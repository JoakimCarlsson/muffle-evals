#[cfg(doc)]
use crate::Itertools;
#[cfg(feature = "use_std")]
use std::error::Error;
use std::fmt::{Debug, Display, Formatter, Result as FmtResult};

/// Value returned for the error case of [`Itertools::strip_prefix`]
/// and [`Itertools::strip_prefix_by`].
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub struct StripPrefixError<I: Iterator, P: Iterator> {
    /// The original iterator, stopped right after the item that did not match.
    pub iterator: I,
    /// The rest of the prefix iterator, after the prefix item that did not match.
    pub prefix: P,
    /// The iterator's item (`None` if it ran out first) and the prefix item
    /// it was compared with.
    pub mismatch: (Option<I::Item>, P::Item),
}

impl<I: Iterator, P: Iterator> Display for StripPrefixError<I, P> {
    fn fmt(&self, f: &mut Formatter) -> FmtResult {
        match self.mismatch.0 {
            None => write!(f, "iterator ended before the prefix was fully matched"),
            Some(_) => write!(f, "iterator item did not match the prefix item"),
        }
    }
}

#[cfg(feature = "use_std")]
impl<I: Iterator + Debug, P: Iterator + Debug> Error for StripPrefixError<I, P>
where
    I::Item: Debug,
    P::Item: Debug,
{
}
