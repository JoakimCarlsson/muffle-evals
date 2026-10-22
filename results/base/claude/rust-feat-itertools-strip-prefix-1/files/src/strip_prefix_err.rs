#[cfg(doc)]
use crate::Itertools;
#[cfg(feature = "use_std")]
use std::error::Error;
use std::fmt::{Debug, Display, Formatter, Result as FmtResult};

/// Value returned for the error case of [`Itertools::strip_prefix`] and
/// [`Itertools::strip_prefix_by`].
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StripPrefixError<I, P, T>
where
    I: Iterator,
{
    /// The original iterator, stopped right after the item that did not match.
    pub iterator: I,
    /// The rest of the prefix iterator, after the prefix item that did not match.
    pub prefix: P,
    /// The iterator's item (`None` if it ran out first) and the prefix item it was compared with.
    pub mismatch: (Option<I::Item>, T),
}

impl<I, P, T> Display for StripPrefixError<I, P, T>
where
    I: Iterator,
{
    fn fmt(&self, f: &mut Formatter) -> FmtResult {
        match self.mismatch.0 {
            None => write!(f, "iterator ended before the whole prefix was matched"),
            Some(_) => write!(f, "iterator does not start with the prefix"),
        }
    }
}

#[cfg(feature = "use_std")]
impl<I, P, T> Error for StripPrefixError<I, P, T>
where
    I: Iterator + Debug,
    I::Item: Debug,
    P: Debug,
    T: Debug,
{
}
