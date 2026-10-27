//! Traits for runtime-selectable key ordering.

use core::cmp::Ordering;

use crate::equivalent::{Comparable, Equivalent};

/// Key equivalence under a comparator.
///
/// Like [`Equivalent`], but the logic lives in a value rather than in the key type, so it can be
/// chosen at runtime.
pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
    /// Returns `true` if `lhs` and `rhs` are equal.
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
}

/// Key ordering under a comparator.
///
/// Like [`Comparable`], but the logic lives in a value rather than in the key type, so it can be
/// chosen at runtime.
pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
    /// Returns the ordering of `lhs` relative to `rhs`.
    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
}

/// The comparator that orders keys with their own `Ord` implementation.
#[derive(Clone, Copy, Debug, Default)]
pub struct BasicComparator;

impl<L: ?Sized, R: ?Sized> Equivalator<L, R> for BasicComparator
where
    L: Equivalent<R>,
{
    #[inline]
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
        Equivalent::equivalent(lhs, rhs)
    }
}

impl<L: ?Sized, R: ?Sized> Comparator<L, R> for BasicComparator
where
    L: Comparable<R>,
{
    #[inline]
    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
        Comparable::compare(lhs, rhs)
    }
}
