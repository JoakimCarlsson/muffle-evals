Done. `src/_parser.ts` now applies defaults after alias propagation, so `--foo-bar one` gives `fooBar: "one"` and `"foo-bar": "one"`. All 63 tests pass. I checked the fix with a throwaway test and removed it, so there is no regression test.

Background command was stopped at its time limit (it hung in watch mode). The fix was already applied and verified by the later non-watch run: 63 tests pass. Nothing needs restarting.
