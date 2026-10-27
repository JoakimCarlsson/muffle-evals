//! Runtime key comparison for skip lists.
//!
//! Closures and boxed comparison closures implement both traits. For example:
//!
//! ```
//! use crossbeam_skiplist::SkipMap;
//! use core::cmp::Ordering;
//!
//! let reverse = true;
//! let compare: Box<dyn Fn(&i32, &i32) -> Ordering> = Box::new(move |a, b| {
//!     if reverse { b.cmp(a) } else { a.cmp(b) }
//! });
//! let map = SkipMap::with_comparator(compare);
//! map.insert(1, "one");
//! map.insert(2, "two");
//! assert_eq!(*map.front().unwrap().key(), 2);
//! ```
use crate::equivalent::{Comparable, Equivalent};
use core::cmp::Ordering;

/// Tests whether a stored key and a query represent the same key.
/// Equivalence must agree with equality in [`Comparator::compare`].
pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
    /// Returns whether the keys are equivalent.
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
}

/// Defines a consistent total ordering of keys.
///
/// The ordering must remain stable while keys are in a collection, and comparisons
/// with query types must agree with comparisons between stored keys.
pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
    /// Compares a stored key with another key or query.
    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
}

/// The default ordering, using [`Equivalent`] and [`Comparable`].
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
    F: Fn(&L, &R) -> Ordering + ?Sized,
{
    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
        self(lhs, rhs) == Ordering::Equal
    }
}

impl<L: ?Sized, R: ?Sized, F> Comparator<L, R> for F
where
    F: Fn(&L, &R) -> Ordering + ?Sized,
{
    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
        self(lhs, rhs)
    }
}
