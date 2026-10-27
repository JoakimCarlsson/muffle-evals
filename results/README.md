# Results

Means per run over the tasks every setup of the agent ran. Runs the agent's API failed are left out, and so are runs in which a command hung until the agent's shell killed it, together with that task's runs in the other setups.

## claude, bug tasks

| setup | passed | cost_usd | turns | tool_calls | raw_reads | input_uncached | input_cached | output | tool_bytes | reply_words | lines_added | lines_removed | lint_new | seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base | 4/5 | 0.093 | 6 | 5 | 0 | 14,118 | 124,632 | 2,445 | 6,537 | 138 | 26 | 8 | 1 | 34 |
| all | 5/5 | 0.104 (+11%) | 6 (-3%) | 5 (+0%) | 0 | 17,396 (+23%) | 121,456 (-3%) | 2,236 (-9%) | 5,561 (-15%) | 57 (-59%) | 15 (-43%) | 7 (-13%) | 1 (-40%) | 28 (-17%) |
| hush | 5/5 | 0.086 (-8%) | 6 (-7%) | 5 (-4%) | 0 | 13,818 (-2%) | 114,671 (-8%) | 1,920 (-21%) | 4,697 (-28%) | 58 (-58%) | 15 (-44%) | 7 (-10%) | 1 (-40%) | 34 (+0%) |
| muffle | 4/5 | 0.096 (+3%) | 6 (+7%) | 6 (+19%) | 0 | 13,894 (-2%) | 131,117 (+5%) | 2,713 (+11%) | 6,465 (-1%) | 160 (+15%) | 26 (+0%) | 8 (+0%) | 1 (+0%) | 31 (-9%) |
| sloth | 4/5 | 0.101 (+8%) | 6 (+3%) | 5 (+4%) | 0 | 15,577 (+10%) | 120,891 (-3%) | 2,656 (+9%) | 6,134 (-6%) | 130 (-6%) | 18 (-30%) | 7 (-15%) | 1 (-40%) | 29 (-15%) |

| task | base | all | hush | muffle | sloth |
|---|---:|---:|---:|---:|---:|
| go-chi-allow-duplicates | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-attrs-pre-init-defaults | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-chrono-iter-days-rev | 0/1 | 1/1 | 1/1 | 0/1 | 0/1 |
| rust-url-path-caret | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-ufo-base-prefix | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |

## codex, bug tasks

| setup | passed | cost_usd | turns | tool_calls | raw_reads | input_uncached | input_cached | output | tool_bytes | reply_words | lines_added | lines_removed | lint_new | seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base | 5/6 | 0.000 | 0 | 7 | 0 | 16,553 | 156,971 | 1,470 | 33,693 | 101 | 24 | 8 | 1 | 46 |
| all | 6/6 | 0.000 | 0 | 6 (-14%) | 0 | 19,270 (+16%) | 138,411 (-12%) | 1,267 (-14%) | 32,144 (-5%) | 22 (-79%) | 16 (-35%) | 4 (-44%) | 0 (-50%) | 50 (+8%) |
| hush | 5/6 | 0.000 | 0 | 8 (+7%) | 0 | 20,683 (+25%) | 117,952 (-25%) | 1,277 (-13%) | 24,107 (-28%) | 20 (-80%) | 18 (-28%) | 7 (-9%) | 1 (-33%) | 52 (+15%) |
| muffle | 5/6 | 0.000 | 0 | 7 (+5%) | 1 | 14,033 (-15%) | 120,619 (-23%) | 1,575 (+7%) | 28,030 (-17%) | 101 (-0%) | 24 (-1%) | 7 (-2%) | 1 (-17%) | 52 (+13%) |
| sloth | 6/6 | 0.000 | 0 | 7 (-5%) | 1 | 15,476 (-7%) | 129,195 (-18%) | 1,445 (-2%) | 28,521 (-15%) | 120 (+18%) | 20 (-17%) | 4 (-44%) | 0 (-50%) | 55 (+20%) |

| task | base | all | hush | muffle | sloth |
|---|---:|---:|---:|---:|---:|
| go-chi-allow-duplicates | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-attrs-pre-init-defaults | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-chrono-iter-days-rev | 0/1 | 1/1 | 0/1 | 0/1 | 1/1 |
| rust-url-path-caret | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-citty-kebab-default | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-ufo-base-prefix | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |

## claude, feature tasks

