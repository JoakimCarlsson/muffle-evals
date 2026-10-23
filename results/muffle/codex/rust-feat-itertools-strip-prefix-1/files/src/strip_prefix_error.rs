/// A failed prefix comparison from [`Itertools::strip_prefix`](crate::Itertools::strip_prefix)
/// or [`Itertools::strip_prefix_by`](crate::Itertools::strip_prefix_by).
#[derive(Debug)]
pub struct StripPrefixError<I: Iterator, P: Iterator> {
    /// The original iterator, positioned after the mismatching item (if any).
    pub iterator: I,
    /// The prefix iterator, positioned after the mismatching prefix item.
    pub prefix: P,
    /// The mismatching iterator and prefix items.
    ///
    /// The first element is `None` if the original iterator ran out first.
    pub mismatch: (Option<I::Item>, P::Item),
}
