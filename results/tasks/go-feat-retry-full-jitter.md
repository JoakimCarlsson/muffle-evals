# go-feat-retry-full-jitter

Source: https://github.com/sethvargo/go-retry/pull/45

## Prompt

> Support "full jitter" backoff.
> 
> `WithJitter` and `WithJitterPercent` only move the wait a little around the base value, so when many clients fail at the same time they still retry in clusters. The AWS article on exponential backoff and jitter recommends "full jitter" instead: wait a random duration anywhere between zero and the base value.
> 
> I would like a new middleware next to the other jitter ones:
> 
> ```go
> func WithFullJitter(next Backoff) Backoff
> ```
> 
> Used like this:
> 
> ```go
> b := retry.NewFibonacci(1 * time.Second)
> b = retry.WithFullJitter(b)
> ```
> 
> - Each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
> - When the wrapped backoff says stop, it stops too.
> - A zero or negative base is returned unchanged and must not panic.
> 
> Please add this.

## Upstream change (tests left out)

Files: [README.md](../../tasks/go-feat-retry-full-jitter/upstream/README.md), [backoff.go](../../tasks/go-feat-retry-full-jitter/upstream/backoff.go), [backoff_test.go](../../tasks/go-feat-retry-full-jitter/upstream/backoff_test.go)

```diff
diff --git a/README.md b/README.md
index 47b6e26..3464965 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random value in [0, next value)
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..47f7475 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,29 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random value between
+// zero (inclusive) and the wrapped backoff's returned value (exclusive). For
+// example, if the backoff returned 20s, the value could be anywhere in [0, 20s).
+//
+// Unlike WithJitter, which applies "+/- j" around the value, full jitter
+// spreads the wait across the entire range, which spreads out retrying clients
+// more effectively. See
+// https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+
+		if val <= 0 {
+			return val, false
+		}
+
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +22/-0 | 58 | 1,701 | $0.083 |
| claude | muffle | pass | +23/-0 | 59 | 1,935 | $0.074 |
| claude | hush | pass | +22/-0 | 66 | 1,725 | $0.077 |
| claude | sloth | pass | +22/-0 | 0 | 1,242 | $0.065 |
| claude | all | pass | +21/-0 | 0 | 1,089 | $0.066 |
| codex | base | pass | +19/-0 | 57 | 1,443 | - |
| codex | muffle | pass | +19/-0 | 55 | 1,412 | - |
| codex | hush | pass | +23/-0 | 46 | 1,322 | - |
| codex | sloth | pass | +26/-0 | 0 | 1,005 | - |
| codex | all | pass | +15/-0 | 0 | 466 | - |

### claude, base: pass

Files: [README.md](../base/claude/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../base/claude/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../base/claude/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..85493e5 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random value between 0 and the result ("full jitter")
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..1bc4705 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,25 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration between
+// 0 (inclusive) and the base value (exclusive), as described in the AWS
+// "Exponential Backoff and Jitter" article. A zero or negative base is
+// returned unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+
+		if val <= 0 {
+			return val, false
+		}
+
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..6e8fb5c 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -342,3 +342,61 @@ func ExampleWithMaxDuration() {
 		// handle error
 	}
 }
+
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	for range 100_000 {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return 1 * time.Second, false
+		}))
+		val, stop := b.Next()
+		if stop {
+			t.Errorf("should not stop")
+		}
+
+		if val < 0 || val >= 1*time.Second {
+			t.Errorf("expected %v to be in [0, 1s)", val)
+		}
+	}
+}
+
+func TestWithFullJitter_Stop(t *testing.T) {
+	t.Parallel()
+
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		return 1 * time.Second, true
+	}))
+	if _, stop := b.Next(); !stop {
+		t.Errorf("expected stop")
+	}
+}
+
+func TestWithFullJitter_NonPositive(t *testing.T) {
+	t.Parallel()
+
+	for _, base := range []time.Duration{0, -1, -time.Second} {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return base, false
+		}))
+		val, stop := b.Next()
+		if stop {
+			t.Errorf("should not stop")
+		}
+		if val != base {
+			t.Errorf("expected %v, got %v", base, val)
+		}
+	}
+}
+
+func ExampleWithFullJitter() {
+	ctx := context.Background()
+
+	b := retry.NewFibonacci(1 * time.Second)
+	b = retry.WithFullJitter(b)
+
+	_ = retry.Do(ctx, b, func(ctx context.Context) error {
+		return nil
+	})
+	// Output:
+}
```

</details>

<details><summary>reply</summary>

