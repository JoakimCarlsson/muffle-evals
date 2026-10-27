use indexmap::{IndexMap, IndexSet};
use std::ops::Bound;

fn check_map(map: &IndexMap<i32, i32>, expected: &[(i32, i32)]) {
    assert!(map
        .iter()
        .map(|(&k, &v)| (k, v))
        .eq(expected.iter().copied()));
    for (index, &(k, v)) in expected.iter().enumerate() {
        assert_eq!(map.get_full(&k), Some((index, &k, &v)));
    }
}

#[test]
fn map_ranges_and_mutation() {
    for start in 0..=8 {
        for end in start..=8 {
            let mut map: IndexMap<_, _> = (0..8).map(|k| (k, k * 10)).collect();
            let mut visited = Vec::new();
            let removed: Vec<_> = map
                .extract_if(start..end, |&k, v| {
                    visited.push(k);
                    *v += 1;
                    k % 2 == 1
                })
                .collect();
            assert_eq!(visited, (start as i32..end as i32).collect::<Vec<_>>());
            assert_eq!(
                removed,
                (start as i32..end as i32)
                    .filter(|k| k % 2 == 1)
                    .map(|k| (k, k * 10 + 1))
                    .collect::<Vec<_>>()
            );
            let expected: Vec<_> = (0..8)
                .filter_map(|k| {
                    let inside = (start..end).contains(&(k as usize));
                    if inside && k % 2 == 1 {
                        None
                    } else {
                        Some((k, k * 10 + i32::from(inside)))
                    }
                })
                .collect();
            check_map(&map, &expected);
        }
    }
}

#[test]
fn map_lazy_and_early_drop() {
    let mut map: IndexMap<_, _> = (0..8).map(|k| (k, k * 10)).collect();
    drop(map.extract_if(.., |_, _| panic!("must be lazy")));
    let mut calls = 0;
    {
        let mut iter = map.extract_if(1..=6, |&k, v| {
            calls += 1;
            *v += 1;
            k % 2 == 0
        });
        assert_eq!(iter.size_hint(), (0, Some(6)));
        // Debug must not visit entries or require Debug on the predicate.
        assert!(format!("{iter:?}").contains("ExtractIf"));
        assert_eq!(iter.next(), Some((2, 21)));
        assert_eq!(iter.size_hint(), (0, Some(4)));
    }
    assert_eq!(calls, 2);
    check_map(
        &map,
        &[(0, 0), (1, 11), (3, 30), (4, 40), (5, 50), (6, 60), (7, 70)],
    );
}

#[test]
fn map_predicate_panic() {
    let mut map: IndexMap<_, _> = (0..5).map(|k| (k, k)).collect();
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let mut iter = map.extract_if(.., |&k, v| {
            *v += 10;
            if k == 2 {
                panic!("predicate");
            }
            true
        });
        assert_eq!(iter.next(), Some((0, 10)));
        assert_eq!(iter.next(), Some((1, 11)));
        iter.next();
    }));
    assert!(result.is_err());
    check_map(&map, &[(2, 12), (3, 3), (4, 4)]);
}

#[test]
fn set_ranges_and_early_drop() {
    for start in 0..=8 {
        for end in start..=8 {
            let mut set: IndexSet<_> = (0..8).collect();
            let removed: Vec<_> = set.extract_if(start..end, |k| k % 2 == 1).collect();
            assert_eq!(
                removed,
                (start as i32..end as i32)
                    .filter(|k| k % 2 == 1)
                    .collect::<Vec<_>>()
            );
            let expected: Vec<_> = (0..8)
                .filter(|k| !(start..end).contains(&(*k as usize)) || k % 2 == 0)
                .collect();
            assert!(set.iter().copied().eq(expected.iter().copied()));
            for (index, k) in expected.iter().enumerate() {
                assert_eq!(set.get_index_of(k), Some(index));
            }
        }
    }
    let mut set: IndexSet<_> = (0..8).collect();
    drop(set.extract_if(.., |_| panic!("must be lazy")));
    let mut calls = 0;
    let removed: Vec<_> = set
        .extract_if(1..7, |k| {
            calls += 1;
            k % 2 == 0
        })
        .take(2)
        .collect();
    assert_eq!(removed, [2, 4]);
    assert_eq!(calls, 4);
    assert!(set.iter().copied().eq([0, 1, 3, 5, 6, 7]));
    for k in [0, 1, 3, 5, 6, 7] {
        assert!(set.contains(&k));
    }
}

#[test]
fn bounds_and_fused() {
    fn fused<I: std::iter::FusedIterator>(_: &I) {}
    let mut map: IndexMap<_, _> = (0..4).map(|k| (k, k)).collect();
    let mut iter: indexmap::map::ExtractIf<'_, _, _, _> =
        map.extract_if((Bound::Excluded(0), Bound::Included(2)), |_, _| true);
    fused(&iter);
    assert_eq!(iter.by_ref().collect::<Vec<_>>(), [(1, 1), (2, 2)]);
    assert_eq!(iter.size_hint(), (0, Some(0)));
    assert_eq!(iter.next(), None);
    drop(iter);
    let mut set: IndexSet<_> = (0..4).collect();
    let mut iter: indexmap::set::ExtractIf<'_, _, _> = set.extract_if(.., |_| false);
    fused(&iter);
    assert!(format!("{iter:?}").contains("ExtractIf"));
    assert_eq!(iter.next(), None);
    assert_eq!(iter.size_hint(), (0, Some(0)));
    assert_eq!(iter.next(), None);
}

#[test]
fn invalid_ranges() {
    for (start, end) in [(3, 2), (0, 5), (5, 5)] {
        let mut map: IndexMap<_, _> = (0..4).map(|k| (k, k)).collect();
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            drop(map.extract_if(start..end, |_, _| true));
        }))
        .is_err());
        check_map(&map, &[(0, 0), (1, 1), (2, 2), (3, 3)]);
        let mut set: IndexSet<_> = (0..4).collect();
        assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            drop(set.extract_if(start..end, |_| true));
        }))
        .is_err());
        assert!(set.iter().copied().eq(0..4));
    }
}

#[test]
fn set_predicate_panic() {
    let mut set: IndexSet<_> = (0..5).collect();
    assert!(std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let mut iter = set.extract_if(.., |&k| {
            if k == 2 {
                panic!("predicate");
            }
            true
        });
        assert_eq!(iter.next(), Some(0));
        assert_eq!(iter.next(), Some(1));
        iter.next();
    }))
    .is_err());
    assert!(set.iter().copied().eq([2, 3, 4]));
    for (index, k) in [2, 3, 4].iter().enumerate() {
        assert_eq!(set.get_index_of(k), Some(index));
    }
}
