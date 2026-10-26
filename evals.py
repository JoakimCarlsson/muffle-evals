#!/usr/bin/env python3
"""Run coding agents on real bug fixes from open-source projects and score the code they write.

Each task under tasks/<id>/ is a bug that was fixed upstream: task.toml pins the project at the commit before the fix
and names the tests the fix added, and prompt.md is the bug report the agent gets. The agent works on a copy of the
project without its git history; afterwards the fix's test files are put back over the agent's copy and the task's
test command decides pass or fail. Lint warnings and the size of the change are scored next to it.

usage:
  evals.py prepare <task>...                       clone and set up each task once (network allowed)
  evals.py verify <task>...                        check that the hidden tests fail before the fix and pass after
  evals.py run <setup> <agent> <task> <n>          one run: the agent works, then it is scored
  evals.py matrix <setups> <agents> <runs> [tasks] every missing run, 4 at a time; lists are comma separated
  evals.py files                                   write the changed files of older runs and each task's upstream files
  evals.py report                                  write results/README.md from every scored run
  evals.py commands [task]...                      write commands/: typical command output with and without muffle

Setups are in setups.toml. Bulky files (clones, prepared copies, raw agent output) live in ~/.cache/muffle-evals;
results/ keeps what a reader needs: the diff, the reply and the score of each run.
"""

import collections
import concurrent.futures
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import time
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CACHE = Path(os.environ.get("EVALS_CACHE", Path.home() / ".cache" / "muffle-evals"))
MUFFLE = Path(os.environ.get("MUFFLE_BIN", Path.home() / "Documents/repos/muffle/build/release/muffle"))
CODEX = Path.home() / ".codex/packages/app-server-daemon/releases/0.163.0-x86_64-unknown-linux-musl/bin/codex"
CLAUDE = Path.home() / ".local/bin/claude"
CLAUDE_MODEL = "sonnet"
CODEX_MODEL = "gpt-6.1-sol"
AGENT_TIMEOUT = 1800
TEST_TIMEOUT = 900


def load_task(task_id):
    """Return the task.toml of ``task_id`` with its prompt and id added."""
    directory = ROOT / "tasks" / task_id
    task = tomllib.loads((directory / "task.toml").read_text())
    task["id"] = task_id
    task["prompt"] = (directory / "prompt.md").read_text().strip()
    return task


def sh(command, cwd, env, timeout=TEST_TIMEOUT, log=None):
    """Run the shell ``command`` in ``cwd`` and return its exit code, writing its output to ``log`` when given."""
    output = open(log, "w") if log else subprocess.DEVNULL
    try:
        return subprocess.run(["bash", "-c", command], cwd=cwd, env=env, stdout=output, stderr=subprocess.STDOUT,
                              stdin=subprocess.DEVNULL, timeout=timeout).returncode
    except subprocess.TimeoutExpired:
        return 124
    finally:
        if log:
            output.close()


def git(*args, cwd=None, check=True):
    """Return the output of ``git args`` in ``cwd``."""
    return subprocess.run(["git", *args], cwd=cwd, check=check, capture_output=True, text=True).stdout


def mirror(task):
    """Return the bare clone of the task's repository in the cache, cloning or fetching it as needed."""
    path = CACHE / "repos" / (task["repo"].rstrip("/").split("github.com/")[-1].replace("/", "__") + ".git")
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        git("clone", "--bare", "--filter=blob:none", task["repo"], str(path))
    for commit in (task["base"], task["fix"]):
        if subprocess.run(["git", "cat-file", "-e", commit + "^{commit}"], cwd=path).returncode:
            git("fetch", "origin", commit, cwd=path)
    return path


def task_env(task, extra=None):
    """Return the environment the task's commands run in: its Python env, shared Go and Cargo caches."""
    env = {key: value for key, value in os.environ.items()
           if not key.startswith(("CLAUDE", "ANTHROPIC", "CODEX", "OPENAI", "MUFFLE", "VIRTUAL_ENV"))}
    python_env = CACHE / "envs" / task["id"]
    env.update({
        "EVAL_ENV": str(python_env),
        "PATH": f"{python_env}/bin:{Path.home()}/.cargo/bin:/usr/local/go/bin:{Path.home()}/go/bin:"
                f"{Path.home()}/.bun/bin:{Path.home()}/.local/bin:/usr/local/bin:/usr/bin:/bin",
        "GOMODCACHE": str(CACHE / "go" / "mod"),
        "GOFLAGS": "-modcacherw",
        "PYTHONDONTWRITEBYTECODE": "1",
    })
    if python_env.exists():
        env["VIRTUAL_ENV"] = str(python_env)
    env.update(extra or {})
    return env


def prepared(task):
    """Return the directory holding the task's project at its base commit, set up and without git history."""
    return CACHE / "prepared" / task["id"]


