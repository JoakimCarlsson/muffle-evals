//! Runtime key comparison for skip lists.
//!
//! Pass a comparator to `SkipMap::with_comparator`, `SkipSet::with_comparator`,
//! or `SkipList::with_comparator` to choose an ordering for that collection.
//! Functions and closures (including boxed comparison closures) returning
//! [`Ordering`] implement both traits, with equivalence defined by `Ordering::Equal`.
//! Implement the traits directly to support both stored keys and borrowed queries.
use crate::equivalent::{Comparable, Equivalent};
use core::cmp::Ordering;

/// Tests whether a stored key and a query represent the same key.
pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
    /// Returns whether the keys are equivalent.
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
}

/// Defines the ordering of stored keys and queries.
///
/// Comparisons must define a consistent total order, and equivalence must agree
/// with `Ordering::Equal`. Heterogeneous comparisons must agree with the stored
/// key ordering. The ordering must remain stable while keys are in the collection.
pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
    /// Compares a stored key with another key or query.
    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
}

/// The default comparator, using [`Equivalent`] and [`Comparable`].
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
        self(lhs, rhs) == Ordering::Equal
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
