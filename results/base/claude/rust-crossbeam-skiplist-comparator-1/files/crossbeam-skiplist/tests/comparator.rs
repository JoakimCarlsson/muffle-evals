use std::{cmp::Ordering, ops::Bound};

use crossbeam_skiplist::{
    SkipMap, SkipSet,
    comparator::{BasicComparator, Comparator, Equivalator},
};

#[derive(Clone, Copy)]
struct IgnoreCase;

fn fold(s: &str) -> impl Iterator<Item = u8> + '_ {
    s.bytes().map(|b| b.to_ascii_lowercase())
}

impl Equivalator<String, str> for IgnoreCase {
    fn equivalent(&self, lhs: &String, rhs: &str) -> bool {
        lhs.eq_ignore_ascii_case(rhs)
    }
}
impl Comparator<String, str> for IgnoreCase {
    fn compare(&self, lhs: &String, rhs: &str) -> Ordering {
        fold(lhs).cmp(fold(rhs))
    }
}
impl Equivalator<String> for IgnoreCase {
    fn equivalent(&self, lhs: &String, rhs: &String) -> bool {
        lhs.eq_ignore_ascii_case(rhs)
    }
}
impl Comparator<String> for IgnoreCase {
    fn compare(&self, lhs: &String, rhs: &String) -> Ordering {
        fold(lhs).cmp(fold(rhs))
    }
}

type CompareFn = Box<dyn Fn(&i32, &i32) -> Ordering + Send + Sync>;

struct Boxed(CompareFn);

impl Equivalator<i32> for Boxed {
    fn equivalent(&self, lhs: &i32, rhs: &i32) -> bool {
        (self.0)(lhs, rhs) == Ordering::Equal
    }
}
impl Comparator<i32> for Boxed {
    fn compare(&self, lhs: &i32, rhs: &i32) -> Ordering {
        (self.0)(lhs, rhs)
    }
}

#[test]
fn case_insensitive_map() {
    let map = SkipMap::<String, u32, _>::with_comparator(IgnoreCase);
    map.insert("abc".to_string(), 1);
    map.insert("ABC".to_string(), 2);
    map.insert("b".to_string(), 3);
    assert_eq!(map.len(), 2);
    assert_eq!(*map.get("aBc").unwrap().value(), 2);
    assert!(map.contains_key("B"));
    assert_eq!(
        map.range::<str, _>((Bound::Included("A"), Bound::Excluded("AZ")))
            .count(),
        1
    );
    assert_eq!(*map.remove("ABC").unwrap().value(), 2);
    assert!(map.get("abc").is_none());
}

#[test]
fn boxed_closure_set() {
    let set = SkipSet::with_comparator(Boxed(Box::new(|a, b| b.cmp(a))));
    for i in [3, 1, 2, 5, 4] {
        set.insert(i);
    }
    let items: Vec<i32> = set.iter().map(|e| *e).collect();
    assert_eq!(items, [5, 4, 3, 2, 1]);
    let rev: Vec<i32> = set.iter().rev().map(|e| *e).collect();
    assert_eq!(rev, [1, 2, 3, 4, 5]);
    assert_eq!(*set.front().unwrap(), 5);
    assert_eq!(*set.pop_back().unwrap(), 1);
    assert_eq!(
        set.range((Bound::Included(&4), Bound::Included(&2)))
            .count(),
        3
    );
}

#[test]
fn basic_comparator_matches_ord() {
    let c = BasicComparator;
    assert_eq!(c.compare(&1, &2), Ordering::Less);
    assert!(c.equivalent("a", "a"));
    let map: SkipMap<i32, i32> = SkipMap::new();
    let map2 = SkipMap::<i32, i32, BasicComparator>::with_comparator(BasicComparator);
    map.insert(1, 1);
    map2.insert(1, 1);
    assert_eq!(map.len(), map2.len());
}
