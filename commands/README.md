# Command output, before and after

Each task's project was put in two states: failing (the hidden tests added, no fix) and fixed (the upstream change applied, not committed). In each, the commands an agent typically runs were run once as they are and once as muffle's hook rewrites them. Only commands muffle rewrites are listed; the files hold both outputs.

Tokens are estimated as bytes / 4.

## Totals by program

| program | commands | raw bytes | muffle bytes | saved |
|---|---:|---:|---:|---:|
| cat | 32 | 1,641,446 | 1,082,651 | 35% |
| grep | 32 | 1,538,295 | 222,063 | 86% |
| cargo | 24 | 970,305 | 194,253 | 80% |
| git | 96 | 81,669 | 58,827 | 28% |
| task tests | 32 | 80,372 | 38,763 | 52% |
| find | 32 | 73,111 | 41,434 | 44% |
| ls | 32 | 42,045 | 12,292 | 71% |
| go | 24 | 11,253 | 5,570 | 51% |
| **all** | 304 | 4,438,496 | 1,655,853 | **63%** |

## Every command

| task | command | raw | muffle | saved | ~tokens saved |
|---|---|---:|---:|---:|---:|
| go-chi-allow-duplicates | [task tests](go-chi-allow-duplicates/01-task-tests.raw.txt) → [muffle](go-chi-allow-duplicates/01-task-tests.muffle.txt) | 250 | 237 | 6% | 3 |
| go-chi-allow-duplicates | [go build ./...](go-chi-allow-duplicates/02-go-build.raw.txt) → [muffle](go-chi-allow-duplicates/02-go-build.muffle.txt) | 0 | 0 | 100% | 0 |
| go-chi-allow-duplicates | [go test ./...](go-chi-allow-duplicates/03-go-test.raw.txt) → [muffle](go-chi-allow-duplicates/03-go-test.muffle.txt) | 300 | 237 | 21% | 15 |
| go-chi-allow-duplicates | [go vet ./...](go-chi-allow-duplicates/04-go-vet.raw.txt) → [muffle](go-chi-allow-duplicates/04-go-vet.muffle.txt) | 0 | 0 | 100% | 0 |
| go-chi-allow-duplicates | [git status](go-chi-allow-duplicates/05-git-status.raw.txt) → [muffle](go-chi-allow-duplicates/05-git-status.muffle.txt) | 269 | 28 | 90% | 60 |
| go-chi-allow-duplicates | [git diff](go-chi-allow-duplicates/06-git-diff.raw.txt) → [muffle](go-chi-allow-duplicates/06-git-diff.muffle.txt) | 1,033 | 733 | 30% | 75 |
| go-chi-allow-duplicates | [git diff --stat](go-chi-allow-duplicates/07-git-diff-stat.raw.txt) → [muffle](go-chi-allow-duplicates/07-git-diff-stat.muffle.txt) | 71 | 71 | 0% | 0 |
| go-chi-allow-duplicates | [ls -la](go-chi-allow-duplicates/08-ls-la.raw.txt) → [muffle](go-chi-allow-duplicates/08-ls-la.muffle.txt) | 1,437 | 423 | 71% | 253 |
| go-chi-allow-duplicates | [find](go-chi-allow-duplicates/09-find.raw.txt) → [muffle](go-chi-allow-duplicates/09-find.muffle.txt) | 2,188 | 1,537 | 30% | 162 |
| go-chi-allow-duplicates | [grep -rn Allow](go-chi-allow-duplicates/10-grep-rn-allow.raw.txt) → [muffle](go-chi-allow-duplicates/10-grep-rn-allow.muffle.txt) | 5,747 | 4,970 | 14% | 194 |
| go-chi-allow-duplicates | [cat tree.go](go-chi-allow-duplicates/11-cat-tree-go.raw.txt) → [muffle](go-chi-allow-duplicates/11-cat-tree-go.muffle.txt) | 21,935 | 6,781 | 70% | 3,788 |
| go-decimal-numdigits | [task tests](go-decimal-numdigits/01-task-tests.raw.txt) → [muffle](go-decimal-numdigits/01-task-tests.muffle.txt) | 342 | 341 | 1% | 0 |
| go-decimal-numdigits | [go build ./...](go-decimal-numdigits/02-go-build.raw.txt) → [muffle](go-decimal-numdigits/02-go-build.muffle.txt) | 0 | 0 | 100% | 0 |
| go-decimal-numdigits | [go test ./...](go-decimal-numdigits/03-go-test.raw.txt) → [muffle](go-decimal-numdigits/03-go-test.muffle.txt) | 342 | 341 | 1% | 0 |
| go-decimal-numdigits | [go vet ./...](go-decimal-numdigits/04-go-vet.raw.txt) → [muffle](go-decimal-numdigits/04-go-vet.muffle.txt) | 0 | 0 | 100% | 0 |
| go-decimal-numdigits | [git status](go-decimal-numdigits/05-git-status.raw.txt) → [muffle](go-decimal-numdigits/05-git-status.muffle.txt) | 272 | 31 | 89% | 60 |
| go-decimal-numdigits | [git diff](go-decimal-numdigits/06-git-diff.raw.txt) → [muffle](go-decimal-numdigits/06-git-diff.muffle.txt) | 995 | 877 | 12% | 29 |
| go-decimal-numdigits | [git diff --stat](go-decimal-numdigits/07-git-diff-stat.raw.txt) → [muffle](go-decimal-numdigits/07-git-diff-stat.muffle.txt) | 93 | 93 | 0% | 0 |
| go-decimal-numdigits | [ls -la](go-decimal-numdigits/08-ls-la.raw.txt) → [muffle](go-decimal-numdigits/08-ls-la.muffle.txt) | 996 | 329 | 67% | 166 |
| go-decimal-numdigits | [find](go-decimal-numdigits/09-find.raw.txt) → [muffle](go-decimal-numdigits/09-find.muffle.txt) | 136 | 131 | 4% | 1 |
| go-decimal-numdigits | [grep -rn Decimal](go-decimal-numdigits/10-grep-rn-decimal.raw.txt) → [muffle](go-decimal-numdigits/10-grep-rn-decimal.muffle.txt) | 32,121 | 5,376 | 84% | 6,686 |
| go-decimal-numdigits | [cat decimal.go](go-decimal-numdigits/11-cat-decimal-go.raw.txt) → [muffle](go-decimal-numdigits/11-cat-decimal-go.muffle.txt) | 67,173 | 67,173 | 0% | 0 |
| go-expr-findlast-map | [task tests](go-expr-findlast-map/01-task-tests.raw.txt) → [muffle](go-expr-findlast-map/01-task-tests.muffle.txt) | 2,431 | 2,098 | 14% | 83 |
| go-expr-findlast-map | [go build ./...](go-expr-findlast-map/02-go-build.raw.txt) → [muffle](go-expr-findlast-map/02-go-build.muffle.txt) | 112 | 70 | 38% | 10 |
| go-expr-findlast-map | [go test ./...](go-expr-findlast-map/03-go-test.raw.txt) → [muffle](go-expr-findlast-map/03-go-test.muffle.txt) | 5,905 | 2,116 | 65% | 947 |
| go-expr-findlast-map | [go vet ./...](go-expr-findlast-map/04-go-vet.raw.txt) → [muffle](go-expr-findlast-map/04-go-vet.muffle.txt) | 0 | 0 | 100% | 0 |
| go-expr-findlast-map | [git status](go-expr-findlast-map/05-git-status.raw.txt) → [muffle](go-expr-findlast-map/05-git-status.muffle.txt) | 282 | 41 | 86% | 60 |
| go-expr-findlast-map | [git diff](go-expr-findlast-map/06-git-diff.raw.txt) → [muffle](go-expr-findlast-map/06-git-diff.muffle.txt) | 513 | 348 | 33% | 41 |
| go-expr-findlast-map | [git diff --stat](go-expr-findlast-map/07-git-diff-stat.raw.txt) → [muffle](go-expr-findlast-map/07-git-diff-stat.muffle.txt) | 62 | 62 | 0% | 0 |
| go-expr-findlast-map | [ls -la](go-expr-findlast-map/08-ls-la.raw.txt) → [muffle](go-expr-findlast-map/08-ls-la.muffle.txt) | 1,702 | 369 | 79% | 333 |
| go-expr-findlast-map | [find](go-expr-findlast-map/09-find.raw.txt) → [muffle](go-expr-findlast-map/09-find.muffle.txt) | 5,499 | 3,996 | 28% | 375 |
| go-expr-findlast-map | [grep -rn findLast](go-expr-findlast-map/10-grep-rn-findlast.raw.txt) → [muffle](go-expr-findlast-map/10-grep-rn-findlast.muffle.txt) | 67,022 | 3,222 | 96% | 15,950 |
| go-expr-findlast-map | [cat compiler/compiler.go](go-expr-findlast-map/11-cat-compiler-compiler-go.raw.txt) → [muffle](go-expr-findlast-map/11-cat-compiler-compiler-go.muffle.txt) | 29,945 | 4,624 | 85% | 6,330 |
| go-feat-humanize-parse-comma | [task tests](go-feat-humanize-parse-comma/01-task-tests.raw.txt) → [muffle](go-feat-humanize-parse-comma/01-task-tests.muffle.txt) | 403 | 353 | 13% | 12 |
| go-feat-humanize-parse-comma | [go build ./...](go-feat-humanize-parse-comma/02-go-build.raw.txt) → [muffle](go-feat-humanize-parse-comma/02-go-build.muffle.txt) | 0 | 0 | 100% | 0 |
| go-feat-humanize-parse-comma | [go test ./...](go-feat-humanize-parse-comma/03-go-test.raw.txt) → [muffle](go-feat-humanize-parse-comma/03-go-test.muffle.txt) | 455 | 353 | 23% | 25 |
| go-feat-humanize-parse-comma | [go vet ./...](go-feat-humanize-parse-comma/04-go-vet.raw.txt) → [muffle](go-feat-humanize-parse-comma/04-go-vet.muffle.txt) | 348 | 279 | 20% | 17 |
| go-feat-humanize-parse-comma | [git status](go-feat-humanize-parse-comma/05-git-status.raw.txt) → [muffle](go-feat-humanize-parse-comma/05-git-status.muffle.txt) | 270 | 29 | 90% | 60 |
| go-feat-humanize-parse-comma | [git diff](go-feat-humanize-parse-comma/06-git-diff.raw.txt) → [muffle](go-feat-humanize-parse-comma/06-git-diff.muffle.txt) | 788 | 696 | 12% | 23 |
| go-feat-humanize-parse-comma | [git diff --stat](go-feat-humanize-parse-comma/07-git-diff-stat.raw.txt) → [muffle](go-feat-humanize-parse-comma/07-git-diff-stat.muffle.txt) | 66 | 66 | 0% | 0 |
| go-feat-humanize-parse-comma | [ls -la](go-feat-humanize-parse-comma/08-ls-la.raw.txt) → [muffle](go-feat-humanize-parse-comma/08-ls-la.muffle.txt) | 2,084 | 655 | 69% | 357 |
| go-feat-humanize-parse-comma | [find](go-feat-humanize-parse-comma/09-find.raw.txt) → [muffle](go-feat-humanize-parse-comma/09-find.muffle.txt) | 380 | 354 | 7% | 6 |
| go-feat-humanize-parse-comma | [grep -rn Comma](go-feat-humanize-parse-comma/10-grep-rn-comma.raw.txt) → [muffle](go-feat-humanize-parse-comma/10-grep-rn-comma.muffle.txt) | 11,932 | 5,043 | 58% | 1,722 |
| go-feat-humanize-parse-comma | [cat comma.go](go-feat-humanize-parse-comma/11-cat-comma-go.raw.txt) → [muffle](go-feat-humanize-parse-comma/11-cat-comma-go.muffle.txt) | 2,805 | 2,805 | 0% | 0 |
| go-feat-mapset-sql | [task tests](go-feat-mapset-sql/01-task-tests.raw.txt) → [muffle](go-feat-mapset-sql/01-task-tests.muffle.txt) | 1,082 | 1,024 | 6% | 14 |
| go-feat-mapset-sql | [go build ./...](go-feat-mapset-sql/02-go-build.raw.txt) → [muffle](go-feat-mapset-sql/02-go-build.muffle.txt) | 0 | 0 | 100% | 0 |
| go-feat-mapset-sql | [go test ./...](go-feat-mapset-sql/03-go-test.raw.txt) → [muffle](go-feat-mapset-sql/03-go-test.muffle.txt) | 1,082 | 1,024 | 6% | 14 |
| go-feat-mapset-sql | [go vet ./...](go-feat-mapset-sql/04-go-vet.raw.txt) → [muffle](go-feat-mapset-sql/04-go-vet.muffle.txt) | 309 | 235 | 24% | 18 |
| go-feat-mapset-sql | [git status](go-feat-mapset-sql/05-git-status.raw.txt) → [muffle](go-feat-mapset-sql/05-git-status.muffle.txt) | 327 | 66 | 80% | 65 |
| go-feat-mapset-sql | [git diff](go-feat-mapset-sql/06-git-diff.raw.txt) → [muffle](go-feat-mapset-sql/06-git-diff.muffle.txt) | 2,348 | 1,893 | 20% | 113 |
| go-feat-mapset-sql | [git diff --stat](go-feat-mapset-sql/07-git-diff-stat.raw.txt) → [muffle](go-feat-mapset-sql/07-git-diff-stat.muffle.txt) | 155 | 155 | 0% | 0 |
| go-feat-mapset-sql | [ls -la](go-feat-mapset-sql/08-ls-la.raw.txt) → [muffle](go-feat-mapset-sql/08-ls-la.muffle.txt) | 1,490 | 490 | 68% | 250 |
| go-feat-mapset-sql | [find](go-feat-mapset-sql/09-find.raw.txt) → [muffle](go-feat-mapset-sql/09-find.muffle.txt) | 256 | 244 | 5% | 3 |
| go-feat-mapset-sql | [grep -rn mapset](go-feat-mapset-sql/10-grep-rn-mapset.raw.txt) → [muffle](go-feat-mapset-sql/10-grep-rn-mapset.muffle.txt) | 1,303 | 1,170 | 11% | 33 |
| go-feat-mapset-sql | [cat threadunsafe.go](go-feat-mapset-sql/11-cat-threadunsafe-go.raw.txt) → [muffle](go-feat-mapset-sql/11-cat-threadunsafe-go.muffle.txt) | 8,341 | 8,341 | 0% | 0 |
| go-feat-retry-full-jitter | [task tests](go-feat-retry-full-jitter/01-task-tests.raw.txt) → [muffle](go-feat-retry-full-jitter/01-task-tests.muffle.txt) | 303 | 248 | 19% | 13 |
| go-feat-retry-full-jitter | [go build ./...](go-feat-retry-full-jitter/02-go-build.raw.txt) → [muffle](go-feat-retry-full-jitter/02-go-build.muffle.txt) | 0 | 0 | 100% | 0 |
| go-feat-retry-full-jitter | [go test ./...](go-feat-retry-full-jitter/03-go-test.raw.txt) → [muffle](go-feat-retry-full-jitter/03-go-test.muffle.txt) | 303 | 248 | 19% | 13 |
| go-feat-retry-full-jitter | [go vet ./...](go-feat-retry-full-jitter/04-go-vet.raw.txt) → [muffle](go-feat-retry-full-jitter/04-go-vet.muffle.txt) | 139 | 63 | 55% | 19 |
| go-feat-retry-full-jitter | [git status](go-feat-retry-full-jitter/05-git-status.raw.txt) → [muffle](go-feat-retry-full-jitter/05-git-status.muffle.txt) | 295 | 44 | 86% | 62 |
| go-feat-retry-full-jitter | [git diff](go-feat-retry-full-jitter/06-git-diff.raw.txt) → [muffle](go-feat-retry-full-jitter/06-git-diff.muffle.txt) | 1,454 | 1,208 | 17% | 61 |
| go-feat-retry-full-jitter | [git diff --stat](go-feat-retry-full-jitter/07-git-diff-stat.raw.txt) → [muffle](go-feat-retry-full-jitter/07-git-diff-stat.muffle.txt) | 97 | 97 | 0% | 0 |
| go-feat-retry-full-jitter | [ls -la](go-feat-retry-full-jitter/08-ls-la.raw.txt) → [muffle](go-feat-retry-full-jitter/08-ls-la.muffle.txt) | 1,027 | 382 | 63% | 161 |
| go-feat-retry-full-jitter | [find](go-feat-retry-full-jitter/09-find.raw.txt) → [muffle](go-feat-retry-full-jitter/09-find.muffle.txt) | 213 | 206 | 4% | 1 |
| go-feat-retry-full-jitter | [grep -rn WithJitter](go-feat-retry-full-jitter/10-grep-rn-withjitter.raw.txt) → [muffle](go-feat-retry-full-jitter/10-grep-rn-withjitter.muffle.txt) | 1,403 | 1,157 | 18% | 61 |
| go-feat-retry-full-jitter | [cat backoff.go](go-feat-retry-full-jitter/11-cat-backoff-go.raw.txt) → [muffle](go-feat-retry-full-jitter/11-cat-backoff-go.muffle.txt) | 3,194 | 3,194 | 0% | 0 |
| go-toml-inline-embed | [task tests](go-toml-inline-embed/01-task-tests.raw.txt) → [muffle](go-toml-inline-embed/01-task-tests.muffle.txt) | 239 | 238 | 1% | 0 |
| go-toml-inline-embed | [go build ./...](go-toml-inline-embed/02-go-build.raw.txt) → [muffle](go-toml-inline-embed/02-go-build.muffle.txt) | 0 | 0 | 100% | 0 |
| go-toml-inline-embed | [go test ./...](go-toml-inline-embed/03-go-test.raw.txt) → [muffle](go-toml-inline-embed/03-go-test.muffle.txt) | 1,209 | 255 | 79% | 238 |
| go-toml-inline-embed | [go vet ./...](go-toml-inline-embed/04-go-vet.raw.txt) → [muffle](go-toml-inline-embed/04-go-vet.muffle.txt) | 129 | 129 | 0% | 0 |
| go-toml-inline-embed | [git status](go-toml-inline-embed/05-git-status.raw.txt) → [muffle](go-toml-inline-embed/05-git-status.muffle.txt) | 276 | 35 | 88% | 60 |
| go-toml-inline-embed | [git diff](go-toml-inline-embed/06-git-diff.raw.txt) → [muffle](go-toml-inline-embed/06-git-diff.muffle.txt) | 1,547 | 1,391 | 11% | 39 |
| go-toml-inline-embed | [git diff --stat](go-toml-inline-embed/07-git-diff-stat.raw.txt) → [muffle](go-toml-inline-embed/07-git-diff-stat.muffle.txt) | 91 | 91 | 0% | 0 |
| go-toml-inline-embed | [ls -la](go-toml-inline-embed/08-ls-la.raw.txt) → [muffle](go-toml-inline-embed/08-ls-la.muffle.txt) | 2,935 | 885 | 70% | 512 |
| go-toml-inline-embed | [find](go-toml-inline-embed/09-find.raw.txt) → [muffle](go-toml-inline-embed/09-find.muffle.txt) | 1,496 | 1,172 | 22% | 81 |
| go-toml-inline-embed | [grep -rn inline](go-toml-inline-embed/10-grep-rn-inline.raw.txt) → [muffle](go-toml-inline-embed/10-grep-rn-inline.muffle.txt) | 13,580 | 10,782 | 21% | 699 |
| go-toml-inline-embed | [cat unmarshaler.go](go-toml-inline-embed/11-cat-unmarshaler-go.raw.txt) → [muffle](go-toml-inline-embed/11-cat-unmarshaler-go.muffle.txt) | 67,710 | 24,609 | 64% | 10,775 |
| go-yaml-int-map-keys | [task tests](go-yaml-int-map-keys/01-task-tests.raw.txt) → [muffle](go-yaml-int-map-keys/01-task-tests.muffle.txt) | 216 | 203 | 7% | 3 |
| go-yaml-int-map-keys | [go build ./...](go-yaml-int-map-keys/02-go-build.raw.txt) → [muffle](go-yaml-int-map-keys/02-go-build.muffle.txt) | 0 | 0 | 100% | 0 |
| go-yaml-int-map-keys | [go test ./...](go-yaml-int-map-keys/03-go-test.raw.txt) → [muffle](go-yaml-int-map-keys/03-go-test.muffle.txt) | 620 | 220 | 65% | 100 |
| go-yaml-int-map-keys | [go vet ./...](go-yaml-int-map-keys/04-go-vet.raw.txt) → [muffle](go-yaml-int-map-keys/04-go-vet.muffle.txt) | 0 | 0 | 100% | 0 |
| go-yaml-int-map-keys | [git status](go-yaml-int-map-keys/05-git-status.raw.txt) → [muffle](go-yaml-int-map-keys/05-git-status.muffle.txt) | 271 | 30 | 89% | 60 |
| go-yaml-int-map-keys | [git diff](go-yaml-int-map-keys/06-git-diff.raw.txt) → [muffle](go-yaml-int-map-keys/06-git-diff.muffle.txt) | 564 | 564 | 0% | 0 |
| go-yaml-int-map-keys | [git diff --stat](go-yaml-int-map-keys/07-git-diff-stat.raw.txt) → [muffle](go-yaml-int-map-keys/07-git-diff-stat.muffle.txt) | 72 | 72 | 0% | 0 |
| go-yaml-int-map-keys | [ls -la](go-yaml-int-map-keys/08-ls-la.raw.txt) → [muffle](go-yaml-int-map-keys/08-ls-la.muffle.txt) | 2,274 | 597 | 74% | 419 |
| go-yaml-int-map-keys | [find](go-yaml-int-map-keys/09-find.raw.txt) → [muffle](go-yaml-int-map-keys/09-find.muffle.txt) | 827 | 729 | 12% | 24 |
| go-yaml-int-map-keys | [grep -rn map](go-yaml-int-map-keys/10-grep-rn-map.raw.txt) → [muffle](go-yaml-int-map-keys/10-grep-rn-map.muffle.txt) | 67,322 | 11,536 | 83% | 13,946 |
| go-yaml-int-map-keys | [cat decode.go](go-yaml-int-map-keys/11-cat-decode-go.raw.txt) → [muffle](go-yaml-int-map-keys/11-cat-decode-go.muffle.txt) | 51,132 | 8,700 | 83% | 10,608 |
| python-attrs-pre-init-defaults | [task tests](python-attrs-pre-init-defaults/01-task-tests.raw.txt) → [muffle](python-attrs-pre-init-defaults/01-task-tests.muffle.txt) | 4,042 | 811 | 80% | 807 |
| python-attrs-pre-init-defaults | [git status](python-attrs-pre-init-defaults/03-git-status.raw.txt) → [muffle](python-attrs-pre-init-defaults/03-git-status.muffle.txt) | 390 | 68 | 83% | 80 |
| python-attrs-pre-init-defaults | [git diff](python-attrs-pre-init-defaults/04-git-diff.raw.txt) → [muffle](python-attrs-pre-init-defaults/04-git-diff.muffle.txt) | 2,197 | 1,369 | 38% | 207 |
| python-attrs-pre-init-defaults | [git diff --stat](python-attrs-pre-init-defaults/05-git-diff-stat.raw.txt) → [muffle](python-attrs-pre-init-defaults/05-git-diff-stat.muffle.txt) | 86 | 86 | 0% | 0 |
| python-attrs-pre-init-defaults | [ls -la](python-attrs-pre-init-defaults/06-ls-la.raw.txt) → [muffle](python-attrs-pre-init-defaults/06-ls-la.muffle.txt) | 1,482 | 423 | 72% | 264 |
| python-attrs-pre-init-defaults | [find](python-attrs-pre-init-defaults/07-find.raw.txt) → [muffle](python-attrs-pre-init-defaults/07-find.muffle.txt) | 1,246 | 874 | 30% | 93 |
| python-attrs-pre-init-defaults | [grep -rn __attrs_pre_init__](python-attrs-pre-init-defaults/08-grep-rn-attrs-pre-init.raw.txt) → [muffle](python-attrs-pre-init-defaults/08-grep-rn-attrs-pre-init.muffle.txt) | 4,878 | 4,418 | 10% | 115 |
| python-attrs-pre-init-defaults | [cat src/attr/_make.py](python-attrs-pre-init-defaults/09-cat-src-attr-make-py.raw.txt) → [muffle](python-attrs-pre-init-defaults/09-cat-src-attr-make-py.muffle.txt) | 96,664 | 22,071 | 78% | 18,648 |
| python-click-choice-double-brackets | [task tests](python-click-choice-double-brackets/01-task-tests.raw.txt) → [muffle](python-click-choice-double-brackets/01-task-tests.muffle.txt) | 2,659 | 1,016 | 62% | 410 |
| python-click-choice-double-brackets | [git status](python-click-choice-double-brackets/03-git-status.raw.txt) → [muffle](python-click-choice-double-brackets/03-git-status.muffle.txt) | 303 | 52 | 83% | 62 |
| python-click-choice-double-brackets | [git diff](python-click-choice-double-brackets/04-git-diff.raw.txt) → [muffle](python-click-choice-double-brackets/04-git-diff.muffle.txt) | 1,358 | 955 | 30% | 100 |
| python-click-choice-double-brackets | [git diff --stat](python-click-choice-double-brackets/05-git-diff-stat.raw.txt) → [muffle](python-click-choice-double-brackets/05-git-diff-stat.muffle.txt) | 106 | 106 | 0% | 0 |
| python-click-choice-double-brackets | [ls -la](python-click-choice-double-brackets/06-ls-la.raw.txt) → [muffle](python-click-choice-double-brackets/06-ls-la.muffle.txt) | 1,113 | 316 | 72% | 199 |
| python-click-choice-double-brackets | [find](python-click-choice-double-brackets/07-find.raw.txt) → [muffle](python-click-choice-double-brackets/07-find.muffle.txt) | 1,831 | 1,319 | 28% | 128 |
| python-click-choice-double-brackets | [grep -rn Choice](python-click-choice-double-brackets/08-grep-rn-choice.raw.txt) → [muffle](python-click-choice-double-brackets/08-grep-rn-choice.muffle.txt) | 7,562 | 5,991 | 21% | 392 |
| python-click-choice-double-brackets | [cat src/click/core.py](python-click-choice-double-brackets/09-cat-src-click-core-py.raw.txt) → [muffle](python-click-choice-double-brackets/09-cat-src-click-core-py.muffle.txt) | 140,209 | 48,742 | 66% | 22,866 |
| python-feat-inflect-number-to-currency | [task tests](python-feat-inflect-number-to-currency/01-task-tests.raw.txt) → [muffle](python-feat-inflect-number-to-currency/01-task-tests.muffle.txt) | 2,927 | 1,273 | 57% | 413 |
| python-feat-inflect-number-to-currency | [git status](python-feat-inflect-number-to-currency/03-git-status.raw.txt) → [muffle](python-feat-inflect-number-to-currency/03-git-status.muffle.txt) | 419 | 87 | 80% | 83 |
| python-feat-inflect-number-to-currency | [git diff](python-feat-inflect-number-to-currency/04-git-diff.raw.txt) → [muffle](python-feat-inflect-number-to-currency/04-git-diff.muffle.txt) | 3,044 | 2,276 | 26% | 192 |
| python-feat-inflect-number-to-currency | [git diff --stat](python-feat-inflect-number-to-currency/05-git-diff-stat.raw.txt) → [muffle](python-feat-inflect-number-to-currency/05-git-diff-stat.muffle.txt) | 148 | 148 | 0% | 0 |
| python-feat-inflect-number-to-currency | [ls -la](python-feat-inflect-number-to-currency/06-ls-la.raw.txt) → [muffle](python-feat-inflect-number-to-currency/06-ls-la.muffle.txt) | 1,365 | 404 | 71% | 240 |
| python-feat-inflect-number-to-currency | [find](python-feat-inflect-number-to-currency/07-find.raw.txt) → [muffle](python-feat-inflect-number-to-currency/07-find.muffle.txt) | 518 | 401 | 23% | 29 |
| python-feat-inflect-number-to-currency | [grep -rn number_to_words](python-feat-inflect-number-to-currency/08-grep-rn-number-to-words.raw.txt) → [muffle](python-feat-inflect-number-to-currency/08-grep-rn-number-to-words.muffle.txt) | 7,947 | 5,181 | 35% | 691 |
| python-feat-inflect-number-to-currency | [cat inflect/__init__.py](python-feat-inflect-number-to-currency/09-cat-inflect-init-py.raw.txt) → [muffle](python-feat-inflect-number-to-currency/09-cat-inflect-init-py.muffle.txt) | 107,875 | 107,875 | 0% | 0 |
| python-feat-packaging-requirement-replace | [task tests](python-feat-packaging-requirement-replace/01-task-tests.raw.txt) → [muffle](python-feat-packaging-requirement-replace/01-task-tests.muffle.txt) | 12,141 | 2,770 | 78% | 2,342 |
| python-feat-packaging-requirement-replace | [git status](python-feat-packaging-requirement-replace/03-git-status.raw.txt) → [muffle](python-feat-packaging-requirement-replace/03-git-status.muffle.txt) | 291 | 50 | 83% | 60 |
| python-feat-packaging-requirement-replace | [git diff](python-feat-packaging-requirement-replace/04-git-diff.raw.txt) → [muffle](python-feat-packaging-requirement-replace/04-git-diff.muffle.txt) | 3,433 | 2,578 | 25% | 213 |
| python-feat-packaging-requirement-replace | [git diff --stat](python-feat-packaging-requirement-replace/05-git-diff-stat.raw.txt) → [muffle](python-feat-packaging-requirement-replace/05-git-diff-stat.muffle.txt) | 129 | 129 | 0% | 0 |
| python-feat-packaging-requirement-replace | [ls -la](python-feat-packaging-requirement-replace/06-ls-la.raw.txt) → [muffle](python-feat-packaging-requirement-replace/06-ls-la.muffle.txt) | 1,334 | 390 | 71% | 236 |
| python-feat-packaging-requirement-replace | [find](python-feat-packaging-requirement-replace/07-find.raw.txt) → [muffle](python-feat-packaging-requirement-replace/07-find.muffle.txt) | 2,195 | 1,435 | 35% | 190 |
| python-feat-packaging-requirement-replace | [grep -rn packaging](python-feat-packaging-requirement-replace/08-grep-rn-packaging.raw.txt) → [muffle](python-feat-packaging-requirement-replace/08-grep-rn-packaging.muffle.txt) | 55,168 | 14,925 | 73% | 10,060 |
| python-feat-packaging-requirement-replace | [cat src/packaging/requirements.py](python-feat-packaging-requirement-replace/09-cat-src-packaging-requirements-py.raw.txt) → [muffle](python-feat-packaging-requirement-replace/09-cat-src-packaging-requirements-py.muffle.txt) | 7,647 | 7,647 | 0% | 0 |
| python-feat-tenacity-wait-exception | [task tests](python-feat-tenacity-wait-exception/01-task-tests.raw.txt) → [muffle](python-feat-tenacity-wait-exception/01-task-tests.muffle.txt) | 997 | 997 | 0% | 0 |
| python-feat-tenacity-wait-exception | [git status](python-feat-tenacity-wait-exception/03-git-status.raw.txt) → [muffle](python-feat-tenacity-wait-exception/03-git-status.muffle.txt) | 312 | 61 | 81% | 62 |
| python-feat-tenacity-wait-exception | [git diff](python-feat-tenacity-wait-exception/04-git-diff.raw.txt) → [muffle](python-feat-tenacity-wait-exception/04-git-diff.muffle.txt) | 2,434 | 1,901 | 22% | 133 |
| python-feat-tenacity-wait-exception | [git diff --stat](python-feat-tenacity-wait-exception/05-git-diff-stat.raw.txt) → [muffle](python-feat-tenacity-wait-exception/05-git-diff-stat.muffle.txt) | 132 | 132 | 0% | 0 |
| python-feat-tenacity-wait-exception | [ls -la](python-feat-tenacity-wait-exception/06-ls-la.raw.txt) → [muffle](python-feat-tenacity-wait-exception/06-ls-la.muffle.txt) | 1,141 | 338 | 71% | 200 |
| python-feat-tenacity-wait-exception | [find](python-feat-tenacity-wait-exception/07-find.raw.txt) → [muffle](python-feat-tenacity-wait-exception/07-find.muffle.txt) | 467 | 335 | 29% | 33 |
| python-feat-tenacity-wait-exception | [grep -rn Retry](python-feat-tenacity-wait-exception/08-grep-rn-retry.raw.txt) → [muffle](python-feat-tenacity-wait-exception/08-grep-rn-retry.muffle.txt) | 25,390 | 13,321 | 48% | 3,017 |
| python-feat-tenacity-wait-exception | [cat tenacity/__init__.py](python-feat-tenacity-wait-exception/09-cat-tenacity-init-py.raw.txt) → [muffle](python-feat-tenacity-wait-exception/09-cat-tenacity-init-py.muffle.txt) | 23,982 | 23,982 | 0% | 0 |
| python-marshmallow-constant-required | [task tests](python-marshmallow-constant-required/01-task-tests.raw.txt) → [muffle](python-marshmallow-constant-required/01-task-tests.muffle.txt) | 3,444 | 1,015 | 71% | 607 |
| python-marshmallow-constant-required | [git status](python-marshmallow-constant-required/03-git-status.raw.txt) → [muffle](python-marshmallow-constant-required/03-git-status.muffle.txt) | 339 | 78 | 77% | 65 |
| python-marshmallow-constant-required | [git diff](python-marshmallow-constant-required/04-git-diff.raw.txt) → [muffle](python-marshmallow-constant-required/04-git-diff.muffle.txt) | 2,087 | 1,483 | 29% | 151 |
| python-marshmallow-constant-required | [git diff --stat](python-marshmallow-constant-required/05-git-diff-stat.raw.txt) → [muffle](python-marshmallow-constant-required/05-git-diff-stat.muffle.txt) | 168 | 168 | 0% | 0 |
| python-marshmallow-constant-required | [ls -la](python-marshmallow-constant-required/06-ls-la.raw.txt) → [muffle](python-marshmallow-constant-required/06-ls-la.muffle.txt) | 1,392 | 406 | 71% | 246 |
| python-marshmallow-constant-required | [find](python-marshmallow-constant-required/07-find.raw.txt) → [muffle](python-marshmallow-constant-required/07-find.muffle.txt) | 1,116 | 766 | 32% | 87 |
| python-marshmallow-constant-required | [grep -rn fields](python-marshmallow-constant-required/08-grep-rn-fields.raw.txt) → [muffle](python-marshmallow-constant-required/08-grep-rn-fields.muffle.txt) | 175,810 | 12,162 | 94% | 40,912 |
| python-marshmallow-constant-required | [cat src/marshmallow/fields.py](python-marshmallow-constant-required/09-cat-src-marshmallow-fields-py.raw.txt) → [muffle](python-marshmallow-constant-required/09-cat-src-marshmallow-fields-py.muffle.txt) | 72,791 | 72,791 | 0% | 0 |
| python-more-itertools-value-chain-typeerror | [task tests](python-more-itertools-value-chain-typeerror/01-task-tests.raw.txt) → [muffle](python-more-itertools-value-chain-typeerror/01-task-tests.muffle.txt) | 1,711 | 1,711 | 0% | 0 |
| python-more-itertools-value-chain-typeerror | [git status](python-more-itertools-value-chain-typeerror/03-git-status.raw.txt) → [muffle](python-more-itertools-value-chain-typeerror/03-git-status.muffle.txt) | 284 | 43 | 85% | 60 |
| python-more-itertools-value-chain-typeerror | [git diff](python-more-itertools-value-chain-typeerror/04-git-diff.raw.txt) → [muffle](python-more-itertools-value-chain-typeerror/04-git-diff.muffle.txt) | 466 | 318 | 32% | 37 |
| python-more-itertools-value-chain-typeerror | [git diff --stat](python-more-itertools-value-chain-typeerror/05-git-diff-stat.raw.txt) → [muffle](python-more-itertools-value-chain-typeerror/05-git-diff-stat.muffle.txt) | 81 | 81 | 0% | 0 |
| python-more-itertools-value-chain-typeerror | [ls -la](python-more-itertools-value-chain-typeerror/06-ls-la.raw.txt) → [muffle](python-more-itertools-value-chain-typeerror/06-ls-la.muffle.txt) | 1,070 | 313 | 71% | 189 |
| python-more-itertools-value-chain-typeerror | [find](python-more-itertools-value-chain-typeerror/07-find.raw.txt) → [muffle](python-more-itertools-value-chain-typeerror/07-find.muffle.txt) | 162 | 120 | 26% | 10 |
| python-more-itertools-value-chain-typeerror | [grep -rn value_chain](python-more-itertools-value-chain-typeerror/08-grep-rn-value-chain.raw.txt) → [muffle](python-more-itertools-value-chain-typeerror/08-grep-rn-value-chain.muffle.txt) | 1,830 | 1,497 | 19% | 83 |
| python-more-itertools-value-chain-typeerror | [cat more_itertools/more.py](python-more-itertools-value-chain-typeerror/09-cat-more-itertools-more-py.raw.txt) → [muffle](python-more-itertools-value-chain-typeerror/09-cat-more-itertools-more-py.muffle.txt) | 173,290 | 36,631 | 79% | 34,164 |
| python-tomlkit-aot-dotted-key | [task tests](python-tomlkit-aot-dotted-key/01-task-tests.raw.txt) → [muffle](python-tomlkit-aot-dotted-key/01-task-tests.muffle.txt) | 1,140 | 409 | 65% | 182 |
| python-tomlkit-aot-dotted-key | [git status](python-tomlkit-aot-dotted-key/03-git-status.raw.txt) → [muffle](python-tomlkit-aot-dotted-key/03-git-status.muffle.txt) | 308 | 57 | 82% | 62 |
| python-tomlkit-aot-dotted-key | [git diff](python-tomlkit-aot-dotted-key/04-git-diff.raw.txt) → [muffle](python-tomlkit-aot-dotted-key/04-git-diff.muffle.txt) | 3,528 | 2,075 | 42% | 363 |
| python-tomlkit-aot-dotted-key | [git diff --stat](python-tomlkit-aot-dotted-key/05-git-diff-stat.raw.txt) → [muffle](python-tomlkit-aot-dotted-key/05-git-diff-stat.muffle.txt) | 119 | 119 | 0% | 0 |
| python-tomlkit-aot-dotted-key | [ls -la](python-tomlkit-aot-dotted-key/06-ls-la.raw.txt) → [muffle](python-tomlkit-aot-dotted-key/06-ls-la.muffle.txt) | 1,076 | 324 | 70% | 188 |
| python-tomlkit-aot-dotted-key | [find](python-tomlkit-aot-dotted-key/07-find.raw.txt) → [muffle](python-tomlkit-aot-dotted-key/07-find.muffle.txt) | 541 | 369 | 32% | 43 |
| python-tomlkit-aot-dotted-key | [grep -rn python](python-tomlkit-aot-dotted-key/08-grep-rn-python.raw.txt) → [muffle](python-tomlkit-aot-dotted-key/08-grep-rn-python.muffle.txt) | 30,222 | 12,820 | 58% | 4,350 |
| python-tomlkit-aot-dotted-key | [cat tomlkit/container.py](python-tomlkit-aot-dotted-key/09-cat-tomlkit-container-py.raw.txt) → [muffle](python-tomlkit-aot-dotted-key/09-cat-tomlkit-container-py.muffle.txt) | 48,442 | 8,219 | 84% | 10,055 |
| rust-chrono-iter-days-rev | [task tests](rust-chrono-iter-days-rev/01-task-tests.raw.txt) → [muffle](rust-chrono-iter-days-rev/01-task-tests.muffle.txt) | 1,426 | 972 | 32% | 113 |
| rust-chrono-iter-days-rev | [cargo build](rust-chrono-iter-days-rev/02-cargo-build.raw.txt) → [muffle](rust-chrono-iter-days-rev/02-cargo-build.muffle.txt) | 178 | 22 | 88% | 39 |
| rust-chrono-iter-days-rev | [cargo test](rust-chrono-iter-days-rev/03-cargo-test.raw.txt) → [muffle](rust-chrono-iter-days-rev/03-cargo-test.muffle.txt) | 18,625 | 913 | 96% | 4,428 |
| rust-chrono-iter-days-rev | [cargo clippy --all-targets](rust-chrono-iter-days-rev/04-cargo-clippy-all-targets.raw.txt) → [muffle](rust-chrono-iter-days-rev/04-cargo-clippy-all-targets.muffle.txt) | 178 | 22 | 88% | 39 |
| rust-chrono-iter-days-rev | [git status](rust-chrono-iter-days-rev/05-git-status.raw.txt) → [muffle](rust-chrono-iter-days-rev/05-git-status.muffle.txt) | 283 | 42 | 86% | 60 |
| rust-chrono-iter-days-rev | [git diff](rust-chrono-iter-days-rev/06-git-diff.raw.txt) → [muffle](rust-chrono-iter-days-rev/06-git-diff.muffle.txt) | 6,885 | 6,180 | 11% | 176 |
| rust-chrono-iter-days-rev | [git diff --stat](rust-chrono-iter-days-rev/07-git-diff-stat.raw.txt) → [muffle](rust-chrono-iter-days-rev/07-git-diff-stat.muffle.txt) | 131 | 131 | 0% | 0 |
| rust-chrono-iter-days-rev | [ls -la](rust-chrono-iter-days-rev/08-ls-la.raw.txt) → [muffle](rust-chrono-iter-days-rev/08-ls-la.muffle.txt) | 1,178 | 311 | 74% | 216 |
| rust-chrono-iter-days-rev | [find](rust-chrono-iter-days-rev/09-find.raw.txt) → [muffle](rust-chrono-iter-days-rev/09-find.muffle.txt) | 1,226 | 797 | 35% | 107 |
| rust-chrono-iter-days-rev | [grep -rn NaiveDate](rust-chrono-iter-days-rev/10-grep-rn-naivedate.raw.txt) → [muffle](rust-chrono-iter-days-rev/10-grep-rn-naivedate.muffle.txt) | 185,899 | 15,413 | 92% | 42,621 |
| rust-chrono-iter-days-rev | [cat src/naive/date/mod.rs](rust-chrono-iter-days-rev/11-cat-src-naive-date-mod-rs.raw.txt) → [muffle](rust-chrono-iter-days-rev/11-cat-src-naive-date-mod-rs.muffle.txt) | 95,929 | 95,929 | 0% | 0 |
| rust-feat-bytes-extend-from-within | [task tests](rust-feat-bytes-extend-from-within/01-task-tests.raw.txt) → [muffle](rust-feat-bytes-extend-from-within/01-task-tests.muffle.txt) | 1,316 | 737 | 44% | 144 |
| rust-feat-bytes-extend-from-within | [cargo build](rust-feat-bytes-extend-from-within/02-cargo-build.raw.txt) → [muffle](rust-feat-bytes-extend-from-within/02-cargo-build.muffle.txt) | 72 | 22 | 70% | 12 |
| rust-feat-bytes-extend-from-within | [cargo test](rust-feat-bytes-extend-from-within/03-cargo-test.raw.txt) → [muffle](rust-feat-bytes-extend-from-within/03-cargo-test.muffle.txt) | 1,489 | 737 | 51% | 188 |
| rust-feat-bytes-extend-from-within | [cargo clippy --all-targets](rust-feat-bytes-extend-from-within/04-cargo-clippy-all-targets.raw.txt) → [muffle](rust-feat-bytes-extend-from-within/04-cargo-clippy-all-targets.muffle.txt) | 3,668 | 2,224 | 40% | 361 |
| rust-feat-bytes-extend-from-within | [git status](rust-feat-bytes-extend-from-within/05-git-status.raw.txt) → [muffle](rust-feat-bytes-extend-from-within/05-git-status.muffle.txt) | 328 | 67 | 80% | 65 |
| rust-feat-bytes-extend-from-within | [git diff](rust-feat-bytes-extend-from-within/06-git-diff.raw.txt) → [muffle](rust-feat-bytes-extend-from-within/06-git-diff.muffle.txt) | 4,059 | 3,446 | 16% | 153 |
| rust-feat-bytes-extend-from-within | [git diff --stat](rust-feat-bytes-extend-from-within/07-git-diff-stat.raw.txt) → [muffle](rust-feat-bytes-extend-from-within/07-git-diff-stat.muffle.txt) | 225 | 225 | 0% | 0 |
| rust-feat-bytes-extend-from-within | [ls -la](rust-feat-bytes-extend-from-within/08-ls-la.raw.txt) → [muffle](rust-feat-bytes-extend-from-within/08-ls-la.muffle.txt) | 925 | 252 | 73% | 168 |
| rust-feat-bytes-extend-from-within | [find](rust-feat-bytes-extend-from-within/09-find.raw.txt) → [muffle](rust-feat-bytes-extend-from-within/09-find.muffle.txt) | 694 | 493 | 29% | 50 |
| rust-feat-bytes-extend-from-within | [grep -rn Vec](rust-feat-bytes-extend-from-within/10-grep-rn-vec.raw.txt) → [muffle](rust-feat-bytes-extend-from-within/10-grep-rn-vec.muffle.txt) | 11,991 | 7,837 | 35% | 1,038 |
| rust-feat-bytes-extend-from-within | [cat src/bytes_mut.rs](rust-feat-bytes-extend-from-within/11-cat-src-bytes-mut-rs.raw.txt) → [muffle](rust-feat-bytes-extend-from-within/11-cat-src-bytes-mut-rs.muffle.txt) | 60,242 | 60,242 | 0% | 0 |
| rust-feat-itertools-strip-prefix | [task tests](rust-feat-itertools-strip-prefix/01-task-tests.raw.txt) → [muffle](rust-feat-itertools-strip-prefix/01-task-tests.muffle.txt) | 2,126 | 1,134 | 47% | 248 |
| rust-feat-itertools-strip-prefix | [cargo build](rust-feat-itertools-strip-prefix/02-cargo-build.raw.txt) → [muffle](rust-feat-itertools-strip-prefix/02-cargo-build.muffle.txt) | 72 | 22 | 70% | 12 |
| rust-feat-itertools-strip-prefix | [cargo test](rust-feat-itertools-strip-prefix/03-cargo-test.raw.txt) → [muffle](rust-feat-itertools-strip-prefix/03-cargo-test.muffle.txt) | 2,301 | 1,134 | 51% | 291 |
| rust-feat-itertools-strip-prefix | [cargo clippy --all-targets](rust-feat-itertools-strip-prefix/04-cargo-clippy-all-targets.raw.txt) → [muffle](rust-feat-itertools-strip-prefix/04-cargo-clippy-all-targets.muffle.txt) | 2,712 | 1,483 | 46% | 307 |
| rust-feat-itertools-strip-prefix | [git status](rust-feat-itertools-strip-prefix/05-git-status.raw.txt) → [muffle](rust-feat-itertools-strip-prefix/05-git-status.muffle.txt) | 272 | 31 | 89% | 60 |
| rust-feat-itertools-strip-prefix | [git diff](rust-feat-itertools-strip-prefix/06-git-diff.raw.txt) → [muffle](rust-feat-itertools-strip-prefix/06-git-diff.muffle.txt) | 3,894 | 3,788 | 3% | 26 |
| rust-feat-itertools-strip-prefix | [git diff --stat](rust-feat-itertools-strip-prefix/07-git-diff-stat.raw.txt) → [muffle](rust-feat-itertools-strip-prefix/07-git-diff-stat.muffle.txt) | 114 | 114 | 0% | 0 |
| rust-feat-itertools-strip-prefix | [ls -la](rust-feat-itertools-strip-prefix/08-ls-la.raw.txt) → [muffle](rust-feat-itertools-strip-prefix/08-ls-la.muffle.txt) | 1,002 | 287 | 72% | 178 |
| rust-feat-itertools-strip-prefix | [find](rust-feat-itertools-strip-prefix/09-find.raw.txt) → [muffle](rust-feat-itertools-strip-prefix/09-find.muffle.txt) | 1,698 | 1,271 | 26% | 106 |
| rust-feat-itertools-strip-prefix | [grep -rn str](rust-feat-itertools-strip-prefix/10-grep-rn-str.raw.txt) → [muffle](rust-feat-itertools-strip-prefix/10-grep-rn-str.muffle.txt) | 26,767 | 12,029 | 56% | 3,684 |
| rust-feat-itertools-strip-prefix | [cat src/lib.rs](rust-feat-itertools-strip-prefix/11-cat-src-lib-rs.raw.txt) → [muffle](rust-feat-itertools-strip-prefix/11-cat-src-lib-rs.muffle.txt) | 181,713 | 181,713 | 0% | 0 |
| rust-feat-slab-get-disjoint-mut | [task tests](rust-feat-slab-get-disjoint-mut/01-task-tests.raw.txt) → [muffle](rust-feat-slab-get-disjoint-mut/01-task-tests.muffle.txt) | 4,423 | 2,131 | 52% | 573 |
| rust-feat-slab-get-disjoint-mut | [cargo build](rust-feat-slab-get-disjoint-mut/02-cargo-build.raw.txt) → [muffle](rust-feat-slab-get-disjoint-mut/02-cargo-build.muffle.txt) | 72 | 22 | 70% | 12 |
| rust-feat-slab-get-disjoint-mut | [cargo test](rust-feat-slab-get-disjoint-mut/03-cargo-test.raw.txt) → [muffle](rust-feat-slab-get-disjoint-mut/03-cargo-test.muffle.txt) | 4,532 | 2,131 | 53% | 600 |
| rust-feat-slab-get-disjoint-mut | [cargo clippy --all-targets](rust-feat-slab-get-disjoint-mut/04-cargo-clippy-all-targets.raw.txt) → [muffle](rust-feat-slab-get-disjoint-mut/04-cargo-clippy-all-targets.muffle.txt) | 4,532 | 2,131 | 53% | 600 |
| rust-feat-slab-get-disjoint-mut | [git status](rust-feat-slab-get-disjoint-mut/05-git-status.raw.txt) → [muffle](rust-feat-slab-get-disjoint-mut/05-git-status.muffle.txt) | 296 | 45 | 85% | 62 |
| rust-feat-slab-get-disjoint-mut | [git diff](rust-feat-slab-get-disjoint-mut/06-git-diff.raw.txt) → [muffle](rust-feat-slab-get-disjoint-mut/06-git-diff.muffle.txt) | 3,817 | 3,303 | 14% | 128 |
| rust-feat-slab-get-disjoint-mut | [git diff --stat](rust-feat-slab-get-disjoint-mut/07-git-diff-stat.raw.txt) → [muffle](rust-feat-slab-get-disjoint-mut/07-git-diff-stat.muffle.txt) | 150 | 150 | 0% | 0 |
| rust-feat-slab-get-disjoint-mut | [ls -la](rust-feat-slab-get-disjoint-mut/08-ls-la.raw.txt) → [muffle](rust-feat-slab-get-disjoint-mut/08-ls-la.muffle.txt) | 693 | 206 | 71% | 121 |
| rust-feat-slab-get-disjoint-mut | [find](rust-feat-slab-get-disjoint-mut/09-find.raw.txt) → [muffle](rust-feat-slab-get-disjoint-mut/09-find.muffle.txt) | 78 | 65 | 17% | 3 |
| rust-feat-slab-get-disjoint-mut | [grep -rn Slab](rust-feat-slab-get-disjoint-mut/10-grep-rn-slab.raw.txt) → [muffle](rust-feat-slab-get-disjoint-mut/10-grep-rn-slab.muffle.txt) | 9,261 | 3,758 | 60% | 1,375 |
| rust-feat-slab-get-disjoint-mut | [cat src/lib.rs](rust-feat-slab-get-disjoint-mut/11-cat-src-lib-rs.raw.txt) → [muffle](rust-feat-slab-get-disjoint-mut/11-cat-src-lib-rs.muffle.txt) | 45,256 | 45,256 | 0% | 0 |
| rust-http-headermap-size-hint | [task tests](rust-http-headermap-size-hint/01-task-tests.raw.txt) → [muffle](rust-http-headermap-size-hint/01-task-tests.muffle.txt) | 413 | 254 | 39% | 39 |
| rust-http-headermap-size-hint | [cargo build](rust-http-headermap-size-hint/02-cargo-build.raw.txt) → [muffle](rust-http-headermap-size-hint/02-cargo-build.muffle.txt) | 72 | 22 | 70% | 12 |
| rust-http-headermap-size-hint | [cargo test](rust-http-headermap-size-hint/03-cargo-test.raw.txt) → [muffle](rust-http-headermap-size-hint/03-cargo-test.muffle.txt) | 10,307 | 217 | 98% | 2,522 |
| rust-http-headermap-size-hint | [cargo clippy --all-targets](rust-http-headermap-size-hint/04-cargo-clippy-all-targets.raw.txt) → [muffle](rust-http-headermap-size-hint/04-cargo-clippy-all-targets.muffle.txt) | 3,346 | 2,564 | 24% | 195 |
| rust-http-headermap-size-hint | [git status](rust-http-headermap-size-hint/05-git-status.raw.txt) → [muffle](rust-http-headermap-size-hint/05-git-status.muffle.txt) | 279 | 38 | 87% | 60 |
| rust-http-headermap-size-hint | [git diff](rust-http-headermap-size-hint/06-git-diff.raw.txt) → [muffle](rust-http-headermap-size-hint/06-git-diff.muffle.txt) | 1,421 | 920 | 36% | 125 |
| rust-http-headermap-size-hint | [git diff --stat](rust-http-headermap-size-hint/07-git-diff-stat.raw.txt) → [muffle](rust-http-headermap-size-hint/07-git-diff-stat.muffle.txt) | 87 | 87 | 0% | 0 |
| rust-http-headermap-size-hint | [ls -la](rust-http-headermap-size-hint/08-ls-la.raw.txt) → [muffle](rust-http-headermap-size-hint/08-ls-la.muffle.txt) | 944 | 250 | 74% | 173 |
| rust-http-headermap-size-hint | [find](rust-http-headermap-size-hint/09-find.raw.txt) → [muffle](rust-http-headermap-size-hint/09-find.muffle.txt) | 764 | 526 | 32% | 59 |
| rust-http-headermap-size-hint | [grep -rn size_hint](rust-http-headermap-size-hint/10-grep-rn-size-hint.raw.txt) → [muffle](rust-http-headermap-size-hint/10-grep-rn-size-hint.muffle.txt) | 1,838 | 1,370 | 26% | 117 |
| rust-http-headermap-size-hint | [cat src/header/map.rs](rust-http-headermap-size-hint/11-cat-src-header-map-rs.raw.txt) → [muffle](rust-http-headermap-size-hint/11-cat-src-header-map-rs.muffle.txt) | 122,904 | 122,904 | 0% | 0 |
| rust-time-strftime-padding-panic | [task tests](rust-time-strftime-padding-panic/01-task-tests.raw.txt) → [muffle](rust-time-strftime-padding-panic/01-task-tests.muffle.txt) | 7,192 | 6,623 | 8% | 142 |
| rust-time-strftime-padding-panic | [cargo build](rust-time-strftime-padding-panic/02-cargo-build.raw.txt) → [muffle](rust-time-strftime-padding-panic/02-cargo-build.muffle.txt) | 43,847 | 40,944 | 7% | 725 |
| rust-time-strftime-padding-panic | [cargo test](rust-time-strftime-padding-panic/03-cargo-test.raw.txt) → [muffle](rust-time-strftime-padding-panic/03-cargo-test.muffle.txt) | 45,520 | 41,411 | 10% | 1,027 |
| rust-time-strftime-padding-panic | [cargo clippy --all-targets](rust-time-strftime-padding-panic/04-cargo-clippy-all-targets.raw.txt) → [muffle](rust-time-strftime-padding-panic/04-cargo-clippy-all-targets.muffle.txt) | 145,686 | 95,495 | 35% | 12,547 |
| rust-time-strftime-padding-panic | [git status](rust-time-strftime-padding-panic/05-git-status.raw.txt) → [muffle](rust-time-strftime-padding-panic/05-git-status.muffle.txt) | 307 | 66 | 79% | 60 |
| rust-time-strftime-padding-panic | [git diff](rust-time-strftime-padding-panic/06-git-diff.raw.txt) → [muffle](rust-time-strftime-padding-panic/06-git-diff.muffle.txt) | 1,631 | 1,334 | 19% | 74 |
| rust-time-strftime-padding-panic | [git diff --stat](rust-time-strftime-padding-panic/07-git-diff-stat.raw.txt) → [muffle](rust-time-strftime-padding-panic/07-git-diff-stat.muffle.txt) | 125 | 125 | 0% | 0 |
| rust-time-strftime-padding-panic | [ls -la](rust-time-strftime-padding-panic/08-ls-la.raw.txt) → [muffle](rust-time-strftime-padding-panic/08-ls-la.muffle.txt) | 1,180 | 346 | 71% | 208 |
| rust-time-strftime-padding-panic | [find](rust-time-strftime-padding-panic/09-find.raw.txt) → [muffle](rust-time-strftime-padding-panic/09-find.muffle.txt) | 6,372 | 3,444 | 46% | 732 |
| rust-time-strftime-padding-panic | [grep -rn time](rust-time-strftime-padding-panic/10-grep-rn-time.raw.txt) → [muffle](rust-time-strftime-padding-panic/10-grep-rn-time.muffle.txt) | 430,155 | 12,497 | 98% | 104,414 |
| rust-time-strftime-padding-panic | [cat time/src/format_description/parse/strftime.rs](rust-time-strftime-padding-panic/11-cat-time-src-format-description-parse-st.raw.txt) → [muffle](rust-time-strftime-padding-panic/11-cat-time-src-format-description-parse-st.muffle.txt) | 14,446 | 2,392 | 84% | 3,013 |
| rust-toml-value-datetime | [task tests](rust-toml-value-datetime/01-task-tests.raw.txt) → [muffle](rust-toml-value-datetime/01-task-tests.muffle.txt) | 955 | 645 | 33% | 77 |
| rust-toml-value-datetime | [cargo build](rust-toml-value-datetime/02-cargo-build.raw.txt) → [muffle](rust-toml-value-datetime/02-cargo-build.muffle.txt) | 1,727 | 22 | 99% | 426 |
| rust-toml-value-datetime | [cargo test](rust-toml-value-datetime/03-cargo-test.raw.txt) → [muffle](rust-toml-value-datetime/03-cargo-test.muffle.txt) | 119,772 | 1,873 | 99% | 29,474 |
| rust-toml-value-datetime | [cargo clippy --all-targets](rust-toml-value-datetime/04-cargo-clippy-all-targets.raw.txt) → [muffle](rust-toml-value-datetime/04-cargo-clippy-all-targets.muffle.txt) | 7,978 | 291 | 97% | 1,921 |
| rust-toml-value-datetime | [git status](rust-toml-value-datetime/05-git-status.raw.txt) → [muffle](rust-toml-value-datetime/05-git-status.muffle.txt) | 324 | 73 | 78% | 62 |
| rust-toml-value-datetime | [git diff](rust-toml-value-datetime/06-git-diff.raw.txt) → [muffle](rust-toml-value-datetime/06-git-diff.muffle.txt) | 1,972 | 1,643 | 17% | 82 |
| rust-toml-value-datetime | [git diff --stat](rust-toml-value-datetime/07-git-diff-stat.raw.txt) → [muffle](rust-toml-value-datetime/07-git-diff-stat.muffle.txt) | 148 | 148 | 0% | 0 |
| rust-toml-value-datetime | [ls -la](rust-toml-value-datetime/08-ls-la.raw.txt) → [muffle](rust-toml-value-datetime/08-ls-la.muffle.txt) | 1,224 | 369 | 70% | 213 |
| rust-toml-value-datetime | [find](rust-toml-value-datetime/09-find.raw.txt) → [muffle](rust-toml-value-datetime/09-find.muffle.txt) | 6,265 | 3,235 | 49% | 757 |
| rust-toml-value-datetime | [grep -rn toml](rust-toml-value-datetime/10-grep-rn-toml.raw.txt) → [muffle](rust-toml-value-datetime/10-grep-rn-toml.muffle.txt) | 189,967 | 12,835 | 94% | 44,283 |
| rust-toml-value-datetime | [cat crates/toml/src/value.rs](rust-toml-value-datetime/11-cat-crates-toml-src-value-rs.raw.txt) → [muffle](rust-toml-value-datetime/11-cat-crates-toml-src-value-rs.muffle.txt) | 35,394 | 35,394 | 0% | 0 |
| rust-url-path-caret | [task tests](rust-url-path-caret/01-task-tests.raw.txt) → [muffle](rust-url-path-caret/01-task-tests.muffle.txt) | 604 | 347 | 43% | 64 |
| rust-url-path-caret | [cargo build](rust-url-path-caret/02-cargo-build.raw.txt) → [muffle](rust-url-path-caret/02-cargo-build.muffle.txt) | 634 | 22 | 97% | 153 |
| rust-url-path-caret | [cargo test](rust-url-path-caret/03-cargo-test.raw.txt) → [muffle](rust-url-path-caret/03-cargo-test.muffle.txt) | 552,427 | 292 | 100% | 138,033 |
| rust-url-path-caret | [cargo clippy --all-targets](rust-url-path-caret/04-cargo-clippy-all-targets.raw.txt) → [muffle](rust-url-path-caret/04-cargo-clippy-all-targets.muffle.txt) | 558 | 237 | 58% | 80 |
| rust-url-path-caret | [git status](rust-url-path-caret/05-git-status.raw.txt) → [muffle](rust-url-path-caret/05-git-status.muffle.txt) | 279 | 38 | 87% | 60 |
| rust-url-path-caret | [git diff](rust-url-path-caret/06-git-diff.raw.txt) → [muffle](rust-url-path-caret/06-git-diff.muffle.txt) | 1,628 | 1,057 | 36% | 142 |
| rust-url-path-caret | [git diff --stat](rust-url-path-caret/07-git-diff-stat.raw.txt) → [muffle](rust-url-path-caret/07-git-diff-stat.muffle.txt) | 85 | 85 | 0% | 0 |
| rust-url-path-caret | [ls -la](rust-url-path-caret/08-ls-la.raw.txt) → [muffle](rust-url-path-caret/08-ls-la.muffle.txt) | 1,269 | 350 | 73% | 229 |
| rust-url-path-caret | [find](rust-url-path-caret/09-find.raw.txt) → [muffle](rust-url-path-caret/09-find.muffle.txt) | 773 | 559 | 28% | 53 |
| rust-url-path-caret | [grep -rn url](rust-url-path-caret/10-grep-rn-url.raw.txt) → [muffle](rust-url-path-caret/10-grep-rn-url.muffle.txt) | 124,528 | 13,994 | 89% | 27,633 |
| rust-url-path-caret | [cat url/src/parser.rs](rust-url-path-caret/11-cat-url-src-parser-rs.raw.txt) → [muffle](rust-url-path-caret/11-cat-url-src-parser-rs.muffle.txt) | 69,061 | 14,789 | 79% | 13,568 |
| ts-citty-kebab-default | [task tests](ts-citty-kebab-default/01-task-tests.raw.txt) → [muffle](ts-citty-kebab-default/01-task-tests.muffle.txt) | 2,049 | 984 | 52% | 266 |
| ts-citty-kebab-default | [git status](ts-citty-kebab-default/02-git-status.raw.txt) → [muffle](ts-citty-kebab-default/02-git-status.muffle.txt) | 276 | 35 | 88% | 60 |
| ts-citty-kebab-default | [git diff](ts-citty-kebab-default/03-git-diff.raw.txt) → [muffle](ts-citty-kebab-default/03-git-diff.muffle.txt) | 504 | 333 | 34% | 42 |
| ts-citty-kebab-default | [git diff --stat](ts-citty-kebab-default/04-git-diff-stat.raw.txt) → [muffle](ts-citty-kebab-default/04-git-diff-stat.muffle.txt) | 57 | 57 | 0% | 0 |
| ts-citty-kebab-default | [ls -la](ts-citty-kebab-default/05-ls-la.raw.txt) → [muffle](ts-citty-kebab-default/05-ls-la.muffle.txt) | 1,222 | 367 | 70% | 213 |
| ts-citty-kebab-default | [find](ts-citty-kebab-default/06-find.raw.txt) → [muffle](ts-citty-kebab-default/06-find.muffle.txt) | 416 | 306 | 27% | 27 |
| ts-citty-kebab-default | [grep -rn fooBar](ts-citty-kebab-default/07-grep-rn-foobar.raw.txt) → [muffle](ts-citty-kebab-default/07-grep-rn-foobar.muffle.txt) | 173 | 154 | 11% | 4 |
| ts-citty-kebab-default | [cat src/_parser.ts](ts-citty-kebab-default/08-cat-src-parser-ts.raw.txt) → [muffle](ts-citty-kebab-default/08-cat-src-parser-ts.muffle.txt) | 4,725 | 4,725 | 0% | 0 |
| ts-feat-cookie-es-allow-multiple | [task tests](ts-feat-cookie-es-allow-multiple/01-task-tests.raw.txt) → [muffle](ts-feat-cookie-es-allow-multiple/01-task-tests.muffle.txt) | 1,983 | 652 | 68% | 332 |
| ts-feat-cookie-es-allow-multiple | [git status](ts-feat-cookie-es-allow-multiple/02-git-status.raw.txt) → [muffle](ts-feat-cookie-es-allow-multiple/02-git-status.muffle.txt) | 363 | 92 | 75% | 67 |
| ts-feat-cookie-es-allow-multiple | [git diff](ts-feat-cookie-es-allow-multiple/03-git-diff.raw.txt) → [muffle](ts-feat-cookie-es-allow-multiple/03-git-diff.muffle.txt) | 3,908 | 2,789 | 29% | 279 |
| ts-feat-cookie-es-allow-multiple | [git diff --stat](ts-feat-cookie-es-allow-multiple/04-git-diff-stat.raw.txt) → [muffle](ts-feat-cookie-es-allow-multiple/04-git-diff-stat.muffle.txt) | 217 | 217 | 0% | 0 |
| ts-feat-cookie-es-allow-multiple | [ls -la](ts-feat-cookie-es-allow-multiple/05-ls-la.raw.txt) → [muffle](ts-feat-cookie-es-allow-multiple/05-ls-la.muffle.txt) | 1,103 | 335 | 70% | 192 |
| ts-feat-cookie-es-allow-multiple | [find](ts-feat-cookie-es-allow-multiple/06-find.raw.txt) → [muffle](ts-feat-cookie-es-allow-multiple/06-find.muffle.txt) | 329 | 261 | 21% | 17 |
| ts-feat-cookie-es-allow-multiple | [grep -rn parse](ts-feat-cookie-es-allow-multiple/07-grep-rn-parse.raw.txt) → [muffle](ts-feat-cookie-es-allow-multiple/07-grep-rn-parse.muffle.txt) | 11,808 | 8,247 | 31% | 890 |
| ts-feat-cookie-es-allow-multiple | [cat src/cookie/types.ts](ts-feat-cookie-es-allow-multiple/08-cat-src-cookie-types-ts.raw.txt) → [muffle](ts-feat-cookie-es-allow-multiple/08-cat-src-cookie-types-ts.muffle.txt) | 5,989 | 5,989 | 0% | 0 |
| ts-feat-knitwork-dynamic-type-import | [task tests](ts-feat-knitwork-dynamic-type-import/01-task-tests.raw.txt) → [muffle](ts-feat-knitwork-dynamic-type-import/01-task-tests.muffle.txt) | 3,388 | 1,286 | 63% | 525 |
| ts-feat-knitwork-dynamic-type-import | [git status](ts-feat-knitwork-dynamic-type-import/02-git-status.raw.txt) → [muffle](ts-feat-knitwork-dynamic-type-import/02-git-status.muffle.txt) | 348 | 77 | 78% | 67 |
| ts-feat-knitwork-dynamic-type-import | [git diff](ts-feat-knitwork-dynamic-type-import/03-git-diff.raw.txt) → [muffle](ts-feat-knitwork-dynamic-type-import/03-git-diff.muffle.txt) | 2,973 | 1,995 | 33% | 244 |
| ts-feat-knitwork-dynamic-type-import | [git diff --stat](ts-feat-knitwork-dynamic-type-import/04-git-diff-stat.raw.txt) → [muffle](ts-feat-knitwork-dynamic-type-import/04-git-diff-stat.muffle.txt) | 174 | 174 | 0% | 0 |
| ts-feat-knitwork-dynamic-type-import | [ls -la](ts-feat-knitwork-dynamic-type-import/05-ls-la.raw.txt) → [muffle](ts-feat-knitwork-dynamic-type-import/05-ls-la.muffle.txt) | 1,038 | 312 | 70% | 181 |
| ts-feat-knitwork-dynamic-type-import | [find](ts-feat-knitwork-dynamic-type-import/06-find.raw.txt) → [muffle](ts-feat-knitwork-dynamic-type-import/06-find.muffle.txt) | 232 | 177 | 24% | 13 |
| ts-feat-knitwork-dynamic-type-import | [grep -rn typeof](ts-feat-knitwork-dynamic-type-import/07-grep-rn-typeof.raw.txt) → [muffle](ts-feat-knitwork-dynamic-type-import/07-grep-rn-typeof.muffle.txt) | 1,766 | 1,439 | 19% | 81 |
| ts-feat-knitwork-dynamic-type-import | [cat src/esm.ts](ts-feat-knitwork-dynamic-type-import/08-cat-src-esm-ts.raw.txt) → [muffle](ts-feat-knitwork-dynamic-type-import/08-cat-src-esm-ts.muffle.txt) | 3,555 | 3,555 | 0% | 0 |
| ts-feat-pathe-reverse-alias | [task tests](ts-feat-pathe-reverse-alias/01-task-tests.raw.txt) → [muffle](ts-feat-pathe-reverse-alias/01-task-tests.muffle.txt) | 4,542 | 3,001 | 34% | 385 |
| ts-feat-pathe-reverse-alias | [git status](ts-feat-pathe-reverse-alias/02-git-status.raw.txt) → [muffle](ts-feat-pathe-reverse-alias/02-git-status.muffle.txt) | 297 | 46 | 85% | 62 |
| ts-feat-pathe-reverse-alias | [git diff](ts-feat-pathe-reverse-alias/03-git-diff.raw.txt) → [muffle](ts-feat-pathe-reverse-alias/03-git-diff.muffle.txt) | 1,671 | 1,366 | 19% | 76 |
| ts-feat-pathe-reverse-alias | [git diff --stat](ts-feat-pathe-reverse-alias/04-git-diff-stat.raw.txt) → [muffle](ts-feat-pathe-reverse-alias/04-git-diff-stat.muffle.txt) | 123 | 123 | 0% | 0 |
| ts-feat-pathe-reverse-alias | [ls -la](ts-feat-pathe-reverse-alias/05-ls-la.raw.txt) → [muffle](ts-feat-pathe-reverse-alias/05-ls-la.muffle.txt) | 1,300 | 384 | 71% | 229 |
| ts-feat-pathe-reverse-alias | [find](ts-feat-pathe-reverse-alias/06-find.raw.txt) → [muffle](ts-feat-pathe-reverse-alias/06-find.muffle.txt) | 153 | 137 | 11% | 4 |
| ts-feat-pathe-reverse-alias | [grep -rn pathe](ts-feat-pathe-reverse-alias/07-grep-rn-pathe.raw.txt) → [muffle](ts-feat-pathe-reverse-alias/07-grep-rn-pathe.muffle.txt) | 8,447 | 4,703 | 45% | 936 |
| ts-feat-pathe-reverse-alias | [cat src/utils.ts](ts-feat-pathe-reverse-alias/08-cat-src-utils-ts.raw.txt) → [muffle](ts-feat-pathe-reverse-alias/08-cat-src-utils-ts.muffle.txt) | 3,316 | 3,316 | 0% | 0 |
| ts-mlly-generic-export-names | [task tests](ts-mlly-generic-export-names/01-task-tests.raw.txt) → [muffle](ts-mlly-generic-export-names/01-task-tests.muffle.txt) | 6,669 | 2,221 | 67% | 1,112 |
| ts-mlly-generic-export-names | [git status](ts-mlly-generic-export-names/02-git-status.raw.txt) → [muffle](ts-mlly-generic-export-names/02-git-status.muffle.txt) | 276 | 35 | 88% | 60 |
| ts-mlly-generic-export-names | [git diff](ts-mlly-generic-export-names/03-git-diff.raw.txt) → [muffle](ts-mlly-generic-export-names/03-git-diff.muffle.txt) | 1,509 | 1,438 | 5% | 17 |
| ts-mlly-generic-export-names | [git diff --stat](ts-mlly-generic-export-names/04-git-diff-stat.raw.txt) → [muffle](ts-mlly-generic-export-names/04-git-diff-stat.muffle.txt) | 99 | 99 | 0% | 0 |
| ts-mlly-generic-export-names | [ls -la](ts-mlly-generic-export-names/05-ls-la.raw.txt) → [muffle](ts-mlly-generic-export-names/05-ls-la.muffle.txt) | 1,040 | 312 | 70% | 182 |
| ts-mlly-generic-export-names | [find](ts-mlly-generic-export-names/06-find.raw.txt) → [muffle](ts-mlly-generic-export-names/06-find.muffle.txt) | 276 | 215 | 23% | 15 |
| ts-mlly-generic-export-names | [grep -rn findExports](ts-mlly-generic-export-names/07-grep-rn-findexports.raw.txt) → [muffle](ts-mlly-generic-export-names/07-grep-rn-findexports.muffle.txt) | 4,990 | 4,346 | 13% | 161 |
| ts-mlly-generic-export-names | [cat src/analyze.ts](ts-mlly-generic-export-names/08-cat-src-analyze-ts.raw.txt) → [muffle](ts-mlly-generic-export-names/08-cat-src-analyze-ts.muffle.txt) | 23,477 | 23,477 | 0% | 0 |
| ts-remeda-deep-equal-null-proto | [task tests](ts-remeda-deep-equal-null-proto/01-task-tests.raw.txt) → [muffle](ts-remeda-deep-equal-null-proto/01-task-tests.muffle.txt) | 2,474 | 1,301 | 48% | 293 |
| ts-remeda-deep-equal-null-proto | [git status](ts-remeda-deep-equal-null-proto/02-git-status.raw.txt) → [muffle](ts-remeda-deep-equal-null-proto/02-git-status.muffle.txt) | 296 | 55 | 82% | 60 |
| ts-remeda-deep-equal-null-proto | [git diff](ts-remeda-deep-equal-null-proto/03-git-diff.raw.txt) → [muffle](ts-remeda-deep-equal-null-proto/03-git-diff.muffle.txt) | 3,146 | 2,131 | 33% | 253 |
| ts-remeda-deep-equal-null-proto | [git diff --stat](ts-remeda-deep-equal-null-proto/04-git-diff-stat.raw.txt) → [muffle](ts-remeda-deep-equal-null-proto/04-git-diff-stat.muffle.txt) | 119 | 119 | 0% | 0 |
| ts-remeda-deep-equal-null-proto | [ls -la](ts-remeda-deep-equal-null-proto/05-ls-la.raw.txt) → [muffle](ts-remeda-deep-equal-null-proto/05-ls-la.muffle.txt) | 1,471 | 440 | 71% | 257 |
| ts-remeda-deep-equal-null-proto | [find](ts-remeda-deep-equal-null-proto/06-find.raw.txt) → [muffle](ts-remeda-deep-equal-null-proto/06-find.muffle.txt) | 31,631 | 13,938 | 56% | 4,423 |
| ts-remeda-deep-equal-null-proto | [grep -rn isDeepEqual](ts-remeda-deep-equal-null-proto/07-grep-rn-isdeepequal.raw.txt) → [muffle](ts-remeda-deep-equal-null-proto/07-grep-rn-isdeepequal.muffle.txt) | 19,956 | 8,478 | 58% | 2,869 |
| ts-remeda-deep-equal-null-proto | [cat packages/remeda/src/isDeepEqual.ts](ts-remeda-deep-equal-null-proto/08-cat-packages-remeda-src-isdeepequal-ts.raw.txt) → [muffle](ts-remeda-deep-equal-null-proto/08-cat-packages-remeda-src-isdeepequal-ts.muffle.txt) | 6,918 | 6,918 | 0% | 0 |
| ts-ufo-base-prefix | [task tests](ts-ufo-base-prefix/01-task-tests.raw.txt) → [muffle](ts-ufo-base-prefix/01-task-tests.muffle.txt) | 4,777 | 973 | 80% | 951 |
| ts-ufo-base-prefix | [git status](ts-ufo-base-prefix/02-git-status.raw.txt) → [muffle](ts-ufo-base-prefix/02-git-status.muffle.txt) | 274 | 33 | 88% | 60 |
| ts-ufo-base-prefix | [git diff](ts-ufo-base-prefix/03-git-diff.raw.txt) → [muffle](ts-ufo-base-prefix/03-git-diff.muffle.txt) | 983 | 765 | 23% | 54 |
| ts-ufo-base-prefix | [git diff --stat](ts-ufo-base-prefix/04-git-diff-stat.raw.txt) → [muffle](ts-ufo-base-prefix/04-git-diff-stat.muffle.txt) | 80 | 80 | 0% | 0 |
| ts-ufo-base-prefix | [ls -la](ts-ufo-base-prefix/05-ls-la.raw.txt) → [muffle](ts-ufo-base-prefix/05-ls-la.muffle.txt) | 1,097 | 327 | 71% | 192 |
| ts-ufo-base-prefix | [find](ts-ufo-base-prefix/06-find.raw.txt) → [muffle](ts-ufo-base-prefix/06-find.muffle.txt) | 435 | 331 | 24% | 26 |
| ts-ufo-base-prefix | [grep -rn withBase](ts-ufo-base-prefix/07-grep-rn-withbase.raw.txt) → [muffle](ts-ufo-base-prefix/07-grep-rn-withbase.muffle.txt) | 1,024 | 904 | 12% | 30 |
| ts-ufo-base-prefix | [cat src/utils.ts](ts-ufo-base-prefix/08-cat-src-utils-ts.raw.txt) → [muffle](ts-ufo-base-prefix/08-cat-src-utils-ts.muffle.txt) | 17,552 | 17,552 | 0% | 0 |
| ts-yaml-flow-key-after-blank | [task tests](ts-yaml-flow-key-after-blank/01-task-tests.raw.txt) → [muffle](ts-yaml-flow-key-after-blank/01-task-tests.muffle.txt) | 1,708 | 758 | 56% | 237 |
| ts-yaml-flow-key-after-blank | [git status](ts-yaml-flow-key-after-blank/02-git-status.raw.txt) → [muffle](ts-yaml-flow-key-after-blank/02-git-status.muffle.txt) | 281 | 40 | 86% | 60 |
| ts-yaml-flow-key-after-blank | [git diff](ts-yaml-flow-key-after-blank/03-git-diff.raw.txt) → [muffle](ts-yaml-flow-key-after-blank/03-git-diff.muffle.txt) | 503 | 372 | 27% | 32 |
| ts-yaml-flow-key-after-blank | [git diff --stat](ts-yaml-flow-key-after-blank/04-git-diff-stat.raw.txt) → [muffle](ts-yaml-flow-key-after-blank/04-git-diff-stat.muffle.txt) | 79 | 79 | 0% | 0 |
| ts-yaml-flow-key-after-blank | [ls -la](ts-yaml-flow-key-after-blank/05-ls-la.raw.txt) → [muffle](ts-yaml-flow-key-after-blank/05-ls-la.muffle.txt) | 1,441 | 400 | 73% | 260 |
| ts-yaml-flow-key-after-blank | [find](ts-yaml-flow-key-after-blank/06-find.raw.txt) → [muffle](ts-yaml-flow-key-after-blank/06-find.muffle.txt) | 2,698 | 1,691 | 38% | 251 |
| ts-yaml-flow-key-after-blank | [grep -rn IMPOSSIBLE](ts-yaml-flow-key-after-blank/07-grep-rn-impossible.raw.txt) → [muffle](ts-yaml-flow-key-after-blank/07-grep-rn-impossible.muffle.txt) | 488 | 488 | 0% | 0 |
| ts-yaml-flow-key-after-blank | [cat src/parse/parser.ts](ts-yaml-flow-key-after-blank/08-cat-src-parse-parser-ts.raw.txt) → [muffle](ts-yaml-flow-key-after-blank/08-cat-src-parse-parser-ts.muffle.txt) | 27,834 | 4,315 | 85% | 5,879 |
