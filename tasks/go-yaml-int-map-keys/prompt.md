Integer keys get converted to `*` when decoding into a `map[string]any`.

```go
package main

import (
	"fmt"
	"log"

	"github.com/goccy/go-yaml"
)

const data = `
42: 100
`

func main() {
	var d map[string]any
	if err := yaml.Unmarshal([]byte(data), &d); err != nil {
		log.Fatalf("error: %v", err)
	}
	fmt.Printf("%v\n", d)
}
```

This prints `map[*:100]`. I expected `map[42:100]`, i.e. the key should be the string `"42"`.

Please fix this.
