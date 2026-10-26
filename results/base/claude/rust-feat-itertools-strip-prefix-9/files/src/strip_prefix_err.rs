#[cfg(doc)]
use crate::Itertools;
use std::fmt::{self, Debug, Display, Formatter};

/// Value returned for the error case of [`Itertools::strip_prefix`]
/// and [`Itertools::strip_prefix_by`].
pub struct StripPrefixError<I, P>
where
    I: Iterator,
    P: Iterator,
{
    /// The original iterator, stopped right after the item that didn't match.
    pub iterator: I,
    /// The rest of the prefix iterator, after the prefix item that didn't match.
    pub prefix: P,
    /// The iterator's item (`None` if it ran out first)
    /// and the prefix item it was compared with.
    pub mismatch: (Option<I::Item>, P::Item),
}

impl<I, P> Clone for StripPrefixError<I, P>
where
    I: Iterator + Clone,
    P: Iterator + Clone,
    I::Item: Clone,
    P::Item: Clone,
{
    fn clone(&self) -> Self {
        Self {
            iterator: self.iterator.clone(),
            prefix: self.prefix.clone(),
            mismatch: self.mismatch.clone(),
        }
    }
}

impl<I, P> Debug for StripPrefixError<I, P>
where
    I: Iterator + Debug,
    P: Iterator + Debug,
    I::Item: Debug,
    P::Item: Debug,
{
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        f.debug_struct("StripPrefixError")
            .field("iterator", &self.iterator)
            .field("prefix", &self.prefix)
            .field("mismatch", &self.mismatch)
            .finish()
    }
}

impl<I, P> Display for StripPrefixError<I, P>
where
    I: Iterator,
    P: Iterator,
{
    fn fmt(&self, f: &mut Formatter<'_>) -> fmt::Result {
        match self.mismatch.0 {
            None => write!(f, "iterator ended before the prefix was matched"),
            Some(_) => write!(f, "iterator does not start with the prefix"),
        }
    }
}

#[cfg(feature = "use_std")]
impl<I, P> std::error::Error for StripPrefixError<I, P>
where
    I: Iterator + Debug,
    P: Iterator + Debug,
    I::Item: Debug,
    P::Item: Debug,
{
}
