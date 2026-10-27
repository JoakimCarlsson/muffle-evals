use std::cmp::Ordering;
use std::ops::Bound::{Excluded, Included};

use crossbeam_skiplist::comparator::{BasicComparator, Comparator, Equivalator};
use crossbeam_skiplist::{SkipMap, SkipSet, base::SkipList};

struct CaseSensitive(bool);

impl<R: AsRef<str> + ?Sized> Equivalator<String, R> for CaseSensitive {
    fn equivalent(&self, lhs: &String, rhs: &R) -> bool {
        self.compare(lhs, rhs) == Ordering::Equal
    }
}
impl<R: AsRef<str> + ?Sized> Comparator<String, R> for CaseSensitive {
    fn compare(&self, lhs: &String, rhs: &R) -> Ordering {
        if self.0 {
            lhs.as_str().cmp(rhs.as_ref())
        } else {
            lhs.to_lowercase().cmp(&rhs.as_ref().to_lowercase())
        }
    }
}

#[test]
fn case_insensitive_map() {
    let map = SkipMap::with_comparator(CaseSensitive(false));
    map.insert("abc".to_owned(), 1);
    map.insert("ABC".to_owned(), 2);
    assert_eq!(map.len(), 1);
    assert_eq!(*map.get("aBc").unwrap().value(), 2);
    assert_eq!(*map.get_or_insert("AbC".to_owned(), 3).value(), 2);
    map.compare_insert("abc".to_owned(), 4, |v| *v == 2);
    assert_eq!(*map.get("ABC").unwrap().value(), 4);
    map.insert("DEF".to_owned(), 5);
    map.insert("ghi".to_owned(), 6);
    assert_eq!(map.lower_bound(Included("dEf")).unwrap().key(), "DEF");
    assert_eq!(map.upper_bound(Excluded("dEf")).unwrap().key(), "abc");
    let mut range = map.range::<str, _>((Included("ABC"), Excluded("GhI")));
    assert_eq!(*range.next().unwrap().value(), 4);
    assert_eq!(*range.next_back().unwrap().value(), 5);
    assert!(range.next().is_none());
    let first = map.front().unwrap();
    assert_eq!(first.next().unwrap().key(), "DEF");
    assert_eq!(map.back().unwrap().prev().unwrap().key(), "DEF");
    assert_eq!(*map.remove("aBC").unwrap().value(), 4);
    assert!(!map.contains_key("ABC"));
    map.clear();
    assert!(map.is_empty());

    let sensitive = SkipSet::with_comparator(CaseSensitive(true));
    sensitive.insert("abc".to_owned());
    sensitive.insert("ABC".to_owned());
    assert_eq!(sensitive.len(), 2);
}

// No Ord, Eq, Clone, or Debug implementation is required on the key or comparator.
struct Key(i32);

#[test]
fn boxed_closure_and_unordered_keys() {
    let descending: Box<dyn Fn(&Key, &Key) -> Ordering> = Box::new(|a, b| b.0.cmp(&a.0));
    let set = SkipSet::with_comparator(descending);
    for n in 0..10 {
        set.insert(Key(n));
    }
    assert_eq!(
        set.iter().map(|e| e.value().0).collect::<Vec<_>>(),
        (0..10).rev().collect::<Vec<_>>()
    );
    let mut iter = set.iter();
    for n in 0..5 {
        assert_eq!(iter.next().unwrap().value().0, 9 - n);
        assert_eq!(iter.next_back().unwrap().value().0, n);
    }
    assert!(iter.next().is_none());
    drop(iter);
    let bounds = (Included(Key(7)), Excluded(Key(2)));
    assert_eq!(
        set.range(bounds)
            .rev()
            .map(|e| e.value().0)
            .collect::<Vec<_>>(),
        vec![3, 4, 5, 6, 7]
    );
    assert!(set.get(&Key(5)).unwrap().remove());
    assert!(set.remove(&Key(4)).is_some());
    assert_eq!(set.pop_front().unwrap().value().0, 9);
    assert_eq!(set.pop_back().unwrap().value().0, 0);
    assert_eq!(
        set.into_iter().map(|k| k.0).collect::<Vec<_>>(),
        vec![8, 7, 6, 3, 2, 1]
    );
}

#[test]
fn base_comparator_and_defaults() {
    assert_eq!(std::mem::size_of::<BasicComparator>(), 0);
    assert!(BasicComparator.equivalent(&"abc".to_owned(), "abc"));
    let collector = crossbeam_epoch::Collector::new();
    let handle = collector.register();
    let guard = &handle.pin();
    let list = SkipList::with_comparator(collector.clone(), CaseSensitive(false));
    list.insert("abc".to_owned(), 1, guard);
    list.insert("ABC".to_owned(), 2, guard);
    assert_eq!(list.len(), 1);
    assert_eq!(*list.get("aBc", guard).unwrap().value(), 2);
    let mut range = list.range::<str, _>((Included("ABC"), Included("ABC")), guard);
    assert_eq!(*range.next_back().unwrap().value(), 2);
    assert!(range.next().is_none());
    let entry = list.get("ABC", guard).unwrap().pin().unwrap();
    assert!(entry.remove(guard));
    entry.release(guard);
    assert!(list.is_empty());
}

#[test]
fn concurrent_case_insensitive_insertion() {
    let map = SkipMap::with_comparator(CaseSensitive(false));
    std::thread::scope(|scope| {
        for thread in 0..4 {
            let map = &map;
            scope.spawn(move || {
                for n in 0..100 {
                    let key = if thread % 2 == 0 {
                        format!("KEY{n:03}")
                    } else {
                        format!("key{n:03}")
                    };
                    map.insert(key, n);
                }
            });
        }
    });
    assert_eq!(map.len(), 100);
    for n in 0..100 {
        assert_eq!(*map.get(format!("Key{n:03}").as_str()).unwrap().value(), n);
    }
    assert_eq!(map.iter().count(), 100);
}