def prepare(task):
    """Write the task's project at its base commit into the cache as a fresh one-commit repository and set it up."""
    repo = mirror(task)
    target = prepared(task)
    shutil.rmtree(target, ignore_errors=True)
    shutil.rmtree(CACHE / "envs" / task["id"], ignore_errors=True)
    target.mkdir(parents=True)
    archive = subprocess.run(["git", "archive", task["base"]], cwd=repo, check=True, capture_output=True).stdout
    subprocess.run(["tar", "x"], cwd=target, input=archive, check=True)
    for name in ("CLAUDE.md", "AGENTS.md", ".claude", ".codex", ".cursor", ".github/copilot-instructions.md"):
        if task.get("keep_agent_files"):
            break
        path = target / name
        shutil.rmtree(path) if path.is_dir() else path.unlink(missing_ok=True)
    env = task_env(task, {"GOCACHE": str(CACHE / "go" / "build"), "TMPDIR": str(CACHE / "tmp")})
    (CACHE / "tmp").mkdir(parents=True, exist_ok=True)
    code = sh(task.get("setup", "true"), target, env, timeout=3600, log=CACHE / "prepared" / f"{task['id']}.setup.log")
    if code:
        sys.exit(f"{task['id']}: setup failed ({code}), see {CACHE}/prepared/{task['id']}.setup.log")
    lint = task.get("lint")
    if lint:
        sh(lint, target, env, log=target.parent / f"{task['id']}.lint-base")
    git("init", "-q", cwd=target)
    (target / ".git" / "info" / "exclude").write_text(task.get("exclude", "") + "\n")
    git("add", "-A", cwd=target)
    git("-c", "user.name=evals", "-c", "user.email=evals@localhost", "commit", "-qm", "base", "--no-verify", cwd=target)
    print(f"{task['id']}: prepared in {target}")


def copy_project(task, work):
    """Copy the task's prepared project to ``work``."""
    shutil.rmtree(work, ignore_errors=True)
    work.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["cp", "-a", str(prepared(task)), str(work)], check=True)


def put_hidden_tests(task, work):
    """Write the fix's version of each of the task's test files over ``work``."""
    repo = mirror(task)
    for path in task["tests"]:
        content = subprocess.run(["git", "show", f"{task['fix']}:{path}"], cwd=repo, check=True,
                                 capture_output=True).stdout
        (work / path).parent.mkdir(parents=True, exist_ok=True)
        (work / path).write_bytes(content)


def is_test_file(path):
    """Return whether ``path`` is a test file by the naming conventions of the task languages."""
    name = path.rsplit("/", 1)[-1]
    in_test_dir = any(part in ("test", "tests", "__tests__", "testdata") for part in path.split("/")[:-1])
    return (in_test_dir or name.endswith("_test.go") or name.startswith("test_") or name.endswith("_test.py")
            or ".test." in name or ".spec." in name or name == "conftest.py")


def drop_agent_tests(work, start_tree, end_tree):
    """Undo the agent's changes to test files in ``work``, so that only its code meets the hidden tests.

    Tests the agent wrote can clash with the hidden ones, such as a Go test function of the same name, and are not
    what is scored.
    """
    changes = git("diff", "--name-status", "--no-renames", start_tree, end_tree, cwd=work)
    for status, path in (line.split("\t", 1) for line in changes.splitlines()):
        if not is_test_file(path):
            continue
        if status == "A":
            (work / path).unlink(missing_ok=True)
        else:
            content = subprocess.run(["git", "cat-file", "blob", f"{start_tree}:{path}"], cwd=work,
                                     capture_output=True, check=True).stdout
            (work / path).parent.mkdir(parents=True, exist_ok=True)
            (work / path).write_bytes(content)


def save_changed_files(source, start_tree, end_tree, target):
    """Copy every file that differs between ``start_tree`` and ``end_tree`` of the repository ``source``, as it is in
    ``end_tree``, to the same path under ``target``."""
    changed = git("diff", "--name-only", "--no-renames", "--diff-filter=d", start_tree, end_tree, cwd=source)
    for path in changed.splitlines():
        content = subprocess.run(["git", "cat-file", "blob", f"{end_tree}:{path}"], cwd=source, capture_output=True,
                                 check=True).stdout
        (target / path).parent.mkdir(parents=True, exist_ok=True)
        (target / path).write_bytes(content)


def reference_patch(task):
    """Return the fix's diff without its test files."""
    excludes = [f":(exclude){path}" for path in task["tests"]]
    return git("diff", task["base"], task["fix"], "--", ".", *excludes, cwd=mirror(task))


def count_lines(path):
    """Return the number of non-empty lines in ``path``, or 0 when it is missing."""
    try:
        return sum(1 for line in open(path, errors="replace") if line.strip())
    except FileNotFoundError:
        return 0


