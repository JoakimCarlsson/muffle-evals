I’ll check the existing command and PO handling, add both subcommands, and run the relevant tests.

The existing catalog and PO writer support most of what’s needed. I’ll store conflict translations separately so the writer can emit them without losing the originals, and use `Catalog.update` for merge behavior.

Both commands are implemented, and the initial 216 relevant tests pass. The new tests cover singular and plural conflicts, filtering, compendium replacement, and backups. I’ll now check CLI registration, stdout output, formatting options, and fuzzy matching.

Implemented `pybabel concat` and `merge`, including help registration, conflict tracking and output, strict conflict parsing, compendiums, backups, and formatting options.

Validation: byte-compilation succeeded; 220 relevant tests passed.

Left out unrequested GNU gettext options. The full project suite was not run.
