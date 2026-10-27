use crossbeam_skiplist::{
    SkipMap, SkipSet,
    base::SkipList,
    comparator::{Comparator, Equivalator},
};
use std::cmp::Ordering;
use std::ops::Bound::{Excluded, Included};

struct CaseSensitivity(bool);
impl<R: AsRef<str> + ?Sized> Equivalator<String, R> for CaseSensitivity {
    fn equivalent(&self, lhs: &String, rhs: &R) -> bool {
        self.compare(lhs, rhs) == Ordering::Equal
    }
}
impl<R: AsRef<str> + ?Sized> Comparator<String, R> for CaseSensitivity {
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
    let map = SkipMap::with_comparator(CaseSensitivity(false));
    map.insert("abc".to_owned(), 1);
    map.insert("ABC".to_owned(), 2);
    assert_eq!(map.len(), 1);
    assert_eq!(*map.get("aBc").unwrap().value(), 2);
    assert_eq!(*map.get_or_insert("AbC".to_owned(), 3).value(), 2);
    map.insert("DEF".to_owned(), 4);
    map.insert("ghi".to_owned(), 5);
    assert_eq!(map.lower_bound(Included("dEf")).unwrap().key(), "DEF");
    assert_eq!(map.upper_bound(Excluded("GHI")).unwrap().key(), "DEF");
    let mut range = map.range::<str, _>((Included("ABC"), Excluded("ghi")));
    assert_eq!(*range.next().unwrap().value(), 2);
    assert_eq!(*range.next_back().unwrap().value(), 4);
    assert!(range.next().is_none());
    let first = map.front().unwrap();
    assert_eq!(first.next().unwrap().key(), "DEF");
    assert_eq!(map.back().unwrap().prev().unwrap().key(), "DEF");
    assert_eq!(*map.remove("aBc").unwrap().value(), 2);
    assert!(!map.contains_key("ABC"));
    map.clear();
    assert!(map.is_empty());
    let sensitive = SkipMap::with_comparator(CaseSensitivity(true));
    sensitive.insert("abc".to_owned(), 1);
    sensitive.insert("ABC".to_owned(), 2);
    assert_eq!(sensitive.len(), 2);
}

#[test]
fn case_insensitive_set() {
    let set = SkipSet::with_comparator(CaseSensitivity(false));
    set.insert("abc".to_owned());
    set.insert("ABC".to_owned());
    set.insert("DEF".to_owned());
    assert_eq!(set.len(), 2);
    assert!(set.contains("aBc"));
    assert_eq!(
        set.range::<str, _>((Included("ABC"), Included("def")))
            .count(),
        2
    );
    assert!(set.remove("AbC").is_some());
    assert_eq!(set.pop_back().unwrap().value(), "DEF");
    assert!(set.is_empty());
}

// Deliberately has no Ord, PartialOrd, Eq or PartialEq implementation.
struct Key(i32);

#[test]
fn boxed_closure_and_unordered_keys() {
    let compare: Box<dyn Fn(&Key, &Key) -> Ordering> = Box::new(|a, b| b.0.cmp(&a.0));
    let map = SkipMap::with_comparator(compare);
    for n in 0..100 {
        map.insert(Key(n), n);
    }
    assert_eq!(
        map.iter().map(|e| *e.value()).collect::<Vec<_>>(),
        (0..100).rev().collect::<Vec<_>>()
    );
    assert_eq!(map.iter().rev().count(), 100);
    assert_eq!(map.range(Key(80)..=Key(20)).count(), 61);
    let entry = map.get(&Key(50)).unwrap();
    assert!(entry.remove());
    assert!(map.get(&Key(50)).is_none());
    drop(entry);
    assert_eq!(map.into_iter().count(), 99);
}

#[test]
fn base_comparator() {
    let collector = crossbeam_epoch::Collector::new();
    let handle = collector.register();
    let guard = &handle.pin();
    let list = SkipList::with_comparator(collector.clone(), CaseSensitivity(false));
    list.insert("ABC".to_owned(), 1, guard);
    assert!(list.get("abc", guard).is_some());
    assert_eq!(
        list.range::<str, _>((Included("aBc"), Included("AbC")), guard)
            .count(),
        1
    );
    assert!(list.remove("abc", guard).is_some());
}
