Optional `Choice` and `DateTime` arguments no longer show double brackets in the usage line. Both of your cases (`nargs=-1` and `required=False`) now render as `[foo|bar]...` and `[%Y]`.

The cause was in `Argument.make_metavar` in `src/click/core.py`. These types already put their own brackets around the metavar, and the argument code then wrapped any optional argument in brackets again. It now skips the extra pair when the metavar is already bracketed.

I ran a small command with a `Choice` argument and an optional `DateTime` argument, and `--help` gave `Usage: -c [OPTIONS] [foo|bar]... [%Y]`. The existing test suite passes (1656 passed, 24 skipped, 1 xfailed). I didn't add a new test, since you didn't ask for one.

I also added a line to `CHANGES.md` under 8.4.2. Nothing is committed.

That notification is about the first attempt, which hung because of a stray `cat > /dev/null` I'd left in the command, and it has now been stopped. I don't need to restart it. I re-ran the edit check, the `--help` check and the test suite as separate commands, and they all finished.

The fix is in place and tests pass, as I reported. Nothing is committed.
