# Results

Means per run over the tasks every setup of the agent ran. Runs the agent's API failed are left out.

## claude, bug tasks

| setup | passed | cost_usd | input_uncached | input_cached | output | tool_bytes | reply_words | lines_added | lines_removed | lint_new | seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base | 19/20 | 0.106 | 15,260 | 177,368 | 2,744 | 8,369 | 165 | 14 | 4 | 1 | 70 |
| all | 19/20 | 0.081 (-23%) | 13,208 (-13%) | 96,839 (-45%) | 1,895 (-31%) | 8,027 (-4%) | 59 (-64%) | 13 (-11%) | 4 (+3%) | 1 (-12%) | 26 (-63%) |
| hush | 19/20 | 0.079 (-26%) | 12,427 (-19%) | 97,515 (-45%) | 1,941 (-29%) | 8,208 (-2%) | 53 (-68%) | 15 (+2%) | 4 (-1%) | 1 (-12%) | 26 (-63%) |
| muffle | 18/20 | 0.106 (-0%) | 15,021 (-2%) | 132,635 (-25%) | 3,266 (+19%) | 8,892 (+6%) | 169 (+2%) | 17 (+17%) | 4 (-7%) | 1 (-12%) | 139 (+98%) |
| sloth | 18/20 | 0.110 (+4%) | 16,467 (+8%) | 127,718 (-28%) | 3,152 (+15%) | 8,211 (-2%) | 182 (+10%) | 10 (-29%) | 4 (-1%) | 1 (-12%) | 208 (+196%) |

| task | base | all | hush | muffle | sloth |
|---|---:|---:|---:|---:|---:|
| go-chi-allow-duplicates | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| go-decimal-numdigits | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| go-expr-findlast-map | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| go-toml-inline-embed | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| go-yaml-int-map-keys | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-attrs-pre-init-defaults | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-click-choice-double-brackets | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-marshmallow-constant-required | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-more-itertools-value-chain-typeerror | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-tomlkit-aot-dotted-key | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-chrono-iter-days-rev | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 |
| rust-http-headermap-size-hint | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-time-strftime-padding-panic | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-toml-value-datetime | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-url-path-caret | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-citty-kebab-default | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-mlly-generic-export-names | 1/1 | 1/1 | 1/1 | 0/1 | 0/1 |
| ts-remeda-deep-equal-null-proto | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-ufo-base-prefix | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-yaml-flow-key-after-blank | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |

## codex, bug tasks

| setup | passed | cost_usd | input_uncached | input_cached | output | tool_bytes | reply_words | lines_added | lines_removed | lint_new | seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base | 19/20 | 0.000 | 19,397 | 176,102 | 1,662 | 34,052 | 94 | 13 | 4 | 1 | 66 |
| all | 18/20 | 0.000 | 20,592 (+6%) | 131,565 (-25%) | 1,060 (-36%) | 32,560 (-4%) | 22 (-77%) | 9 (-31%) | 4 (-4%) | 1 (+0%) | 48 (-28%) |
| hush | 19/20 | 0.000 | 16,908 (-13%) | 122,931 (-30%) | 1,228 (-26%) | 23,506 (-31%) | 25 (-73%) | 13 (-3%) | 4 (-1%) | 1 (+0%) | 51 (-23%) |
| muffle | 19/20 | 0.000 | 18,144 (-6%) | 137,747 (-22%) | 1,559 (-6%) | 26,809 (-21%) | 94 (+0%) | 14 (+9%) | 4 (+20%) | 1 (+12%) | 61 (-9%) |
| sloth | 20/20 | 0.000 | 23,424 (+21%) | 141,658 (-20%) | 1,387 (-17%) | 37,259 (+9%) | 126 (+33%) | 10 (-26%) | 4 (-4%) | 1 (-6%) | 58 (-12%) |