def verify(task):
    """Check that the task's test command fails with the hidden tests alone and passes with the reference fix."""
    work = CACHE / "verify" / task["id"]
    env = task_env(task, {"GOCACHE": str(CACHE / "go" / "build"), "TMPDIR": str(CACHE / "tmp")})
    (CACHE / "tmp").mkdir(parents=True, exist_ok=True)
    results = {}
    for label, with_fix in (("without fix", False), ("with fix", True)):
        copy_project(task, work)
        if with_fix:
            subprocess.run(["git", "apply", "-"], cwd=work, input=reference_patch(task), text=True, check=True)
        put_hidden_tests(task, work)
        started = time.time()
        results[label] = sh(task["test"], work, env, log=CACHE / "verify" / f"{task['id']}.{label.replace(' ', '-')}.log")
        print(f"{task['id']}: {label}: exit {results[label]} in {time.time() - started:.0f}s")
    shutil.rmtree(work, ignore_errors=True)
    ok = results["without fix"] != 0 and results["with fix"] == 0
    print(f"{task['id']}: {'OK' if ok else 'BROKEN'}")
    return ok


def snapshot(work):
    """Return the tree id of everything in ``work``, untracked files included, without touching its index."""
    index = work / ".git" / "evals-index"
    shutil.copy(work / ".git" / "index", index)
    env = {**os.environ, "GIT_INDEX_FILE": str(index)}
    subprocess.run(["git", "add", "-A"], cwd=work, env=env, capture_output=True)
    tree = subprocess.run(["git", "write-tree"], cwd=work, env=env, capture_output=True, text=True).stdout.strip()
    index.unlink()
    return tree


def run_agent(setup, agent, task, work, raw, config, env):
    """Run ``agent`` on the task in ``work`` as the setup ``setup`` of setups.toml says and return its exit code.

    The setup's ``init`` flags go to ``muffle init`` (no ``init``: no muffle) and its ``claude_args`` to Claude Code.
    """
    config.mkdir(parents=True)
    if agent == "claude":
        shutil.copy(Path.home() / ".claude" / ".credentials.json", config / ".credentials.json")
        env["CLAUDE_CONFIG_DIR"] = str(config)
        command = [str(CLAUDE), "-p", task["prompt"], "--model", CLAUDE_MODEL, "--permission-mode",
                   "bypassPermissions", "--output-format", "stream-json", "--verbose", "--strict-mcp-config",
                   *(os.path.expandvars(os.path.expanduser(arg)) for arg in setup.get("claude_args", []))]
        secret = config / ".credentials.json"
    else:
        shutil.copy(Path.home() / ".codex" / "auth.json", config / "auth.json")
        (config / "config.toml").write_text(f'model = "{CODEX_MODEL}"\nmodel_reasoning_effort = "low"\n\n'
                                            f'[projects."{work}"]\ntrust_level = "trusted"\n')
        env["CODEX_HOME"] = str(config)
        command = [str(CODEX), "exec", "--json", "--skip-git-repo-check",
                   "--dangerously-bypass-approvals-and-sandbox", task["prompt"]]
        secret = config / "auth.json"
    if "init" in setup:
        subprocess.run([str(MUFFLE), "init", "--agent", agent, *setup["init"]], env=env, check=True,
                       capture_output=True)
    try:
        with open(raw / "out.jsonl", "w") as out, open(raw / "err", "w") as err:
            return subprocess.run(command, cwd=work, env=env, stdout=out, stderr=err, stdin=subprocess.DEVNULL,
                                  timeout=AGENT_TIMEOUT).returncode
    except subprocess.TimeoutExpired:
        return 124
    finally:
        secret.unlink(missing_ok=True)


def load_setups():
    """Return the setups of setups.toml by name."""
    return tomllib.loads((ROOT / "setups.toml").read_text())


