//! Runtime key equivalence and ordering.

use crate::equivalent::{Comparable, Equivalent};
use core::cmp::Ordering;

/// Tests whether a stored key and a query represent the same key.
///
/// Equivalence must agree with [`Comparator::compare`] returning [`Ordering::Equal`].
pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
    /// Returns whether the keys are equivalent.
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
}

/// Defines a consistent total ordering of keys.
///
/// The ordering must remain stable while keys are stored in a collection.
/// Comparisons with query keys must agree with comparisons between stored keys.
pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
    /// Compares a stored key with another key or query.
    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
}

/// The default ordering, using [`Equivalent`] and [`Comparable`].
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
