#[cfg(doc)]
use crate::Itertools;

/// Value returned for the error case of [`Itertools::strip_prefix`] and
/// [`Itertools::strip_prefix_by`].
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct StripPrefixError<I, P, PrefixItem>
where
    I: Iterator,
    P: Iterator<Item = PrefixItem>,
{
    /// The original iterator, stopped right after the item that did not match.
    pub iterator: I,
    /// The rest of the prefix, after the prefix item that did not match.
    pub prefix: P,
    /// The iterator's item (`None` if it ran out) and the prefix item it was compared with.
    pub mismatch: (Option<I::Item>, PrefixItem),
}