def run(setup, agent, task, n):
    """Run ``agent`` once on ``task`` in ``setup`` and write its diff, reply and score to results/."""
    name = f"{task['id']}-{n}"
    raw = CACHE / "runs" / setup / agent / name
    result = ROOT / "results" / setup / agent / name
    shutil.rmtree(raw, ignore_errors=True)
    shutil.rmtree(result, ignore_errors=True)
    work, tmp = raw / "work", raw / "tmp"
    copy_project(task, work)
    tmp.mkdir()
    env = task_env(task, {"TMPDIR": str(tmp), "XDG_CACHE_HOME": str(raw / "cache"), "GOCACHE": str(raw / "go"),
                          "GOTMPDIR": str(tmp)})
    start_tree = snapshot(work)
    started = time.time()
    exit_code = run_agent(load_setups()[setup], agent, task, work, raw, raw / "config", env)
    seconds = round(time.time() - started)
    end_tree = snapshot(work)
    diff = git("diff", start_tree, end_tree, cwd=work)
    stat = [line.split("\t", 2) for line in git("diff", "--numstat", "--no-renames", start_tree, end_tree,
                                                 cwd=work).splitlines()]
    code = [(a, r) for a, r, path in stat if a.isdigit() and not is_test_file(path)]
    added, removed = sum(int(a) for a, _ in code), sum(int(r) for _, r in code)
    test_added = sum(int(a) for a, _, path in stat if a.isdigit() and is_test_file(path))
    lint_base = count_lines(prepared(task).parent / f"{task['id']}.lint-base") if task.get("lint") else None
    lint_after = None
    if task.get("lint"):
        sh(task["lint"], work, env, log=raw / "lint.log")
        lint_after = count_lines(raw / "lint.log")
    drop_agent_tests(work, start_tree, end_tree)
    put_hidden_tests(task, work)
    test_exit = sh(task["test"], work, env, log=raw / "test.log")
    metrics, reply = parse(agent, raw / "out.jsonl")
    if metrics.get("error") and not metrics.get("output"):
        print(f"{setup} {agent} {name}: the agent's API failed, nothing scored; see {raw}/out.jsonl", flush=True)
        return None
    reference = reference_patch(task)
    score = {
        "task": task["id"], "kind": task.get("kind", "bug"), "setup": setup, "agent": agent, "run": n,
        "passed": test_exit == 0, "test_exit": test_exit, "agent_exit": exit_code, "seconds": seconds,
        "lines_added": added, "lines_removed": removed, "test_lines_added": test_added,
        "reference_added": sum(1 for line in reference.splitlines() if line.startswith("+") and not line.startswith("+++")),
        "reference_removed": sum(1 for line in reference.splitlines() if line.startswith("-") and not line.startswith("---")),
        "lint_new": None if lint_after is None else lint_after - lint_base,
        "muffle": subprocess.run([str(MUFFLE), "--version"], capture_output=True, text=True).stdout.strip(),
        **metrics,
    }
    result.mkdir(parents=True)
    (result / "diff.patch").write_text(diff)
    save_changed_files(work, start_tree, end_tree, result / "files")
    (result / "reply.md").write_text(reply + "\n")
    (result / "score.json").write_text(json.dumps(score, indent=2) + "\n")
    shutil.copy(raw / "test.log", result / "test.log")
    shutil.copy(raw / "out.jsonl", result / "transcript.jsonl")
    for path in (work, tmp, raw / "go", raw / "config" / "plugins", raw / "config" / "cache"):
        shutil.rmtree(path, ignore_errors=True)
    print(f"{setup} {agent} {name}: {'pass' if score['passed'] else 'FAIL'} in {seconds}s, "
          f"+{added}/-{removed}, agent exit {exit_code}", flush=True)
    return score


def events(path):
    """Yield the JSON events of a run's raw output, skipping lines that are not JSON."""
    try:
        lines = open(path, errors="replace").read().splitlines()
    except FileNotFoundError:
        return
    for line in lines:
        try:
            yield json.loads(line)
        except json.JSONDecodeError:
            continue


def text_of(content):
    """Return the text of a tool result content, which is a string or a list of blocks."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(block.get("text", "") for block in content if isinstance(block, dict))
    return ""


SUBCOMMAND_PROGRAMS = {"git", "cargo", "npm", "pnpm", "yarn", "bun", "go", "docker", "gh", "uv", "pip", "poetry", "npx"}


def command_key(command):
    """Return the program of the shell ``command``, with its subcommand for programs that have them."""
    words = command.split()
    while words and ("=" in words[0] or words[0] in ("cd", "&&", "env", "time")):
        words = words[words.index("&&") + 1:] if "&&" in words else words[1:]
    if not words:
        return ""
    if words[0] in SUBCOMMAND_PROGRAMS and len(words) > 1 and not words[1].startswith("-"):
        return " ".join(words[:2])
    return words[0]


def add_command(commands, command, shown):
    """Count one run of ``command`` and the bytes and lossy marker of its output ``shown`` in ``commands``."""
    entry = commands.setdefault(command_key(command), {"calls": 0, "bytes": 0, "lossy": 0})
    entry["calls"] += 1
    entry["bytes"] += len(shown.encode())
    entry["lossy"] += "[raw:" in shown


def parse(agent, path):
    """Return the token and byte counts and the reply text of one run's raw output."""
    m = collections.Counter()
    reply = []
    turn_ids = set()
    commands = {}
    calls = {}
    for e in events(path):
        kind = e.get("type")
        if agent == "claude":
            message = e.get("message") or {}
            content = message.get("content")
            if kind == "assistant" and message.get("id") not in turn_ids:
                turn_ids.add(message.get("id"))
                m["turns"] += 1
            if kind in ("assistant", "user") and isinstance(content, list):
                for block in content:
                    if block.get("type") == "tool_use":
                        m["tool_calls"] += 1
                        if block.get("name") == "Bash":
                            calls[block.get("id")] = (block.get("input") or {}).get("command", "")
                    elif block.get("type") == "tool_result":
                        shown = text_of(block.get("content"))
                        m["tool_bytes"] += len(shown.encode())
                        m["raw_reads"] += "[raw:" in shown
                        if block.get("tool_use_id") in calls:
                            add_command(commands, calls[block["tool_use_id"]], shown)
                    elif block.get("type") == "text" and kind == "assistant":
                        reply.append(block["text"])
            if kind == "result":
                m["cost_usd"] += e.get("total_cost_usd") or 0
                m["error"] = int(bool(e.get("is_error")))
                for usage in (e.get("modelUsage") or {}).values():
                    m["input_uncached"] += usage.get("inputTokens", 0) + usage.get("cacheCreationInputTokens", 0)
                    m["input_cached"] += usage.get("cacheReadInputTokens", 0)
                    m["output"] += usage.get("outputTokens", 0)
        else:
            item = e.get("item") or {}
            if kind == "item.completed":
                if item.get("type") == "command_execution":
                    m["tool_calls"] += 1
                    m["raw_reads"] += "[raw:" in (item.get("aggregated_output") or "")
                    add_command(commands, item.get("command") or "", item.get("aggregated_output") or "")
                    m["tool_bytes"] += len((item.get("aggregated_output") or "").encode())
                elif item.get("type") == "agent_message":
                    reply.append(item.get("text", ""))
            if kind in ("turn.failed", "error"):
                m["error"] = 1
            if kind == "turn.completed":
                u = e.get("usage") or {}
                cached = u.get("cached_input_tokens", 0)
                m["input_uncached"] += max(u.get("input_tokens", 0) - cached, 0)
                m["input_cached"] += cached
                m["output"] += u.get("output_tokens", 0)
    m["reply_words"] = sum(len(text.split()) for text in reply)
    return {**m, "commands": commands}, "\n\n".join(reply)


