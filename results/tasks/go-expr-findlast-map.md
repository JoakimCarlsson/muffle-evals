# go-expr-findlast-map

Source: https://github.com/expr-lang/expr/pull/954

## Prompt

> `findLast()` and `findLastIndex()` produce a runtime error when used as values inside `{ }` map literal expressions. All the other predicate builtins (`find`, `findIndex`, `filter`, `all`, `any`, `count`, `none`, `one`) work fine in the same position.
> 
> ```go
> func main() {
> 	// These work fine:
> 	run(`findLast([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)`)          // OK: 5
> 	run(`{"r": find([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}`)       // OK: map[r:4]
> 	run(`{"r": findIndex([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}`)  // OK: map[r:3]
> 	run(`{"r": filter([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}`)     // OK: map[r:[4 5]]
> 
> 	// These crash:
> 	run(`{"r": findLast([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}`)      // ERROR
> 	run(`{"r": findLastIndex([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}`) // ERROR
> }
> 
> func run(expression string) {
> 	program, err := expr.Compile(expression)
> 	if err != nil {
> 		fmt.Printf("COMPILE ERROR: %s\n  %v\n", expression, err)
> 		return
> 	}
> 	result, err := expr.Run(program, nil)
> 	if err != nil {
> 		fmt.Printf("RUN ERROR: %s\n  %v\n", expression, err)
> 		return
> 	}
> 	fmt.Printf("OK: %s\n  %v\n", expression, result)
> }
> ```
> 
> Error:
> 
> ```
> RUN ERROR: {"r": findLast([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}
>   interface conversion: interface {} is bool, not string (1:1)
>    | {"r": findLast([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}
>    | ^
> ```
> 
> Compilation succeeds; the error only happens at run time. Workaround is to put the call in a `let` binding before the map literal, but it should just work.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [compiler/compiler.go](../../tasks/go-expr-findlast-map/upstream/compiler/compiler.go), [expr_test.go](../../tasks/go-expr-findlast-map/upstream/expr_test.go)

```diff
diff --git a/compiler/compiler.go b/compiler/compiler.go
index f66cf9e..6851753 100644
--- a/compiler/compiler.go
+++ b/compiler/compiler.go
@@ -1213,12 +1213,14 @@ func (c *compiler) emitLoopBackwards(body func()) {
 	c.emit(OpInt, 0)
 	c.emit(OpMoreOrEqual)
 	end := c.emit(OpJumpIfFalse, placeholder)
+	c.emit(OpPop)
 
 	body()
 
 	c.emit(OpDecrementIndex)
 	c.emit(OpJumpBackward, c.calcBackwardJump(begin))
 	c.patchJump(end)
+	c.emit(OpPop)
 }
 
 func (c *compiler) PredicateNode(node *ast.PredicateNode) {
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +2/-0 | 15 | 1,958 | $0.089 |
| claude | muffle | pass | +2/-0 | 21 | 7,225 | $0.254 |
| claude | hush | pass | +2/-0 | 0 | 7,489 | $0.241 |
| claude | sloth | pass | +2/-0 | 12 | 1,867 | $0.070 |
| claude | all | pass | +2/-0 | 12 | 2,170 | $0.100 |
| codex | base | pass | +2/-0 | 33 | 1,434 | - |
| codex | muffle | pass | +2/-0 | 33 | 1,585 | - |
| codex | hush | pass | +2/-0 | 31 | 1,209 | - |
| codex | sloth | pass | +3/-0 | 24 | 2,098 | - |
| codex | all | pass | +2/-0 | 26 | 1,344 | - |

### claude, base: pass

Files: [compiler/compiler.go](../base/claude/go-expr-findlast-map-1/files/compiler/compiler.go), [expr_test.go](../base/claude/go-expr-findlast-map-1/files/expr_test.go)

<details><summary>diff</summary>

```diff
diff --git a/compiler/compiler.go b/compiler/compiler.go
index f66cf9e..9818976 100644
--- a/compiler/compiler.go
+++ b/compiler/compiler.go
@@ -1213,12 +1213,14 @@ func (c *compiler) emitLoopBackwards(body func()) {
 	c.emit(OpInt, 0)
 	c.emit(OpMoreOrEqual)
 	end := c.emit(OpJumpIfFalse, placeholder)
+	c.emit(OpPop)
 
 	body()
 
 	c.emit(OpDecrementIndex)
 	c.emit(OpJumpBackward, c.calcBackwardJump(begin))
 	c.patchJump(end)
+	c.emit(OpPop) // discard the failed bounds check left by OpJumpIfFalse
 }
 
 func (c *compiler) PredicateNode(node *ast.PredicateNode) {
diff --git a/expr_test.go b/expr_test.go
index 1bce3c8..d281eb4 100644
--- a/expr_test.go
+++ b/expr_test.go
@@ -3005,3 +3005,18 @@ func TestBytesLiteral_errors(t *testing.T) {
 		})
 	}
 }
+
+func TestExpr_findLast_in_map_literal(t *testing.T) {
+	tests := map[string]any{
+		`{"r": findLast([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}`:      map[string]any{"r": 5.0},
+		`{"r": findLastIndex([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}`: map[string]any{"r": 4},
+		`{"r": findLast([1, 2], # > 3)}`:                         map[string]any{"r": nil},
+	}
+	for code, want := range tests {
+		program, err := expr.Compile(code)
+		require.NoError(t, err, code)
+		got, err := expr.Run(program, nil)
+		require.NoError(t, err, code)
+		assert.Equal(t, want, got, code)
+	}
+}
```

</details>

<details><summary>reply</summary>

Identical to find; so the difference is in emitLoopBackwards.

Now add a test and run.

Fixed: all tests pass, including a new regression test.

**Cause:** `emitLoopBackwards` in `compiler/compiler.go` left a stray bool on the VM stack. The loop's `index >= 0` check is followed by `OpJumpIfFalse`, which doesn't pop the bool. Every iteration pushed one that was never removed, and the exit path left one too. At top level the extra values were ignored. Inside a `{ }` literal, the map builder read the leftover bool as a key and failed with `interface {} is bool, not string`.

**Fix:** I added an `OpPop` right after the jump, so the loop body starts with a clean stack. I added another `OpPop` at the loop's exit target, so the false check result is discarded when the loop runs out.

**Test:** `TestExpr_findLast_in_map_literal` in `expr_test.go` covers `findLast` and `findLastIndex` in a map literal. It includes a no-match case that returns `nil`.

I didn't commit anything.

</details>

### claude, muffle: pass

Files: [compiler/compiler.go](../muffle/claude/go-expr-findlast-map-1/files/compiler/compiler.go), [expr_test.go](../muffle/claude/go-expr-findlast-map-1/files/expr_test.go)

<details><summary>diff</summary>

```diff
diff --git a/compiler/compiler.go b/compiler/compiler.go
index f66cf9e..22d608c 100644
--- a/compiler/compiler.go
+++ b/compiler/compiler.go
@@ -1213,12 +1213,14 @@ func (c *compiler) emitLoopBackwards(body func()) {
 	c.emit(OpInt, 0)
 	c.emit(OpMoreOrEqual)
 	end := c.emit(OpJumpIfFalse, placeholder)
+	c.emit(OpPop)
 
 	body()
 
 	c.emit(OpDecrementIndex)
 	c.emit(OpJumpBackward, c.calcBackwardJump(begin))
 	c.patchJump(end)
+	c.emit(OpPop) // JumpIfFalse leaves the failed bound check on the stack.
 }
 
 func (c *compiler) PredicateNode(node *ast.PredicateNode) {
diff --git a/expr_test.go b/expr_test.go
index 1bce3c8..0c8a497 100644
--- a/expr_test.go
+++ b/expr_test.go
@@ -3005,3 +3005,24 @@ func TestBytesLiteral_errors(t *testing.T) {
 		})
 	}
 }
+
+func TestFindLast_inMapLiteral(t *testing.T) {
+	tests := []struct {
+		code string
+		want any
+	}{
+		{`{"r": findLast([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}`, map[string]any{"r": 5.0}},
+		{`{"r": findLastIndex([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}`, map[string]any{"r": 4}},
+		{`{"r": findLast([1, 2, 3], # > 9)}`, map[string]any{"r": nil}},
+		{`{"r": findLastIndex([1, 2, 3], # > 9)}`, map[string]any{"r": nil}},
+	}
+	for _, tt := range tests {
+		t.Run(tt.code, func(t *testing.T) {
+			program, err := expr.Compile(tt.code)
+			require.NoError(t, err)
+			out, err := expr.Run(program, nil)
+			require.NoError(t, err)
+			assert.Equal(t, tt.want, out)
+		})
+	}
+}
```

</details>

<details><summary>reply</summary>

Running my temporary test for the fix (compile is slow); waiting on it now.

The fix is in, but the test file wasn't created (the earlier command was interrupted). I'll add a proper regression test instead.

`findLast()` and `findLastIndex()` now work inside `{ }` map literals. The full test suite passes, including a new regression test.

**Cause:** the backwards loop in `emitLoopBackwards` (`compiler/compiler.go`) checks `index >= 0` on each iteration. The conditional jump leaves that boolean on the stack. It was never popped, so a stray `bool` stayed on the stack. A bare call hid this because the result was read off the top of the stack. Inside a map literal, the stray value was taken as a key, which gave `interface {} is bool, not string`.

**Fix:** the loop now pops the check result on both paths: when it continues into the body, and when it exits at the end.

**Test:** `TestFindLast_inMapLiteral` in `expr_test.go` covers both functions, with a match and with no match.

I haven't committed anything.

The background command from my first attempt was stopped at its time limit. It had already done its job: the Python edit ran. The temporary test file it was meant to create was never written, so there's nothing to clean up. I'm not restarting it.

The fix and the regression test came from the later runs, and the full suite passed. Nothing else is pending, and I haven't committed anything.

</details>

### claude, hush: pass

Files: [compiler/compiler.go](../hush/claude/go-expr-findlast-map-1/files/compiler/compiler.go)

<details><summary>diff</summary>

```diff
diff --git a/compiler/compiler.go b/compiler/compiler.go
index f66cf9e..1aca7f0 100644
--- a/compiler/compiler.go
+++ b/compiler/compiler.go
@@ -1213,12 +1213,14 @@ func (c *compiler) emitLoopBackwards(body func()) {
 	c.emit(OpInt, 0)
 	c.emit(OpMoreOrEqual)
 	end := c.emit(OpJumpIfFalse, placeholder)
+	c.emit(OpPop)
 
 	body()
 
 	c.emit(OpDecrementIndex)
 	c.emit(OpJumpBackward, c.calcBackwardJump(begin))
 	c.patchJump(end)
+	c.emit(OpPop) // condition left by the failed bounds check
 }
 
 func (c *compiler) PredicateNode(node *ast.PredicateNode) {
```

</details>

<details><summary>reply</summary>

Waiting on the background test run. Checking its output now.

Done. `emitLoopBackwards` in `compiler/compiler.go` left the loop-bound bool on the stack, which corrupted the map literal. It now pops it on both the loop-continue path and the loop-exit path. `findLast` and `findLastIndex` now work inside `{ }` for match, no-match and empty-array cases. I checked that with a scratch test (since deleted) and ran the compiler, vm, builtin, optimizer and root package tests, which pass. I didn't add a permanent regression test, and I didn't run the full `./...` suite.

Old background run killed at its time limit. Not restarted; fix already verified by the later foreground run.

</details>

### claude, sloth: pass

Files: [compiler/compiler.go](../sloth/claude/go-expr-findlast-map-1/files/compiler/compiler.go), [expr_test.go](../sloth/claude/go-expr-findlast-map-1/files/expr_test.go)

<details><summary>diff</summary>

```diff
diff --git a/compiler/compiler.go b/compiler/compiler.go
index f66cf9e..6851753 100644
--- a/compiler/compiler.go
+++ b/compiler/compiler.go
@@ -1213,12 +1213,14 @@ func (c *compiler) emitLoopBackwards(body func()) {
 	c.emit(OpInt, 0)
 	c.emit(OpMoreOrEqual)
 	end := c.emit(OpJumpIfFalse, placeholder)
+	c.emit(OpPop)
 
 	body()
 
 	c.emit(OpDecrementIndex)
 	c.emit(OpJumpBackward, c.calcBackwardJump(begin))
 	c.patchJump(end)
+	c.emit(OpPop)
 }
 
 func (c *compiler) PredicateNode(node *ast.PredicateNode) {
diff --git a/expr_test.go b/expr_test.go
index 1bce3c8..409a1c4 100644
--- a/expr_test.go
+++ b/expr_test.go
@@ -1275,6 +1275,18 @@ func TestExpr(t *testing.T) {
 			`findLastIndex(1..9, # % 2 == 0)`,
 			7,
 		},
+		{
+			`{"r": findLast(1..9, # > 3)}`,
+			map[string]any{"r": 9},
+		},
+		{
+			`{"r": findLastIndex(1..9, # > 3)}`,
+			map[string]any{"r": 8},
+		},
+		{
+			`{"r": findLast(1..9, # > 99)}`,
+			map[string]any{"r": nil},
+		},
 		{
 			`filter(1..9, # % 2 == 0)[-1]`,
 			8,
```

</details>

<details><summary>reply</summary>

Adding regression tests next to the existing findLast cases, then running the suite.

Fixed: `findLast()` and `findLastIndex()` now work inside `{ }` map literals. The full test suite passes (`go test ./...`).

**Cause:** the backward loop that `findLast` and `findLastIndex` compile to (`emitLoopBackwards` in `compiler/compiler.go`) never popped its `index >= 0` check. A leftover bool stayed on the VM stack on every iteration and on loop exit. In a map literal, the VM reads the key and value from the stack, so it picked up that stray bool as the key. That is the "interface {} is bool, not string" error. Plain calls only worked because nothing else was reading the stack.

**Fix:** I added an `OpPop` after the loop-condition jump, on both the continue path and the exit path. The forward loop doesn't have this problem.

**Tests:** I added three cases to `expr_test.go` next to the existing `findLast` tests:
- `findLast` in a map literal
- `findLastIndex` in a map literal
- `findLast` in a map literal with no match, which gives `nil`

`gofmt -l` lists four files, all existing test files I didn't touch.

I haven't committed anything.

</details>

### claude, all: pass

Files: [compiler/compiler.go](../all/claude/go-expr-findlast-map-1/files/compiler/compiler.go), [expr_test.go](../all/claude/go-expr-findlast-map-1/files/expr_test.go)

<details><summary>diff</summary>

```diff
diff --git a/compiler/compiler.go b/compiler/compiler.go
index f66cf9e..6851753 100644
--- a/compiler/compiler.go
+++ b/compiler/compiler.go
@@ -1213,12 +1213,14 @@ func (c *compiler) emitLoopBackwards(body func()) {
 	c.emit(OpInt, 0)
 	c.emit(OpMoreOrEqual)
 	end := c.emit(OpJumpIfFalse, placeholder)
+	c.emit(OpPop)
 
 	body()
 
 	c.emit(OpDecrementIndex)
 	c.emit(OpJumpBackward, c.calcBackwardJump(begin))
 	c.patchJump(end)
+	c.emit(OpPop)
 }
 
 func (c *compiler) PredicateNode(node *ast.PredicateNode) {
diff --git a/expr_test.go b/expr_test.go
index 1bce3c8..28aaa60 100644
--- a/expr_test.go
+++ b/expr_test.go
@@ -1275,6 +1275,18 @@ func TestExpr(t *testing.T) {
 			`findLastIndex(1..9, # % 2 == 0)`,
 			7,
 		},
+		{
+			`{"r": findLast(1..9, # % 2 == 0)}`,
+			map[string]any{"r": 8},
+		},
+		{
+			`{"r": findLastIndex(1..9, # % 2 == 0)}`,
+			map[string]any{"r": 7},
+		},
+		{
+			`{"r": findLast(1..9, # > 100)}`,
+			map[string]any{"r": nil},
+		},
 		{
 			`filter(1..9, # % 2 == 0)[-1]`,
 			8,
```

</details>

<details><summary>reply</summary>

Found cause: backwards loop leaves `>= 0` bool on stack. Fixing now.

Done. `emitLoopBackwards` in `compiler/compiler.go` left the `>= 0` bool on the stack. It now pops it in the loop body and at loop exit. I added three map-literal cases to `expr_test.go`, and the full test suite passes. Nothing is committed.

</details>

### codex, base: pass

Files: [compiler/compiler.go](../base/codex/go-expr-findlast-map-1/files/compiler/compiler.go), [expr_test.go](../base/codex/go-expr-findlast-map-1/files/expr_test.go)

<details><summary>diff</summary>

```diff
diff --git a/compiler/compiler.go b/compiler/compiler.go
index f66cf9e..123160f 100644
--- a/compiler/compiler.go
+++ b/compiler/compiler.go
@@ -1213,12 +1213,14 @@ func (c *compiler) emitLoopBackwards(body func()) {
 	c.emit(OpInt, 0)
 	c.emit(OpMoreOrEqual)
 	end := c.emit(OpJumpIfFalse, placeholder)
+	c.emit(OpPop) // Discard the loop condition before evaluating the body.
 
 	body()
 
 	c.emit(OpDecrementIndex)
 	c.emit(OpJumpBackward, c.calcBackwardJump(begin))
 	c.patchJump(end)
+	c.emit(OpPop) // Discard the loop condition when iteration finishes.
 }
 
 func (c *compiler) PredicateNode(node *ast.PredicateNode) {
diff --git a/expr_test.go b/expr_test.go
index 1bce3c8..280ec8a 100644
--- a/expr_test.go
+++ b/expr_test.go
@@ -1464,6 +1464,39 @@ func TestExpr(t *testing.T) {
 	}
 }
 
+func TestExpr_findLastInMap(t *testing.T) {
+	for _, builtin := range []string{"findLast", "findLastIndex"} {
+		for _, tt := range []struct {
+			name      string
+			array     string
+			predicate string
+			value     any
+			index     any
+		}{
+			{"last", "[1.0, 2.0, 3.0, 4.0, 5.0]", "# > 3", 5.0, 4},
+			{"middle", "[1.0, 2.0, 3.0, 4.0, 5.0]", "# < 4", 3.0, 2},
+			{"first", "[1.0, 2.0, 3.0, 4.0, 5.0]", "# == 1", 1.0, 0},
+			{"no match", "[1.0, 2.0, 3.0, 4.0, 5.0]", "# > 5", nil, nil},
+			{"empty", "[]", "# > 3", nil, nil},
+		} {
+			for _, optimize := range []bool{false, true} {
+				t.Run(fmt.Sprintf("%s/%s/optimize=%v", builtin, tt.name, optimize), func(t *testing.T) {
+					code := fmt.Sprintf(`{"before": 42, "r": %s(%s, %s), "after": 43}`, builtin, tt.array, tt.predicate)
+					program, err := expr.Compile(code, expr.Optimize(optimize))
+					require.NoError(t, err)
+					result, err := expr.Run(program, nil)
+					require.NoError(t, err)
+					want := tt.value
+					if builtin == "findLastIndex" {
+						want = tt.index
+					}
+					assert.Equal(t, map[string]any{"before": 42, "r": want, "after": 43}, result)
+				})
+			}
+		}
+	}
+}
+
 func TestExpr_error(t *testing.T) {
 	env := mock.Env{
 		ArrayOfAny: []any{1, "2", 3, true},
```

</details>

<details><summary>reply</summary>

I’ll trace how the reverse-search builtins compile, fix the stack handling, and add regression tests for map literals.

The reverse loop leaves its condition boolean on the stack on every iteration and when it exits. Map construction then reads that boolean as a key. I’ve added cleanup on both paths; the regression tests cover both builtins with matches, no matches, and empty arrays, with optimization enabled and disabled.

Fixed both builtins by removing leftover loop-condition booleans from the VM stack, which caused map construction to read a boolean as a key.

Added regression tests covering matches, no matches, and empty arrays, with optimization enabled and disabled. Confirmed they failed before the fix.

All tests pass with `go test ./...`.

</details>

### codex, muffle: pass

Files: [compiler/compiler.go](../muffle/codex/go-expr-findlast-map-1/files/compiler/compiler.go), [expr_test.go](../muffle/codex/go-expr-findlast-map-1/files/expr_test.go)

<details><summary>diff</summary>

```diff
diff --git a/compiler/compiler.go b/compiler/compiler.go
index f66cf9e..6851753 100644
--- a/compiler/compiler.go
+++ b/compiler/compiler.go
@@ -1213,12 +1213,14 @@ func (c *compiler) emitLoopBackwards(body func()) {
 	c.emit(OpInt, 0)
 	c.emit(OpMoreOrEqual)
 	end := c.emit(OpJumpIfFalse, placeholder)
+	c.emit(OpPop)
 
 	body()
 
 	c.emit(OpDecrementIndex)
 	c.emit(OpJumpBackward, c.calcBackwardJump(begin))
 	c.patchJump(end)
+	c.emit(OpPop)
 }
 
 func (c *compiler) PredicateNode(node *ast.PredicateNode) {
diff --git a/expr_test.go b/expr_test.go
index 1bce3c8..6066437 100644
--- a/expr_test.go
+++ b/expr_test.go
@@ -1464,6 +1464,39 @@ func TestExpr(t *testing.T) {
 	}
 }
 
+func TestExpr_findLast_mapValue(t *testing.T) {
+	for _, builtin := range []string{"findLast", "findLastIndex"} {
+		for _, tt := range []struct {
+			name      string
+			array     string
+			predicate string
+			value     any
+			index     any
+		}{
+			{"last element", `[1.0, 2.0, 3.0, 4.0, 5.0]`, `# > 3`, 5.0, 4},
+			{"earlier element", `[1.0, 2.0, 3.0, 4.0, 5.0]`, `# < 4`, 3.0, 2},
+			{"first element", `[1.0, 2.0, 3.0, 4.0, 5.0]`, `# == 1`, 1.0, 0},
+			{"no match", `[1.0, 2.0, 3.0, 4.0, 5.0]`, `# > 5`, nil, nil},
+			{"empty array", `[]`, `# > 3`, nil, nil},
+		} {
+			for _, optimize := range []bool{true, false} {
+				t.Run(fmt.Sprintf("%s/%s/optimize=%v", builtin, tt.name, optimize), func(t *testing.T) {
+					code := fmt.Sprintf(`{"r": %s(%s, %s)}`, builtin, tt.array, tt.predicate)
+					program, err := expr.Compile(code, expr.Optimize(optimize))
+					require.NoError(t, err)
+					got, err := expr.Run(program, nil)
+					require.NoError(t, err)
+					want := tt.value
+					if builtin == "findLastIndex" {
+						want = tt.index
+					}
+					assert.Equal(t, map[string]any{"r": want}, got)
+				})
+			}
+		}
+	}
+}
+
 func TestExpr_error(t *testing.T) {
 	env := mock.Env{
 		ArrayOfAny: []any{1, "2", 3, true},
```

</details>

<details><summary>reply</summary>

I’ll trace how the reverse-search builtins use the VM stack, fix the issue, and add regression coverage for map values.

The reverse loop leaves its loop-condition boolean on the stack on every iteration and when it finishes. That extra value makes map construction read a boolean as a key. I’ve added cleanup on both paths and regression cases for matches at different positions, no match, and empty arrays, with optimization enabled and disabled.

Fixed both builtins by removing leftover loop-condition booleans from the VM stack.

Added regression coverage for map values with matches, no matches, and empty arrays, with optimization enabled and disabled.

Validation: `go test ./...` passes.

</details>

### codex, hush: pass

Files: [compiler/compiler.go](../hush/codex/go-expr-findlast-map-1/files/compiler/compiler.go), [expr_test.go](../hush/codex/go-expr-findlast-map-1/files/expr_test.go)

<details><summary>diff</summary>

```diff
diff --git a/compiler/compiler.go b/compiler/compiler.go
index f66cf9e..6851753 100644
--- a/compiler/compiler.go
+++ b/compiler/compiler.go
@@ -1213,12 +1213,14 @@ func (c *compiler) emitLoopBackwards(body func()) {
 	c.emit(OpInt, 0)
 	c.emit(OpMoreOrEqual)
 	end := c.emit(OpJumpIfFalse, placeholder)
+	c.emit(OpPop)
 
 	body()
 
 	c.emit(OpDecrementIndex)
 	c.emit(OpJumpBackward, c.calcBackwardJump(begin))
 	c.patchJump(end)
+	c.emit(OpPop)
 }
 
 func (c *compiler) PredicateNode(node *ast.PredicateNode) {
diff --git a/expr_test.go b/expr_test.go
index 1bce3c8..0ac1270 100644
--- a/expr_test.go
+++ b/expr_test.go
@@ -3005,3 +3005,34 @@ func TestBytesLiteral_errors(t *testing.T) {
 		})
 	}
 }
+
+func TestExpr_findLast_map_value(t *testing.T) {
+	for _, optimize := range []bool{false, true} {
+		for _, builtin := range []string{"findLast", "findLastIndex"} {
+			for _, tc := range []struct {
+				array     string
+				predicate string
+				value     any
+				index     any
+			}{
+				{`[1.0, 2.0, 3.0, 4.0, 5.0]`, `# > 3`, float64(5), 4},
+				{`[1.0, 2.0, 3.0, 4.0, 5.0]`, `# < 3`, float64(2), 1},
+				{`[1.0, 2.0, 3.0]`, `# > 3`, nil, nil},
+				{`[]`, `# > 3`, nil, nil},
+			} {
+				expression := fmt.Sprintf(`{"r": %s(%s, %s), "tail": 42}`, builtin, tc.array, tc.predicate)
+				t.Run(fmt.Sprintf("%s/optimize=%t", expression, optimize), func(t *testing.T) {
+					program, err := expr.Compile(expression, expr.Optimize(optimize))
+					require.NoError(t, err)
+					result, err := expr.Run(program, nil)
+					require.NoError(t, err)
+					want := tc.value
+					if builtin == "findLastIndex" {
+						want = tc.index
+					}
+					assert.Equal(t, map[string]any{"r": want, "tail": 42}, result)
+				})
+			}
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

Done.
Fixed reverse-loop stack cleanup for both builtins. Added regression tests for matches, no matches, empty arrays, optimization enabled/disabled. `go test ./...` passed.

</details>

### codex, sloth: pass

Files: [compiler/compiler.go](../sloth/codex/go-expr-findlast-map-1/files/compiler/compiler.go), [expr_test.go](../sloth/codex/go-expr-findlast-map-1/files/expr_test.go)

<details><summary>diff</summary>

```diff
diff --git a/compiler/compiler.go b/compiler/compiler.go
index f66cf9e..0d661da 100644
--- a/compiler/compiler.go
+++ b/compiler/compiler.go
@@ -1203,6 +1203,7 @@ func (c *compiler) emitLoop(body func()) {
 	c.patchJump(end)
 }
 
+// emitLoopBackwards emits a reverse loop over the current scope's collection.
 func (c *compiler) emitLoopBackwards(body func()) {
 	c.emit(OpGetLen)
 	c.emit(OpInt, 1)
@@ -1213,12 +1214,14 @@ func (c *compiler) emitLoopBackwards(body func()) {
 	c.emit(OpInt, 0)
 	c.emit(OpMoreOrEqual)
 	end := c.emit(OpJumpIfFalse, placeholder)
+	c.emit(OpPop)
 
 	body()
 
 	c.emit(OpDecrementIndex)
 	c.emit(OpJumpBackward, c.calcBackwardJump(begin))
 	c.patchJump(end)
+	c.emit(OpPop)
 }
 
 func (c *compiler) PredicateNode(node *ast.PredicateNode) {
diff --git a/expr_test.go b/expr_test.go
index 1bce3c8..1e85d49 100644
--- a/expr_test.go
+++ b/expr_test.go
@@ -1275,6 +1275,30 @@ func TestExpr(t *testing.T) {
 			`findLastIndex(1..9, # % 2 == 0)`,
 			7,
 		},
+		{
+			`{"r": findLast([1.0, 2.0, 3.0, 4.0, 5.5], # > 3), "i": findLastIndex([1.0, 2.0, 3.0, 4.0, 5.5], # > 3)}`,
+			map[string]any{"r": 5.5, "i": 4},
+		},
+		{
+			`{"r": findLast([1, 2, 3], # == 2), "i": findLastIndex([1, 2, 3], # == 2)}`,
+			map[string]any{"r": 2, "i": 1},
+		},
+		{
+			`{"r": findLast([1, 2, 3], # == 1), "i": findLastIndex([1, 2, 3], # == 1)}`,
+			map[string]any{"r": 1, "i": 0},
+		},
+		{
+			`{"r": findLast([1, 2, 3], # > 3), "i": findLastIndex([1, 2, 3], # > 3)}`,
+			map[string]any{"r": nil, "i": nil},
+		},
+		{
+			`{"r": findLast([], true), "i": findLastIndex([], true)}`,
+			map[string]any{"r": nil, "i": nil},
+		},
+		{
+			`{"r": last(filter([1, 2, 3], # < 3))}`,
+			map[string]any{"r": 2},
+		},
 		{
 			`filter(1..9, # % 2 == 0)[-1]`,
 			8,
```

</details>

<details><summary>reply</summary>

I’ll trace how the reverse-search builtins use the VM stack, fix the shared cause, and add regression coverage in the existing tests.

The shared reverse-loop compiler leaves its loop-condition boolean on the stack on every iteration and at exhaustion. That corrupts map construction. The fix belongs in that helper, which serves both builtins and optimized `last(filter(...))` expressions. I’ll add map-value cases for matches, no match, and empty input; no API, VM, or configuration changes are needed.

The stack fix is in place. One new test hit an existing test-harness quirk: it prints and reparses expressions, turning `5.0` into integer `5`. I changed that test value to `5.5` to preserve its type through the round trip.

`go build ./...` also encountered a `main` package with no `main` function. I’m checking the library build separately and rerunning the full test suite.

Fixed the shared reverse-loop compiler to discard its condition booleans, preventing stack corruption in map literals.

Regression coverage includes both builtins, match boundaries, no matches, empty input, and optimized `last(filter(...))`.

Validation: `go test ./...` and `go build .` pass. `go build ./...` hits an existing `main` package without a `main` function.

</details>

### codex, all: pass

Files: [compiler/compiler.go](../all/codex/go-expr-findlast-map-1/files/compiler/compiler.go), [expr_test.go](../all/codex/go-expr-findlast-map-1/files/expr_test.go)

<details><summary>diff</summary>

```diff
diff --git a/compiler/compiler.go b/compiler/compiler.go
index f66cf9e..6851753 100644
--- a/compiler/compiler.go
+++ b/compiler/compiler.go
@@ -1213,12 +1213,14 @@ func (c *compiler) emitLoopBackwards(body func()) {
 	c.emit(OpInt, 0)
 	c.emit(OpMoreOrEqual)
 	end := c.emit(OpJumpIfFalse, placeholder)
+	c.emit(OpPop)
 
 	body()
 
 	c.emit(OpDecrementIndex)
 	c.emit(OpJumpBackward, c.calcBackwardJump(begin))
 	c.patchJump(end)
+	c.emit(OpPop)
 }
 
 func (c *compiler) PredicateNode(node *ast.PredicateNode) {
diff --git a/expr_test.go b/expr_test.go
index 1bce3c8..c18257a 100644
--- a/expr_test.go
+++ b/expr_test.go
@@ -1464,6 +1464,32 @@ func TestExpr(t *testing.T) {
 	}
 }
 
+// TestExpr_findLast_in_map checks reverse predicate loops preserve surrounding values.
+func TestExpr_findLast_in_map(t *testing.T) {
+	for _, builtin := range []string{"findLast", "findLastIndex"} {
+		for _, tt := range []struct {
+			args string
+			want any
+		}{
+			{`[1.0, 2.0, 3.0, 4.0, 5.0], # > 3`, map[string]any{"findLast": 5.0, "findLastIndex": 4}[builtin]},
+			{`[1.0, 2.0, 3.0, 4.0, 5.0], # < 2`, map[string]any{"findLast": 1.0, "findLastIndex": 0}[builtin]},
+			{`[1.0, 2.0, 3.0, 4.0, 5.0], # > 5`, nil},
+			{`[], # > 3`, nil},
+		} {
+			code := fmt.Sprintf(`{"r": %s(%s), "s": 42}`, builtin, tt.args)
+			t.Run(code, func(t *testing.T) {
+				for _, optimize := range []bool{false, true} {
+					program, err := expr.Compile(code, expr.Optimize(optimize))
+					require.NoError(t, err)
+					got, err := expr.Run(program, nil)
+					require.NoError(t, err)
+					assert.Equal(t, map[string]any{"r": tt.want, "s": 42}, got)
+				}
+			})
+		}
+	}
+}
+
 func TestExpr_error(t *testing.T) {
 	env := mock.Env{
 		ArrayOfAny: []any{1, "2", 3, true},
```

</details>

<details><summary>reply</summary>

Done. Reverse loops now pop condition flags; regression tests cover matches, misses, empty arrays.
`go test ./...` passes; build fails: `function main is undeclared`.

</details>
