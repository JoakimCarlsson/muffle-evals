# go-chi-allow-duplicates

Source: https://github.com/go-chi/chi/pull/1029

## Prompt

> Duplicate HTTP methods in the 405 `Allow` header.
> 
> When routes are registered that overlap because of their wildcards, their methods are repeated in the `Allow` header of 405 responses:
> 
> ```go
> r := chi.NewRouter()
> 
> r.Post("/article/1-2-3", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
> r.Post("/article/{a}", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
> r.Post("/article/{b}-{c}", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
> r.Post("/article/{b}-{c}-{d}", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
> 
> server := httptest.NewServer(r)
> defer server.Close()
> 
> // Send a request with an unsupported method
> res, _ := http.Get(server.URL + "/article/1-2-3")
> fmt.Println("Status:", res.Status)
> fmt.Println("Header:", res.Header)
> ```
> 
> Output:
> 
> ```
> Status: 405 Method Not Allowed
> Header: map[Allow:[POST POST POST POST] Content-Length:[0] Date:[...]]
> ```
> 
> `POST` appears four times in the `Allow` header. Each method should only appear once.
> 
> Please fix this.

## Upstream change (tests left out)

Files: [mux_test.go](../../tasks/go-chi-allow-duplicates/upstream/mux_test.go), [tree.go](../../tasks/go-chi-allow-duplicates/upstream/tree.go)

```diff
diff --git a/tree.go b/tree.go
index 9f56549..e7bc9ed 100644
--- a/tree.go
+++ b/tree.go
@@ -479,7 +479,9 @@ func (n *node) findRoute(rctx *Context, method methodTyp, path string) *node {
 							if endpoints == mALL || endpoints == mSTUB {
 								continue
 							}
-							rctx.methodsAllowed = append(rctx.methodsAllowed, endpoints)
+							if !slices.Contains(rctx.methodsAllowed, endpoints) {
+								rctx.methodsAllowed = append(rctx.methodsAllowed, endpoints)
+							}
 						}
 
 						// flag that the routing context found a route, but not a corresponding
@@ -525,7 +527,9 @@ func (n *node) findRoute(rctx *Context, method methodTyp, path string) *node {
 					if endpoints == mALL || endpoints == mSTUB {
 						continue
 					}
-					rctx.methodsAllowed = append(rctx.methodsAllowed, endpoints)
+					if !slices.Contains(rctx.methodsAllowed, endpoints) {
+						rctx.methodsAllowed = append(rctx.methodsAllowed, endpoints)
+					}
 				}
 
 				// flag that the routing context found a route, but not a corresponding
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +5/-0 | 20 | 1,147 | $0.075 |
| claude | muffle | pass | +12/-2 | 21 | 1,030 | $0.057 |
| claude | hush | pass | +5/-0 | 0 | 991 | $0.076 |
| claude | sloth | pass | +5/-0 | 13 | 1,381 | $0.067 |
| claude | all | pass | +6/-2 | 18 | 1,509 | $0.089 |
| codex | base | pass | +5/-0 | 30 | 1,231 | - |
| codex | muffle | pass | +5/-0 | 44 | 1,370 | - |
| codex | hush | pass | +5/-0 | 32 | 1,108 | - |
| codex | sloth | pass | +5/-0 | 33 | 1,306 | - |
| codex | all | pass | +5/-0 | 34 | 1,157 | - |

### claude, base: pass

Files: [mux.go](../base/claude/go-chi-allow-duplicates-1/files/mux.go), [mux_test.go](../base/claude/go-chi-allow-duplicates-1/files/mux_test.go)

<details><summary>diff</summary>

```diff
diff --git a/mux.go b/mux.go
index 37cd500..3b67039 100644
--- a/mux.go
+++ b/mux.go
@@ -523,7 +523,12 @@ func (mx *Mux) updateRouteHandler() {
 // methods for the route.
 func methodNotAllowedHandler(methodsAllowed ...methodTyp) func(w http.ResponseWriter, r *http.Request) {
 	return func(w http.ResponseWriter, r *http.Request) {
+		seen := make(map[methodTyp]struct{}, len(methodsAllowed))
 		for _, m := range methodsAllowed {
+			if _, ok := seen[m]; ok {
+				continue
+			}
+			seen[m] = struct{}{}
 			w.Header().Add("Allow", reverseMethodMap[m])
 		}
 		w.WriteHeader(405)
diff --git a/mux_test.go b/mux_test.go
index 3e3b18f..2dcf344 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -2120,3 +2120,23 @@ func BenchmarkMux(b *testing.B) {
 		})
 	}
 }