def matrix(setups, agents, runs, tasks):
    """Run every combination that has no score yet, four at a time."""
    known = load_setups()
    jobs = [(s, a, t, n) for n in range(1, runs + 1) for t in tasks for s in setups for a in agents
            if a in known[s].get("agents", ("claude", "codex"))
            and not (ROOT / "results" / s / a / f"{t}-{n}" / "score.json").exists()]
    print(f"{len(jobs)} runs to do", flush=True)
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        futures = [pool.submit(run, s, a, load_task(t), n) for s, a, t, n in jobs]
        for future in concurrent.futures.as_completed(futures):
            if future.exception():
                print(f"run failed: {future.exception()!r}", flush=True)


def write_commands_report(scores):
    """Write results/commands.md: the shell commands the agents ran, by output bytes, to show which need a filter."""
    totals = collections.defaultdict(lambda: {"calls": 0, "bytes": 0, "lossy": 0})
    for score in scores:
        for key, entry in (score.get("commands") or {}).items():
            for field, value in entry.items():
                totals[key][field] += value
    lines = ["# Commands", "", "Shell commands the agents ran, over every scored run, by bytes of output they were shown "
             "(after muffle, where it ran). Lossy is the number of outputs that ended in a `[raw:]` line.", "",
             "| command | calls | bytes shown | mean bytes | lossy |", "|---|---:|---:|---:|---:|"]
    for key, t in sorted(totals.items(), key=lambda item: -item[1]["bytes"])[:60]:
        lines.append(f"| `{key}` | {t['calls']:,} | {t['bytes']:,} | {t['bytes'] // t['calls']:,} | {t['lossy']:,} |")
    (ROOT / "results" / "commands.md").write_text("\n".join(lines) + "\n")


def report():
    """Write results/README.md: per agent, each setup's pass rate and mean costs, against the base setup."""
    scores = [json.loads(Path(path).read_text()) for path in glob.glob(str(ROOT / "results/*/*/*/score.json"))]
    scores = [s for s in scores if not s.get("error")]
    fields = ("cost_usd", "turns", "tool_calls", "raw_reads", "input_uncached", "input_cached", "output", "tool_bytes", "reply_words", "lines_added",
              "lines_removed", "lint_new", "seconds")
    lines = ["# Results", "", "Means per run over the tasks every setup of the agent ran. Runs the agent's API failed "
             "are left out.", ""]
    sections = sorted({(s.get("kind", "bug"), s["agent"]) for s in scores})
    for kind, agent in sections:
        mine = [s for s in scores if s["agent"] == agent and s.get("kind", "bug") == kind]
        setups = sorted({s["setup"] for s in mine}, key=lambda name: (name != "base", name))
        shared = set.intersection(*({s["task"] for s in mine if s["setup"] == setup} for setup in setups))
        lines += [f"## {agent}, {kind} tasks", "", "| setup | passed | " + " | ".join(fields) + " |",
                  "|---|---:|" + "---:|" * len(fields)]
        base = None
        for setup in setups:
            runs = [s for s in mine if s["setup"] == setup and s["task"] in shared]
            means = {f: sum(s.get(f) or 0 for s in runs) / len(runs) for f in fields}
            base = base or means
            cells = [f"{means[f]:.3f}" if f == "cost_usd" else f"{means[f]:,.0f}" for f in fields]
            if setup != "base":
                cells = [c + (f" ({100 * (means[f] / base[f] - 1):+.0f}%)" if base[f] else "") for c, f in
                         zip(cells, fields)]
            lines.append(f"| {setup} | {sum(s['passed'] for s in runs)}/{len(runs)} | " + " | ".join(cells) + " |")
        lines += ["", "| task | " + " | ".join(setups) + " |", "|---|" + "---:|" * len(setups)]
        for task in sorted(shared):
            row = [f"{sum(s['passed'] for s in mine if s['task'] == task and s['setup'] == setup)}/"
                   f"{sum(1 for s in mine if s['task'] == task and s['setup'] == setup)}" for setup in setups]
            lines.append(f"| {task} | " + " | ".join(row) + " |")
        lines.append("")
    write_commands_report(scores)
    lines += ["## Per task", "", "Each page shows the bug report, the upstream change and every agent's diff:", ""]
    for task_id in sorted({s["task"] for s in scores}):
        write_task_page(task_id, [s for s in scores if s["task"] == task_id])
        lines.append(f"- [{task_id}](tasks/{task_id}.md)")
    (ROOT / "results" / "README.md").write_text("\n".join(lines) + "\n")
    print("\n".join(lines))


