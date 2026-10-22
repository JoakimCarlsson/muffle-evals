Done. `ParseComma` and `ParseCommaf` added to `comma.go`. Build, existing tests and a throwaway check of your cases passed. I deleted the check, so no tests were added.

Both are lenient about comma placement: `ParseComma("1,2,3")` returns 123. `ParseCommaf` rejects commas after the decimal point.
