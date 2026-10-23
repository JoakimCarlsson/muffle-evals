#[cfg(doc)]
use crate::Itertools;

/// Value returned for the error case of [`Itertools::strip_prefix`] and
/// [`Itertools::strip_prefix_by`].
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StripPrefixError<I, P>
where
    I: Iterator,
    P: Iterator,
{
    /// The original iterator, stopped right after the item that didn't match.
    pub iterator: I,
    /// The rest of the prefix iterator, after the prefix item that didn't match.
    pub prefix: P,
    /// The iterator's item (`None` if it ran out) and the prefix item it was compared with.
    pub mismatch: (Option<I::Item>, P::Item),
}
