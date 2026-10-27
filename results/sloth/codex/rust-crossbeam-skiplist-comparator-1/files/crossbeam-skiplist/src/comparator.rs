//! Runtime key comparison for skip lists.

use crate::equivalent::{Comparable, Equivalent};
use core::cmp::Ordering;

/// Tests whether stored and query keys are equivalent.
/// Equivalence must agree with equality under the comparator's ordering.
pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
    /// Returns whether the keys are equivalent.
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
}

/// Orders stored and query keys consistently with the stored-key ordering.
/// The ordering must be a total order and remain stable while keys are stored.
pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
    /// Returns the ordering of the keys.
    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
}

/// Uses the key type's existing equivalence and ordering.
#[derive(Clone, Copy, Debug, Default)]
pub struct BasicComparator;

impl<L: ?Sized + Equivalent<R>, R: ?Sized> Equivalator<L, R> for BasicComparator {
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
        lhs.equivalent(rhs)
    }
}

impl<L: ?Sized + Comparable<R>, R: ?Sized> Comparator<L, R> for BasicComparator {
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
