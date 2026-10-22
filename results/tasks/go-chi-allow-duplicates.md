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
| claude | base | pass | +13/-2 | 25 | 1,194 | $0.042 |
| claude | muffle | pass | +12/-2 | 21 | 1,461 | $0.058 |
| claude | hush | pass | +5/-0 | 0 | 842 | $0.038 |
| claude | sloth | pass | +5/-0 | 0 | 1,262 | $0.052 |
| claude | all | pass | +12/-2 | 0 | 578 | $0.041 |
| codex | base | pass | +5/-0 | 41 | 1,235 | - |
| codex | muffle | pass | +5/-0 | 41 | 1,556 | - |
| codex | hush | pass | +5/-0 | 44 | 1,226 | - |
| codex | sloth | pass | +5/-0 | 0 | 964 | - |
| codex | all | pass | +5/-0 | 0 | 673 | - |

### claude, base: pass

Files: [context.go](../base/claude/go-chi-allow-duplicates-1/files/context.go), [dup_test.go](../base/claude/go-chi-allow-duplicates-1/files/dup_test.go), [tree.go](../base/claude/go-chi-allow-duplicates-1/files/tree.go)

<details><summary>diff</summary>

```diff
diff --git a/context.go b/context.go
index 8222073..41d2850 100644
--- a/context.go
+++ b/context.go
@@ -164,3 +164,14 @@ type contextKey struct {
 func (k *contextKey) String() string {
 	return "chi context value " + k.name
 }
+
+// addMethodAllowed records m as an allowed method for a 405 response,
+// skipping methods that were already recorded.
+func (x *Context) addMethodAllowed(m methodTyp) {
+	for _, existing := range x.methodsAllowed {
+		if existing == m {
+			return
+		}
+	}
+	x.methodsAllowed = append(x.methodsAllowed, m)
+}
diff --git a/dup_test.go b/dup_test.go
new file mode 100644
index 0000000..fdb71b2
--- /dev/null
+++ b/dup_test.go
@@ -0,0 +1,25 @@
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
+
+	w := httptest.NewRecorder()
+	r.ServeHTTP(w, httptest.NewRequest("GET", "/article/1-2-3", nil))
+	if w.Code != 405 {
+		t.Fatalf("code %d", w.Code)
+	}
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

Simplest: dedupe at both append sites via a helper.

The 405 `Allow` header now lists each method once, so your example returns `Allow: POST` instead of `POST POST POST POST`. I added a regression test using that exact example, and `go test .` passes.

The duplicates came from the route lookup in `tree.go`. It tries each overlapping wildcard route in turn, and every route that matched the path added its methods to the list. I added a small helper, `addMethodAllowed`, to `context.go`. It skips a method that is already in the list, and both places in `tree.go` that collected methods now use it.

The test is in a new file, `dup_test.go`. I haven't committed anything.

</details>

### claude, muffle: pass

Files: [context.go](../muffle/claude/go-chi-allow-duplicates-1/files/context.go), [dup_test.go](../muffle/claude/go-chi-allow-duplicates-1/files/dup_test.go), [tree.go](../muffle/claude/go-chi-allow-duplicates-1/files/tree.go)

<details><summary>diff</summary>

```diff
diff --git a/context.go b/context.go
index 8222073..23675f7 100644
--- a/context.go
+++ b/context.go
@@ -164,3 +164,13 @@ type contextKey struct {
 func (k *contextKey) String() string {
 	return "chi context value " + k.name
 }
+
+// addMethodAllowed records m as allowed for a 405 response, skipping duplicates.
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

I'll dedupe where the methods are appended, so custom 405 handlers also get unique values.

Each method now appears only once in the `Allow` header. Your example returns `Allow: POST`, and `go test .` passes.

Routing can reach the same leaf through several wildcard branches, and each visit appended that leaf's methods again. I added `Context.addMethodAllowed` in `context.go`, which skips a method already recorded. The two append sites in `tree.go` now call it. Because the fix is in the routing context, custom `MethodNotAllowed` handlers also see a deduplicated `methodsAllowed`.

I also added a regression test, `TestMethodNotAllowedNoDuplicateAllow`, using your four routes. It's in a new file, `dup_test.go`, and you may want to move it into `mux_test.go`.

I haven't committed anything.

</details>

### claude, hush: pass

Files: [mux.go](../hush/claude/go-chi-allow-duplicates-1/files/mux.go)

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
```

</details>

<details><summary>reply</summary>

Dedupe in the handler (also covers map-order nondeterminism not at all, but fixes duplicates).

Done. `methodNotAllowedHandler` in `mux.go` now skips repeated methods, so `Allow` lists each once. Existing tests pass. I didn't add a regression test or run your exact example.

</details>

### claude, sloth: pass

Files: [mux.go](../sloth/claude/go-chi-allow-duplicates-1/files/mux.go)

<details><summary>diff</summary>

```diff
diff --git a/mux.go b/mux.go
index 37cd500..0325761 100644
--- a/mux.go
+++ b/mux.go
@@ -523,7 +523,12 @@ func (mx *Mux) updateRouteHandler() {
 // methods for the route.
 func methodNotAllowedHandler(methodsAllowed ...methodTyp) func(w http.ResponseWriter, r *http.Request) {
 	return func(w http.ResponseWriter, r *http.Request) {
+		seen := make(map[methodTyp]struct{}, len(methodsAllowed))
 		for _, m := range methodsAllowed {
+			if _, dup := seen[m]; dup {
+				continue
+			}
+			seen[m] = struct{}{}
 			w.Header().Add("Allow", reverseMethodMap[m])
 		}
 		w.WriteHeader(405)
```

</details>

<details><summary>reply</summary>

Dedupe in the shared handler with a bitmask-free seen set (works for any Go version).

The 405 `Allow` header now lists each method once. I haven't run your four-route example to see the new output. The build passes and the existing tests pass. I didn't add a test, since you didn't ask for one.

The cause is that the router collects allowed methods from every route that matches the path. Overlapping wildcard routes each add their own copy of `POST`. I fixed it in `methodNotAllowedHandler` in `mux.go`, which now skips any method it has already written. That is the one place every 405 response goes through.

The order of methods in the header is still random, as it was before, because they come from a map.

I made no git commit.

</details>

### claude, all: pass

Files: [context.go](../all/claude/go-chi-allow-duplicates-1/files/context.go), [tree.go](../all/claude/go-chi-allow-duplicates-1/files/tree.go)

<details><summary>diff</summary>

```diff
diff --git a/context.go b/context.go
index 8222073..5bcb8b1 100644
--- a/context.go
+++ b/context.go
@@ -164,3 +164,13 @@ type contextKey struct {
 func (k *contextKey) String() string {
 	return "chi context value " + k.name
 }
+
+// addMethodAllowed records m for the 405 Allow header unless already recorded.
+func (x *Context) addMethodAllowed(m methodTyp) {
+	for _, have := range x.methodsAllowed {
+		if have == m {
+			return
+		}
+	}
+	x.methodsAllowed = append(x.methodsAllowed, m)
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

Dedupe at append via helper.

Done. Added `Context.addMethodAllowed` in `context.go`, which skips methods already recorded. Both append sites in `tree.go` now call it. Build and existing tests pass. I didn't run your repro or add a test.

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
index 3e3b18f..299395b 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -428,6 +428,47 @@ func TestMethodNotAllowed(t *testing.T) {
 	})
 }
 
+func TestMethodNotAllowedOverlappingRoutes(t *testing.T) {
+	for _, methods := range [][]string{{http.MethodPost}, {http.MethodPost, http.MethodPut}} {
+		t.Run(fmt.Sprint(methods), func(t *testing.T) {
+			r := NewRouter()
+			for _, pattern := range []string{
+				"/article/1-2-3",
+				"/article/{a}",
+				"/article/{b}-{c}",
+				"/article/{b}-{c}-{d}",
+			} {
+				for _, method := range methods {
+					r.MethodFunc(method, pattern, func(w http.ResponseWriter, r *http.Request) {
+						w.WriteHeader(http.StatusOK)
+					})
+				}
+			}
+
+			w := httptest.NewRecorder()
+			r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/article/1-2-3", nil))
+			if w.Code != http.StatusMethodNotAllowed {
+				t.Fatalf("status = %d, want %d", w.Code, http.StatusMethodNotAllowed)
+			}
+			allowed := w.Header().Values("Allow")
+			if len(allowed) != len(methods) {
+				t.Fatalf("Allow = %v, want each of %v once", allowed, methods)
+			}
+			for _, method := range methods {
+				count := 0
+				for _, value := range allowed {
+					if value == method {
+						count++
+					}
+				}
+				if count != 1 {
+					t.Errorf("Allow = %v, want %s once", allowed, method)
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

I’ll check how the router collects methods for 405 responses, fix the duplicates, and add a regression test for overlapping routes.

Fixed the 405 handler to include each method only once in the `Allow` header.

Added regression tests for overlapping routes with both single and multiple allowed methods. Confirmed they failed before the fix and pass afterward.

Validation: `go test ./...` passes.

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
index 3e3b18f..19a892d 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -428,6 +428,47 @@ func TestMethodNotAllowed(t *testing.T) {
 	})
 }
 
+func TestMethodNotAllowedOverlappingRoutes(t *testing.T) {
+	for _, methods := range [][]string{{http.MethodPost}, {http.MethodPost, http.MethodPut}} {
+		t.Run(fmt.Sprint(methods), func(t *testing.T) {
+			r := NewRouter()
+			for _, pattern := range []string{
+				"/article/1-2-3",
+				"/article/{a}",
+				"/article/{b}-{c}",
+				"/article/{b}-{c}-{d}",
+			} {
+				for _, method := range methods {
+					r.MethodFunc(method, pattern, func(w http.ResponseWriter, r *http.Request) {
+						w.WriteHeader(http.StatusOK)
+					})
+				}
+			}
+
+			resp := httptest.NewRecorder()
+			r.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/article/1-2-3", nil))
+			if resp.Code != http.StatusMethodNotAllowed {
+				t.Fatalf("expected status 405, got %d", resp.Code)
+			}
+			allowed := resp.Header().Values("Allow")
+			if len(allowed) != len(methods) {
+				t.Fatalf("expected each allowed method once: want %v, got %v", methods, allowed)
+			}
+			for _, method := range methods {
+				count := 0
+				for _, value := range allowed {
+					if value == method {
+						count++
+					}
+				}
+				if count != 1 {
+					t.Errorf("expected %s once in Allow header, got %v", method, allowed)
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

I’ll check how the router builds the 405 `Allow` header, add a regression test, and fix the duplicates.

The regression test reproduced the duplicates for both one and two allowed methods. The fix uses the existing method bit flags to emit each method once. The full test suite is running now.

Fixed the 405 handler to include each allowed HTTP method only once.

Added regression coverage for overlapping routes with both single and multiple allowed methods.

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
index 3e3b18f..177d2c2 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -428,6 +428,50 @@ func TestMethodNotAllowed(t *testing.T) {
 	})
 }
 
+func TestMethodNotAllowedOverlappingRoutes(t *testing.T) {
+	for _, methods := range [][]string{{"POST"}, {"POST", "PUT"}} {
+		t.Run(fmt.Sprint(methods), func(t *testing.T) {
+			r := NewRouter()
+			for _, pattern := range []string{
+				"/article/1-2-3",
+				"/article/{a}",
+				"/article/{b}-{c}",
+				"/article/{b}-{c}-{d}",
+			} {
+				for _, method := range methods {
+					r.MethodFunc(method, pattern, func(w http.ResponseWriter, r *http.Request) {
+						w.WriteHeader(http.StatusOK)
+					})
+				}
+			}
+
+			// Repeat requests to verify that each response gets its own Allow header.
+			for i := 0; i < 2; i++ {
+				resp := httptest.NewRecorder()
+				r.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/article/1-2-3", nil))
+				if resp.Code != http.StatusMethodNotAllowed {
+					t.Fatalf("status = %d, want %d", resp.Code, http.StatusMethodNotAllowed)
+				}
+				allowed := resp.Header().Values("Allow")
+				if len(allowed) != len(methods) {
+					t.Fatalf("Allow = %v, want each of %v once", allowed, methods)
+				}
+				for _, method := range methods {
+					count := 0
+					for _, value := range allowed {
+						if value == method {
+							count++
+						}
+					}
+					if count != 1 {
+						t.Fatalf("Allow = %v, want %s once", allowed, method)
+					}
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

405 `Allow` needs method deduplication. Checking route matching and existing tests.


Done.
405 `Allow` methods deduplicated. Regression tests cover overlapping routes and repeated requests. `go test ./...` passed.

</details>

### codex, sloth: pass

Files: [mux.go](../sloth/codex/go-chi-allow-duplicates-1/files/mux.go)

<details><summary>diff</summary>

```diff
diff --git a/mux.go b/mux.go
index 37cd500..25b37e3 100644
--- a/mux.go
+++ b/mux.go
@@ -523,7 +523,12 @@ func (mx *Mux) updateRouteHandler() {
 // methods for the route.
 func methodNotAllowedHandler(methodsAllowed ...methodTyp) func(w http.ResponseWriter, r *http.Request) {
 	return func(w http.ResponseWriter, r *http.Request) {
+		seen := methodTyp(0)
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

I’ll trace how the router builds the `Allow` header, fix the duplicate handling, and run the existing tests.

Both route lookup paths collect matching methods, and the shared 405 responder writes them all to the header. I’ll deduplicate in that responder using the existing method bit flags. This needs only a change in `mux.go`; callers, exports, fixtures, and configuration stay unchanged. Distinct methods will keep their current order, including custom methods.

Fixed in [mux.go](mux.go:526): the shared 405 responder now emits each allowed method once, including when wildcard routes overlap.

Validation passed: `go build ./...`, `go test -race ./...`, and `git diff --check`.

</details>

### codex, all: pass

Files: [mux.go](../all/codex/go-chi-allow-duplicates-1/files/mux.go)

<details><summary>diff</summary>

```diff
diff --git a/mux.go b/mux.go
index 37cd500..bbd6831 100644
--- a/mux.go
+++ b/mux.go
@@ -523,7 +523,12 @@ func (mx *Mux) updateRouteHandler() {
 // methods for the route.
 func methodNotAllowedHandler(methodsAllowed ...methodTyp) func(w http.ResponseWriter, r *http.Request) {
 	return func(w http.ResponseWriter, r *http.Request) {
+		var allowed methodTyp
 		for _, m := range methodsAllowed {
+			if allowed&m != 0 {
+				continue
+			}
+			allowed |= m
 			w.Header().Add("Allow", reverseMethodMap[m])
 		}
 		w.WriteHeader(405)
```

</details>

<details><summary>reply</summary>

Done.
`mux.go` deduplicates 405 `Allow` methods, preserving order. Build and existing tests pass.

</details>
