# Writing a task

A task is a bug that was fixed upstream in an open-source project, in `tasks/<id>/`, where `<id>` is
`<language>-<project>-<short-slug>`, such as `rust-ripgrep-glob-case`.

## Choosing the fix

- A merged pull request or commit that fixes a bug a user reported, in a maintained project with real users.
- Fixed in 2025 or 2026, so that the models are less likely to have seen the fix.
- The fix changes 1 to 4 non-test files, about 5 to 100 lines, and adds or changes tests that fail without it.
- The bug can be understood from a report alone: no design discussion, no new public API the tests depend on by a
  name the report cannot guess.
- The project builds offline after `setup`, and `test` takes under 3 minutes once set up.

## Feature tasks

A task with `kind = "feature"` in `task.toml` is a small feature added upstream instead of a bug fix: a new option,
function or behaviour that an agent could build small or big. They measure how much code each setup writes when it
picks the scope itself.

- The upstream change adds about 15 to 150 lines of non-test code, with tests for it.
- `prompt.md` is a feature request as a user would write it. It names every public name, argument and return shape
  the hidden tests use, since the agent cannot guess them, but never how to build it.
- Prefer features with room to over-build: where a plain version is enough but a configurable or abstracted one is
  tempting.

## Files

`task.toml`:

```toml
language = "rust"                         # rust, python, typescript or go
kind = "bug"                              # bug (the default) or feature
repo = "https://github.com/owner/name"
base = "<full sha of the parent of the fix>"
fix = "<full sha of the fix>"
source = "https://github.com/owner/name/pull/123"
tests = ["tests/foo.rs"]                  # every test file the fix added or changed, taken from `fix` at scoring
setup = "cargo fetch && cargo test --no-run -q"   # runs once in the project; network allowed
test = "cargo test -q --test foo"         # exit 0 = pass; runs the hidden tests and the tests next to them
lint = "cargo clippy -q --all-targets --message-format short 2>&1 | grep ': warning'"  # optional, one line per warning
exclude = "target/"                       # optional, .git/info/exclude lines for build output
```

`prompt.md`: the bug report as a user would write it, from the issue: what they did, what they expected, what
happened. No test names, no hint at the fix beyond what the issue says. End with what a real user would ask for:
"Please fix this." The agent decides itself whether to write tests.

## Environments

- Python: `setup` creates the environment at `$EVAL_ENV` (`uv venv "$EVAL_ENV"` then `uv pip install ...`) with the
  project's dependencies but never the project itself in editable mode, since the project is copied for each run;
  `test` makes the project importable with `PYTHONPATH=src` or similar. `$EVAL_ENV/bin` is on `PATH` for the agent.
- Node and Bun: `setup` installs into the project's own `node_modules` (`npm ci`, `bun install`).
- Go: modules go to a shared cache; `setup` is `go mod download && go test -count=1 -run XXX ./...`.
- Rust: `setup` builds the tests once so each run's copy starts warm; `exclude = "target/"`.

## Checking

```sh
./evals.py prepare <id>   # clone, check out base without history, run setup
./evals.py verify <id>    # hidden tests must fail without the fix and pass with it
```
