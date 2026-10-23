# Results

Means per run over the tasks every setup of the agent ran. Runs the agent's API failed are left out.

## claude, bug tasks

| setup | passed | cost_usd | input_uncached | input_cached | output | tool_bytes | reply_words | lines_added | lines_removed | lint_new | seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base | 19/20 | 0.106 | 15,260 | 177,368 | 2,744 | 8,369 | 165 | 14 | 4 | 1 | 70 |
| all | 19/20 | 0.092 (-14%) | 14,522 (-5%) | 111,167 (-37%) | 2,253 (-18%) | 8,612 (+3%) | 57 (-66%) | 11 (-22%) | 3 (-13%) | 1 (-6%) | 30 (-57%) |
| hush | 18/20 | 0.091 (-14%) | 14,526 (-5%) | 107,990 (-39%) | 2,234 (-19%) | 8,228 (-2%) | 51 (-69%) | 17 (+17%) | 3 (-9%) | 1 (-12%) | 65 (-8%) |
| muffle | 19/20 | 0.096 (-10%) | 14,598 (-4%) | 112,945 (-36%) | 2,636 (-4%) | 8,542 (+2%) | 157 (-5%) | 16 (+10%) | 3 (-8%) | 1 (-12%) | 68 (-3%) |
| sloth | 19/20 | 0.095 (-11%) | 14,367 (-6%) | 114,941 (-35%) | 2,569 (-6%) | 8,621 (+3%) | 151 (-8%) | 12 (-17%) | 3 (-28%) | 1 (-12%) | 32 (-55%) |

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
| rust-chrono-iter-days-rev | 0/1 | 0/1 | 0/1 | 0/1 | 1/1 |
| rust-http-headermap-size-hint | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-time-strftime-padding-panic | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-toml-value-datetime | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-url-path-caret | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-citty-kebab-default | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-mlly-generic-export-names | 1/1 | 1/1 | 0/1 | 1/1 | 0/1 |
| ts-remeda-deep-equal-null-proto | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-ufo-base-prefix | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-yaml-flow-key-after-blank | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |

## codex, bug tasks

| setup | passed | cost_usd | input_uncached | input_cached | output | tool_bytes | reply_words | lines_added | lines_removed | lint_new | seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base | 19/20 | 0.000 | 19,397 | 176,102 | 1,662 | 34,052 | 94 | 13 | 4 | 1 | 66 |
| all | 20/20 | 0.000 | 24,299 (+25%) | 144,602 (-18%) | 1,482 (-11%) | 33,807 (-1%) | 24 (-74%) | 12 (-10%) | 3 (-23%) | 1 (+12%) | 63 (-5%) |
| hush | 19/20 | 0.000 | 23,597 (+22%) | 125,107 (-29%) | 1,322 (-20%) | 25,099 (-26%) | 25 (-74%) | 12 (-8%) | 4 (+9%) | 1 (+12%) | 56 (-16%) |
| muffle | 19/20 | 0.000 | 25,032 (+29%) | 120,787 (-31%) | 1,635 (-2%) | 31,278 (-8%) | 97 (+3%) | 14 (+7%) | 5 (+23%) | 1 (-6%) | 61 (-7%) |
| sloth | 20/20 | 0.000 | 21,792 (+12%) | 144,224 (-18%) | 1,765 (+6%) | 37,850 (+11%) | 137 (+45%) | 11 (-20%) | 3 (-23%) | 1 (+0%) | 69 (+4%) |

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
| rust-chrono-iter-days-rev | 1/1 | 1/1 | 0/1 | 0/1 | 1/1 |
| rust-http-headermap-size-hint | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-time-strftime-padding-panic | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-toml-value-datetime | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-url-path-caret | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-citty-kebab-default | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-mlly-generic-export-names | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-remeda-deep-equal-null-proto | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-ufo-base-prefix | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-yaml-flow-key-after-blank | 0/1 | 1/1 | 1/1 | 1/1 | 1/1 |

## claude, feature tasks

| setup | passed | cost_usd | input_uncached | input_cached | output | tool_bytes | reply_words | lines_added | lines_removed | lint_new | seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base | 11/12 | 0.124 | 17,586 | 148,149 | 3,886 | 9,941 | 184 | 60 | 1 | 1 | 38 |
| all | 12/12 | 0.104 (-16%) | 15,788 (-10%) | 97,979 (-34%) | 3,152 (-19%) | 9,198 (-7%) | 60 (-67%) | 46 (-24%) | 1 (-7%) | 1 (+9%) | 33 (-12%) |
| hush | 12/12 | 0.097 (-22%) | 14,556 (-17%) | 82,187 (-45%) | 3,044 (-22%) | 8,535 (-14%) | 39 (-79%) | 56 (-7%) | 1 (-7%) | 1 (-36%) | 31 (-18%) |
| muffle | 12/12 | 0.108 (-13%) | 14,754 (-16%) | 93,140 (-37%) | 4,017 (+3%) | 9,164 (-8%) | 168 (-9%) | 60 (+0%) | 1 (-14%) | 0 (-45%) | 40 (+6%) |
| sloth | 11/12 | 0.111 (-10%) | 16,246 (-8%) | 112,350 (-24%) | 3,483 (-10%) | 11,078 (+11%) | 171 (-7%) | 43 (-29%) | 1 (-14%) | 1 (+0%) | 37 (-2%) |

| task | base | all | hush | muffle | sloth |
|---|---:|---:|---:|---:|---:|
| go-feat-humanize-parse-comma | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| go-feat-mapset-sql | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| go-feat-retry-full-jitter | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-feat-inflect-number-to-currency | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-feat-packaging-requirement-replace | 0/1 | 1/1 | 1/1 | 1/1 | 0/1 |
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
| all | 12/12 | 0.000 | 24,858 (+32%) | 145,013 (-13%) | 2,124 (-7%) | 35,594 (-23%) | 20 (-77%) | 38 (-23%) | 1 (-22%) | 1 (+71%) | 74 (+14%) |
| hush | 12/12 | 0.000 | 22,674 (+20%) | 113,707 (-32%) | 1,968 (-14%) | 27,378 (-40%) | 22 (-75%) | 46 (-7%) | 1 (+11%) | 1 (+71%) | 65 (+0%) |
| muffle | 12/12 | 0.000 | 21,809 (+16%) | 131,520 (-21%) | 2,371 (+4%) | 29,087 (-37%) | 92 (+4%) | 49 (+0%) | 1 (+22%) | 1 (+57%) | 79 (+21%) |
| sloth | 12/12 | 0.000 | 24,906 (+32%) | 161,056 (-3%) | 2,683 (+17%) | 30,951 (-33%) | 132 (+49%) | 41 (-15%) | 1 (+33%) | 1 (+0%) | 90 (+38%) |

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
