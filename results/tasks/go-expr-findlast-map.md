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
| claude | muffle | pass | +2/-0 | 15 | 2,738 | $0.078 |
| claude | hush | pass | +2/-0 | 0 | 2,507 | $0.065 |
| claude | sloth | pass | +2/-0 | 0 | 6,015 | $0.169 |
| claude | all | pass | +2/-0 | 0 | 2,820 | $0.090 |
| codex | base | pass | +2/-0 | 33 | 1,434 | - |
| codex | muffle | pass | +2/-0 | 33 | 1,425 | - |
| codex | hush | pass | +2/-0 | 25 | 1,160 | - |
| codex | sloth | pass | +3/-0 | 0 | 1,674 | - |
| codex | all | pass | +2/-0 | 0 | 1,327 | - |

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
index 1bce3c8..d490fc7 100644
--- a/expr_test.go
+++ b/expr_test.go
@@ -3005,3 +3005,18 @@ func TestBytesLiteral_errors(t *testing.T) {
 		})
 	}
 }
+
+func TestExpr_findLast_inMapLiteral(t *testing.T) {
+	tests := map[string]any{
+		`{"r": findLast([1, 2, 3, 4, 5], # > 3)}`:      map[string]any{"r": 5},
+		`{"r": findLastIndex([1, 2, 3, 4, 5], # > 3)}`: map[string]any{"r": 4},
+		`{"r": findLast([1, 2], # > 3)}`:               map[string]any{"r": nil},
+	}
+	for input, want := range tests {
+		program, err := expr.Compile(input)
+		require.NoError(t, err)
+		out, err := expr.Run(program, nil)
+		require.NoError(t, err)
+		assert.Equal(t, want, out, input)
+	}
+}
```

</details>

<details><summary>reply</summary>

Compiler looks symmetric; look at emitLoopBackwards and the map node.

My test expectation was wrong (index of 5 is 4); fix it.

`findLast()` and `findLastIndex()` now work inside `{ }` map literals. Your two failing examples return `map[r:5]` and `map[r:4]`, and the full test suite passes.

**Cause:** the backward loop used by those two builtins (`emitLoopBackwards` in `compiler/compiler.go`) checks `index >= 0` with a jump that doesn't remove the comparison result from the stack. That boolean stayed on the stack on every iteration and again when the loop ended. In a plain call nothing noticed. Inside a map literal, the map builder took the leftover `bool` as a key, hence "interface {} is bool, not string".

**Fix:** the loop now pops that boolean on both paths, when it continues into the body and when it exits.

I added `TestExpr_findLast_inMapLiteral` to `expr_test.go`. It covers `findLast`, `findLastIndex` and a no-match case, which returns `nil`.

`gofmt -l` flags four test files, but I didn't touch any of them, and the files I changed are clean.

I haven't committed anything.

</details>

### claude, hush: pass

Files: [compiler/compiler.go](../hush/claude/go-expr-findlast-map-1/files/compiler/compiler.go)

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
```

</details>

<details><summary>reply</summary>

Fix is half done: the loop-condition bool also stays on the stack on the continue path. I'm adding a pop there too.

Done. `emitLoopBackwards` in `compiler/compiler.go` left its loop-condition bool on the stack. It now pops that bool when the loop continues and when it exits. Map-literal cases for `findLast` and `findLastIndex` now return correct results, and `go test ./...` passes. I didn't add a regression test.

</details>

### claude, sloth: pass

