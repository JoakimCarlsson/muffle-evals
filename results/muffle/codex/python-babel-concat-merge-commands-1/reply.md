I’ll check the existing command and PO handling patterns, implement both subcommands, and run focused tests.

Both commands are implemented, and the 206 existing catalog, PO, and frontend tests pass. I’ll add focused tests for conflicts, count filtering, compendium replacement, and backups to check the new behavior.

Implemented `pybabel concat` and `pybabel merge`, registered in CLI help.

Added conflict storage and PO output, strict conflict-marker rejection, compendium support, backups, and option validation.

Validation: 214 tests passed; `git diff --check` passed.