| setup | passed | cost_usd | turns | tool_calls | raw_reads | input_uncached | input_cached | output | tool_bytes | reply_words | lines_added | lines_removed | lint_new | seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base | 2/2 | 0.101 | 4 | 4 | 0 | 15,668 | 89,652 | 2,893 | 7,163 | 156 | 57 | 1 | 0 | 26 |
| all | 2/2 | 0.090 (-10%) | 4 (-11%) | 4 (-11%) | 0 | 15,028 (-4%) | 78,308 (-13%) | 2,221 (-23%) | 6,060 (-15%) | 36 (-77%) | 38 (-33%) | 0 (-50%) | 0 | 20 (-23%) |
| hush | 2/2 | 0.086 (-15%) | 5 (+11%) | 4 (+0%) | 0 | 12,643 (-19%) | 93,771 (+5%) | 2,585 (-11%) | 4,994 (-30%) | 57 (-64%) | 58 (+2%) | 0 (-50%) | 0 | 24 (-6%) |
| muffle | 2/2 | 0.095 (-6%) | 4 (+0%) | 4 (-11%) | 0 | 14,281 (-9%) | 84,649 (-6%) | 2,929 (+1%) | 6,468 (-10%) | 160 (+3%) | 53 (-7%) | 0 (-50%) | 0 | 26 (+2%) |
| sloth | 2/2 | 0.112 (+11%) | 7 (+56%) | 6 (+33%) | 0 | 15,470 (-1%) | 151,978 (+70%) | 3,486 (+20%) | 6,221 (-13%) | 150 (-4%) | 43 (-25%) | 0 (-50%) | 0 | 28 (+10%) |

| task | base | all | hush | muffle | sloth |
|---|---:|---:|---:|---:|---:|
| go-feat-retry-full-jitter | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-feat-slab-get-disjoint-mut | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |

## codex, feature tasks

| setup | passed | cost_usd | turns | tool_calls | raw_reads | input_uncached | input_cached | output | tool_bytes | reply_words | lines_added | lines_removed | lint_new | seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base | 4/4 | 0.000 | 0 | 7 | 0 | 14,338 | 133,920 | 1,826 | 18,707 | 79 | 40 | 0 | 1 | 46 |
| all | 4/4 | 0.000 | 0 | 6 (-21%) | 1 | 14,364 (+0%) | 140,352 (+5%) | 1,652 (-10%) | 37,351 (+100%) | 25 (-69%) | 32 (-20%) | 0 (+0%) | 1 (+0%) | 51 (+9%) |
| hush | 4/4 | 0.000 | 0 | 8 (+7%) | 1 | 18,638 (+30%) | 105,568 (-21%) | 1,611 (-12%) | 17,696 (-5%) | 22 (-72%) | 40 (+1%) | 0 (+0%) | 1 (+0%) | 50 (+7%) |
| muffle | 4/4 | 0.000 | 0 | 8 (+17%) | 0 | 17,524 (+22%) | 116,640 (-13%) | 1,972 (+8%) | 18,349 (-2%) | 92 (+17%) | 42 (+6%) | 0 (+0%) | 1 (+25%) | 50 (+8%) |
| sloth | 4/4 | 0.000 | 0 | 8 (+7%) | 2 | 20,400 (+42%) | 164,960 (+23%) | 2,288 (+25%) | 24,322 (+30%) | 100 (+26%) | 32 (-18%) | 0 (+0%) | 1 (+0%) | 66 (+41%) |

| task | base | all | hush | muffle | sloth |
|---|---:|---:|---:|---:|---:|
| go-feat-retry-full-jitter | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-feat-tenacity-wait-exception | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-feat-slab-get-disjoint-mut | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-feat-pathe-reverse-alias | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |

## claude, long tasks

| setup | passed | cost_usd | turns | tool_calls | raw_reads | input_uncached | input_cached | output | tool_bytes | reply_words | lines_added | lines_removed | lint_new | seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base | 5/8 | 0.551 | 15 | 15 | 0 | 59,032 | 862,400 | 22,829 | 63,644 | 322 | 340 | 50 | 2 | 186 |
| all | 4/8 | 0.477 (-13%) | 15 (-2%) | 15 (-2%) | 1 | 53,204 (-10%) | 742,364 (-14%) | 19,004 (-17%) | 56,817 (-11%) | 146 (-55%) | 276 (-19%) | 47 (-5%) | 1 (-17%) | 154 (-18%) |
| hush | 5/8 | 0.523 (-5%) | 16 (+3%) | 17 (+11%) | 0 | 61,265 (+4%) | 743,822 (-14%) | 20,325 (-11%) | 57,819 (-9%) | 110 (-66%) | 339 (-0%) | 46 (-6%) | 2 (+25%) | 171 (-8%) |
| muffle | 4/8 | 0.545 (-1%) | 14 (-4%) | 14 (-5%) | 0 | 59,313 (+0%) | 719,838 (-17%) | 23,632 (+4%) | 59,981 (-6%) | 314 (-3%) | 312 (-8%) | 48 (-3%) | 2 (+33%) | 205 (+10%) |
| sloth | 5/8 | 0.529 (-4%) | 17 (+12%) | 18 (+16%) | 0 | 57,622 (-2%) | 814,714 (-6%) | 21,727 (-5%) | 58,253 (-8%) | 335 (+4%) | 254 (-25%) | 47 (-4%) | 1 (-25%) | 181 (-3%) |

