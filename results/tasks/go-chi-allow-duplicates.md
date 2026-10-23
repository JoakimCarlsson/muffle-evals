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
| claude | muffle | pass | +12/-2 | 21 | 1,230 | $0.083 |
| claude | hush | pass | +5/-0 | 0 | 579 | $0.066 |
| claude | sloth | pass | +5/-0 | 20 | 1,570 | $0.101 |
| claude | all | pass | +5/-0 | 19 | 1,352 | $0.087 |
| codex | base | pass | +5/-0 | 41 | 1,235 | - |
| codex | muffle | pass | +5/-0 | 44 | 1,488 | - |
| codex | hush | pass | +5/-0 | 29 | 1,090 | - |
| codex | sloth | pass | +5/-0 | 32 | 1,451 | - |
| codex | all | pass | +5/-0 | 26 | 1,143 | - |

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
index 8222073..c7a4a1b 100644
--- a/context.go
+++ b/context.go
@@ -164,3 +164,13 @@ type contextKey struct {
 func (k *contextKey) String() string {
 	return "chi context value " + k.name
 }
+
+// addAllowedMethod records m as allowed for a 405, skipping duplicates.
+func (x *Context) addAllowedMethod(m methodTyp) {
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
index 9f56549..eb4a419 100644
--- a/tree.go
+++ b/tree.go
@@ -479,7 +479,7 @@ func (n *node) findRoute(rctx *Context, method methodTyp, path string) *node {
 							if endpoints == mALL || endpoints == mSTUB {
 								continue
 							}
-							rctx.methodsAllowed = append(rctx.methodsAllowed, endpoints)
+							rctx.addAllowedMethod(endpoints)
 						}
 
 						// flag that the routing context found a route, but not a corresponding
@@ -525,7 +525,7 @@ func (n *node) findRoute(rctx *Context, method methodTyp, path string) *node {
 					if endpoints == mALL || endpoints == mSTUB {
 						continue
 					}
-					rctx.methodsAllowed = append(rctx.methodsAllowed, endpoints)
+					rctx.addAllowedMethod(endpoints)
 				}
 
 				// flag that the routing context found a route, but not a corresponding
```

</details>

<details><summary>reply</summary>

Simplest: dedupe at the append sites via a helper on the context.

Fixed: the 405 `Allow` header now lists each method once. Your example gives `Allow: [POST]`, and `go test ./...` passes.

The cause was in route matching (`tree.go`). It appends the allowed methods each time it reaches a leaf node that matches the path. With several overlapping wildcard routes, it reaches several such leaves, so the same method was added more than once. I added `Context.addAllowedMethod` in `context.go`, which skips methods already recorded. Both append sites in `tree.go` now call it.

I also added a regression test using your example, in a new file, `dup_test.go`. You may want to move it into an existing test file.

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

Dedupe in the handler.

Done. `methodNotAllowedHandler` in `mux.go` now skips methods it already added to `Allow`. Existing tests pass. I didn't add a test for your repro or run the repro itself.

</details>

### claude, sloth: pass

Files: [mux.go](../sloth/claude/go-chi-allow-duplicates-1/files/mux.go), [mux_test.go](../sloth/claude/go-chi-allow-duplicates-1/files/mux_test.go)

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
index 3e3b18f..97230f8 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -428,6 +428,26 @@ func TestMethodNotAllowed(t *testing.T) {
 	})
 }
 
+func TestMethodNotAllowedNoDuplicateAllow(t *testing.T) {
+	r := NewRouter()
+	ok := func(w http.ResponseWriter, r *http.Request) {}
+	r.Post("/article/1-2-3", ok)
+	r.Post("/article/{a}", ok)
+	r.Post("/article/{b}-{c}", ok)
+	r.Post("/article/{b}-{c}-{d}", ok)
+
+	ts := httptest.NewServer(r)
+	defer ts.Close()
+
+	resp, _ := testRequest(t, ts, "GET", "/article/1-2-3", nil)
+	if resp.StatusCode != 405 {
+		t.Fatal(resp.Status)
+	}
+	if allowed := resp.Header.Values("Allow"); len(allowed) != 1 || allowed[0] != "POST" {
+		t.Fatal("Allow header should be [POST]. Received: ", allowed)
+	}
+}
+
 func TestMuxNestedMethodNotAllowed(t *testing.T) {
 	r := NewRouter()
 	r.Get("/root", func(w http.ResponseWriter, r *http.Request) {
```

</details>

<details><summary>reply</summary>

Add a test after TestMethodNotAllowed.

The 405 `Allow` header now lists each method once. Your example returns `Allow: [POST]`, and `go test .` passes.

The router collects allowed methods from every overlapping wildcard route it visits, so the same method gets added several times. I removed the duplicates where the header is written, in `methodNotAllowedHandler` in `mux.go`. I left the collection in `tree.go` alone.

I added `TestMethodNotAllowedNoDuplicateAllow` in `mux_test.go`, which uses the four routes from your report. I ran only the root package tests, not the `middleware` package or the rest of the repo.

I didn't commit anything.

</details>

### claude, all: pass

Files: [mux.go](../all/claude/go-chi-allow-duplicates-1/files/mux.go), [mux_test.go](../all/claude/go-chi-allow-duplicates-1/files/mux_test.go)

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
index 3e3b18f..1ce4ade 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -1855,6 +1855,25 @@ func TestQueryHTTPMethod(t *testing.T) {
 	}
 }
 
+func TestMethodNotAllowedNoDuplicateAllow(t *testing.T) {
+	r := NewRouter()
+	h := func(w http.ResponseWriter, r *http.Request) {}
+	r.Post("/article/1-2-3", h)
+	r.Post("/article/{a}", h)
+	r.Post("/article/{b}-{c}", h)
+	r.Post("/article/{b}-{c}-{d}", h)
+	ts := httptest.NewServer(r)
+	defer ts.Close()
+
+	resp, _ := testRequest(t, ts, "GET", "/article/1-2-3", nil)
+	if resp.StatusCode != 405 {
+		t.Fatal(resp.Status)
+	}
+	if got := resp.Header.Values("Allow"); len(got) != 1 || got[0] != "POST" {
+		t.Fatal("Allow header should contain only POST. Received: ", got)
+	}
+}
+
 func TestMuxMatch(t *testing.T) {
 	r := NewRouter()
 	r.Get("/hi", func(w http.ResponseWriter, r *http.Request) {
```

</details>

<details><summary>reply</summary>

Dedupe at the handler, single point.

Done. `methodNotAllowedHandler` in `mux.go` now skips methods it already added, so `Allow` lists each method once. I added `TestMethodNotAllowedNoDuplicateAllow` for your example, and `go test .` passes. Nothing committed.

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
index 3e3b18f..fb9b684 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -428,6 +428,50 @@ func TestMethodNotAllowed(t *testing.T) {
 	})
 }
 
+func TestMethodNotAllowedOverlappingRoutes(t *testing.T) {
+	for _, methods := range [][]string{
+		{http.MethodPost},
+		{http.MethodPost, http.MethodPut},
+	} {
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
+				t.Fatalf("expected each allowed method once: %v, got %v", methods, allowed)
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

I’ll find where the `Allow` header is built, add a regression test for overlapping routes, and fix the duplicates.

The regression test reproduced the repeated methods. The handler now adds each method only once, and the router tests pass. The middleware tests are still running.

Fixed the 405 handler to include each method only once in the `Allow` header.

Added regression tests for overlapping routes with one and multiple allowed methods. Confirmed they failed before the fix.

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
index 3e3b18f..16310dd 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -428,6 +428,35 @@ func TestMethodNotAllowed(t *testing.T) {
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
+	}
+	r.Put("/article/{a}", handler)
+
+	for i := 0; i < 2; i++ {
+		resp := httptest.NewRecorder()
+		r.ServeHTTP(resp, httptest.NewRequest(http.MethodGet, "/article/1-2-3", nil))
+		if resp.Code != http.StatusMethodNotAllowed {
+			t.Fatalf("expected status 405, got %d", resp.Code)
+		}
+		allowed := resp.Header().Values("Allow")
+		if len(allowed) != 2 || !((allowed[0] == "POST" && allowed[1] == "PUT") ||
+			(allowed[0] == "PUT" && allowed[1] == "POST")) {
+			t.Fatalf("expected POST and PUT exactly once, got %v", allowed)
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
405 `Allow` header deduplicates methods. Added regression test for overlapping routes and repeated requests. `go test ./...` passed.

</details>

### codex, sloth: pass

Files: [mux.go](../sloth/codex/go-chi-allow-duplicates-1/files/mux.go), [mux_test.go](../sloth/codex/go-chi-allow-duplicates-1/files/mux_test.go)

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
index 3e3b18f..21b9eab 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -428,6 +428,38 @@ func TestMethodNotAllowed(t *testing.T) {
 	})
 }
 
+// TestMethodNotAllowedOverlappingRoutes checks that each allowed method appears once.
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
+	}
+	r.Put("/article/{a}", handler)
+
+	ts := httptest.NewServer(r)
+	defer ts.Close()
+
+	for _, path := range []string{"/article/1-2-3", "/article/other"} {
+		resp, _ := testRequest(t, ts, "GET", path, nil)
+		if resp.StatusCode != http.StatusMethodNotAllowed {
+			t.Fatal(resp.Status)
+		}
+		allowedMethods := resp.Header.Values("Allow")
+		if len(allowedMethods) != 2 || ((allowedMethods[0] != "POST" || allowedMethods[1] != "PUT") &&
+			(allowedMethods[1] != "POST" || allowedMethods[0] != "PUT")) {
+			t.Fatalf("%s: expected Allow headers POST, PUT; got %v", path, allowedMethods)
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

I’ll check where the router collects allowed methods, fix the duplicate handling, and add a regression test for overlapping routes.

Both route-matching paths collect methods, and the shared 405 handler writes them to `Allow`. I’ll deduplicate there, preserving the order of distinct methods. This needs changes only in `mux.go` and `mux_test.go`; no API or configuration changes are needed.

Fixed the shared 405 handler so each method appears only once in `Allow`, preserving the order of distinct methods.

Added regression coverage for overlapping wildcard routes and multiple allowed methods.

Validation passed: `go test ./...`, `go build ./...`, and `git diff --check`.

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
index 3e3b18f..0340405 100644
--- a/mux_test.go
+++ b/mux_test.go
@@ -428,6 +428,32 @@ func TestMethodNotAllowed(t *testing.T) {
 	})
 }
 
+// TestMethodNotAllowedOverlappingRoutes checks that matching routes advertise each method once.
+func TestMethodNotAllowedOverlappingRoutes(t *testing.T) {
+	r := NewRouter()
+	for _, pattern := range []string{"/article/1-2-3", "/article/{a}", "/article/{b}-{c}", "/article/{b}-{c}-{d}"} {
+		r.Post(pattern, func(w http.ResponseWriter, r *http.Request) {
+			w.WriteHeader(http.StatusOK)
+		})
+	}
+	r.Put("/article/{a}", func(w http.ResponseWriter, r *http.Request) {
+		w.WriteHeader(http.StatusOK)
+	})
+
+	ts := httptest.NewServer(r)
+	defer ts.Close()
+
+	resp, _ := testRequest(t, ts, "GET", "/article/1-2-3", nil)
+	if resp.StatusCode != http.StatusMethodNotAllowed {
+		t.Fatal(resp.Status)
+	}
+	allowedMethods := resp.Header.Values("Allow")
+	if len(allowedMethods) != 2 || ((allowedMethods[0] != "POST" || allowedMethods[1] != "PUT") &&
+		(allowedMethods[1] != "POST" || allowedMethods[0] != "PUT")) {
+		t.Fatal("Allow header should contain 2 headers: POST, PUT. Received: ", allowedMethods)
+	}
+}
+
 func TestMuxNestedMethodNotAllowed(t *testing.T) {
 	r := NewRouter()
 	r.Get("/root", func(w http.ResponseWriter, r *http.Request) {
```

</details>

<details><summary>reply</summary>

405 `Allow` duplicates need deduplication. Checking route matching and existing tests.


Done.
405 `Allow` methods deduplicated; overlapping-route regression test added. `go test ./...` and `go build ./...` passed.

</details>