def write_task_page(task_id, scores):
    """Write results/tasks/<task_id>.md: the prompt, the upstream change, then each run's diff with its score."""
    task = load_task(task_id)
    order = ("base", "muffle", "hush", "sloth", "all")
    scores = sorted(scores, key=lambda s: (s["agent"], order.index(s["setup"]) if s["setup"] in order else 99, s["run"]))
    lines = [f"# {task_id}", "", f"Source: {task['source']}", "", "## Prompt", "", *(f"> {line}" for line in
             task["prompt"].splitlines()), "", "## Upstream change (tests left out)", "",
             "Files: " + ", ".join(f"[{path}](../../tasks/{task_id}/upstream/{path})" for path in
                                   sorted(p.relative_to(ROOT / "tasks" / task_id / "upstream") for p in
                                          (ROOT / "tasks" / task_id / "upstream").rglob("*") if p.is_file())), "",
             "```diff",
             reference_patch(task).rstrip(), "```", "", "## Runs", "",
             "| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |",
             "|---|---|---|---:|---:|---:|---:|"]
    for s in scores:
        lines.append(f"| {s['agent']} | {s['setup']} | {'pass' if s['passed'] else '**FAIL**'} | "
                     f"+{s['lines_added']}/-{s['lines_removed']} | {s.get('test_lines_added', 0)} | "
                     f"{s.get('output', 0):,} | {'$%.3f' % s['cost_usd'] if s.get('cost_usd') else '-'} |")
    for s in scores:
        run_dir = ROOT / "results" / s["setup"] / s["agent"] / f"{task_id}-{s['run']}"
        diff = (run_dir / "diff.patch").read_text().rstrip()
        files = sorted(path.relative_to(run_dir / "files") for path in (run_dir / "files").rglob("*") if path.is_file())
        lines += ["", f"### {s['agent']}, {s['setup']}: {'pass' if s['passed'] else 'FAIL'}", "",
                  "Files: " + (", ".join(f"[{path}](../{s['setup']}/{s['agent']}/{task_id}-{s['run']}/files/{path})"
                                         for path in files) or "none"), "",
                  "<details><summary>diff</summary>", "", "```diff", diff or "(no changes)", "```", "", "</details>",
                  "", "<details><summary>reply</summary>", "", (run_dir / "reply.md").read_text().strip(), "",
                  "</details>"]
    page = ROOT / "results" / "tasks" / f"{task_id}.md"
    page.parent.mkdir(parents=True, exist_ok=True)
    page.write_text("\n".join(lines) + "\n")


def backfill_files():
    """Write the changed files of every scored run that has none yet, and each task's upstream files, from the diffs.

    Each run's diff is applied to a fresh copy of the prepared project in a scratch repository, whose start and end
    trees then give the files the same way a run does.
    """
    scratch = CACHE / "files-scratch"
    for task_dir in sorted((ROOT / "tasks").iterdir()):
        task = load_task(task_dir.name)
        upstream = task_dir / "upstream"
        if not upstream.exists():
            save_changed_files(mirror(task), task["base"], task["fix"], upstream)
        for run_dir in sorted(glob.glob(str(ROOT / "results" / "*" / "*" / f"{task['id']}-*"))):
            run_dir = Path(run_dir)
            if (run_dir / "files").exists() or not (run_dir / "score.json").exists():
                continue
            diff = (run_dir / "diff.patch").read_text()
            if not diff.strip():
                continue
            shutil.rmtree(scratch, ignore_errors=True)
            scratch.mkdir(parents=True)
            git("init", "-q", cwd=scratch)
            archive = subprocess.run(["git", "archive", "HEAD"], cwd=prepared(task), check=True,
                                     capture_output=True).stdout
            subprocess.run(["tar", "x"], cwd=scratch, input=archive, check=True)
            start_tree = snapshot_fresh(scratch)
            applied = subprocess.run(["git", "apply", "--binary", "-"], cwd=scratch, input=diff, text=True,
                                     capture_output=True)
            if applied.returncode:
                print(f"{run_dir}: diff does not apply: {applied.stderr.strip()}")
                continue
            save_changed_files(scratch, start_tree, snapshot_fresh(scratch), run_dir / "files")
    shutil.rmtree(scratch, ignore_errors=True)


