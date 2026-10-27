//! Runtime-selectable key ordering for skip lists.

use core::cmp::Ordering;

use crate::equivalent::{Comparable, Equivalent};

/// Decides whether two keys are equal.
pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
    /// Returns `true` if `lhs` and `rhs` are equal.
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
}

/// Decides how two keys are ordered.
///
/// `equivalent` must agree with `compare` returning `Ordering::Equal`, and the ordering must be
/// total and consistent for the lifetime of the collection using it.
pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
    /// Returns the ordering of `lhs` relative to `rhs`.
    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
}

/// Orders keys through the [`Equivalent`] and [`Comparable`] traits, i.e. by their `Ord`.
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