Files: [compiler/compiler.go](../sloth/claude/go-expr-findlast-map-1/files/compiler/compiler.go)

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
```

</details>

<details><summary>reply</summary>

Running the full test suite after fixing the backward loop; waiting on it now.

`findLast()` and `findLastIndex()` now work inside `{ }` map literals. They also work in array literals, and they work when nothing matches.

**Cause:** the backward loop in `emitLoopBackwards` (`compiler/compiler.go`) left the loop-condition bool (`index >= 0`) on the stack on every iteration and when the loop ended. A bare `findLast(...)` call hid this, but inside a map literal the stray bool was read as a key, which gave "interface {} is bool, not string".

**Fix:** I added an `OpPop` after the condition's `JumpIfFalse` and another at the loop-exit target.

I checked these cases with a throwaway test, which I then deleted:
- `{"r": findLast([1,2,3,4,5], # > 3)}` gives `map[r:5]`.
- `{"r": findLastIndex([1,2,3,4,5], # > 3)}` gives `map[r:4]`.
- A predicate that never matches gives `map[r:<nil>]`.
- `findLastIndex([], ...)` on an empty array gives `map[r:<nil>]`.
- `[findLast([1,2,3], # > 5), 1]` gives `[<nil> 1]`.

`go test ./...` passes (55 packages OK). I didn't add a permanent regression test, since you didn't ask for one. Nothing is committed.

That notification is about the first test command, which hung and was stopped at its time limit. It hung because of a stray `cat > /tmp/x` in my command that waited on stdin. I didn't restart it.

The fix and checks I reported are unaffected. I re-ran the throwaway test and the full `go test ./...` in separate commands, and both passed. I deleted the throwaway test file and the stray `/tmp/x`. The only change in the working tree is `compiler/compiler.go`. Nothing is committed.

</details>

### claude, all: pass

Files: [compiler/compiler.go](../all/claude/go-expr-findlast-map-1/files/compiler/compiler.go)

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
```

</details>

<details><summary>reply</summary>

Found it: the backward loop's exit `JumpIfFalse` leaves a stray bool on the stack. I'm adding a pop there.

Done. `emitLoopBackwards` in `compiler/compiler.go` left a bool on the stack, which broke the surrounding map literal. It now pops it on both the loop-continue and loop-exit paths.

Both builtins now work inside `{ }`, including when nothing matches and on an empty array. The full test suite passes. I added no permanent test.

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
index f66cf9e..4f8f758 100644
--- a/compiler/compiler.go
+++ b/compiler/compiler.go
@@ -1213,12 +1213,14 @@ func (c *compiler) emitLoopBackwards(body func()) {
 	c.emit(OpInt, 0)
 	c.emit(OpMoreOrEqual)
 	end := c.emit(OpJumpIfFalse, placeholder)
+	c.emit(OpPop) // Discard the loop condition before executing the body.
 
 	body()
 
 	c.emit(OpDecrementIndex)
 	c.emit(OpJumpBackward, c.calcBackwardJump(begin))
 	c.patchJump(end)
+	c.emit(OpPop) // Discard the loop condition when the loop is exhausted.
 }
 
 func (c *compiler) PredicateNode(node *ast.PredicateNode) {
diff --git a/expr_test.go b/expr_test.go
index 1bce3c8..515cb8b 100644
--- a/expr_test.go
+++ b/expr_test.go
@@ -83,6 +83,39 @@ func ExampleEval_bytes_literal() {
 	// Output: [97 98 99]
 }
 
+func TestFindLastInMap(t *testing.T) {
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
+			{"first", "[1.0, 2.0, 3.0]", "# == 1", 1.0, 0},
+			{"no match", "[1.0, 2.0, 3.0]", "# > 3", nil, nil},
+			{"empty", "[]", "# > 3", nil, nil},
+		} {
+			for _, optimize := range []bool{false, true} {
+				t.Run(fmt.Sprintf("%s/%s/optimize=%t", builtin, tt.name, optimize), func(t *testing.T) {
+					code := fmt.Sprintf(`{"before": 42, "r": %s(%s, %s), "after": 99}`, builtin, tt.array, tt.predicate)
+					program, err := expr.Compile(code, expr.Optimize(optimize))
+					require.NoError(t, err)
+					out, err := expr.Run(program, nil)
+					require.NoError(t, err)
+					want := tt.value
+					if builtin == "findLastIndex" {
+						want = tt.index
+					}
+					assert.Equal(t, map[string]any{"before": 42, "r": want, "after": 99}, out)
+				})
+			}
+		}
+	}
+}
+
 func TestDisableIfOperator_AllowsIfFunction(t *testing.T) {
 	env := map[string]any{
 		"if": func(x int) int { return x + 1 },
```

</details>

<details><summary>reply</summary>

I’ll trace how the reverse searches affect the VM stack, fix the issue, and add regression tests for map values.

The reverse loop leaves its condition boolean on the stack on every iteration and at exhaustion. Map construction then reads that boolean as a key. I’ve added cleanup on both paths and regression tests for matches, no matches, and empty arrays, with optimization enabled and disabled. The full test suite is running now.

Fixed both builtins by cleaning up the reverse loop’s condition boolean, which was left on the VM stack and mistaken for a map key.

Added regression tests covering matches, no matches, and empty arrays, with optimization enabled and disabled.

All tests pass: `go test ./...`.

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
index 1bce3c8..abd841a 100644
--- a/expr_test.go
+++ b/expr_test.go
@@ -1464,6 +1464,31 @@ func TestExpr(t *testing.T) {
 	}
 }
 
+func TestExpr_findLast_map_value(t *testing.T) {
+	for _, optimize := range []bool{false, true} {
+		for _, builtin := range []string{"findLast", "findLastIndex"} {
+			for _, tt := range []struct {
+				array string
+				want  any
+			}{
+				{"[1.0, 2.0, 3.0, 4.0, 5.0]", map[string]any{"findLast": 5.0, "findLastIndex": 4}[builtin]},
+				{"[5.0, 4.0, 3.0, 2.0, 1.0]", map[string]any{"findLast": 4.0, "findLastIndex": 1}[builtin]},
+				{"[1.0, 2.0, 3.0]", nil},
+				{"[]", nil},
+			} {
+				expression := fmt.Sprintf(`{"r": %s(%s, # > 3)}`, builtin, tt.array)
+				t.Run(fmt.Sprintf("%s/optimize=%t", expression, optimize), func(t *testing.T) {
+					program, err := expr.Compile(expression, expr.Optimize(optimize))
+					require.NoError(t, err)
+					result, err := expr.Run(program, nil)
+					require.NoError(t, err)
+					assert.Equal(t, map[string]any{"r": tt.want}, result)
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

Done.
Fixed reverse-loop stack leak affecting both builtins. Added map regression tests covering matches, no matches, empty arrays, optimization on/off. `go test ./...` passed.

</details>

### codex, sloth: pass

Files: [compiler/compiler.go](../sloth/codex/go-expr-findlast-map-1/files/compiler/compiler.go)

<details><summary>diff</summary>

```diff
diff --git a/compiler/compiler.go b/compiler/compiler.go
index f66cf9e..32f6834 100644
--- a/compiler/compiler.go
+++ b/compiler/compiler.go
@@ -1203,6 +1203,7 @@ func (c *compiler) emitLoop(body func()) {
 	c.patchJump(end)
 }
 
+// emitLoopBackwards emits a reverse loop, consuming each boundary-check result.
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
```

</details>

<details><summary>reply</summary>

I’ll trace how the reverse-search builtins use the VM stack, compare them with `find` and `findIndex`, and fix the shared cause. Then I’ll build and run the existing tests.

The reverse-loop helper leaves its boundary-check boolean on the stack. Map construction then reads that boolean as a key, causing the error.

The fix belongs in that shared helper, which serves both builtins and optimized `filter(... ) | last()` expressions. I’ll remove the boolean on both loop paths. No caller, fixture, config, or export changes are needed; I’ll use the existing tests and direct reproduction checks.

Fixed in [compiler/compiler.go]( /home/jdaddy/.cache/muffle-evals/runs/sloth/codex/go-expr-findlast-map-1/work/compiler/compiler.go:1207). The shared reverse-loop helper now removes boundary-check booleans from the stack, fixing both builtins inside map literals.

Validation: all existing tests and 20 direct reproduction/edge-case checks passed. Affected packages build successfully. `go build ./...` fails because the existing examples package lacks a `main` function.

</details>

### codex, all: pass

Files: [compiler/compiler.go](../all/codex/go-expr-findlast-map-1/files/compiler/compiler.go)

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
```

</details>

<details><summary>reply</summary>

Compiler stack handling needs checking; then shared fix, build, existing tests.


Done.
Reverse loops pop condition flags. Existing tests pass; compiler/VM build pass. Full build fails: `function main is undeclared in the main package`.

</details>
