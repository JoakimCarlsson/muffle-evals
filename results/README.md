# Results

Means per run over the tasks every setup of the agent ran. Runs the agent's API failed are left out.

## claude

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

## codex

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
