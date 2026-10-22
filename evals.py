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
  evals.py report                                  write results/README.md from every scored run

Setups are in setups.toml. Bulky files (clones, prepared copies, raw agent output) live in ~/.cache/muffle-evals;
results/ keeps what a reader needs: the diff, the reply and the score of each run.
"""

import collections
import concurrent.futures
import glob
import json
import os
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


def run_agent(setup_flags, agent, task, work, raw, config, env):
    """Run ``agent`` on the task in ``work`` with muffle set up by ``setup_flags`` (none: no muffle) and return its
    exit code."""
    config.mkdir(parents=True)
    if agent == "claude":
        credentials = max(Path.home().glob(".local/share/pandemonium-nightly/accounts/claude-code/*/.credentials.json"),
                          key=lambda path: path.stat().st_mtime)
        shutil.copy(credentials, config / ".credentials.json")
        env["CLAUDE_CONFIG_DIR"] = str(config)
        command = [str(CLAUDE), "-p", task["prompt"], "--model", CLAUDE_MODEL, "--permission-mode",
                   "bypassPermissions", "--output-format", "stream-json", "--verbose", "--strict-mcp-config"]
        secret = config / ".credentials.json"
    else:
        shutil.copy(Path.home() / ".codex" / "auth.json", config / "auth.json")
        (config / "config.toml").write_text(f'model = "{CODEX_MODEL}"\nmodel_reasoning_effort = "low"\n\n'
                                            f'[projects."{work}"]\ntrust_level = "trusted"\n')
        env["CODEX_HOME"] = str(config)
        command = [str(CODEX), "exec", "--json", "--skip-git-repo-check",
                   "--dangerously-bypass-approvals-and-sandbox", task["prompt"]]
        secret = config / "auth.json"
    if setup_flags is not None:
        subprocess.run([str(MUFFLE), "init", "--agent", agent, *setup_flags], env=env, check=True,
                       capture_output=True)
    try:
        with open(raw / "out.jsonl", "w") as out, open(raw / "err", "w") as err:
            return subprocess.run(command, cwd=work, env=env, stdout=out, stderr=err, stdin=subprocess.DEVNULL,
                                  timeout=AGENT_TIMEOUT).returncode
    except subprocess.TimeoutExpired:
        return 124
    finally:
        secret.unlink(missing_ok=True)


def run(setup, agent, task, n):
    """Run ``agent`` once on ``task`` in ``setup`` and write its diff, reply and score to results/."""
    setups = tomllib.loads((ROOT / "setups.toml").read_text())
    flags = setups[setup]["init"] if "init" in setups[setup] else None
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
    exit_code = run_agent(flags, agent, task, work, raw, raw / "config", env)
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
        "task": task["id"], "setup": setup, "agent": agent, "run": n,
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
    (result / "reply.md").write_text(reply + "\n")
    (result / "score.json").write_text(json.dumps(score, indent=2) + "\n")
    shutil.copy(raw / "test.log", result / "test.log")
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


def parse(agent, path):
    """Return the token and byte counts and the reply text of one run's raw output."""
    m = collections.Counter()
    reply = []
    for e in events(path):
        kind = e.get("type")
        if agent == "claude":
            content = (e.get("message") or {}).get("content")
            if kind in ("assistant", "user") and isinstance(content, list):
                for block in content:
                    if block.get("type") == "tool_result":
                        m["tool_bytes"] += len(text_of(block.get("content")).encode())
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
    return dict(m), "\n\n".join(reply)


def matrix(setups, agents, runs, tasks):
    """Run every combination that has no score yet, four at a time."""
    jobs = [(s, a, t, n) for n in range(1, runs + 1) for t in tasks for s in setups for a in agents
            if not (ROOT / "results" / s / a / f"{t}-{n}" / "score.json").exists()]
    print(f"{len(jobs)} runs to do", flush=True)
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        futures = [pool.submit(run, s, a, load_task(t), n) for s, a, t, n in jobs]
        for future in concurrent.futures.as_completed(futures):
            if future.exception():
                print(f"run failed: {future.exception()!r}", flush=True)


def report():
    """Write results/README.md: per agent, each setup's pass rate and mean costs, against the base setup."""
    scores = [json.loads(Path(path).read_text()) for path in glob.glob(str(ROOT / "results/*/*/*/score.json"))]
    scores = [s for s in scores if not s.get("error")]
    fields = ("cost_usd", "input_uncached", "input_cached", "output", "tool_bytes", "reply_words", "lines_added",
              "lines_removed", "lint_new", "seconds")
    lines = ["# Results", "", "Means per run over the tasks every setup of the agent ran. Runs the agent's API failed "
             "are left out.", ""]
    for agent in sorted({s["agent"] for s in scores}):
        mine = [s for s in scores if s["agent"] == agent]
        setups = sorted({s["setup"] for s in mine}, key=lambda name: (name != "base", name))
        shared = set.intersection(*({s["task"] for s in mine if s["setup"] == setup} for setup in setups))
        lines += [f"## {agent}", "", "| setup | passed | " + " | ".join(fields) + " |",
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
    (ROOT / "results" / "README.md").write_text("\n".join(lines))
    print("\n".join(lines))


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
    elif command == "report":
        report()
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