| task | base | all | hush | muffle | sloth |
|---|---:|---:|---:|---:|---:|
| go-chi-allow-duplicates | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| go-decimal-numdigits | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| go-expr-findlast-map | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| go-toml-inline-embed | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| go-yaml-int-map-keys | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-attrs-pre-init-defaults | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-click-choice-double-brackets | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-marshmallow-constant-required | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-more-itertools-value-chain-typeerror | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-tomlkit-aot-dotted-key | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-chrono-iter-days-rev | 1/1 | 0/1 | 0/1 | 0/1 | 1/1 |
| rust-http-headermap-size-hint | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-time-strftime-padding-panic | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-toml-value-datetime | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-url-path-caret | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-citty-kebab-default | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-mlly-generic-export-names | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-remeda-deep-equal-null-proto | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-ufo-base-prefix | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-yaml-flow-key-after-blank | 0/1 | 0/1 | 1/1 | 1/1 | 1/1 |

## claude, feature tasks

| setup | passed | cost_usd | input_uncached | input_cached | output | tool_bytes | reply_words | lines_added | lines_removed | lint_new | seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base | 11/12 | 0.124 | 17,586 | 148,149 | 3,886 | 9,941 | 184 | 60 | 1 | 1 | 38 |
| all | 12/12 | 0.096 (-23%) | 14,924 (-15%) | 94,554 (-36%) | 2,688 (-31%) | 7,471 (-25%) | 57 (-69%) | 46 (-24%) | 1 (-14%) | 1 (-27%) | 88 (+132%) |
| hush | 11/12 | 0.100 (-19%) | 15,048 (-14%) | 93,819 (-37%) | 3,091 (-20%) | 7,595 (-24%) | 45 (-76%) | 56 (-6%) | 1 (-29%) | 1 (+27%) | 39 (+3%) |
| muffle | 12/12 | 0.103 (-17%) | 14,532 (-17%) | 100,586 (-32%) | 3,451 (-11%) | 9,573 (-4%) | 174 (-5%) | 60 (+0%) | 2 (+93%) | 1 (+9%) | 35 (-9%) |
| sloth | 12/12 | 0.084 (-32%) | 12,982 (-26%) | 75,121 (-49%) | 2,503 (-36%) | 8,068 (-19%) | 168 (-8%) | 42 (-30%) | 1 (-14%) | 1 (-36%) | 28 (-26%) |

| task | base | all | hush | muffle | sloth |
|---|---:|---:|---:|---:|---:|
| go-feat-humanize-parse-comma | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| go-feat-mapset-sql | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| go-feat-retry-full-jitter | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-feat-inflect-number-to-currency | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-feat-packaging-requirement-replace | 0/1 | 1/1 | 0/1 | 1/1 | 1/1 |
| python-feat-tenacity-wait-exception | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-feat-bytes-extend-from-within | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-feat-itertools-strip-prefix | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-feat-slab-get-disjoint-mut | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-feat-cookie-es-allow-multiple | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-feat-knitwork-dynamic-type-import | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-feat-pathe-reverse-alias | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |

## codex, feature tasks

| setup | passed | cost_usd | input_uncached | input_cached | output | tool_bytes | reply_words | lines_added | lines_removed | lint_new | seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base | 12/12 | 0.000 | 18,854 | 166,837 | 2,288 | 45,945 | 89 | 49 | 1 | 1 | 65 |
| all | 12/12 | 0.000 | 17,058 (-10%) | 117,429 (-30%) | 1,375 (-40%) | 32,992 (-28%) | 25 (-71%) | 39 (-19%) | 1 (+33%) | 1 (+43%) | 48 (-26%) |
| hush | 12/12 | 0.000 | 13,688 (-27%) | 117,355 (-30%) | 1,834 (-20%) | 25,423 (-45%) | 25 (-71%) | 43 (-11%) | 1 (-11%) | 1 (+57%) | 54 (-17%) |
| muffle | 12/12 | 0.000 | 17,259 (-8%) | 151,093 (-9%) | 2,291 (+0%) | 31,085 (-32%) | 90 (+2%) | 47 (-4%) | 1 (-11%) | 1 (+57%) | 69 (+5%) |
| sloth | 12/12 | 0.000 | 25,999 (+38%) | 121,536 (-27%) | 1,650 (-28%) | 27,625 (-40%) | 126 (+42%) | 45 (-8%) | 1 (+33%) | 1 (+57%) | 55 (-15%) |

