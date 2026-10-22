`findLast()` and `findLastIndex()` produce a runtime error when used as values inside `{ }` map literal expressions. All the other predicate builtins (`find`, `findIndex`, `filter`, `all`, `any`, `count`, `none`, `one`) work fine in the same position.

```go
func main() {
	// These work fine:
	run(`findLast([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)`)          // OK: 5
	run(`{"r": find([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}`)       // OK: map[r:4]
	run(`{"r": findIndex([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}`)  // OK: map[r:3]
	run(`{"r": filter([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}`)     // OK: map[r:[4 5]]

	// These crash:
	run(`{"r": findLast([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}`)      // ERROR
	run(`{"r": findLastIndex([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}`) // ERROR
}

func run(expression string) {
	program, err := expr.Compile(expression)
	if err != nil {
		fmt.Printf("COMPILE ERROR: %s\n  %v\n", expression, err)
		return
	}
	result, err := expr.Run(program, nil)
	if err != nil {
		fmt.Printf("RUN ERROR: %s\n  %v\n", expression, err)
		return
	}
	fmt.Printf("OK: %s\n  %v\n", expression, result)
}
```

Error:

```
RUN ERROR: {"r": findLast([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}
  interface conversion: interface {} is bool, not string (1:1)
   | {"r": findLast([1.0, 2.0, 3.0, 4.0, 5.0], # > 3)}
   | ^
```

Compilation succeeds; the error only happens at run time. Workaround is to put the call in a `let` binding before the map literal, but it should just work.

Please fix this.
