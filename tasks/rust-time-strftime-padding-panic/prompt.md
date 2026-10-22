`time::format_description::parse_strftime_borrowed` panics with an index-out-of-bounds error when the format string ends with a padding modifier right after `%`, such as `"%_"`, `"%-"` or `"%0"`.

Reproduction (`cargo run --example poc_strftime_oob_panic -p time --features formatting`):

```rust
fn main() {
    let inputs = ["%_", "%-", "%0"];

    for input in &inputs {
        println!("Trying to parse strftime format: {:?}", input);
        time::format_description::parse_strftime_borrowed(input);
    }
}
```

Output:

```
Trying to parse strftime format: "%_"
thread 'main' panicked at time/src/format_description/parse/strftime.rs:79:51:
index out of bounds: the len is 2 but the index is 2
```

and the same for `"%-"` and `"%0"`. I expected an error to be returned for these malformed format strings instead of a panic, the same kind of
error an unknown component such as `"%Q"` gives: a valid escape sequence was expected, at the position where the
component is missing.

Please fix this.
