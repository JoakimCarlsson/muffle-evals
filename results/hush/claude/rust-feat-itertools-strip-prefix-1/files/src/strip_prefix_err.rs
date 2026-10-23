#[cfg(doc)]
use crate::Itertools;
use std::fmt::{Debug, Display, Formatter, Result as FmtResult};

/// Value returned for the error case of [`Itertools::strip_prefix`] and
/// [`Itertools::strip_prefix_by`].
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StripPrefixError<I, P, PrefixItem>
where
    I: Iterator,
{
    /// The original iterator, stopped right after the item that didn't match.
    pub iterator: I,
    /// The rest of the prefix iterator, after the prefix item that didn't match.
    pub prefix: P,
    /// The iterator's item (`None` if it ran out first) and the prefix item
    /// it was compared with.
    pub mismatch: (Option<I::Item>, PrefixItem),
}

impl<I, P, PrefixItem> Display for StripPrefixError<I, P, PrefixItem>
where
    I: Iterator,
{
    fn fmt(&self, f: &mut Formatter) -> FmtResult {
        match self.mismatch.0 {
            None => write!(f, "iterator ended before the prefix was fully matched"),
            Some(_) => write!(f, "iterator item did not match the prefix item"),
        }
    }
}

#[cfg(feature = "use_std")]
impl<I, P, PrefixItem> std::error::Error for StripPrefixError<I, P, PrefixItem>
where
    I: Iterator + Debug,
    I::Item: Debug,
    P: Debug,
    PrefixItem: Debug,
{
}
