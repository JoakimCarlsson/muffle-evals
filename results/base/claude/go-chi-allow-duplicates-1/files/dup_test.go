package chi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMethodNotAllowedNoDuplicateAllow(t *testing.T) {
	r := NewRouter()
	h := func(w http.ResponseWriter, r *http.Request) {}
	r.Post("/article/1-2-3", h)
	r.Post("/article/{a}", h)
	r.Post("/article/{b}-{c}", h)
	r.Post("/article/{b}-{c}-{d}", h)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/article/1-2-3", nil))
	if w.Code != 405 {
		t.Fatalf("code %d", w.Code)
	}
	if got := w.Header().Values("Allow"); len(got) != 1 || got[0] != "POST" {
		t.Fatalf("Allow = %v", got)
	}
}