| task | base | all | hush | muffle | sloth |
|---|---:|---:|---:|---:|---:|
| go-mo-either-binary | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-babel-concat-merge-commands | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 |
| python-lark-parser-scan | 1/1 | 0/1 | 1/1 | 1/1 | 1/1 |
| rust-crossbeam-skiplist-comparator | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-indexmap-extract-if | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-ky-force-retry | 1/1 | 1/1 | 1/1 | 0/1 | 1/1 |
| ts-unstorage-get-item-type | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 |
| ts-zod-deep-partial | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 |

## codex, long tasks

| setup | passed | cost_usd | turns | tool_calls | raw_reads | input_uncached | input_cached | output | tool_bytes | reply_words | lines_added | lines_removed | lint_new | seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| base | 7/10 | 0.000 | 0 | 15 | 0 | 36,512 | 481,498 | 6,315 | 69,324 | 136 | 242 | 37 | 2 | 142 |
| all | 8/10 | 0.000 | 0 | 16 (+6%) | 2 | 36,875 (+1%) | 538,240 (+12%) | 6,832 (+8%) | 70,361 (+1%) | 26 (-81%) | 238 (-1%) | 42 (+11%) | 1 (-35%) | 173 (+22%) |
| hush | 7/10 | 0.000 | 0 | 14 (-10%) | 1 | 36,061 (-1%) | 393,382 (-18%) | 5,466 (-13%) | 72,690 (+5%) | 20 (-85%) | 241 (-0%) | 38 (+3%) | 2 (-10%) | 152 (+7%) |
| muffle | 8/10 | 0.000 | 0 | 16 (+2%) | 1 | 30,634 (-16%) | 417,229 (-13%) | 6,033 (-4%) | 68,322 (-1%) | 134 (-2%) | 260 (+8%) | 39 (+3%) | 2 (-10%) | 138 (-2%) |
| sloth | 8/10 | 0.000 | 0 | 15 (-3%) | 2 | 32,563 (-11%) | 521,523 (+8%) | 6,871 (+9%) | 75,370 (+9%) | 152 (+11%) | 231 (-5%) | 41 (+9%) | 2 (+5%) | 186 (+32%) |

| task | base | all | hush | muffle | sloth |
|---|---:|---:|---:|---:|---:|
| go-mo-either-binary | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| python-babel-concat-merge-commands | 0/1 | 0/1 | 0/1 | 1/1 | 0/1 |
| python-lark-parser-scan | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-crossbeam-skiplist-comparator | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-h2-informational-responses | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| rust-indexmap-extract-if | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-hono-define-handler | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |
| ts-ky-force-retry | 0/1 | 1/1 | 0/1 | 0/1 | 1/1 |
| ts-unstorage-get-item-type | 0/1 | 0/1 | 0/1 | 0/1 | 0/1 |
| ts-zod-deep-partial | 1/1 | 1/1 | 1/1 | 1/1 | 1/1 |

## Per task

Each page shows the bug report, the upstream change and every agent's diff:

- [go-chi-allow-duplicates](tasks/go-chi-allow-duplicates.md)
- [go-feat-retry-full-jitter](tasks/go-feat-retry-full-jitter.md)
- [go-mo-either-binary](tasks/go-mo-either-binary.md)
- [python-attrs-pre-init-defaults](tasks/python-attrs-pre-init-defaults.md)
- [python-babel-concat-merge-commands](tasks/python-babel-concat-merge-commands.md)
- [python-feat-tenacity-wait-exception](tasks/python-feat-tenacity-wait-exception.md)
- [python-lark-parser-scan](tasks/python-lark-parser-scan.md)
- [rust-chrono-iter-days-rev](tasks/rust-chrono-iter-days-rev.md)
- [rust-crossbeam-skiplist-comparator](tasks/rust-crossbeam-skiplist-comparator.md)
- [rust-feat-slab-get-disjoint-mut](tasks/rust-feat-slab-get-disjoint-mut.md)
- [rust-h2-informational-responses](tasks/rust-h2-informational-responses.md)
- [rust-indexmap-extract-if](tasks/rust-indexmap-extract-if.md)
- [rust-url-path-caret](tasks/rust-url-path-caret.md)
- [ts-citty-kebab-default](tasks/ts-citty-kebab-default.md)
- [ts-feat-pathe-reverse-alias](tasks/ts-feat-pathe-reverse-alias.md)
- [ts-hono-define-handler](tasks/ts-hono-define-handler.md)
- [ts-ky-force-retry](tasks/ts-ky-force-retry.md)
- [ts-ufo-base-prefix](tasks/ts-ufo-base-prefix.md)
- [ts-unstorage-get-item-type](tasks/ts-unstorage-get-item-type.md)
- [ts-zod-deep-partial](tasks/ts-zod-deep-partial.md)
