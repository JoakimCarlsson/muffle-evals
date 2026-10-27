//! Runtime key comparison for ordered collections.
//!
//! Comparison closures, including boxed closures, implement these traits.

use crate::equivalent::{Comparable, Equivalent};
use core::cmp::Ordering;

/// Tests whether two keys represent the same entry.
/// Equivalence must agree with the comparator's ordering.
pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
    /// Returns whether the keys are equivalent.
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
}

/// Orders keys consistently throughout a collection's lifetime.
/// Implementations must define a total order, including for borrowed queries.
pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
    /// Returns the ordering of the keys.
    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
}

/// The usual ordering provided by `Equivalent` and `Comparable`.
#[derive(Clone, Copy, Debug, Default)]
pub struct BasicComparator;

impl<L: ?Sized, R: ?Sized> Equivalator<L, R> for BasicComparator
where
    L: Equivalent<R>,
{
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
        lhs.equivalent(rhs)
    }
}

impl<L: ?Sized, R: ?Sized> Comparator<L, R> for BasicComparator
where
    L: Comparable<R>,
{
    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
        lhs.compare(rhs)
    }
}

impl<L: ?Sized, R: ?Sized, F> Equivalator<L, R> for F
where
    F: Fn(&L, &R) -> Ordering,
{
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
        self(lhs, rhs).is_eq()
    }
}

impl<L: ?Sized, R: ?Sized, F> Comparator<L, R> for F
where
    F: Fn(&L, &R) -> Ordering,
{
    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
        self(lhs, rhs)
    }
}