def snapshot_fresh(work):
    """Return the tree id of everything in the repository ``work``, staging it all."""
    git("add", "-A", "-f", cwd=work)
    return git("write-tree", cwd=work).strip()


LANGUAGE_COMMANDS = {
    "rust": ["cargo build 2>&1", "cargo check 2>&1", "cargo test 2>&1", "cargo clippy --all-targets 2>&1"],
    "go": ["go build ./... 2>&1", "go test ./... 2>&1", "go vet ./... 2>&1"],
    "python": ["uvx ruff check . 2>&1", "uvx mypy . 2>&1"],
    "typescript": ["npx tsc --noEmit 2>&1"],
}
EXTENSIONS = {"rust": "rs", "go": "go", "python": "py", "typescript": "ts"}


def task_commands(task):
    """Return the shell commands an agent typically runs on the task, as (label, command, state) triples.

    The commands are written the way agents write them: builds and tests with ``2>&1``, and ``grep`` for two names
    from the prompt longer than three letters at once with a quoted ``\\|`` pattern. The state is ``failing`` (the
    hidden tests added, no fix) or ``fixed`` (the upstream change applied, uncommitted).
    """
    language = task["language"]
    idents = [name for name in dict.fromkeys(re.findall(r"`([A-Za-z_][A-Za-z0-9_]*)", task["prompt"]))
              if len(name) > 3][:2]
    source = max((path for path in task_dir_files(task) if path.endswith("." + EXTENSIONS[language])),
                 key=lambda path: (prepared(task) / path).stat().st_size if (prepared(task) / path).exists() else 0,
                 default=None)
    commands = [("task tests", f"{task['test']} 2>&1", "failing")]
    commands += [(command, command, "failing") for command in LANGUAGE_COMMANDS[language]]
    commands += [("git status", "git status", "fixed"), ("git diff", "git diff", "fixed"),
                 ("git diff --stat", "git diff --stat", "fixed"), ("git log", "git log -20", "failing"),
                 ("git show", "git show HEAD", "failing"), ("git branch", "git branch -a", "failing"),
                 ("ls -la", "ls -la", "failing"),
                 ("find", f"find . -name '*.{EXTENSIONS[language]}' -not -path './node_modules/*' "
                          "-not -path './target/*'", "failing")]
    if idents:
        pattern = "\\|".join(idents)
        commands.append((f'grep -rn "{pattern}"', f'grep -rn "{pattern}" --exclude-dir=node_modules '
                                                  "--exclude-dir=target --exclude-dir=.git .", "failing"))
    if source and (prepared(task) / source).exists():
        commands.append((f"git blame {source}", f"git blame {source}", "failing"))
        commands.append((f"cat {source}", f"cat {source}", "failing"))
    return commands


def task_dir_files(task):
    """Return the non-test files the task's upstream change touches."""
    return [path for path in git("diff", "--name-only", task["base"], task["fix"], cwd=mirror(task)).splitlines()
            if path not in task["tests"] and not is_test_file(path)]


def muffled(command, env):
    """Return ``command`` as muffle's Claude Code hook rewrites it in a fresh session, or ``None`` when it does not."""
    event = json.dumps({"session_id": f"commands-{time.time_ns()}", "hook_event_name": "PreToolUse",
                        "tool_name": "Bash", "tool_input": {"command": command}})
    answer = subprocess.run([str(MUFFLE), "hook", "claude"], input=event, capture_output=True, text=True,
                            env=env).stdout
    if not answer.strip():
        return None
    return json.loads(answer)["hookSpecificOutput"]["updatedInput"]["command"]


def capture(command, cwd, env):
    """Return the output of the shell ``command`` run in ``cwd``, standard error merged into standard output as an
    agent's shell tool shows it."""
    try:
        return subprocess.run(["bash", "-c", command], cwd=cwd, env=env, stdout=subprocess.PIPE,
                              stderr=subprocess.STDOUT, text=True, errors="replace", stdin=subprocess.DEVNULL,
                              timeout=TEST_TIMEOUT).stdout
    except subprocess.TimeoutExpired as timeout:
        return (timeout.stdout or b"").decode(errors="replace") + "\n[timed out]\n"


