Null-prototype equality needs shared comparison fix and regression tests.


Done.
`isDeepEqual` handles null prototypes in both orders and nested values; class checks preserved. Regression tests added. Runtime tests, type tests, build, lint passed.
