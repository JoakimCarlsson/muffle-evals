/// The first mismatch returned by [`Itertools::strip_prefix`](crate::Itertools::strip_prefix)
/// or [`Itertools::strip_prefix_by`](crate::Itertools::strip_prefix_by).
#[derive(Debug)]
pub struct StripPrefixError<I: Iterator, P: Iterator> {
    /// The original iterator, advanced past the mismatching item, if any.
    pub iterator: I,
    /// The prefix iterator, advanced past the mismatching prefix item.
    pub prefix: P,
    /// The mismatching items, with `None` if the original iterator ran out first.
    pub mismatch: (Option<I::Item>, P::Item),
}
