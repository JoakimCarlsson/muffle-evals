`Decimal.NumDigits` returns an invalid value for some numbers.

```go
for _, s := range []string{
	"100000000000000E20",
	"1000000000000000E20",
	"10000000000000000E20",
} {
	d, err := decimal.NewFromString(s)
	if err != nil {
		log.Fatal(err)
	}
	c := d.Coefficient().Text(10)
	fmt.Printf("%s: %s %d %d\n", s, d, len(c), d.NumDigits())
}
```

Output:

```
100000000000000E20: 10000000000000000000000000000000000 15 15
1000000000000000E20: 100000000000000000000000000000000000 16 15
10000000000000000E20: 1000000000000000000000000000000000000 17 17
```

For the second number, `len(d.Coefficient().Text(10))` is 16 but `d.NumDigits()` says 15. The documentation doesn't say the result is an estimate, so I'd expect it to return the exact number of digits of the coefficient.

Please fix this.