| task | base | all | hush | muffle | sloth |
|---|---:|---:|---:|---:|---:|
| go-feat-humanize-parse-comma | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| go-feat-mapset-sql | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| go-feat-retry-full-jitter | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-feat-inflect-number-to-currency | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-feat-packaging-requirement-replace | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-feat-tenacity-wait-exception | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-feat-bytes-extend-from-within | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-feat-itertools-strip-prefix | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-feat-slab-get-disjoint-mut | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-feat-cookie-es-allow-multiple | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-feat-knitwork-dynamic-type-import | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-feat-pathe-reverse-alias | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |

## Per task

Each page shows the bug report, the upstream change and every agent's diff:

- [go-chi-allow-duplicates](tasks/go-chi-allow-duplicates.md)
- [go-decimal-numdigits](tasks/go-decimal-numdigits.md)
- [go-expr-findlast-map](tasks/go-expr-findlast-map.md)
- [go-feat-humanize-parse-comma](tasks/go-feat-humanize-parse-comma.md)
- [go-feat-mapset-sql](tasks/go-feat-mapset-sql.md)
- [go-feat-retry-full-jitter](tasks/go-feat-retry-full-jitter.md)
- [go-toml-inline-embed](tasks/go-toml-inline-embed.md)
- [go-yaml-int-map-keys](tasks/go-yaml-int-map-keys.md)
- [python-attrs-pre-init-defaults](tasks/python-attrs-pre-init-defaults.md)
- [python-click-choice-double-brackets](tasks/python-click-choice-double-brackets.md)
- [python-feat-inflect-number-to-currency](tasks/python-feat-inflect-number-to-currency.md)
- [python-feat-packaging-requirement-replace](tasks/python-feat-packaging-requirement-replace.md)
- [python-feat-tenacity-wait-exception](tasks/python-feat-tenacity-wait-exception.md)
- [python-marshmallow-constant-required](tasks/python-marshmallow-constant-required.md)
- [python-more-itertools-value-chain-typeerror](tasks/python-more-itertools-value-chain-typeerror.md)
- [python-tomlkit-aot-dotted-key](tasks/python-tomlkit-aot-dotted-key.md)
- [rust-chrono-iter-days-rev](tasks/rust-chrono-iter-days-rev.md)
- [rust-feat-bytes-extend-from-within](tasks/rust-feat-bytes-extend-from-within.md)
- [rust-feat-itertools-strip-prefix](tasks/rust-feat-itertools-strip-prefix.md)
- [rust-feat-slab-get-disjoint-mut](tasks/rust-feat-slab-get-disjoint-mut.md)
- [rust-http-headermap-size-hint](tasks/rust-http-headermap-size-hint.md)
- [rust-time-strftime-padding-panic](tasks/rust-time-strftime-padding-panic.md)
- [rust-toml-value-datetime](tasks/rust-toml-value-datetime.md)
- [rust-url-path-caret](tasks/rust-url-path-caret.md)
- [ts-citty-kebab-default](tasks/ts-citty-kebab-default.md)
- [ts-feat-cookie-es-allow-multiple](tasks/ts-feat-cookie-es-allow-multiple.md)
- [ts-feat-knitwork-dynamic-type-import](tasks/ts-feat-knitwork-dynamic-type-import.md)
- [ts-feat-pathe-reverse-alias](tasks/ts-feat-pathe-reverse-alias.md)
- [ts-mlly-generic-export-names](tasks/ts-mlly-generic-export-names.md)
- [ts-remeda-deep-equal-null-proto](tasks/ts-remeda-deep-equal-null-proto.md)
- [ts-ufo-base-prefix](tasks/ts-ufo-base-prefix.md)
- [ts-yaml-flow-key-after-blank](tasks/ts-yaml-flow-key-after-blank.md)
