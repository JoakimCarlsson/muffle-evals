use std::{cmp::Ordering, ops::Bound};

use crossbeam_epoch as epoch;
use crossbeam_skiplist::{
    SkipMap, SkipSet,
    base::SkipList,
    comparator::{BasicComparator, Comparator, Equivalator},
};

/// Compares strings ignoring ASCII case, unless `sensitive` is set.
#[derive(Clone, Copy)]
struct Case {
    sensitive: bool,
}

impl Equivalator<String, str> for Case {
    fn equivalent(&self, lhs: &String, rhs: &str) -> bool {
        self.compare(lhs, rhs).is_eq()
    }
}

impl Comparator<String, str> for Case {
    fn compare(&self, lhs: &String, rhs: &str) -> Ordering {
        if self.sensitive {
            lhs.as_str().cmp(rhs)
        } else {
            let l = lhs.bytes().map(|b| b.to_ascii_lowercase());
            l.cmp(rhs.bytes().map(|b| b.to_ascii_lowercase()))
        }
    }
}

impl Equivalator<String> for Case {
    fn equivalent(&self, lhs: &String, rhs: &String) -> bool {
        self.compare(lhs, rhs.as_str()).is_eq()
    }
}

impl Comparator<String> for Case {
    fn compare(&self, lhs: &String, rhs: &String) -> Ordering {
        self.compare(lhs, rhs.as_str())
    }
}

struct Reverse;

impl Equivalator<i32> for Reverse {
    fn equivalent(&self, lhs: &i32, rhs: &i32) -> bool {
        lhs == rhs
    }
}

impl Comparator<i32> for Reverse {
    fn compare(&self, lhs: &i32, rhs: &i32) -> Ordering {
        rhs.cmp(lhs)
    }
}

#[test]
fn basic_comparator() {
    assert_eq!(BasicComparator.compare(&1, &2), Ordering::Less);
    assert!(BasicComparator.equivalent("a", "a"));
    assert_eq!(
        BasicComparator.compare(&"b".to_string(), "a"),
        Ordering::Greater
    );
}

#[test]
fn map_ignores_case() {
    let map = SkipMap::with_comparator(Case { sensitive: false });
    map.insert("abc".to_string(), 1);
    map.insert("ABC".to_string(), 2);
    map.insert("b".to_string(), 3);
    assert_eq!(map.len(), 2);
    assert_eq!(*map.get("aBc").unwrap().value(), 2);
    assert!(map.contains_key("B"));
    assert_eq!(map.remove("ABC").unwrap().value(), &2);
    assert!(!map.contains_key("abc"));
    assert_eq!(map.len(), 1);
}

#[test]
fn map_case_sensitive() {
    let map = SkipMap::with_comparator(Case { sensitive: true });
    map.insert("abc".to_string(), 1);
    map.insert("ABC".to_string(), 2);
    assert_eq!(map.len(), 2);
    assert!(map.get("aBc").is_none());
    // Uppercase sorts first.
    assert_eq!(map.front().unwrap().key(), "ABC");
}

#[test]
fn map_range_and_iter() {
    let map = SkipMap::with_comparator(Reverse);
    for i in 0..10 {
        map.insert(i, i * 10);
    }
    let keys: Vec<i32> = map.iter().map(|e| *e.key()).collect();
    assert_eq!(keys, (0..10).rev().collect::<Vec<_>>());
    let keys: Vec<i32> = map.range(&6..=&3).map(|e| *e.key()).collect();
    assert_eq!(keys, [6, 5, 4, 3]);
    let keys: Vec<i32> = map.range(&6..=&3).rev().map(|e| *e.key()).collect();
    assert_eq!(keys, [3, 4, 5, 6]);
    assert_eq!(*map.lower_bound(Bound::Excluded(&5)).unwrap().key(), 4);
    assert_eq!(*map.upper_bound(Bound::Excluded(&5)).unwrap().key(), 6);
    assert_eq!(*map.pop_front().unwrap().key(), 9);
    assert_eq!(*map.pop_back().unwrap().key(), 0);
}

#[test]
fn set_with_comparator() {
    let set = SkipSet::with_comparator(Reverse);
    set.insert(1);
    set.insert(3);
    set.insert(2);
    assert!(set.contains(&2));
    assert_eq!(set.iter().map(|e| *e).collect::<Vec<_>>(), [3, 2, 1]);
    assert_eq!(*set.back().unwrap(), 1);
}

#[test]
fn base_with_comparator() {
    let list = SkipList::with_comparator(epoch::default_collector().clone(), Reverse);
    let guard = &epoch::pin();
    list.insert(1, (), guard).release(guard);
    list.insert(2, (), guard).release(guard);
    assert_eq!(*list.front(guard).unwrap().key(), 2);
    assert_eq!(*list.back(guard).unwrap().key(), 1);
}

#[test]
fn default_still_works() {
    let map: SkipMap<i32, i32> = SkipMap::new();
    map.insert(2, 2);
    map.insert(1, 1);
    assert_eq!(*map.front().unwrap().key(), 1);
}
