# Commands

Shell commands the agents ran, over every scored run, by bytes of output they were shown (after muffle, where it ran). Lossy is the number of outputs that ended in a `[raw:]` line.

| command | calls | bytes shown | mean bytes | lossy |
|---|---:|---:|---:|---:|
| `/bin/bash` | 1,118 | 4,905,341 | 4,387 | 80 |
| `sed` | 127 | 515,846 | 4,061 | 2 |
| `cat` | 82 | 268,122 | 3,269 | 2 |
| `grep` | 75 | 194,154 | 2,588 | 2 |
| `/home/jdaddy/.cache/muffle-evals/runs/sloth/claude/rust-crossbeam-skiplist-comparator-1/work/crossbeam-skiplist;` | 25 | 95,602 | 3,824 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/hush/claude/rust-crossbeam-skiplist-comparator-1/work/crossbeam-skiplist;` | 26 | 86,891 | 3,341 | 0 |
| `ls` | 19 | 74,511 | 3,921 | 1 |
| `ls;` | 15 | 70,670 | 4,711 | 0 |
| `python3` | 79 | 67,519 | 854 | 3 |
| `/home/jdaddy/.cache/muffle-evals/runs/base/claude/rust-h2-informational-responses-1/work;` | 13 | 52,842 | 4,064 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/base/claude/ts-zod-deep-partial-1/work/packages/zod/src/v4;` | 9 | 48,322 | 5,369 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/muffle/claude/python-babel-concat-merge-commands-1/work;` | 9 | 44,775 | 4,975 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/sloth/claude/ts-unstorage-get-item-type-1/work;` | 12 | 42,560 | 3,546 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/muffle/claude/rust-h2-informational-responses-1/work;` | 9 | 39,522 | 4,391 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/muffle/claude/ts-ky-force-retry-1/work;` | 12 | 34,117 | 2,843 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/base/claude/rust-crossbeam-skiplist-comparator-1/work/crossbeam-skiplist;` | 15 | 34,097 | 2,273 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/base/claude/ts-ky-force-retry-1/work;` | 4 | 32,936 | 8,234 | 0 |
| `python` | 50 | 28,961 | 579 | 2 |
| `/home/jdaddy/.cache/muffle-evals/runs/base/claude/rust-indexmap-extract-if-1/work;` | 5 | 24,471 | 4,894 | 0 |
| `source;` | 1 | 24,133 | 24,133 | 1 |
| `/home/jdaddy/.cache/muffle-evals/runs/base/claude/python-babel-concat-merge-commands-1/work;` | 10 | 19,393 | 1,939 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/sloth/claude/python-babel-concat-merge-commands-1/work;` | 10 | 17,756 | 1,775 | 1 |
| `git status` | 8 | 16,910 | 2,113 | 0 |
| `git ls-files` | 5 | 16,757 | 3,351 | 0 |
| `npx vitest` | 8 | 15,654 | 1,956 | 1 |
| `core;` | 3 | 15,474 | 5,158 | 0 |
| `pwd;` | 1 | 15,189 | 15,189 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/muffle/claude/rust-indexmap-extract-if-1/work;` | 7 | 14,586 | 2,083 | 0 |
| `mkdir` | 12 | 12,831 | 1,069 | 0 |
| `for` | 6 | 12,714 | 2,119 | 0 |
| `{print` | 2 | 12,657 | 6,328 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/all/claude/ts-hono-define-handler-1/work/src;` | 4 | 12,559 | 3,139 | 0 |
| `packages/zod/src/v4;` | 3 | 12,338 | 4,112 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/all/claude/ts-ky-force-retry-1/work` | 11 | 11,107 | 1,009 | 0 |
| `git log` | 4 | 9,764 | 2,441 | 0 |
| `cargo test` | 12 | 9,411 | 784 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/base/claude/ts-ky-force-retry-1/work` | 9 | 9,006 | 1,000 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/base/claude/python-feat-tenacity-wait-exception-1/work;` | 6 | 8,378 | 1,396 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/all/claude/go-mo-either-binary-1/work;` | 4 | 7,682 | 1,920 | 0 |
| `git checkout` | 8 | 7,435 | 929 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/sloth/claude/ts-zod-deep-partial-1/work;` | 7 | 6,849 | 978 | 1 |
| `head` | 3 | 6,718 | 2,239 | 0 |
| `src/v4;` | 4 | 6,125 | 1,531 | 1 |
| `git stash` | 6 | 5,939 | 989 | 0 |
| `crossbeam-skiplist;` | 3 | 5,353 | 1,784 | 0 |
| `/work` | 1 | 5,351 | 5,351 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/all/claude/rust-feat-slab-get-disjoint-mut-1/work;` | 3 | 5,346 | 1,782 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/base/claude/ts-ufo-base-prefix-1/work;` | 5 | 5,094 | 1,018 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/base/claude/rust-chrono-iter-days-rev-1/work;` | 4 | 4,889 | 1,222 | 0 |
| `git diff` | 7 | 4,703 | 671 | 1 |
| `/home/jdaddy/.cache/muffle-evals/runs/sloth/claude/ts-zod-deep-partial-1/work/packages/zod/src/v4/core/tests;` | 1 | 4,409 | 4,409 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/muffle/claude/rust-feat-slab-get-disjoint-mut-1/work;` | 3 | 4,142 | 1,380 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/muffle/claude/ts-ufo-base-prefix-1/work;` | 4 | 3,857 | 964 | 0 |
| `npx tsc` | 3 | 3,817 | 1,272 | 1 |
| `tail` | 1 | 3,762 | 3,762 | 0 |
| `crossbeam-skiplist` | 3 | 3,361 | 1,120 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/base/claude/ts-feat-pathe-reverse-alias-1/work;` | 3 | 3,346 | 1,115 | 0 |
| `/home/jdaddy/.cache/muffle-evals/runs/base/claude/python-attrs-pre-init-defaults-1/work;` | 4 | 2,880 | 720 | 0 |
| `entries.len()","if` | 1 | 2,754 | 2,754 | 0 |
| `find` | 1 | 2,713 | 2,713 | 0 |
