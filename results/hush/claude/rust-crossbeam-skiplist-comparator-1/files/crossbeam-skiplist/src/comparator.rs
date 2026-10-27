//! Traits for comparing keys with a runtime-chosen ordering.

use core::cmp::Ordering;

use crate::equivalent::{Comparable, Equivalent};

/// Key equivalence with a comparator value.
///
/// Unlike [`Equivalent`], the implementor is a separate value (the comparator) rather than the
/// key itself, so the equivalence can be chosen at runtime.
pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
    /// Returns `true` if `lhs` and `rhs` are equivalent.
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
}

/// Key ordering with a comparator value.
///
/// Unlike [`Comparable`], the implementor is a separate value (the comparator) rather than the
/// key itself, so the ordering can be chosen at runtime.
///
/// # Contract
///
/// The ordering must be a total order, consistent with [`Equivalator::equivalent`], and must not
/// change while the comparator is in use by a collection.
pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
    /// Returns the ordering of `lhs` relative to `rhs`.
    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
}

/// The default comparator. Orders keys through the [`Comparable`] and [`Equivalent`] traits,
/// which for most types means their [`Ord`] implementation.
#[derive(Clone, Copy, Debug, Default)]
pub struct BasicComparator;

impl<L, R> Equivalator<L, R> for BasicComparator
where
    L: ?Sized + Equivalent<R>,
    R: ?Sized,
{
    #[inline]
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
        Equivalent::equivalent(lhs, rhs)
    }
}

impl<L, R> Comparator<L, R> for BasicComparator
where
    L: ?Sized + Comparable<R>,
    R: ?Sized,
{
    #[inline]
    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
        Comparable::compare(lhs, rhs)
    }
}
