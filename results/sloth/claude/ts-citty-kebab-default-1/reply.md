You've hit your session limit · resets 11:30am (Europe/Stockholm)

Quick check of the reported case:

`--foo-bar one` now gives `fooBar: "one"` and `"foo-bar": "one"`. With no flag, `fooBar` is still `"two"`.

The cause was in `src/_parser.ts`. Defaults were handed to `node:util`'s `parseArgs`, which filled in `fooBar: "two"` before alias propagation ran. Propagation only copies a value to an alias that is still unset, so `foo-bar: "one"` never replaced the default.

The fix registers options without defaults, resolves aliases, and then applies each default only if the argument is still unset. It then propagates aliases once more so the default reaches every alias name.

- **Checks:** the existing suite passes (63 tests, no type errors). I also ran your exact case in a throwaway test, which passed, and deleted it afterwards. I didn't add a permanent regression test since you didn't ask for one.
- **Tool timeout:** my first test run hit the tool timeout and was killed. The rerun finished fine.
