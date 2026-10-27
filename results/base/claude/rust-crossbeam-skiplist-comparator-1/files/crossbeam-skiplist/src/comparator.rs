//! Runtime-selectable key orderings for skip lists.
//!
//! By default a skip list orders its keys with their [`Ord`] implementation, through
//! [`BasicComparator`]. Supplying a different [`Comparator`] (for instance one that ignores
//! case, or one that wraps a boxed closure) lets the ordering be chosen at runtime.
//!
//! A comparator must define a total order that is consistent with its [`Equivalator`]
//! implementation: `equivalent(a, b)` must hold exactly when `compare(a, b)` is
//! [`Ordering::Equal`]. When the stored key type and the query type differ, comparisons in both
//! directions must agree with the ordering on stored keys.

use core::cmp::Ordering;

use crate::equivalent::{Comparable, Equivalent};

/// Decides whether two values are equivalent.
pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
    /// Returns `true` if `lhs` and `rhs` are equivalent.
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
}

/// Defines a total order between two values.
pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
    /// Compares `lhs` with `rhs`.
    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
}

/// The comparator that orders keys by their [`Ord`] implementation.
///
/// This is the default comparator of skip lists. It is implemented through the crate's
/// [`Equivalent`] and [`Comparable`] traits.
#[derive(Clone, Copy, Debug, Default)]
pub struct BasicComparator;

impl<L: ?Sized, R: ?Sized> Equivalator<L, R> for BasicComparator
where
    L: Equivalent<R>,
{
    #[inline]
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
        lhs.equivalent(rhs)
    }
}

impl<L: ?Sized, R: ?Sized> Comparator<L, R> for BasicComparator
where
    L: Comparable<R>,
{
    #[inline]
    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
        lhs.compare(rhs)
    }
}
