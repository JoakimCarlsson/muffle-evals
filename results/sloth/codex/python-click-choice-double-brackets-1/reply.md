I’ll check how argument metavars are formatted, fix the shared cause, then run the existing tests.

The extra brackets come from `Argument.make_metavar`, which wraps the already bracketed type metavar. I’ll make that shared formatter skip wrapping when brackets are present. This also covers argument error hints; required arguments, options, and explicit metavars keep their current behavior. No changes are needed to fixtures, config, or exports.

Fixed the shared argument metavar formatter to avoid adding brackets when they’re already present. Optional `Choice` and `DateTime` arguments now display a single pair, including with `nargs=-1`.

Validation: 1,656 tests passed, and the wheel built successfully.
