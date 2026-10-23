/// A failed [`strip_prefix`](crate::Itertools::strip_prefix) or
/// [`strip_prefix_by`](crate::Itertools::strip_prefix_by) operation.
///
/// Matching items have been consumed. The first mismatching pair is retained
/// in `mismatch`, and both iterators are positioned immediately after that pair.
#[derive(Debug)]
pub struct StripPrefixError<I: Iterator, P: Iterator> {
    /// The original iterator, positioned after the mismatching item or exhaustion.
    pub iterator: I,
    /// The prefix iterator, positioned after the mismatching prefix item.
    pub prefix: P,
    /// The mismatching pair, with `None` if the original iterator ended first.
    pub mismatch: (Option<I::Item>, P::Item),
}