I added `WithFullJitter(next Backoff) Backoff` in `backoff.go`, next to the other jitter middleware. `go vet` and `go test ./...` pass.

- **Range:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** if the wrapped backoff says stop, it returns `0, true`.
- **Zero or negative base:** it is returned unchanged with `stop` false, so `rand.Int64N` is never called with a non-positive argument and nothing panics.

I added tests in `backoff_test.go` for the range, stop propagation, and zero and negative bases. I also added a short usage line to the Jitter section of `README.md`.

I also added an `ExampleWithFullJitter`, but it differs from the existing examples. It has an `// Output:` line, so `go test` runs it, and the retried function returns nil straight away, so it never waits. The existing `ExampleWithJitter` has no `// Output:` line, so `go test` only compiles it.

I haven't committed anything.

</details>

### claude, muffle: pass

Files: [README.md](../muffle/claude/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../muffle/claude/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../muffle/claude/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..85493e5 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random value between 0 and the result ("full jitter")
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..909fb43 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,26 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration in
+// [0, base), where base is the value returned by the wrapped backoff. This is
+// the "full jitter" strategy described in the AWS Architecture Blog post
+// "Exponential Backoff And Jitter". A zero or negative base is returned
+// unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+
+		if val <= 0 {
+			return val, false
+		}
+
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..28a4bad 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -198,6 +198,65 @@ func ExampleWithJitterPercent() {
 	}
 }
 
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	base := 10 * time.Second
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		return base, false
+	}))
+
+	for i := 0; i < 1_000; i++ {
+		val, stop := b.Next()
+		if stop {
+			t.Fatal("should not stop")
+		}
+		if val < 0 || val >= base {
+			t.Fatalf("expected %v to be in [0, %v)", val, base)
+		}
+	}
+}
+
+func TestWithFullJitter_Stop(t *testing.T) {
+	t.Parallel()
+
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		return 5 * time.Second, true
+	}))
+
+	if val, stop := b.Next(); !stop || val != 0 {
+		t.Fatalf("expected stop with 0, got %v, %v", val, stop)
+	}
+}
+
+func TestWithFullJitter_NonPositive(t *testing.T) {
+	t.Parallel()
+
+	for _, base := range []time.Duration{0, -1 * time.Second} {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return base, false
+		}))
+
+		if val, stop := b.Next(); stop || val != base {
+			t.Fatalf("expected %v, got %v, %v", base, val, stop)
+		}
+	}
+}
+
+func ExampleWithFullJitter() {
+	ctx := context.Background()
+
+	b := retry.NewFibonacci(1 * time.Second)
+	b = retry.WithFullJitter(b)
+
+	if err := retry.Do(ctx, b, func(_ context.Context) error {
+		// TODO: logic here
+		return nil
+	}); err != nil {
+		// handle error
+	}
+}
+
 func TestWithMaxRetries(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

I added `WithFullJitter(next Backoff) Backoff` in `backoff.go`, next to the other jitter middleware. `gofmt` is clean and `go test ./...` passes.

- **Normal case:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** if the wrapped backoff says stop, it returns `0, true`.
- **Zero or negative base:** the base is returned unchanged, so nothing panics.

I also added three tests and an example to `backoff_test.go`. The tests cover the `[0, base)` range, stopping, and zero or negative bases. The README's Jitter section now shows `WithFullJitter` too.

Nothing is committed.

</details>

### claude, hush: pass

Files: [README.md](../hush/claude/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../hush/claude/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../hush/claude/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..68685f6 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random value between 0 and the next value ("full jitter")
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..6492324 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,25 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration between
+// 0 (inclusive) and the base value (exclusive), as described in the AWS article
+// "Exponential Backoff And Jitter". A zero or negative base is returned
+// unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+
+		if val <= 0 {
+			return val, false
+		}
+
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..bc69270 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -342,3 +342,69 @@ func ExampleWithMaxDuration() {
 		// handle error
 	}
 }
+
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	for range 100_000 {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return 1 * time.Second, false
+		}))
+		val, stop := b.Next()
+		if stop {
+			t.Errorf("should not stop")
+		}
+
+		if val < 0 || val >= 1*time.Second {
+			t.Errorf("expected %v to be in [0, 1s)", val)
+		}
+	}
+}
+
+func TestWithFullJitter_EdgeCases(t *testing.T) {
+	t.Parallel()
+
+	cases := []struct {
+		name     string
+		nextVal  time.Duration
+		nextStop bool
+		wantVal  time.Duration
+		wantStop bool
+	}{
+		{name: "zero", nextVal: 0, wantVal: 0},
+		{name: "negative", nextVal: -1 * time.Second, wantVal: -1 * time.Second},
+		{name: "stop_propagates", nextVal: 1 * time.Second, nextStop: true, wantVal: 0, wantStop: true},
+	}
+
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+
+			b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+				return tc.nextVal, tc.nextStop
+			}))
+
+			val, stop := b.Next()
+			if stop != tc.wantStop {
+				t.Errorf("expected stop to be %t", tc.wantStop)
+			}
+			if val != tc.wantVal {
+				t.Errorf("expected %v to be %v", val, tc.wantVal)
+			}
+		})
+	}
+}
+
+func ExampleWithFullJitter() {
+	ctx := context.Background()
+
+	b := retry.NewFibonacci(1 * time.Second)
+	b = retry.WithFullJitter(b)
+
+	if err := retry.Do(ctx, b, func(_ context.Context) error {
+		// TODO: logic here
+		return nil
+	}); err != nil {
+		// handle error
+	}
+}
```

</details>

<details><summary>reply</summary>

Add README and tests.

Done. `WithFullJitter` in `backoff.go` returns a random duration in `[0, base)`, passes stop through, and returns a zero or negative base unchanged. Added tests, an example and a README entry; `go test ./...` passes.

</details>

### claude, sloth: pass

Files: [README.md](../sloth/claude/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../sloth/claude/go-feat-retry-full-jitter-1/files/backoff.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..85493e5 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random value between 0 and the result ("full jitter")
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..80610be 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,25 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration between
+// 0 (inclusive) and the base value (exclusive), as described in the AWS article
+// "Exponential Backoff and Jitter". A base value of 0 or less is returned
+// unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+
+		if val <= 0 {
+			return val, false
+		}
+
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
```

