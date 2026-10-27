use std::cmp::Ordering;
use std::ops::Bound::{Excluded, Included};

use crossbeam_skiplist::{
    SkipMap, SkipSet,
    base::SkipList,
    comparator::{BasicComparator, Comparator, Equivalator},
};

#[derive(Clone, Copy)]
struct CaseOrder(bool);

impl<R: AsRef<str> + ?Sized> Equivalator<String, R> for CaseOrder {
    fn equivalent(&self, lhs: &String, rhs: &R) -> bool {
        self.compare(lhs, rhs) == Ordering::Equal
    }
}

impl<R: AsRef<str> + ?Sized> Comparator<String, R> for CaseOrder {
    fn compare(&self, lhs: &String, rhs: &R) -> Ordering {
        if self.0 {
            lhs.to_lowercase().cmp(&rhs.as_ref().to_lowercase())
        } else {
            lhs.as_str().cmp(rhs.as_ref())
        }
    }
}

#[test]
fn heterogeneous_case_order() {
    for insensitive in [false, true] {
        let map = SkipMap::with_comparator(CaseOrder(insensitive));
        map.insert("abc".to_owned(), 1);
        assert_eq!(map.get("aBc").is_some(), insensitive);
        map.insert("ABC".to_owned(), 2);
        assert_eq!(map.len(), if insensitive { 1 } else { 2 });
        assert_eq!(*map.get("ABC").unwrap().value(), 2);
        assert_eq!(*map.get_or_insert("ABC".to_owned(), 3).value(), 2);
        map.insert("def".to_owned(), 4);
        map.insert("ghi".to_owned(), 5);
        let keys: Vec<_> = map
            .range::<str, _>((Included("abc"), Excluded("ghi")))
            .map(|e| e.key().clone())
            .collect();
        assert_eq!(keys.len(), 2);
        let entry = map.get("def").unwrap();
        assert_eq!(entry.next().unwrap().key(), "ghi");
        assert!(entry.prev().is_some());
        assert!(entry.remove());
        assert!(!map.contains_key("def"));
        assert!(map.remove("ABC").is_some());
    }
    let set = SkipSet::with_comparator(CaseOrder(true));
    set.insert("abc".to_owned());
    set.insert("ABC".to_owned());
    assert_eq!(set.len(), 1);
    assert!(set.contains("aBc"));
    assert!(set.remove("AbC").is_some());
}

// Deliberately has no Ord, Eq, or PartialEq implementation.
#[derive(Debug)]
struct Key(i32);

#[test]
fn boxed_closure_and_non_ord_keys() {
    type Compare = Box<dyn Fn(&Key, &Key) -> Ordering + Send + Sync>;
    let comparator: Compare = Box::new(|a, b| b.0.cmp(&a.0));
    let map = SkipMap::with_comparator(comparator);
    for k in 0..10 {
        map.insert(Key(k), k);
    }
    assert_eq!(
        map.iter().map(|e| e.key().0).collect::<Vec<_>>(),
        (0..10).rev().collect::<Vec<_>>()
    );
    assert_eq!(
        map.iter().rev().map(|e| e.key().0).collect::<Vec<_>>(),
        (0..10).collect::<Vec<_>>()
    );
    let lo = Key(8);
    let hi = Key(2);
    let mut range = map.range(&lo..&hi);
    assert_eq!(range.next().unwrap().key().0, 8);
    assert_eq!(range.next_back().unwrap().key().0, 3);
    assert_eq!(
        range.map(|e| e.key().0).collect::<Vec<_>>(),
        vec![7, 6, 5, 4]
    );
    assert_eq!(map.front().unwrap().key().0, 9);
    assert_eq!(map.back().unwrap().key().0, 0);
    assert_eq!(map.lower_bound(Included(&Key(7))).unwrap().key().0, 7);
    assert_eq!(map.upper_bound(Excluded(&Key(7))).unwrap().key().0, 8);
    assert!(map.remove(&Key(5)).is_some());
    map.clear();
    assert!(map.is_empty());
}

#[test]
fn base_entries_and_ranges() {
    let list = SkipList::with_comparator(
        crossbeam_epoch::default_collector().clone(),
        CaseOrder(true),
    );
    let guard = &crossbeam_epoch::pin();
    for key in ["abc", "DEF", "ghi"] {
        list.insert(key.to_owned(), 1, guard);
    }
    assert!(list.get("AbC", guard).is_some());
    let mut iter = list.iter(guard);
    assert_eq!(iter.next().unwrap().key(), "abc");
    assert_eq!(iter.next_back().unwrap().key(), "ghi");
    assert_eq!(iter.next().unwrap().key(), "DEF");
    assert!(iter.next_back().is_none());
    let keys: Vec<_> = list
        .range::<str, _>((Included("ABC"), Included("def")), guard)
        .rev()
        .map(|e| e.key().clone())
        .collect();
    assert_eq!(keys, ["DEF", "abc"]);
    let entry = list.get("def", guard).unwrap().pin().unwrap();
    assert_eq!(entry.next(guard).unwrap().key(), "ghi");
    assert!(entry.remove(guard));
    assert!(list.remove("ABC", guard).is_some());
}

#[test]
fn default_comparator() {
    let c = BasicComparator;
    assert!(c.equivalent(&"abc".to_owned(), "abc"));
    assert_eq!(c.compare(&"abc".to_owned(), "def"), Ordering::Less);
    let _: SkipMap<i32, i32> = SkipMap::new();
    let _: SkipSet<i32> = SkipSet::default();
    let _: SkipList<i32, i32> = SkipList::new(crossbeam_epoch::default_collector().clone());
}
