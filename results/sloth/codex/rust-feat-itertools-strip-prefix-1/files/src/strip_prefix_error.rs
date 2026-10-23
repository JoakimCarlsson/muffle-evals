/// The remaining iterators and mismatched items from
/// [`strip_prefix`](crate::Itertools::strip_prefix) or
/// [`strip_prefix_by`](crate::Itertools::strip_prefix_by).
#[derive(Debug)]
pub struct StripPrefixError<I: Iterator, P: Iterator> {
    /// The original iterator, advanced past the mismatched item, if any.
    pub iterator: I,
    /// The prefix iterator, advanced past the mismatched prefix item.
    pub prefix: P,
    /// The mismatched items; `None` means the original iterator ran out first.
    pub mismatch: (Option<I::Item>, P::Item),
}