</details>

<details><summary>reply</summary>

I added `WithFullJitter(next Backoff) Backoff` to `backoff.go`, right after `WithJitterPercent`. It builds, `go vet` is clean, and the existing tests pass. I didn't write tests for it, since you didn't ask for any.

- **Normal case:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** if the wrapped backoff says stop, it returns `0, true`, like the other jitter middlewares.
- **Zero or negative base:** it is returned unchanged and doesn't panic. This check comes before the random call, which would panic on a non-positive bound.

I also added a short `WithFullJitter` example to the Jitter section of `README.md`. Nothing is committed.

</details>

### claude, all: pass

Files: [README.md](../all/claude/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../all/claude/go-feat-retry-full-jitter-1/files/backoff.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..85493e5 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random value between 0 and the result ("full jitter")
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..562c022 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,24 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration between
+// 0 (inclusive) and the base value (exclusive). A base value that is zero or
+// negative is returned unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+
+		if val <= 0 {
+			return val, false
+		}
+
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
```

</details>

<details><summary>reply</summary>

Done. `WithFullJitter` added in `backoff.go` and documented in the README. Build and existing tests pass. I wrote no new tests because you didn't ask for any.

</details>

### codex, base: pass

Files: [README.md](../base/codex/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../base/codex/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../base/codex/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..b2aca1f 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random duration from zero (inclusive) to the next value (exclusive)
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..205dd9e 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,22 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a uniformly random duration
+// in [0, base), where base is the wrapped backoff's next duration. Zero and
+// negative durations are returned unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+		if val <= 0 {
+			return val, false
+		}
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..332a443 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -198,6 +198,63 @@ func ExampleWithJitterPercent() {
 	}
 }
 
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	// Vary the base on each call to verify that the wrapped backoff advances.
+	bases := []time.Duration{time.Nanosecond, time.Second, 1<<63 - 1}
+	var calls int
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		base := bases[calls%len(bases)]
+		calls++
+		return base, false
+	}))
+	for i := range 1000 {
+		base := bases[i%len(bases)]
+		val, stop := b.Next()
+		if stop || val < 0 || val >= base {
+			t.Fatalf("Next() = (%v, %t), want duration in [0, %v) and no stop", val, stop, base)
+		}
+		if calls != i+1 {
+			t.Fatalf("wrapped backoff called %d times, want %d", calls, i+1)
+		}
+	}
+}
+
+func TestWithFullJitter_EdgeCases(t *testing.T) {
+	t.Parallel()
+
+	for _, tc := range []struct {
+		name string
+		base time.Duration
+		stop bool
+		want time.Duration
+	}{
+		{name: "zero"},
+		{name: "negative", base: -time.Second, want: -time.Second},
+		{name: "minimum", base: -1 << 63, want: -1 << 63},
+		{name: "stop_positive", base: time.Second, stop: true},
+		{name: "stop_zero", stop: true},
+		{name: "stop_negative", base: -time.Second, stop: true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+			b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+				return tc.base, tc.stop
+			}))
+			if val, stop := b.Next(); val != tc.want || stop != tc.stop {
+				t.Fatalf("Next() = (%v, %t), want (%v, %t)", val, stop, tc.want, tc.stop)
+			}
+		})
+	}
+}
+
+func ExampleWithFullJitter() {
+	b := retry.NewFibonacci(1 * time.Second)
+	b = retry.WithFullJitter(b)
+	_, _ = b.Next()
+}
+
 func TestWithMaxRetries(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

I’ll check the existing jitter middleware, add `WithFullJitter` and focused tests, then run the test suite.

Added `WithFullJitter(next Backoff)` with uniform sampling in `[0, base)`, stop propagation, and unchanged zero or negative durations.

Included edge-case tests, a usage example, and README documentation.

Validation passed: `go test ./...`, `go test -race ./...`, and `git diff --check`.

</details>

### codex, muffle: pass

Files: [README.md](../muffle/codex/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../muffle/codex/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../muffle/codex/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..f926ad5 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random duration from zero up to (but excluding) the next value
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..08493bc 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,22 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration in
+// [0, base), where base is the duration returned by the wrapped backoff.
+// Zero and negative durations are returned unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+		if val <= 0 {
+			return val, false
+		}
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..2c06038 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -198,6 +198,61 @@ func ExampleWithJitterPercent() {
 	}
 }
 
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	// Use changing bases to verify each call uses the wrapped backoff's value.
+	bases := []time.Duration{time.Nanosecond, time.Second, time.Duration(1<<63 - 1)}
+	var base time.Duration
+	calls := 0
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		calls++
+		return base, false
+	}))
+	for _, base = range bases {
+		for range 1000 {
+			val, stop := b.Next()
+			if stop {
+				t.Fatal("should not stop")
+			}
+			if val < 0 || val >= base {
+				t.Fatalf("expected %v in [0, %v)", val, base)
+			}
+		}
+	}
+	if calls != 1000*len(bases) {
+		t.Errorf("expected one wrapped call per Next, got %d", calls)
+	}
+}
+
+func TestWithFullJitter_NonPositiveAndStop(t *testing.T) {
+	t.Parallel()
+
+	for _, base := range []time.Duration{0, -time.Second, time.Duration(-1 << 63), time.Second} {
+		for _, stopped := range []bool{false, true} {
+			if base > 0 && !stopped {
+				continue
+			}
+			b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+				return base, stopped
+			}))
+			want := base
+			if stopped {
+				want = 0
+			}
+			if val, stop := b.Next(); val != want || stop != stopped {
+				t.Errorf("base %v, stop %t: got (%v, %t), want (%v, %t)", base, stopped, val, stop, want, stopped)
+			}
+		}
+	}
+}
+
+func ExampleWithFullJitter() {
+	b := retry.NewFibonacci(1 * time.Second)
+	b = retry.WithFullJitter(b)
+	_ = b
+}
+
 func TestWithMaxRetries(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

I’ll check the existing jitter middleware, add `WithFullJitter`, and test its range, stop, and nonpositive-base behavior.

Added `WithFullJitter(next Backoff) Backoff` alongside the existing jitter middleware.

- Returns a random duration in `[0, base)`.
- Propagates stop.
- Preserves zero and negative durations without panicking.

Added tests, a usage example, and README documentation. `go test ./...` and `git diff --check` pass.

</details>

### codex, hush: pass

Files: [README.md](../hush/codex/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../hush/codex/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../hush/codex/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..43c52b1 100644
--- a/README.md
+++ b/README.md
@@ -128,6 +128,14 @@ b = WithJitter(500*time.Millisecond, b)
 b = WithJitterPercent(5, b)
 ```
 
+For full jitter, return a random duration in `[0, base)`, where `base` is the
+wrapped backoff's next duration. Zero and negative durations are unchanged.
+
+```golang
+b := NewFibonacci(1 * time.Second)
+b = WithFullJitter(b)
+```
+
 ### MaxRetries
 
 To terminate a retry, specify the maximum number of _retries_. Note this
diff --git a/backoff.go b/backoff.go
index b493869..ed8c2a9 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,21 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a uniformly random duration
+// in [0, next). Zero and negative durations are returned unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+		if val <= 0 {
+			return val, false
+		}
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithMaxRetries executes the backoff function up until the maximum attempts.
 func WithMaxRetries(max uint64, next Backoff) Backoff {
 	var l sync.Mutex
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..8893804 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -198,6 +198,52 @@ func ExampleWithJitterPercent() {
 	}
 }
 
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	bases := []time.Duration{1, 2, time.Second, time.Duration(1<<63 - 1), 0, -1, time.Duration(-1 << 63)}
+	i := 0
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		base := bases[i%len(bases)]
+		i++
+		return base, false
+	}))
+	for range 1000 {
+		for _, base := range bases {
+			val, stop := b.Next()
+			if stop {
+				t.Fatal("should not stop")
+			}
+			if base <= 0 {
+				if val != base {
+					t.Fatalf("expected %v, got %v", base, val)
+				}
+			} else if val < 0 || val >= base {
+				t.Fatalf("expected %v in [0, %v)", val, base)
+			}
+		}
+	}
+}
+
+func TestWithFullJitter_Stop(t *testing.T) {
+	t.Parallel()
+
+	for _, base := range []time.Duration{-1, 0, time.Second} {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return base, true
+		}))
+		if val, stop := b.Next(); val != 0 || !stop {
+			t.Errorf("expected (0, true), got (%v, %t)", val, stop)
+		}
+	}
+}
+
+func ExampleWithFullJitter() {
+	b := retry.NewFibonacci(1 * time.Second)
+	b = retry.WithFullJitter(b)
+	_, _ = b.Next()
+}
+
 func TestWithMaxRetries(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

Done.
Added `WithFullJitter`, docs, tests. Returns `[0, base)`, propagates stop, preserves nonpositive bases. `go test -race ./...` passed.

</details>

### codex, sloth: pass

Files: [README.md](../sloth/codex/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../sloth/codex/go-feat-retry-full-jitter-1/files/backoff.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..b73cf40 100644
--- a/README.md
+++ b/README.md
@@ -128,6 +128,14 @@ b = WithJitter(500*time.Millisecond, b)
 b = WithJitterPercent(5, b)
 ```
 
+For full jitter, use a random duration from zero up to (but excluding) the
+wrapped backoff's value:
+
+```golang
+b := NewFibonacci(1 * time.Second)
+b = WithFullJitter(b)
+```
+
 ### MaxRetries
 
 To terminate a retry, specify the maximum number of _retries_. Note this
diff --git a/backoff.go b/backoff.go
index b493869..f1038f9 100644
--- a/backoff.go
+++ b/backoff.go
@@ -43,6 +43,24 @@ func WithJitter(j time.Duration, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration in
+// [0, base), where base is the wrapped duration. Nonpositive durations are
+// returned unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+
+		if val <= 0 {
+			return val, false
+		}
+
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithJitterPercent wraps a backoff function and adds the specified jitter
 // percentage. j can be interpreted as "+/- j%". For example, if j were 5 and
 // the backoff returned 20s, the value could be between 19 and 21 seconds. The
```

</details>

<details><summary>reply</summary>

I’ll check the existing jitter middleware and callers, add `WithFullJitter` in the same style, then build and run the existing tests.

The change needs a new exported function in `backoff.go` and a README example. No callers, fixtures, or configuration need changes. I’ll use the existing random generator and stop convention, with a guard that returns nonpositive durations unchanged.

Added `WithFullJitter(next Backoff) Backoff` and a README example.

- Returns a random duration in `[0, base)`.
- Propagates the wrapped stop signal.
- Returns zero and negative durations unchanged.

Build and existing tests pass.

</details>

### codex, all: pass

Files: [backoff.go](../all/codex/go-feat-retry-full-jitter-1/files/backoff.go)

<details><summary>diff</summary>

```diff
diff --git a/backoff.go b/backoff.go
index b493869..8dc2ef8 100644
--- a/backoff.go
+++ b/backoff.go
@@ -43,6 +43,21 @@ func WithJitter(j time.Duration, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff and returns a random duration in [0, base).
+// Non-positive base durations are returned unchanged.
+func WithFullJitter(next Backoff) Backoff {
+	return BackoffFunc(func() (time.Duration, bool) {
+		val, stop := next.Next()
+		if stop {
+			return 0, true
+		}
+		if val <= 0 {
+			return val, false
+		}
+		return time.Duration(rand.Int64N(int64(val))), false
+	})
+}
+
 // WithJitterPercent wraps a backoff function and adds the specified jitter
 // percentage. j can be interpreted as "+/- j%". For example, if j were 5 and
 // the backoff returned 20s, the value could be between 19 and 21 seconds. The
```

</details>

<details><summary>reply</summary>

Done.
Added `WithFullJitter`: random `[0, base)`, stop propagation, nonpositive bases unchanged. Build and existing tests pass.

</details>
