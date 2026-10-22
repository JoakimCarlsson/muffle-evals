/// Error returned by [`Itertools::strip_prefix`](crate::Itertools::strip_prefix)
/// and [`Itertools::strip_prefix_by`](crate::Itertools::strip_prefix_by).
///
/// Matching items before the mismatch have been consumed from both iterators.
#[derive(Debug, Clone)]
pub struct StripPrefixError<I: Iterator, P: Iterator> {
    /// The input iterator, positioned after the mismatching item, if any.
    pub iterator: I,
    /// The prefix iterator, positioned after the mismatching prefix item.
    pub prefix: P,
    /// The mismatching input and prefix items. The input item is `None` if
    /// the input iterator returned `None` before the prefix was consumed.
    pub mismatch: (Option<I::Item>, P::Item),
}
