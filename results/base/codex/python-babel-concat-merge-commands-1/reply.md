I’ll inspect the existing commands and PO handling, add the two subcommands and conflict support, then run the relevant tests.

Both subcommands are implemented and registered in CLI help. Conflict output includes each source’s translation, and the parser rejects conflict markers when `abort_invalid=True`. I’m checking the command behavior and running the existing catalog, PO, and frontend tests.

Implemented `pybabel concat` and `pybabel merge`, including CLI help registration, conflict storage and PO output, compendium handling, and backups.

Validation: 211 tests passed. Ruff was unavailable in the environment.