+
+func TestMuxMethodNotAllowedNoDuplicateAllow(t *testing.T) {
+	r := NewRouter()
+	h := func(w http.ResponseWriter, r *http.Request) {}
+	r.Post("/article/1-2-3", h)
+	r.Post("/article/{a}", h)
+	r.Post("/article/{b}-{c}", h)
+	r.Post("/article/{b}-{c}-{d}", h)
+
+	rec := httptest.NewRecorder()
+	req, _ := http.NewRequest("GET", "/article/1-2-3", nil)
+	r.ServeHTTP(rec, req)
+
+	if rec.Code != 405 {
+		t.Fatalf("expected 405, got %d", rec.Code)
+	}
+	if got := rec.Header()["Allow"]; len(got) != 1 || got[0] != "POST" {
+		t.Fatalf("expected Allow [POST], got %v", got)
+	}
+}
```

</details>

<details><summary>reply</summary>

Dedupe in the handler.

The 405 `Allow` header now lists each method once, so your example returns `Allow: [POST]` instead of four `POST` entries. The full test suite passes.

The fix is in `methodNotAllowedHandler` in `mux.go`. It now skips any method it has already added to the header. Overlapping wildcard routes still each contribute their methods during lookup, so the duplicates are removed at the point the header is written.

I added a regression test, `TestMuxMethodNotAllowedNoDuplicateAllow` in `mux_test.go`, which uses the four routes from your report. I haven't committed anything.

</details>

### claude, muffle: pass

Files: [context.go](../muffle/claude/go-chi-allow-duplicates-1/files/context.go), [dup_test.go](../muffle/claude/go-chi-allow-duplicates-1/files/dup_test.go), [tree.go](../muffle/claude/go-chi-allow-duplicates-1/files/tree.go)

<details><summary>diff</summary>

```diff
diff --git a/context.go b/context.go
index 8222073..5d16dc8 100644
--- a/context.go
+++ b/context.go
@@ -164,3 +164,13 @@ type contextKey struct {
 func (k *contextKey) String() string {
 	return "chi context value " + k.name
 }
+
+// addMethodAllowed records a method for the 405 Allow header, skipping duplicates.
+func (x *Context) addMethodAllowed(m methodTyp) {
+	for _, have := range x.methodsAllowed {
+		if have == m {
+			return
+		}
+	}
+	x.methodsAllowed = append(x.methodsAllowed, m)
+}
diff --git a/dup_test.go b/dup_test.go
new file mode 100644
index 0000000..89f3f96
--- /dev/null
+++ b/dup_test.go
@@ -0,0 +1,21 @@
+package chi
+
+import (
+	"net/http"
+	"net/http/httptest"
+	"testing"
+)
+
+func TestMethodNotAllowedNoDuplicateAllow(t *testing.T) {
+	r := NewRouter()
+	h := func(w http.ResponseWriter, r *http.Request) {}
+	r.Post("/article/1-2-3", h)
+	r.Post("/article/{a}", h)
+	r.Post("/article/{b}-{c}", h)
+	r.Post("/article/{b}-{c}-{d}", h)
+	w := httptest.NewRecorder()
+	r.ServeHTTP(w, httptest.NewRequest("GET", "/article/1-2-3", nil))
+	if got := w.Header().Values("Allow"); len(got) != 1 || got[0] != "POST" {
+		t.Fatalf("Allow = %v", got)
+	}
+}
diff --git a/tree.go b/tree.go
index 9f56549..1370e12 100644
--- a/tree.go
+++ b/tree.go
@@ -479,7 +479,7 @@ func (n *node) findRoute(rctx *Context, method methodTyp, path string) *node {
 							if endpoints == mALL || endpoints == mSTUB {
 								continue
 							}
-							rctx.methodsAllowed = append(rctx.methodsAllowed, endpoints)
+							rctx.addMethodAllowed(endpoints)
 						}
 
 						// flag that the routing context found a route, but not a corresponding
@@ -525,7 +525,7 @@ func (n *node) findRoute(rctx *Context, method methodTyp, path string) *node {
 					if endpoints == mALL || endpoints == mSTUB {
 						continue
 					}
-					rctx.methodsAllowed = append(rctx.methodsAllowed, endpoints)
+					rctx.addMethodAllowed(endpoints)
 				}
 
 				// flag that the routing context found a route, but not a corresponding
```

</details>

<details><summary>reply</summary>

Add a helper that dedups.

The 405 `Allow` header now lists each method once. Your example gives `Allow: POST` instead of `POST POST POST POST`. `go test .` passes.

The router collected allowed methods from every matching route and never checked for repeats. I added a small helper, `addMethodAllowed` in `context.go`, that skips methods already collected. Both places in `tree.go` that gather methods now call it.

I also added a regression test using your four overlapping routes, in a new file, `dup_test.go`. You may want to move it into `mux_test.go`.

I haven't committed anything.

</details>

### claude, hush: pass

Files: [mux.go](../hush/claude/go-chi-allow-duplicates-1/files/mux.go)

<details><summary>diff</summary>

```diff
diff --git a/mux.go b/mux.go
index 37cd500..48c3601 100644
--- a/mux.go
+++ b/mux.go
@@ -523,7 +523,12 @@ func (mx *Mux) updateRouteHandler() {
 // methods for the route.
 func methodNotAllowedHandler(methodsAllowed ...methodTyp) func(w http.ResponseWriter, r *http.Request) {
 	return func(w http.ResponseWriter, r *http.Request) {
+		var seen methodTyp
 		for _, m := range methodsAllowed {
+			if seen&m != 0 {
+				continue
+			}
+			seen |= m
 			w.Header().Add("Allow", reverseMethodMap[m])
 		}
 		w.WriteHeader(405)
```

</details>

<details><summary>reply</summary>

Dedupe in the handler, preserving order.

Done. `methodNotAllowedHandler` in `mux.go` now skips methods already added, so each appears once in `Allow`. Existing tests pass; I didn't add a regression test or run your example.

</details>

### claude, sloth: pass

Files: [mux.go](../sloth/claude/go-chi-allow-duplicates-1/files/mux.go), [mux_test.go](../sloth/claude/go-chi-allow-duplicates-1/files/mux_test.go)

<details><summary>diff</summary>

```diff
diff --git a/mux.go b/mux.go
index 37cd500..34d4ebc 100644
--- a/mux.go
+++ b/mux.go
@@ -523,7 +523,12 @@ func (mx *Mux) updateRouteHandler() {
 // methods for the route.
 func methodNotAllowedHandler(methodsAllowed ...methodTyp) func(w http.ResponseWriter, r *http.Request) {
 	return func(w http.ResponseWriter, r *http.Request) {
+		seen := make(map[methodTyp]bool, len(methodsAllowed))
 		for _, m := range methodsAllowed {
+			if seen[m] {
+				continue
+			}
+			seen[m] = true
 			w.Header().Add("Allow", reverseMethodMap[m])
 		}
 		w.WriteHeader(405)
diff --git a/mux_test.go b/mux_test.go
index 3e3b18f..e4e0995 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -2120,3 +2120,16 @@ func BenchmarkMux(b *testing.B) {
 		})
 	}
 }
+func TestMethodNotAllowedNoDuplicateAllow(t *testing.T) {
+	r := NewRouter()
+	h := func(w http.ResponseWriter, r *http.Request) {}
+	r.Post("/article/1-2-3", h)
+	r.Post("/article/{a}", h)
+	r.Post("/article/{b}-{c}", h)
+	r.Post("/article/{b}-{c}-{d}", h)
+	w := httptest.NewRecorder()
+	r.ServeHTTP(w, httptest.NewRequest("GET", "/article/1-2-3", nil))
+	if got := w.Header().Values("Allow"); len(got) != 1 || got[0] != "POST" {
+		t.Fatalf("Allow = %v", got)
+	}
+}
```

</details>

<details><summary>reply</summary>

The 405 `Allow` header now lists each method once. Your example returns `Allow: POST` instead of `POST POST POST POST`, and `go test .` passes.

The change is in `methodNotAllowedHandler` in `mux.go`. It skips any method it has already added. I fixed it there rather than in `tree.go` because two separate places in `tree.go` collect the allowed methods.

I added `TestMethodNotAllowedNoDuplicateAllow` to `mux_test.go`, using your four overlapping `POST` routes. I didn't run anything beyond the root package's tests.

I haven't committed anything.

</details>

### claude, all: pass

Files: [mux_test.go](../all/claude/go-chi-allow-duplicates-1/files/mux_test.go), [tree.go](../all/claude/go-chi-allow-duplicates-1/files/tree.go)

<details><summary>diff</summary>

```diff
diff --git a/mux_test.go b/mux_test.go
index 3e3b18f..e4db956 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -2120,3 +2120,21 @@ func BenchmarkMux(b *testing.B) {
 		})
 	}
 }
+
+func TestMuxMethodNotAllowedNoDuplicateAllow(t *testing.T) {
+	r := NewRouter()
+	h := func(w http.ResponseWriter, r *http.Request) {}
+	r.Post("/article/1-2-3", h)
+	r.Post("/article/{a}", h)
+	r.Post("/article/{b}-{c}", h)
+	r.Post("/article/{b}-{c}-{d}", h)
+
+	w := httptest.NewRecorder()
+	r.ServeHTTP(w, httptest.NewRequest("GET", "/article/1-2-3", nil))
+	if w.Code != 405 {
+		t.Fatalf("expected 405, got %d", w.Code)
+	}
+	if got := w.Header().Values("Allow"); len(got) != 1 || got[0] != "POST" {
+		t.Fatalf("expected Allow [POST], got %v", got)
+	}
+}
diff --git a/tree.go b/tree.go
index 9f56549..e7bc9ed 100644
--- a/tree.go
+++ b/tree.go
@@ -479,7 +479,9 @@ func (n *node) findRoute(rctx *Context, method methodTyp, path string) *node {
 							if endpoints == mALL || endpoints == mSTUB {
 								continue
 							}
-							rctx.methodsAllowed = append(rctx.methodsAllowed, endpoints)
+							if !slices.Contains(rctx.methodsAllowed, endpoints) {
+								rctx.methodsAllowed = append(rctx.methodsAllowed, endpoints)
+							}
 						}
 
 						// flag that the routing context found a route, but not a corresponding
@@ -525,7 +527,9 @@ func (n *node) findRoute(rctx *Context, method methodTyp, path string) *node {
 					if endpoints == mALL || endpoints == mSTUB {
 						continue
 					}
-					rctx.methodsAllowed = append(rctx.methodsAllowed, endpoints)
+					if !slices.Contains(rctx.methodsAllowed, endpoints) {
+						rctx.methodsAllowed = append(rctx.methodsAllowed, endpoints)
+					}
 				}
 
 				// flag that the routing context found a route, but not a corresponding
```

</details>

<details><summary>reply</summary>

Dedupe at append in tree.go.

Done. `tree.go` now skips a method already in `methodsAllowed` before appending, so each method shows once in `Allow`. I added `TestMuxMethodNotAllowedNoDuplicateAllow` to `mux_test.go`. All tests pass.

</details>

### codex, base: pass

Files: [mux.go](../base/codex/go-chi-allow-duplicates-1/files/mux.go), [mux_test.go](../base/codex/go-chi-allow-duplicates-1/files/mux_test.go)

<details><summary>diff</summary>

```diff
diff --git a/mux.go b/mux.go
index 37cd500..48c3601 100644
--- a/mux.go
+++ b/mux.go
@@ -523,7 +523,12 @@ func (mx *Mux) updateRouteHandler() {
 // methods for the route.
 func methodNotAllowedHandler(methodsAllowed ...methodTyp) func(w http.ResponseWriter, r *http.Request) {
 	return func(w http.ResponseWriter, r *http.Request) {
+		var seen methodTyp
 		for _, m := range methodsAllowed {
+			if seen&m != 0 {
+				continue
+			}
+			seen |= m
 			w.Header().Add("Allow", reverseMethodMap[m])
 		}
 		w.WriteHeader(405)
diff --git a/mux_test.go b/mux_test.go
index 3e3b18f..7888443 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -428,6 +428,36 @@ func TestMethodNotAllowed(t *testing.T) {
 	})
 }
 
+func TestMethodNotAllowedOverlappingRoutes(t *testing.T) {
+	r := NewRouter()
+	handler := func(w http.ResponseWriter, r *http.Request) {
+		w.WriteHeader(http.StatusOK)
+	}
+	for _, pattern := range []string{
+		"/article/1-2-3",
+		"/article/{a}",
+		"/article/{b}-{c}",
+		"/article/{b}-{c}-{d}",
+	} {
+		r.Post(pattern, handler)
+		r.Put(pattern, handler)
+	}
+
+	resp := httptest.NewRecorder()
+	r.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/article/1-2-3", nil))
+	if resp.Code != http.StatusMethodNotAllowed {
+		t.Fatalf("expected status 405, got %d", resp.Code)
+	}
+	allowedMethods := resp.Header().Values("Allow")
+	counts := make(map[string]int)
+	for _, method := range allowedMethods {
+		counts[method]++
+	}
+	if len(allowedMethods) != 2 || counts[http.MethodPost] != 1 || counts[http.MethodPut] != 1 {
+		t.Fatalf("expected Allow to contain POST and PUT once each, got %v", allowedMethods)
+	}
+}
+
 func TestMuxNestedMethodNotAllowed(t *testing.T) {
 	r := NewRouter()
 	r.Get("/root", func(w http.ResponseWriter, r *http.Request) {
```

</details>

<details><summary>reply</summary>

I’ll check how the 405 handler builds the `Allow` header, fix the duplicates, and add a regression test for overlapping routes.

The 405 handler now emits each allowed method once. The regression test covers all four overlapping routes with both POST and PUT to verify that distinct methods are preserved. The router tests pass; the middleware tests are still running.

Fixed the 405 handler so each method appears only once in the `Allow` header.

Added a regression test covering four overlapping routes with POST and PUT, verifying both methods appear exactly once.

Validation: `go test ./...` and `git diff --check` pass.

</details>

### codex, muffle: pass

Files: [mux.go](../muffle/codex/go-chi-allow-duplicates-1/files/mux.go), [mux_test.go](../muffle/codex/go-chi-allow-duplicates-1/files/mux_test.go)

<details><summary>diff</summary>

```diff
diff --git a/mux.go b/mux.go
index 37cd500..48c3601 100644
--- a/mux.go
+++ b/mux.go
@@ -523,7 +523,12 @@ func (mx *Mux) updateRouteHandler() {
 // methods for the route.
 func methodNotAllowedHandler(methodsAllowed ...methodTyp) func(w http.ResponseWriter, r *http.Request) {
 	return func(w http.ResponseWriter, r *http.Request) {
+		var seen methodTyp
 		for _, m := range methodsAllowed {
+			if seen&m != 0 {
+				continue
+			}
+			seen |= m
 			w.Header().Add("Allow", reverseMethodMap[m])
 		}
 		w.WriteHeader(405)
diff --git a/mux_test.go b/mux_test.go
index 3e3b18f..7c7e0ee 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -428,6 +428,50 @@ func TestMethodNotAllowed(t *testing.T) {
 	})
 }
 
+func TestMethodNotAllowedOverlappingRoutes(t *testing.T) {
+	for _, multipleMethods := range []bool{false, true} {
+		t.Run(fmt.Sprintf("multipleMethods=%v", multipleMethods), func(t *testing.T) {
+			r := NewRouter()
+			handler := func(w http.ResponseWriter, r *http.Request) {
+				w.WriteHeader(http.StatusOK)
+			}
+			for _, pattern := range []string{
+				"/article/1-2-3",
+				"/article/{a}",
+				"/article/{b}-{c}",
+				"/article/{b}-{c}-{d}",
+			} {
+				r.Post(pattern, handler)
+				if multipleMethods {
+					r.Put(pattern, handler)
+				}
+			}
+
+			w := httptest.NewRecorder()
+			r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/article/1-2-3", nil))
+			if w.Code != http.StatusMethodNotAllowed {
+				t.Fatalf("status = %d, want %d", w.Code, http.StatusMethodNotAllowed)
+			}
+			want := map[string]int{http.MethodPost: 1}
+			if multipleMethods {
+				want[http.MethodPut] = 1
+			}
+			got := make(map[string]int)
+			for _, method := range w.Header().Values("Allow") {
+				got[method]++
+			}
+			if len(got) != len(want) {
+				t.Fatalf("Allow methods = %v, want %v", got, want)
+			}
+			for method, count := range want {
+				if got[method] != count {
+					t.Errorf("Allow contains %s %d times, want %d", method, got[method], count)
+				}
+			}
+		})
+	}
+}
+
 func TestMuxNestedMethodNotAllowed(t *testing.T) {
 	r := NewRouter()
 	r.Get("/root", func(w http.ResponseWriter, r *http.Request) {
```

</details>

<details><summary>reply</summary>

I’ll check how the router builds the `Allow` header, fix the duplicates, and add a regression test for overlapping routes.

The regression test reproduced four copies of each method. The fix makes the 405 handler emit each method once, and the router tests pass. The middleware tests are still running.

Fixed the 405 handler to include each HTTP method only once in the `Allow` header.

Added regression coverage for overlapping routes with both single and multiple allowed methods. Confirmed the tests failed before the fix.

Validation: `go test ./...` passes.

</details>

### codex, hush: pass

Files: [mux.go](../hush/codex/go-chi-allow-duplicates-1/files/mux.go), [mux_test.go](../hush/codex/go-chi-allow-duplicates-1/files/mux_test.go)

<details><summary>diff</summary>

```diff
diff --git a/mux.go b/mux.go
index 37cd500..48c3601 100644
--- a/mux.go
+++ b/mux.go
@@ -523,7 +523,12 @@ func (mx *Mux) updateRouteHandler() {
 // methods for the route.
 func methodNotAllowedHandler(methodsAllowed ...methodTyp) func(w http.ResponseWriter, r *http.Request) {
 	return func(w http.ResponseWriter, r *http.Request) {
+		var seen methodTyp
 		for _, m := range methodsAllowed {
+			if seen&m != 0 {
+				continue
+			}
+			seen |= m
 			w.Header().Add("Allow", reverseMethodMap[m])
 		}
 		w.WriteHeader(405)
diff --git a/mux_test.go b/mux_test.go
index 3e3b18f..59e69e9 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -13,6 +13,38 @@ import (
 	"time"
 )
 
+func TestMethodNotAllowedDuplicateMethods(t *testing.T) {
+	r := NewRouter()
+	handler := func(w http.ResponseWriter, r *http.Request) {
+		w.WriteHeader(http.StatusOK)
+	}
+	for _, pattern := range []string{
+		"/article/1-2-3",
+		"/article/{a}",
+		"/article/{b}-{c}",
+		"/article/{b}-{c}-{d}",
+	} {
+		r.Post(pattern, handler)
+		r.Put(pattern, handler)
+	}
+
+	for i := 0; i < 2; i++ {
+		resp := httptest.NewRecorder()
+		r.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/article/1-2-3", nil))
+		if resp.Code != http.StatusMethodNotAllowed {
+			t.Fatalf("expected status 405, got %d", resp.Code)
+		}
+		allowed := resp.Header().Values("Allow")
+		counts := make(map[string]int)
+		for _, method := range allowed {
+			counts[method]++
+		}
+		if len(allowed) != 2 || counts[http.MethodPost] != 1 || counts[http.MethodPut] != 1 {
+			t.Fatalf("expected POST and PUT once each, got %v", allowed)
+		}
+	}
+}
+
 func TestMuxBasic(t *testing.T) {
 	var count uint64
 	countermw := func(next http.Handler) http.Handler {
```

</details>

<details><summary>reply</summary>

Done.
405 `Allow` headers now list each method once. Added overlapping-route regression test. `go test ./...` passed.

</details>

### codex, sloth: pass

Files: [mux.go](../sloth/codex/go-chi-allow-duplicates-1/files/mux.go), [mux_test.go](../sloth/codex/go-chi-allow-duplicates-1/files/mux_test.go)

<details><summary>diff</summary>

```diff
diff --git a/mux.go b/mux.go
index 37cd500..3b67039 100644
--- a/mux.go
+++ b/mux.go
@@ -523,7 +523,12 @@ func (mx *Mux) updateRouteHandler() {
 // methods for the route.
 func methodNotAllowedHandler(methodsAllowed ...methodTyp) func(w http.ResponseWriter, r *http.Request) {
 	return func(w http.ResponseWriter, r *http.Request) {
+		seen := make(map[methodTyp]struct{}, len(methodsAllowed))
 		for _, m := range methodsAllowed {
+			if _, ok := seen[m]; ok {
+				continue
+			}
+			seen[m] = struct{}{}
 			w.Header().Add("Allow", reverseMethodMap[m])
 		}
 		w.WriteHeader(405)
diff --git a/mux_test.go b/mux_test.go
index 3e3b18f..12e0ecb 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -428,6 +428,39 @@ func TestMethodNotAllowed(t *testing.T) {
 	})
 }
 
+// TestMethodNotAllowedOverlappingRoutes checks that each allowed method appears once.
+func TestMethodNotAllowedOverlappingRoutes(t *testing.T) {
+	r := NewRouter()
+	handler := func(w http.ResponseWriter, r *http.Request) {
+		w.WriteHeader(http.StatusOK)
+	}
+	for _, path := range []string{"/article/1-2-3", "/article/{a}", "/article/{b}-{c}", "/article/{b}-{c}-{d}"} {
+		r.Post(path, handler)
+	}
+
+	ts := httptest.NewServer(r)
+	defer ts.Close()
+
+	for _, multipleMethods := range []bool{false, true} {
+		if multipleMethods {
+			r.Put("/article/{a}", handler)
+		}
+		resp, _ := testRequest(t, ts, "GET", "/article/1-2-3", nil)
+		if resp.StatusCode != http.StatusMethodNotAllowed {
+			t.Fatal(resp.Status)
+		}
+		allowedMethods := resp.Header.Values("Allow")
+		counts := make(map[string]int)
+		for _, method := range allowedMethods {
+			counts[method]++
+		}
+		if counts["POST"] != 1 || (!multipleMethods && len(allowedMethods) != 1) ||
+			(multipleMethods && (counts["PUT"] != 1 || len(allowedMethods) != 2)) {
+			t.Fatal("Allow header should contain each registered method once. Received: ", allowedMethods)
+		}
+	}
+}
+
 func TestMuxNestedMethodNotAllowed(t *testing.T) {
 	r := NewRouter()
 	r.Get("/root", func(w http.ResponseWriter, r *http.Request) {
```

</details>

<details><summary>reply</summary>

I’ll check how the 405 handler builds `Allow`, fix the duplicate methods, and add a regression test for the overlapping routes.

The shared 405 handler now adds each method once, preserving its first occurrence. The regression test covers your four overlapping POST routes and checks that a distinct PUT method is still included. The build and full test suite are running.

Fixed the shared 405 handler so each method appears only once in `Allow`.

Added regression coverage for your overlapping POST routes and for retaining a distinct PUT method.

Passed: `go build ./... && go test ./...`.

No unrelated changes; race tests were not run.

</details>

### codex, all: pass

Files: [mux.go](../all/codex/go-chi-allow-duplicates-1/files/mux.go), [mux_test.go](../all/codex/go-chi-allow-duplicates-1/files/mux_test.go)

<details><summary>diff</summary>

```diff
diff --git a/mux.go b/mux.go
index 37cd500..48c3601 100644
--- a/mux.go
+++ b/mux.go
@@ -523,7 +523,12 @@ func (mx *Mux) updateRouteHandler() {
 // methods for the route.
 func methodNotAllowedHandler(methodsAllowed ...methodTyp) func(w http.ResponseWriter, r *http.Request) {
 	return func(w http.ResponseWriter, r *http.Request) {
+		var seen methodTyp
 		for _, m := range methodsAllowed {
+			if seen&m != 0 {
+				continue
+			}
+			seen |= m
 			w.Header().Add("Allow", reverseMethodMap[m])
 		}
 		w.WriteHeader(405)
diff --git a/mux_test.go b/mux_test.go
index 3e3b18f..3afb484 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -428,6 +428,40 @@ func TestMethodNotAllowed(t *testing.T) {
 	})
 }
 
+// TestMethodNotAllowedDuplicateMethods checks overlapping routes advertise each method once.
+func TestMethodNotAllowedDuplicateMethods(t *testing.T) {
+	for _, methods := range [][]string{{"POST"}, {"POST", "PUT"}} {
+		r := NewRouter()
+		for _, pattern := range []string{"/article/1-2-3", "/article/{a}", "/article/{b}-{c}", "/article/{b}-{c}-{d}"} {
+			for _, method := range methods {
+				r.MethodFunc(method, pattern, func(w http.ResponseWriter, r *http.Request) {
+					w.WriteHeader(http.StatusOK)
+				})
+			}
+		}
+		resp := httptest.NewRecorder()
+		r.ServeHTTP(resp, httptest.NewRequest("GET", "/article/1-2-3", nil))
+		if resp.Code != http.StatusMethodNotAllowed {
+			t.Fatal(resp.Code)
+		}
+		allowed := resp.Header().Values("Allow")
+		if len(allowed) != len(methods) {
+			t.Fatalf("expected methods %v, received %v", methods, allowed)
+		}
+		for _, method := range methods {
+			count := 0
+			for _, value := range allowed {
+				if value == method {
+					count++
+				}
+			}
+			if count != 1 {
+				t.Fatalf("expected %s once, received %v", method, allowed)
+			}
+		}
+	}
+}
+
 func TestMuxNestedMethodNotAllowed(t *testing.T) {
 	r := NewRouter()
 	r.Get("/root", func(w http.ResponseWriter, r *http.Request) {
```

</details>

<details><summary>reply</summary>

Done.
405 `Allow` headers now list each method once. Added overlapping-route regression coverage; `go build ./...` and `go test ./...` passed.

</details>
