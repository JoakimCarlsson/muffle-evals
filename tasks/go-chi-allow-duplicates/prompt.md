Duplicate HTTP methods in the 405 `Allow` header.

When routes are registered that overlap because of their wildcards, their methods are repeated in the `Allow` header of 405 responses:

```go
r := chi.NewRouter()

r.Post("/article/1-2-3", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
r.Post("/article/{a}", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
r.Post("/article/{b}-{c}", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
r.Post("/article/{b}-{c}-{d}", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })

server := httptest.NewServer(r)
defer server.Close()

// Send a request with an unsupported method
res, _ := http.Get(server.URL + "/article/1-2-3")
fmt.Println("Status:", res.Status)
fmt.Println("Header:", res.Header)
```

Output:

```
Status: 405 Method Not Allowed
Header: map[Allow:[POST POST POST POST] Content-Length:[0] Date:[...]]
```

`POST` appears four times in the `Allow` header. Each method should only appear once.

Please fix this.
