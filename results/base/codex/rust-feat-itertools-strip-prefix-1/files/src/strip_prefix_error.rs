/// A failed prefix match from [`Itertools::strip_prefix`](crate::Itertools::strip_prefix)
/// or [`Itertools::strip_prefix_by`](crate::Itertools::strip_prefix_by).
///
/// Successfully matched items have been consumed and discarded. The mismatched
/// items are retained in `mismatch`, and both iterators can be used to continue
/// after the failed comparison. No allocation or cloning is required.
#[derive(Debug)]
pub struct StripPrefixError<I: Iterator, P: Iterator> {
    /// The original iterator, positioned after the mismatched item (or the
    /// first `None` if it ran out before the prefix).
    pub iterator: I,
    /// The prefix iterator, positioned after the mismatched prefix item.
    pub prefix: P,
    /// The mismatched iterator item and prefix item. The first element is
    /// `None` if the original iterator ran out first.
    pub mismatch: (Option<I::Item>, P::Item),
}
