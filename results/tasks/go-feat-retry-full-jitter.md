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
| claude | base | pass | +22/-0 | 56 | 1,723 | $0.084 |
| claude | muffle | pass | +22/-0 | 66 | 2,006 | $0.076 |
| claude | hush | pass | +22/-0 | 42 | 1,416 | $0.070 |
| claude | sloth | pass | +21/-0 | 56 | 3,000 | $0.096 |
| claude | all | pass | +19/-0 | 66 | 1,751 | $0.091 |
| codex | base | pass | +19/-0 | 60 | 1,402 | - |
| codex | muffle | pass | +24/-0 | 58 | 1,522 | - |
| codex | hush | pass | +19/-0 | 43 | 1,059 | - |
| codex | sloth | pass | +15/-0 | 56 | 1,476 | - |
| codex | all | pass | +15/-0 | 56 | 1,115 | - |

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
index b493869..b30f71b 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,25 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration between
+// 0 (inclusive) and the base value (exclusive), known as "full jitter". See
+// https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/. A
+// zero or negative base is returned unchanged.
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
index 7c528e8..08f285b 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -198,6 +198,62 @@ func ExampleWithJitterPercent() {
 	}
 }
 
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
+	if val, stop := b.Next(); !stop || val != 0 {
+		t.Errorf("expected stop with 0, got %v, %v", val, stop)
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
+		if val, stop := b.Next(); stop || val != base {
+			t.Errorf("expected %v, got %v (stop=%v)", base, val, stop)
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

I added `WithFullJitter(next Backoff) Backoff` to `backoff.go`, right after `WithJitterPercent`. `go vet` and `go test ./...` both pass.

- **Range:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** when the wrapped backoff says stop, it returns `0, true`.
- **Zero or negative base:** the value comes back unchanged, so `rand.Int64N` is never called with a non-positive argument and nothing panics.

I also added three tests in `backoff_test.go` (the range, stop, and non-positive base cases) plus an `ExampleWithFullJitter`. The README's Jitter section now has a short `WithFullJitter` snippet.

Nothing is committed.

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
index b493869..2e48346 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,25 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration between
+// 0 (inclusive) and the base value (exclusive), as described in the AWS
+// "Exponential Backoff and Jitter" article. A base value that is zero or
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
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..62bb4b4 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -119,6 +119,72 @@ func ExampleWithJitter() {
 	}
 }
 
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
+func TestWithFullJitter_NonPositive(t *testing.T) {
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
+
 func TestWithJitterPercent(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

I added `WithFullJitter(next Backoff) Backoff` in `backoff.go`, right after `WithJitterPercent`. `go vet` and `go test` pass, and `gofmt` reports nothing.

- **Result:** each `Next()` returns a random duration in `[0, base)`, where `base` is what the wrapped backoff returned.
- **Stop:** when the wrapped backoff says stop, it returns `0, true`, the same as the other jitter middleware.
- **Zero or negative base:** the value is returned unchanged, so nothing panics.

In `backoff_test.go` I added a range test over 100,000 draws, a table test for zero, negative and stop cases, and `ExampleWithFullJitter`, which matches your usage snippet. I also added a short `WithFullJitter` entry to the Jitter section of the README.

I haven't committed anything.

</details>

### claude, hush: pass

Files: [README.md](../hush/claude/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../hush/claude/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../hush/claude/go-feat-retry-full-jitter-1/files/backoff_test.go)

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
index b493869..acd4753 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,25 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration between
+// 0 (inclusive) and the base value (exclusive), as described in the AWS
+// article "Exponential Backoff And Jitter". A zero or negative base value is
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
index 7c528e8..18c6d5b 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -342,3 +342,45 @@ func ExampleWithMaxDuration() {
 		// handle error
 	}
 }
+
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		return 1 * time.Second, false
+	}))
+	for range 100_000 {
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
+	for _, base := range []time.Duration{0, -1 * time.Second} {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return base, false
+		}))
+		if val, stop := b.Next(); stop || val != base {
+			t.Errorf("expected (%v, false), got (%v, %v)", base, val, stop)
+		}
+	}
+}
```

</details>

<details><summary>reply</summary>

Done. `WithFullJitter` added in `backoff.go`, with tests and a README entry. Tests pass.

</details>

### claude, sloth: pass

Files: [README.md](../sloth/claude/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../sloth/claude/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../sloth/claude/go-feat-retry-full-jitter-1/files/backoff_test.go)

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
index b493869..b9ce29e 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,24 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and replaces the value with a random
+// duration in [0, base), where base is the value returned by the wrapped
+// backoff. A base that is zero or negative is returned unchanged.
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
index 7c528e8..f3f6c04 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -342,3 +342,59 @@ func ExampleWithMaxDuration() {
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
+	if val, stop := b.Next(); !stop || val != 0 {
+		t.Errorf("expected stop with 0, got %v, %v", val, stop)
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
+		if val, stop := b.Next(); stop || val != base {
+			t.Errorf("expected %v, got %v (stop=%v)", base, val, stop)
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
+	if err := retry.Do(ctx, b, func(ctx context.Context) error {
+		// Actual retry logic here
+		return nil
+	}); err != nil {
+		// handle error
+	}
+}
```

