//! Runtime-selectable key ordering for skip lists.
//!
//! A [`Comparator`] decides how the keys of a [`SkipMap`](crate::SkipMap),
//! [`SkipSet`](crate::SkipSet) or [`SkipList`](crate::base::SkipList) are ordered. The default,
//! [`BasicComparator`], uses the ordering of the key type, exactly like [`BTreeMap`] does.
//!
//! [`BTreeMap`]: https://doc.rust-lang.org/std/collections/struct.BTreeMap.html

use core::cmp::Ordering;

use crate::equivalent::{Comparable, Equivalent};

/// Decides whether two keys are equal.
///
/// `L` is the type of the key stored in the collection and `R` is the type of the key used for
/// lookups; they may differ, e.g. `String` and `str`.
pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
    /// Returns `true` if `lhs` and `rhs` are equal.
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
}

/// Decides the ordering of two keys.
///
/// # Contract
///
/// The ordering must be a total order that is consistent over time, and consistent with
/// [`Equivalator::equivalent`]: `equivalent` must return `true` exactly when `compare` returns
/// [`Ordering::Equal`]. When `L` and `R` differ, comparing a stored key with a lookup key must
/// agree with the ordering of the stored keys among themselves.
pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
    /// Returns the ordering of `lhs` relative to `rhs`.
    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
}

/// A comparator that uses the [`Comparable`] and [`Equivalent`] implementations of the stored
/// key, i.e. the regular `Ord` ordering.
///
/// This is the default comparator of all skip list types.
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