def command_examples(task):
    """Run the task's typical commands with and without muffle and write both outputs under commands/<task>/.

    Returns one row per command: label, file stem, raw and muffled byte counts. A command muffle leaves alone counts
    its raw output as muffled and gets no files.
    """
    out_dir = ROOT / "commands" / task["id"]
    shutil.rmtree(out_dir, ignore_errors=True)
    out_dir.mkdir(parents=True)
    scratch = CACHE / "commands"
    cache = scratch / "muffle-cache"
    env = task_env(task, {"GOCACHE": str(CACHE / "go" / "build"), "TMPDIR": str(CACHE / "tmp"),
                          "XDG_CACHE_HOME": str(cache)})
    rows = []
    states = {}
    for state in ("failing", "fixed"):
        work = scratch / f"{task['id']}-{state}"
        copy_project(task, work)
        if state == "fixed":
            subprocess.run(["git", "apply", "-"], cwd=work, input=reference_patch(task), text=True, check=True)
        else:
            put_hidden_tests(task, work)
        states[state] = work
    for number, (label, command, state) in enumerate(task_commands(task), 1):
        rewritten = muffled(command, env)
        raw = capture(command, states[state], env)
        stem = f"{number:02d}-" + re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")[:40]
        if rewritten is None:
            rows.append((label, None, len(raw.encode()), len(raw.encode())))
            print(f"{task['id']}: {label}: {len(raw.encode())} bytes, left alone", flush=True)
            continue
        shown = capture(rewritten, states[state], env)
        shown = shown.replace(str(cache), "~/.cache")
        (out_dir / f"{stem}.raw.txt").write_text(f"$ {command}\n{raw}")
        (out_dir / f"{stem}.muffle.txt").write_text(f"$ {command}\n{shown}")
        rows.append((label, stem, len(raw.encode()), len(shown.encode())))
        print(f"{task['id']}: {label}: {len(raw.encode())} -> {len(shown.encode())} bytes", flush=True)
    for work in states.values():
        shutil.rmtree(work, ignore_errors=True)
    return rows


def commands_report(task_ids):
    """Write commands/<task>/ examples for ``task_ids`` and commands/README.md with every task's rows."""
    rows_file = ROOT / "commands" / "rows.json"
    rows = json.loads(rows_file.read_text()) if rows_file.exists() else {}
    for task_id in task_ids:
        rows[task_id] = command_examples(load_task(task_id))
    rows_file.parent.mkdir(exist_ok=True)
    rows_file.write_text(json.dumps(rows, indent=1) + "\n")
    by_program = collections.defaultdict(lambda: [0, 0, 0])
    lines = ["# Command output, before and after", "",
             "Each task's project was put in two states: failing (the hidden tests added, no fix) and fixed (the "
             "upstream change applied, not committed). In each, the commands an agent typically runs were run once as "
             "they are and once as muffle's hook rewrites them. A command muffle leaves alone counts its raw output "
             "on both sides and has no files; the files of the others hold both outputs.", "", "Tokens are estimated as bytes / 4.", ""]
    for task_id in sorted(rows):
        for label, stem, raw, shown in rows[task_id]:
            total = by_program[label.split()[0] if not label.startswith("task tests") else "task tests"]
            total[0] += 1
            total[1] += raw
            total[2] += shown
    lines += ["## Totals by program", "", "| program | commands | raw bytes | muffle bytes | saved |", "|---|---:|---:|---:|---:|"]
    all_raw = sum(t[1] for t in by_program.values())
    all_shown = sum(t[2] for t in by_program.values())
    for program, (count, raw, shown) in sorted(by_program.items(), key=lambda item: -item[1][1]):
        lines.append(f"| {program} | {count} | {raw:,} | {shown:,} | {100 - 100 * shown // max(raw, 1)}% |")
    lines += [f"| **all** | {sum(t[0] for t in by_program.values())} | {all_raw:,} | {all_shown:,} | "
              f"**{100 - 100 * all_shown // max(all_raw, 1)}%** |", "", "## Every command", "",
              "| task | command | raw | muffle | saved | ~tokens saved |", "|---|---|---:|---:|---:|---:|"]
    for task_id in sorted(rows):
        for label, stem, raw, shown in rows[task_id]:
            link = (f"[{label}]({task_id}/{stem}.raw.txt) → [muffle]({task_id}/{stem}.muffle.txt)" if stem
                    else f"{label} (left alone)")
            lines.append(f"| {task_id} | {link} | "
                         f"{raw:,} | {shown:,} | {100 - 100 * shown // max(raw, 1)}% | {(raw - shown) // 4:,} |")
    (ROOT / "commands" / "README.md").write_text("\n".join(lines) + "\n")


def main():
    """Dispatch the subcommand on the command line."""
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    command, rest = args[0], args[1:]
    if command == "prepare":
        for task_id in rest:
            prepare(load_task(task_id))
    elif command == "verify":
        sys.exit(0 if all([verify(load_task(task_id)) for task_id in rest]) else 1)
    elif command == "run" and len(rest) == 4:
        run(rest[0], rest[1], load_task(rest[2]), int(rest[3]))
    elif command == "matrix" and len(rest) in (3, 4):
        tasks = rest[3].split(",") if len(rest) == 4 else sorted(p.name for p in (ROOT / "tasks").iterdir())
        matrix(rest[0].split(","), rest[1].split(","), int(rest[2]), tasks)
    elif command == "files":
        backfill_files()
    elif command == "report":
        report()
    elif command == "commands":
        commands_report(rest or sorted(p.name for p in (ROOT / "tasks").iterdir()))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