</details>

<details><summary>reply</summary>

I've added `WithFullJitter` and the tests pass; I'm wrapping up now.

- **`backoff.go`**: `WithFullJitter(next Backoff) Backoff` sits next to the other jitter middlewares. It returns a random duration in `[0, base)`.
- **Stop:** when the wrapped backoff stops, it returns `0, true`.
- **Zero or negative base:** it is returned unchanged, so there is no panic from `rand.Int64N`.
- **`backoff_test.go`**: tests for the range, stop, and non-positive cases, plus an `ExampleWithFullJitter` matching your usage.
- **`README.md`**: a short entry under the Jitter section.

`go test ./...` passes. I haven't committed anything.

</details>

### claude, all: pass

Files: [backoff.go](../all/claude/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../all/claude/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/backoff.go b/backoff.go
index b493869..4462251 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,25 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration between
+// 0 (inclusive) and the wrapped value (exclusive), as described in the AWS
+// "Exponential Backoff and Jitter" article. A zero or negative wrapped value is
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
index 7c528e8..ee95162 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -198,6 +198,72 @@ func ExampleWithJitterPercent() {
 	}
 }
 
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
+func TestWithFullJitter_Passthrough(t *testing.T) {
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
+		{name: "stop_propagates", nextVal: 1 * time.Second, nextStop: true, wantStop: true},
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
+
 func TestWithMaxRetries(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

Done. `WithFullJitter` is in `backoff.go`, with range, stop, zero/negative and example tests in `backoff_test.go`. Tests pass. Nothing committed.

</details>

### codex, base: pass

Files: [README.md](../base/codex/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../base/codex/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../base/codex/go-feat-retry-full-jitter-1/files/backoff_test.go)

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
index 7c528e8..faed143 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -198,6 +198,66 @@ func ExampleWithJitterPercent() {
 	}
 }
 
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	// Change the base on every call to verify that the wrapper advances it.
+	bases := []time.Duration{time.Nanosecond, time.Second, time.Duration(1<<63 - 1)}
+	calls := 0
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		base := bases[calls%len(bases)]
+		calls++
+		return base, false
+	}))
+	for i := range 10_000 {
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
+func TestWithFullJitter_NonPositiveAndStop(t *testing.T) {
+	t.Parallel()
+
+	cases := []struct {
+		name string
+		base time.Duration
+		stop bool
+		want time.Duration
+	}{
+		{name: "zero"},
+		{name: "negative", base: -time.Second, want: -time.Second},
+		{name: "minimum", base: time.Duration(-1 << 63), want: time.Duration(-1 << 63)},
+		{name: "stop_positive", base: time.Second, stop: true},
+		{name: "stop_zero", stop: true},
+		{name: "stop_negative", base: -time.Second, stop: true},
+	}
+	for _, tc := range cases {
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
+
+	// Each call returns a random duration in [0, the next Fibonacci duration).
+	_, _ = b.Next()
+}
+
 func TestWithMaxRetries(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

I’ll check the existing jitter middleware, add `WithFullJitter`, and test the range, stop, and nonpositive-duration behavior.

Added `WithFullJitter(next Backoff) Backoff`.

- Returns a uniformly random duration in `[0, base)`.
- Propagates stop signals.
- Returns zero and negative bases unchanged without panicking.

Added tests, a usage example, and README documentation. `go test ./...` and `git diff --check` pass.

</details>

### codex, muffle: pass

Files: [README.md](../muffle/codex/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../muffle/codex/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../muffle/codex/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..a72abde 100644
--- a/README.md
+++ b/README.md
@@ -128,6 +128,14 @@ b = WithJitter(500*time.Millisecond, b)
 b = WithJitterPercent(5, b)
 ```
 
+For full jitter, choose a random duration from zero (inclusive) to the next
+backoff value (exclusive). Zero and negative values are returned unchanged.
+
+```golang
+b := NewFibonacci(1 * time.Second)
+b = WithFullJitter(b)
+```
+
 ### MaxRetries
 
 To terminate a retry, specify the maximum number of _retries_. Note this
diff --git a/backoff.go b/backoff.go
index b493869..fdb657a 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,22 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff and returns a uniformly random duration in
+// [0, base), where base is the duration returned by next. Zero and negative
+// durations are returned unchanged.
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
index 7c528e8..018f18f 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -198,6 +198,64 @@ func ExampleWithJitterPercent() {
 	}
 }
 
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	// Vary the underlying value to verify each call uses the current base.
+	bases := []time.Duration{time.Nanosecond, time.Second, time.Duration(1<<63 - 1)}
+	calls := 0
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		base := bases[calls%len(bases)]
+		calls++
+		return base, false
+	}))
+	for i := range 10_000 {
+		base := bases[i%len(bases)]
+		val, stop := b.Next()
+		if stop || val < 0 || val >= base {
+			t.Fatalf("Next() = (%v, %t), want duration in [0, %v) and no stop", val, stop, base)
+		}
+	}
+	if calls != 10_000 {
+		t.Fatalf("wrapped backoff called %d times, want 10000", calls)
+	}
+}
+
+func TestWithFullJitter_EdgeCases(t *testing.T) {
+	t.Parallel()
+
+	cases := []struct {
+		name string
+		base time.Duration
+		stop bool
+		want time.Duration
+	}{
+		{name: "zero"},
+		{name: "negative", base: -time.Second, want: -time.Second},
+		{name: "minimum", base: time.Duration(-1 << 63), want: time.Duration(-1 << 63)},
+		{name: "stop_positive", base: time.Second, stop: true},
+		{name: "stop_zero", stop: true},
+		{name: "stop_negative", base: -time.Second, stop: true},
+	}
+	for _, tc := range cases {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+			b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+				return tc.base, tc.stop
+			}))
+			if val, stop := b.Next(); val != tc.want || stop != tc.stop {
+				t.Errorf("Next() = (%v, %t), want (%v, %t)", val, stop, tc.want, tc.stop)
+			}
+		})
+	}
+}
+
+func ExampleWithFullJitter() {
+	b := retry.NewFibonacci(1 * time.Second)
+	b = retry.WithFullJitter(b)
+	b.Next()
+}
+
 func TestWithMaxRetries(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

I’ll check the existing jitter middleware, add `WithFullJitter` with edge-case tests, and run the test suite.

Added `WithFullJitter(next Backoff) Backoff` with uniform random waits in `[0, base)`, stop propagation, and unchanged zero or negative durations.

Included documentation, a usage example, and edge-case tests. `go test ./...` passes.

</details>

### codex, hush: pass

Files: [README.md](../hush/codex/go-feat-retry-full-jitter-1/files/README.md), [backoff.go](../hush/codex/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../hush/codex/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/README.md b/README.md
index 47b6e26..01ee360 100644
--- a/README.md
+++ b/README.md
@@ -126,6 +126,9 @@ b = WithJitter(500*time.Millisecond, b)
 
 // Return the next value, +/- 5% of the result
 b = WithJitterPercent(5, b)
+
+// Return a random duration in [0, the next value)
+b = WithFullJitter(b)
 ```
 
 ### MaxRetries
diff --git a/backoff.go b/backoff.go
index b493869..18f9081 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,22 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff function and returns a random duration in
+// [0, base), where base is the wrapped backoff's next duration. Zero and
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
index 7c528e8..a630bc6 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -198,6 +198,49 @@ func ExampleWithJitterPercent() {
 	}
 }
 
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	for _, base := range []time.Duration{1, time.Second, time.Duration(1<<63 - 1)} {
+		calls := 0
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			calls++
+			return base, false
+		}))
+		for range 1000 {
+			val, stop := b.Next()
+			if stop || val < 0 || val >= base {
+				t.Fatalf("base %v: got (%v, %t), want duration in [0, base) and no stop", base, val, stop)
+			}
+		}
+		if calls != 1000 {
+			t.Fatalf("wrapped backoff called %d times, want 1000", calls)
+		}
+	}
+}
+
+func TestWithFullJitter_NonPositiveAndStop(t *testing.T) {
+	t.Parallel()
+
+	for _, base := range []time.Duration{0, -time.Second, time.Duration(-1 << 63), time.Second} {
+		for _, stop := range []bool{false, true} {
+			if base > 0 && !stop {
+				continue
+			}
+			b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+				return base, stop
+			}))
+			want := base
+			if stop {
+				want = 0
+			}
+			if val, gotStop := b.Next(); val != want || gotStop != stop {
+				t.Errorf("base %v, stop %t: got (%v, %t), want (%v, %t)", base, stop, val, gotStop, want, stop)
+			}
+		}
+	}
+}
+
 func TestWithMaxRetries(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

Done.
Added `WithFullJitter`, documentation, and boundary tests. Returns `[0, base)`, propagates stops, preserves nonpositive bases. `go test ./...` passed.

</details>

### codex, sloth: pass

Files: [backoff.go](../sloth/codex/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../sloth/codex/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/backoff.go b/backoff.go
index b493869..490a885 100644
--- a/backoff.go
+++ b/backoff.go
@@ -43,6 +43,21 @@ func WithJitter(j time.Duration, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff and returns a random duration in [0, base).
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
 // WithJitterPercent wraps a backoff function and adds the specified jitter
 // percentage. j can be interpreted as "+/- j%". For example, if j were 5 and
 // the backoff returned 20s, the value could be between 19 and 21 seconds. The
diff --git a/backoff_test.go b/backoff_test.go
index 7c528e8..8e87549 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -119,6 +119,62 @@ func ExampleWithJitter() {
 	}
 }
 
+// TestWithFullJitter verifies positive durations, including duration boundaries.
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	for _, base := range []time.Duration{1, time.Second, 1<<63 - 1} {
+		b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+			return base, false
+		}))
+		for range 100_000 {
+			val, stop := b.Next()
+			if stop {
+				t.Fatal("should not stop")
+			}
+			if val < 0 || val >= base {
+				t.Fatalf("expected %v to be in [0, %v)", val, base)
+			}
+		}
+	}
+}
+
+// TestWithFullJitter_NonPositiveAndStop verifies unchanged durations and stopping.
+func TestWithFullJitter_NonPositiveAndStop(t *testing.T) {
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
+		{name: "stop", base: time.Second, stop: true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			t.Parallel()
+
+			b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+				return tc.base, tc.stop
+			}))
+			val, stop := b.Next()
+			if val != tc.want || stop != tc.stop {
+				t.Fatalf("got (%v, %t), want (%v, %t)", val, stop, tc.want, tc.stop)
+			}
+		})
+	}
+}
+
+// ExampleWithFullJitter demonstrates wrapping a Fibonacci backoff.
+func ExampleWithFullJitter() {
+	b := retry.NewFibonacci(1 * time.Second)
+	b = retry.WithFullJitter(b)
+	b.Next()
+}
+
 func TestWithJitterPercent(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

I’ll check the existing jitter code and tests, add `WithFullJitter` in the same style, and run the build and tests.

Added `WithFullJitter(next Backoff) Backoff` beside the existing jitter middleware.

Tests cover `[0, base)`, stop propagation, unchanged zero and negative bases, and duration boundaries. The Fibonacci usage example compiles.

Passed: `go build ./... && go test ./...`.

No extra options or dependencies added. Race tests were not run.

</details>

### codex, all: pass

Files: [backoff.go](../all/codex/go-feat-retry-full-jitter-1/files/backoff.go), [backoff_test.go](../all/codex/go-feat-retry-full-jitter-1/files/backoff_test.go)

<details><summary>diff</summary>

```diff
diff --git a/backoff.go b/backoff.go
index b493869..806de57 100644
--- a/backoff.go
+++ b/backoff.go
@@ -67,6 +67,21 @@ func WithJitterPercent(j uint64, next Backoff) Backoff {
 	})
 }
 
+// WithFullJitter wraps a backoff and returns a random duration in [0, base).
+// Zero and negative base durations are returned unchanged.
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
index 7c528e8..2a00259 100644
--- a/backoff_test.go
+++ b/backoff_test.go
@@ -198,6 +198,62 @@ func ExampleWithJitterPercent() {
 	}
 }
 
+// TestWithFullJitter checks bounds for each wrapped duration.
+func TestWithFullJitter(t *testing.T) {
+	t.Parallel()
+
+	base := time.Duration(1)
+	b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+		return base, false
+	}))
+	for _, duration := range []time.Duration{1, time.Second, 1<<63 - 1} {
+		base = duration
+		for range 100_000 {
+			val, stop := b.Next()
+			if stop || val < 0 || val >= base {
+				t.Fatalf("Next() = (%v, %t), want duration in [0, %v) and false", val, stop, base)
+			}
+		}
+	}
+}
+
+// TestWithFullJitter_NonPositiveAndStop checks unchanged bases and stopping.
+func TestWithFullJitter_NonPositiveAndStop(t *testing.T) {
+	t.Parallel()
+
+	for _, tc := range []struct {
+		name string
+		base time.Duration
+		stop bool
+	}{
+		{name: "zero"},
+		{name: "negative", base: -time.Second},
+		{name: "minimum", base: -1 << 63},
+		{name: "stop", base: time.Second, stop: true},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			b := retry.WithFullJitter(retry.BackoffFunc(func() (time.Duration, bool) {
+				return tc.base, tc.stop
+			}))
+			want := tc.base
+			if tc.stop {
+				want = 0
+			}
+			if val, stop := b.Next(); val != want || stop != tc.stop {
+				t.Errorf("Next() = (%v, %t), want (%v, %t)", val, stop, want, tc.stop)
+			}
+		})
+	}
+}
+
+// ExampleWithFullJitter demonstrates wrapping a Fibonacci backoff.
+func ExampleWithFullJitter() {
+	b := retry.NewFibonacci(1 * time.Second)
+	b = retry.WithFullJitter(b)
+	b.Next()
+	// Output:
+}
+
 func TestWithMaxRetries(t *testing.T) {
 	t.Parallel()
```

</details>

<details><summary>reply</summary>

Done.
Added `WithFullJitter` with `[0, base)` sampling, stop propagation, and unchanged nonpositive durations. Build and all tests passed.

</details>
