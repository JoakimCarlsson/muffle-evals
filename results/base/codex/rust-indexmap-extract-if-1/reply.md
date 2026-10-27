I’ll check the storage and iterator code, add both `extract_if` APIs, and test ordering, laziness, early drop, and lookup consistency.


Both APIs are added. They use the existing ordered-removal code, which keeps the hash table consistent after each extraction and if the predicate panics. I’ll now check range handling, early drop, and value mutation. Each extraction shifts later entries, so extracting many entries can take quadratic time.


The workspace tests and the `no_std` check pass. The new tests cover ranges, value mutation, early drop, fused iteration, and lookups after a predicate panic. I’ve also documented the quadratic worst-case cost of repeated ordered removals; the final feature checks are running.


Added both `extract_if` APIs and public `ExtractIf` iterator types with `Iterator`, `FusedIterator`, and `Debug`.

They preserve order, support ranges and map value mutation, and leave unvisited entries untouched on early drop. Lookups remain consistent after extraction or predicate panic.

Workspace tests, seven new tests, and `no_std`/all-feature checks pass.

Performance limitation: each removal shifts later entries, so extracting many entries can take quadratic time.
