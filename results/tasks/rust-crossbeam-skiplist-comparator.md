# rust-crossbeam-skiplist-comparator

Source: https://github.com/crossbeam-rs/crossbeam/pull/1182

## Prompt

> I'd like `crossbeam-skiplist` to let me pick the ordering a `SkipMap` or `SkipSet` uses at runtime, instead of always using the key type's `Ord`. My use case is a map of string keys where case sensitivity is a setting, or where the user hands me a boxed comparison closure.
> 
> Please add a new public module `crossbeam_skiplist::comparator` with:
> 
> - `trait Equivalator<L: ?Sized, R: ?Sized = L>` with `fn equivalent(&self, lhs: &L, rhs: &R) -> bool`.
> - `trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R>` with `fn compare(&self, lhs: &L, rhs: &R) -> std::cmp::Ordering`.
> - `struct BasicComparator`, zero-sized, deriving `Clone`, `Copy`, `Debug` and `Default`, implementing both traits through the crate's existing `Equivalent`/`Comparable` traits, so it behaves exactly like today's ordering.
> 
> `SkipMap`, `SkipSet` and the underlying `base::SkipList` get a new last type parameter `C` defaulting to `BasicComparator`, and so do their entry, iterator and range types (`Entry`, `RefEntry`, `Iter`, `RefIter`, `Range`, `RefRange` and the map and set equivalents), so that existing code that names `SkipMap<K, V>` or calls `SkipMap::new()` keeps compiling and behaving the same. `new()` stays tied to `BasicComparator`.
> 
> New constructors:
> 
> ```rust
> SkipMap::<K, V, C>::with_comparator(comparator: C) -> Self
> SkipSet::<T, C>::with_comparator(comparator: C) -> Self
> base::SkipList::<K, V, C>::with_comparator(collector: Collector, comparator: C) -> Self
> ```
> 
> Every lookup, insert, remove and range operation must then use the comparator's `compare`/`equivalent` instead of `Ord`, with the query key type allowed to differ from the stored key type as long as `C: Comparator<K, Q>`. For example a `SkipMap<String, u32, _>` built with a comparator that ignores case should treat `"abc"` and `"ABC"` as the same key, and `get("aBc")` with a `&str` should find it.
> 
> Please add this.

## Upstream change (tests left out)

Files: 

```diff
diff --git a/Cargo.toml b/Cargo.toml
index 9d6a7fa..2ad3e0f 100644
--- a/Cargo.toml
+++ b/Cargo.toml
@@ -91,3 +91,5 @@ declare_interior_mutable_const = { level = "allow", priority = 1 } # https://git
 incompatible_msrv = { level = "allow", priority = 1 } # buggy: doesn't consider cfg, https://github.com/rust-lang/rust-clippy/issues/12280, https://github.com/rust-lang/rust-clippy/issues/12257#issuecomment-2093667187
 lint_groups_priority = { level = "allow", priority = 1 } # https://github.com/rust-lang/rust-clippy/issues/12920
 manual_map = { level = "allow", priority = 1 }
+manual_range_contains = { level = "allow", priority = 1 } # https://github.com/rust-lang/rust-clippy/issues/6455#issuecomment-1225966395
+type_complexity = { level = "allow", priority = 1 }
diff --git a/crossbeam-skiplist/src/base.rs b/crossbeam-skiplist/src/base.rs
index a73ee8a..e0f54b5 100644
--- a/crossbeam-skiplist/src/base.rs
+++ b/crossbeam-skiplist/src/base.rs
@@ -15,8 +15,10 @@ use core::{
 use crossbeam_epoch::{self as epoch, Atomic, Collector, Guard, Shared};
 use crossbeam_utils::CachePadded;
 
-use super::equivalent::Comparable;
-use crate::alloc_helper::Global;
+use crate::{
+    alloc_helper::Global,
+    comparator::{BasicComparator, Comparator},
+};
 
 /// Number of bits needed to store height.
 const HEIGHT_BITS: usize = 5;
@@ -304,7 +306,7 @@ impl<'a, K, V> NodeRef<'a, K, V> {
     /// Decrements the reference count of a node, pinning the thread and destroying the node
     /// if the count become zero.
     #[inline]
-    unsafe fn decrement_with_pin<F>(self, parent: &SkipList<K, V>, pin: F)
+    unsafe fn decrement_with_pin<F, C>(self, parent: &SkipList<K, V, C>, pin: F)
     where
         F: FnOnce() -> Guard,
     {
@@ -463,7 +465,7 @@ struct HotData {
 // As a further future optimization, if `!mem::needs_drop::<K>() && !mem::needs_drop::<V>()`
 // (neither key nor the value have destructors), there's no point in creating a new local
 // collector, so we should simply use the global one.
-pub struct SkipList<K, V> {
+pub struct SkipList<K, V, C = BasicComparator> {
     /// The head of the skip list (just a dummy node, not a real entry).
     head: Head<K, V>,
 
@@ -472,14 +474,24 @@ pub struct SkipList<K, V> {
 
     /// Hot data associated with the skip list, stored in a dedicated cache line.
     hot_data: CachePadded<HotData>,
+
+    /// The `Comparator` used to determine key ordering.
+    comparator: C,
 }
 
-unsafe impl<K: Send + Sync, V: Send + Sync> Send for SkipList<K, V> {}
-unsafe impl<K: Send + Sync, V: Send + Sync> Sync for SkipList<K, V> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Send + Sync> Send for SkipList<K, V, C> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Send + Sync> Sync for SkipList<K, V, C> {}
 
 impl<K, V> SkipList<K, V> {
     /// Returns a new, empty skip list.
     pub fn new(collector: Collector) -> Self {
+        Self::with_comparator(collector, Default::default())
+    }
+}
+
+impl<K, V, C> SkipList<K, V, C> {
+    /// Returns a new, empty skip list using the given comparator.
+    pub fn with_comparator(collector: Collector, comparator: C) -> Self {
         Self {
             head: Head::new(),
             collector,
@@ -488,6 +500,7 @@ impl<K, V> SkipList<K, V> {
                 len: AtomicUsize::new(0),
                 max_height: AtomicUsize::new(1),
             }),
+            comparator,
         }
     }
 
@@ -517,12 +530,12 @@ impl<K, V> SkipList<K, V> {
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Returns the entry with the smallest key.
-    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.next_node(self.head.as_tower(), Bound::Unbounded, guard)?;
         Some(Entry {
@@ -533,7 +546,7 @@ where
     }
 
     /// Returns the entry with the largest key.
-    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.search_bound::<K>(Bound::Unbounded, true, guard)?;
         Some(Entry {
@@ -546,21 +559,21 @@ where
     /// Returns `true` if the map contains a value for the specified key.
     pub fn contains_key<Q>(&self, key: &Q, guard: &Guard) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.get(key, guard).is_some()
     }
 
     /// Returns an entry with the specified `key`.
-    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>>
+    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
         let n = self.search_bound(Bound::Included(key), false, guard)?;
-        if !n.key.equivalent(key) {
+        if !self.comparator.equivalent(&n.key, key) {
             return None;
         }
 
@@ -578,9 +591,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -599,9 +612,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -614,19 +627,18 @@ where
     }
 
     /// Finds an entry with the specified key, or inserts a new `key`-`value` pair if none exist.
-    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| false, guard)
     }
 
     /// Finds an entry with the specified key, or inserts a new `key`-`value` pair if none exist,
     /// where value is calculated with a function.
     ///
-    ///
     /// <b>Note:</b> Another thread may write key value first, leading to the result of this closure
     /// discarded. If closure is modifying some other state (such as shared counters or shared
     /// objects), it may lead to <u>undesired behaviour</u> such as counters being changed without
     /// result of closure inserted
-    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -634,7 +646,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V> {
+    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V, C> {
         self.check_guard(guard);
         Iter {
             parent: self,
@@ -645,7 +657,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn ref_iter(&self) -> RefIter<'_, K, V> {
+    pub fn ref_iter(&self) -> RefIter<'_, K, V, C> {
         RefIter {
             parent: self,
             head: None,
@@ -658,9 +670,9 @@ where
         &'a self,
         range: R,
         guard: &'g Guard,
-    ) -> Range<'a, 'g, Q, R, K, V>
+    ) -> Range<'a, 'g, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -677,9 +689,9 @@ where
 
     /// Returns an iterator over a subset of entries in the skip list.
     #[allow(clippy::needless_lifetimes)]
-    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V>
+    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -825,7 +837,7 @@ where
         guard: &'a Guard,
     ) -> Option<NodeRef<'a, K, V>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -887,11 +899,11 @@ where
                         // bound, we return the last node before the condition became true. For the
                         // lower bound, we return the first node after the condition became true.
                         if upper_bound {
-                            if !below_upper_bound(&bound, &c.key) {
+                            if !below_upper_bound(&self.comparator, &bound, &c.key) {
                                 break;
                             }
                             result = Some(c);
-                        } else if above_lower_bound(&bound, &c.key) {
+                        } else if above_lower_bound(&self.comparator, &bound, &c.key) {
                             result = Some(c);
                             break;
                         }
@@ -910,7 +922,7 @@ where
     /// Searches for a key in the skip list and returns a list of all adjacent nodes.
     fn search_position<'a, Q>(&'a self, key: &Q, guard: &'a Guard) -> Position<'a, K, V>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -971,7 +983,7 @@ where
 
                         // If `curr` contains a key that is greater than or equal to `key`, we're
                         // done with this level.
-                        match c.key.compare(key) {
+                        match self.comparator.compare(&c.key, key) {
                             cmp::Ordering::Greater => break,
                             cmp::Ordering::Equal => {
                                 result.found = Some(c);
@@ -1004,8 +1016,9 @@ where
         value: F,
         replace: CompareF,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
+        C: Comparator<K>,
         F: FnOnce() -> V,
         CompareF: Fn(&V) -> bool,
     {
@@ -1155,7 +1168,10 @@ where
                     // the tower without breaking any invariants. Note that building higher levels
                     // is completely optional. Only the lowest level really matters, and all the
                     // higher levels are there just to make searching faster.
-                    if succ.as_ref().map(|s| &s.key) == Some(&n.key) {
+                    if succ
+                        .as_ref()
+                        .is_some_and(|s| self.comparator.equivalent(&s.key, &n.key))
+                    {
                         search = self.search_position(&n.key, guard);
                         continue;
                     }
@@ -1218,16 +1234,17 @@ where
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord + Send + 'static,
+    C: Comparator<K>,
+    K: Send + 'static,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the skip list and returns the new entry.
     ///
     /// If there is an existing entry with this key, it will be removed before inserting the new
     /// one.
-    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| true, guard)
     }
 
@@ -1242,7 +1259,7 @@ where
         value: V,
         compare_fn: F,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -1250,9 +1267,9 @@ where
     }
 
     /// Removes an entry with the specified `key` from the map and returns it.
-    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -1320,7 +1337,7 @@ where
     }
 
     /// Removes an entry from the front of the skip list.
-    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.front(guard)?;
@@ -1335,7 +1352,7 @@ where
     }
 
     /// Removes an entry from the back of the skip list.
-    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.back(guard)?;
@@ -1393,7 +1410,7 @@ where
     }
 }
 
-impl<K, V> Drop for SkipList<K, V> {
+impl<K, V, C> Drop for SkipList<K, V, C> {
     fn drop(&mut self) {
         unsafe {
             let mut node = NodeRef::from_shared(
@@ -1419,9 +1436,9 @@ impl<K, V> Drop for SkipList<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipList<K, V>
+impl<K, V, C> fmt::Debug for SkipList<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -1429,7 +1446,7 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipList<K, V> {
+impl<K, V, C> IntoIterator for SkipList<K, V, C> {
     type Item = (K, V);
     type IntoIter = IntoIter<K, V>;
 
@@ -1464,13 +1481,13 @@ impl<K, V> IntoIterator for SkipList<K, V> {
 /// The lifetimes of the key and value are the same as that of the `Guard`
 /// used when creating the `Entry` (`'g`). This lifetime is also constrained to
 /// not outlive the `SkipList`.
-pub struct Entry<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Entry<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'g, K, V>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Entry<'a, 'g, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1487,7 +1504,7 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1496,14 +1513,15 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     ///
     /// This method may return `None` if the reference count is already 0 and
     /// the node has been queued for deletion.
-    pub fn pin(&self) -> Option<RefEntry<'a, K, V>> {
+    pub fn pin(&self) -> Option<RefEntry<'a, K, V, C>> {
         unsafe { RefEntry::try_acquire(self.parent, self.node) }
     }
 }
 
-impl<K, V> Entry<'_, '_, K, V>
+impl<K, V, C> Entry<'_, '_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    C: Comparator<K>,
+    K: Send + 'static,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1526,7 +1544,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, '_, K, V> {
+impl<K, V, C> Clone for Entry<'_, '_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             parent: self.parent,
@@ -1536,7 +1554,7 @@ impl<K, V> Clone for Entry<'_, '_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1549,9 +1567,9 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K, V> Entry<'a, 'g, K, V>
+impl<'a: 'g, 'g, K, V, C> Entry<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self) -> bool {
@@ -1565,7 +1583,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self.parent.next_node(
             self.node.as_tower(),
             Bound::Excluded(&self.node.key),
@@ -1590,7 +1608,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self
             .parent
             .search_bound(Bound::Excluded(&self.node.key), true, self.guard)?;
@@ -1606,12 +1624,12 @@ where
 ///
 /// You *must* call `release` to free this type, otherwise the node will be
 /// leaked. This is because releasing the entry requires a `Guard`.
-pub struct RefEntry<'a, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct RefEntry<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'a, K, V>,
 }
 
-impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C: 'a> RefEntry<'a, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1628,7 +1646,7 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1650,9 +1668,9 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     /// Tries to create a new `RefEntry` by incrementing the reference count of
     /// a node.
     unsafe fn try_acquire(
-        parent: &'a SkipList<K, V>,
+        parent: &'a SkipList<K, V, C>,
         node: NodeRef<'_, K, V>,
-    ) -> Option<RefEntry<'a, K, V>> {
+    ) -> Option<RefEntry<'a, K, V, C>> {
         if unsafe { node.try_increment() } {
             Some(RefEntry {
                 parent,
@@ -1667,9 +1685,10 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 }
 
-impl<K, V> RefEntry<'_, K, V>
+impl<K, V, C> RefEntry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    C: Comparator<K>,
+    K: Send + 'static,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1694,7 +1713,7 @@ where
     }
 }
 
-impl<K, V> Clone for RefEntry<'_, K, V> {
+impl<K, V, C> Clone for RefEntry<'_, K, V, C> {
     fn clone(&self) -> Self {
         unsafe {
             // Incrementing will always succeed since we're already holding a reference to the node.
@@ -1707,7 +1726,7 @@ impl<K, V> Clone for RefEntry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for RefEntry<'_, K, V>
+impl<K, V, C> fmt::Debug for RefEntry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1720,9 +1739,9 @@ where
     }
 }
 
-impl<'a, K, V> RefEntry<'a, K, V>
+impl<'a, K, V, C> RefEntry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self, guard: &Guard) -> bool {
@@ -1736,7 +1755,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1763,7 +1782,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1780,20 +1799,20 @@ where
 }
 
 /// An iterator over the entries of a `SkipList`.
-pub struct Iter<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Iter<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Iterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Iterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1804,7 +1823,7 @@ where
             }
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1817,11 +1836,11 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> DoubleEndedIterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> DoubleEndedIterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -1831,7 +1850,7 @@ where
                 .search_bound::<K>(Bound::Unbounded, true, self.guard),
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1844,7 +1863,7 @@ where
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Iter<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1858,13 +1877,13 @@ where
 }
 
 /// An iterator over reference-counted entries of a `SkipList`.
-pub struct RefIter<'a, K, V> {
-    parent: &'a SkipList<K, V>,
-    head: Option<RefEntry<'a, K, V>>,
-    tail: Option<RefEntry<'a, K, V>>,
+pub struct RefIter<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
+    head: Option<RefEntry<'a, K, V, C>>,
+    tail: Option<RefEntry<'a, K, V, C>>,
 }
 
-impl<K, V> fmt::Debug for RefIter<'_, K, V>
+impl<K, V, C> fmt::Debug for RefIter<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1883,12 +1902,12 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V>
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match &self.head {
             Some(e) => e.next(guard),
@@ -1896,7 +1915,9 @@ where
         };
         match (&next_head, &self.tail) {
             // The next key is larger than the latest tail key we observed with this iterator.
-            (Some(ref next), Some(t)) if next.key() >= t.key() => {
+            (Some(ref next), Some(t))
+                if self.parent.comparator.compare(next.key(), t.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1915,7 +1936,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match &self.tail {
             Some(e) => e.prev(guard),
@@ -1923,7 +1944,9 @@ where
         };
         match (&self.head, &next_tail) {
             // The prev key is smaller than the latest head key we observed with this iterator.
-            (Some(h), Some(next)) if h.key() >= next.key() => {
+            (Some(h), Some(next))
+                if self.parent.comparator.compare(h.key(), next.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1942,7 +1965,7 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C> {
     /// Decrements the reference count of `RefEntry` owned by the iterator.
     pub fn drop_impl(&mut self, guard: &Guard) {
         self.parent.check_guard(guard);
@@ -1956,13 +1979,13 @@ impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipList`.
-pub struct Range<'a: 'g, 'g, Q, R, K, V>
+pub struct Range<'a: 'g, 'g, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     range: R,
@@ -1970,15 +1993,15 @@ where
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> Iterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> Iterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1991,14 +2014,14 @@ where
             match self.tail {
                 Some(t) => {
                     let bound = Bound::Excluded(&t.as_ref().key);
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2013,13 +2036,13 @@ where
     }
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -2032,14 +2055,14 @@ where
             match self.head {
                 Some(h) => {
                     let bound = Bound::Excluded(&h.as_ref().key);
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2054,9 +2077,10 @@ where
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, '_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, '_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
+    K: fmt::Debug,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2071,38 +2095,39 @@ where
 }
 
 /// An iterator over reference-counted subset of entries of a `SkipList`.
-pub struct RefRange<'a, Q, R, K, V>
+pub struct RefRange<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
-    pub(crate) head: Option<RefEntry<'a, K, V>>,
-    pub(crate) tail: Option<RefEntry<'a, K, V>>,
+    parent: &'a SkipList<K, V, C>,
+    pub(crate) head: Option<RefEntry<'a, K, V, C>>,
+    pub(crate) tail: Option<RefEntry<'a, K, V, C>>,
     pub(crate) range: R,
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-unsafe impl<Q, R, K, V> Send for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C> Send for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-unsafe impl<Q, R, K, V> Sync for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C> Sync for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-impl<Q, R, K, V> fmt::Debug for RefRange<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
+    K: fmt::Debug,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2116,14 +2141,14 @@ where
     }
 }
 
-impl<'a, Q, R, K: 'a, V: 'a> RefRange<'a, Q, R, K, V>
+impl<'a, Q, R, K: 'a, V: 'a, C> RefRange<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match self.head {
             Some(ref e) => e.next(guard),
@@ -2134,7 +2159,7 @@ where
             match self.tail {
                 Some(ref t) => {
                     let bound = Bound::Excluded(t.key());
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2150,7 +2175,7 @@ where
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2171,7 +2196,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match self.tail {
             Some(ref e) => e.prev(guard),
@@ -2182,7 +2207,7 @@ where
             match self.head {
                 Some(ref h) => {
                     let bound = Bound::Excluded(h.key());
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2198,7 +2223,7 @@ where
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2307,9 +2332,9 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 
 /// Helper function to retry an operation until pinning succeeds or `None` is
 /// returned.
-pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V>(mut f: F) -> Option<RefEntry<'a, K, V>>
+pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V, C>(mut f: F) -> Option<RefEntry<'a, K, V, C>>
 where
-    F: FnMut() -> Option<Entry<'a, 'g, K, V>>,
+    F: FnMut() -> Option<Entry<'a, 'g, K, V, C>>,
 {
     loop {
         if let Some(e) = f()?.pin() {
@@ -2319,27 +2344,27 @@ where
 }
 
 /// Helper function to check if a value is above a lower bound
-fn above_lower_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn above_lower_bound<V, T, C>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_ge(),
-        Bound::Excluded(key) => other.compare(key).is_gt(),
+        Bound::Included(key) => comparator.compare(other, key).is_ge(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_gt(),
     }
 }
 
 /// Helper function to check if a value is below an upper bound
-fn below_upper_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn below_upper_bound<V, T, C>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_le(),
-        Bound::Excluded(key) => other.compare(key).is_lt(),
+        Bound::Included(key) => comparator.compare(other, key).is_le(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_lt(),
     }
 }
diff --git a/crossbeam-skiplist/src/comparator.rs b/crossbeam-skiplist/src/comparator.rs
new file mode 100644
index 0000000..239863b
--- /dev/null
+++ b/crossbeam-skiplist/src/comparator.rs
@@ -0,0 +1,96 @@
+//! Traits for key comparison in maps.
+
+use core::cmp::Ordering;
+
+use crate::equivalent::{Comparable, Equivalent};
+
+/// Key equality trait.
+///
+/// This trait allows for very flexible comparison of objects. You may
+/// borrow/dereference `L` and `R` using `Borrow` or another trait. The trait
+/// takes a `self` parameter, which you can use to change how the operands are
+/// compared. For example, you can toggle string case-sensitivity on and off at
+/// runtime, or you can use `Box<dyn Equivalator<L, R>>` to allow the user of
+/// your code to supply a custom comparison function.
+///
+/// Implementations of `Equivalator` don't affect the inherent `Eq` or `Hash`
+/// implementations for a type. Currently there is no companion trait that
+/// allows for custom hashing the way `Equivalator` allows for custom
+/// comparison.
+///
+/// See also `Comparator`.
+///
+/// ## Example
+/// ```
+/// use crossbeam_skiplist::comparator::Equivalator;
+///
+/// struct MyEquivalator {
+///     case_sensitive: bool,
+/// }
+///
+/// impl Equivalator<[u8], [u8]> for MyEquivalator {
+///     fn equivalent(&self, lhs: &[u8], rhs: &[u8]) -> bool {
+///         if self.case_sensitive {
+///             lhs == rhs
+///         } else {
+///             // Case-insensitive ASCII comparison on raw bytes
+///             if lhs.len() != rhs.len() { return false; }
+///             for (&c1, &c2) in lhs.iter().zip(rhs.iter()) {
+///                 let c1 = if c1 >= 0x61 && c1 <= 0x7a { c1 - 32 } else { c1 };
+///                 let c2 = if c2 >= 0x61 && c2 <= 0x7a { c2 - 32 } else { c2 };
+///                 if c1 != c2 { return false; }
+///             }
+///             true
+///         }
+///     }
+/// }
+/// ```
+pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
+    /// Compare `lhs` to `rhs` for equality.
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
+}
+
+/// Key ordering trait.
+///
+/// This trait allows for very flexible comparison of objects. You may
+/// borrow/dereference `L` and `R` using `Borrow` or another trait. The trait
+/// takes a `self` parameter, which you can use to change how the operands are
+/// compared. For example, you can toggle string case-sensitivity on and off,
+/// or you can use `Box<dyn Comparator<L, R>>` to allow the user of your code
+/// to supply a custom comparison function.
+///
+/// The `Comparator` and `Equivalator` implementations for a comparator must
+/// agree on which inputs are equal.
+///
+/// See also `Equivalator`.
+pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
+    /// Compare `lhs` to `rhs` and return their ordering.
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
+}
+
+/// This comparator uses the `Equivalent` and `Comparable` traits to perform
+/// comparisons, which themselves fall back on the standard library `Borrow`
+/// and `Ord` traits. When used in a map, this results in the same behavior as
+/// the standard `BTreeMap` interface.
+#[derive(Clone, Copy, Debug, Default)]
+pub struct BasicComparator;
+
+impl<K: ?Sized, Q: ?Sized> Equivalator<K, Q> for BasicComparator
+where
+    K: Equivalent<Q>,
+{
+    #[inline]
+    fn equivalent(&self, lhs: &K, rhs: &Q) -> bool {
+        <K as Equivalent<Q>>::equivalent(lhs, rhs)
+    }
+}
+
+impl<K: ?Sized, Q: ?Sized> Comparator<K, Q> for BasicComparator
+where
+    K: Comparable<Q>,
+{
+    #[inline]
+    fn compare(&self, lhs: &K, rhs: &Q) -> Ordering {
+        <K as Comparable<Q>>::compare(lhs, rhs)
+    }
+}
diff --git a/crossbeam-skiplist/src/lib.rs b/crossbeam-skiplist/src/lib.rs
index 5ff8e74..5337e3d 100644
--- a/crossbeam-skiplist/src/lib.rs
+++ b/crossbeam-skiplist/src/lib.rs
@@ -265,4 +265,5 @@ pub mod set;
 #[doc(inline)]
 pub use crate::{map::SkipMap, set::SkipSet};
 
+pub mod comparator;
 pub mod equivalent;
diff --git a/crossbeam-skiplist/src/map.rs b/crossbeam-skiplist/src/map.rs
index c7c5408..e9e00ec 100644
--- a/crossbeam-skiplist/src/map.rs
+++ b/crossbeam-skiplist/src/map.rs
@@ -11,7 +11,7 @@ use crossbeam_epoch as epoch;
 
 use crate::{
     base::{self, try_pin_loop},
-    equivalent::Comparable,
+    comparator::{BasicComparator, Comparator},
 };
 
 /// An ordered map based on a lock-free skip list.
@@ -19,13 +19,18 @@ use crate::{
 /// This is an alternative to [`BTreeMap`] which supports
 /// concurrent access across multiple threads.
 ///
+/// A custom comparator may be provided, causing all keys
+/// to be ordered by the comparison function used instead
+/// of the standard `Ord` impl. See [`Comparator`].
+///
 /// [`BTreeMap`]: std::collections::BTreeMap
-pub struct SkipMap<K, V> {
-    inner: base::SkipList<K, V>,
+/// [`Comparator`]: crate::comparator::Comparator
+pub struct SkipMap<K, V, C = BasicComparator> {
+    inner: base::SkipList<K, V, C>,
 }
 
 impl<K, V> SkipMap<K, V> {
-    /// Returns a new, empty map.
+    /// Returns a new, empty map with the default comparator.
     ///
     /// # Example
     ///
@@ -39,6 +44,23 @@ impl<K, V> SkipMap<K, V> {
             inner: base::SkipList::new(epoch::default_collector().clone()),
         }
     }
+}
+
+impl<K, V, C> SkipMap<K, V, C> {
+    /// Returns a new, empty map with the given comparator.
+    ///
+    /// # Example
+    ///
+    /// ```
+    /// use crossbeam_skiplist::{SkipMap, comparator::BasicComparator};
+    ///
+    /// let map: SkipMap<i32, &str> = SkipMap::with_comparator(BasicComparator);
+    /// ```
+    pub fn with_comparator(comparator: C) -> Self {
+        Self {
+            inner: base::SkipList::with_comparator(epoch::default_collector().clone(), comparator),
+        }
+    }
 
     /// Returns `true` if the map is empty.
     ///
@@ -80,9 +102,9 @@ impl<K, V> SkipMap<K, V> {
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -99,7 +121,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.front().unwrap().value(), "five");
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.front(guard)).map(Entry::new)
     }
@@ -119,11 +141,97 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.back().unwrap().value(), "six");
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.back(guard)).map(Entry::new)
     }
 
+    /// Finds an entry with the specified key, or inserts a new `key`-`value` pair if none exist.
+    ///
+    /// This function returns an [`Entry`] which
+    /// can be used to access the key's associated value.
+    ///
+    /// # Example
+    /// ```
+    /// use crossbeam_skiplist::SkipMap;
+    ///
+    /// let ages = SkipMap::new();
+    /// let gates_age = ages.get_or_insert("Bill Gates", 64);
+    /// assert_eq!(*gates_age.value(), 64);
+    ///
+    /// ages.insert("Steve Jobs", 65);
+    /// let jobs_age = ages.get_or_insert("Steve Jobs", -1);
+    /// assert_eq!(*jobs_age.value(), 65);
+    /// ```
+    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
+        let guard = &epoch::pin();
+        Entry::new(self.inner.get_or_insert(key, value, guard))
+    }
+
+    /// Finds an entry with the specified key, or inserts a new `key`-`value` pair if none exist,
+    /// where value is calculated with a function.
+    ///
+    /// <b>Note:</b> Another thread may write key value first, leading to the result of this closure
+    /// discarded. If closure is modifying some other state (such as shared counters or shared
+    /// objects), it may lead to <u>undesired behaviour</u> such as counters being changed without
+    /// result of closure inserted
+    ///
+    /// This function returns an [`Entry`] which
+    /// can be used to access the key's associated value.
+    ///
+    /// # Example
+    /// ```
+    /// use crossbeam_skiplist::SkipMap;
+    ///
+    /// let ages = SkipMap::new();
+    /// let gates_age = ages.get_or_insert_with("Bill Gates", || 64);
+    /// assert_eq!(*gates_age.value(), 64);
+    ///
+    /// ages.insert("Steve Jobs", 65);
+    /// let jobs_age = ages.get_or_insert_with("Steve Jobs", || -1);
+    /// assert_eq!(*jobs_age.value(), 65);
+    /// ```
+    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V, C>
+    where
+        F: FnOnce() -> V,
+    {
+        let guard = &epoch::pin();
+        Entry::new(self.inner.get_or_insert_with(key, value_fn, guard))
+    }
+
+    /// Returns an iterator over all entries in the map,
+    /// sorted by key.
+    ///
+    /// This iterator returns [`Entry`]s which
+    /// can be used to access keys and their associated values.
+    ///
+    /// # Examples
+    /// ```
+    /// use crossbeam_skiplist::SkipMap;
+    ///
+    /// let numbers = SkipMap::new();
+    /// numbers.insert(6, "six");
+    /// numbers.insert(7, "seven");
+    /// numbers.insert(12, "twelve");
+    ///
+    /// // Print then numbers from least to greatest
+    /// for entry in numbers.iter() {
+    ///     let number = entry.key();
+    ///     let number_str = entry.value();
+    ///     println!("{} is {}", number, number_str);
+    /// }
+    /// ```
+    pub fn iter(&self) -> Iter<'_, K, V, C> {
+        Iter {
+            inner: self.inner.ref_iter(),
+        }
+    }
+}
+
+impl<K, V, C> SkipMap<K, V, C>
+where
+    C: Comparator<K>,
+{
     /// Returns `true` if the map contains a value for the specified key.
     ///
     /// # Example
@@ -138,7 +246,7 @@ where
     /// ```
     pub fn contains_key<Q>(&self, key: &Q) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -160,9 +268,9 @@ where
     /// numbers.insert("six", 6);
     /// assert_eq!(*numbers.get("six").unwrap().value(), 6);
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -195,9 +303,9 @@ where
     /// let greater_than_thirteen = numbers.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -227,98 +335,15 @@ where
     /// let less_than_six = numbers.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.upper_bound(bound, guard)).map(Entry::new)
     }
 
-    /// Finds an entry with the specified key, or inserts a new `key`-`value` pair if none exist.
-    ////
-    /// This function returns an [`Entry`] which
-    /// can be used to access the key's associated value.
-    ///
-    /// # Example
-    /// ```
-    /// use crossbeam_skiplist::SkipMap;
-    ///
-    /// let ages = SkipMap::new();
-    /// let gates_age = ages.get_or_insert("Bill Gates", 64);
-    /// assert_eq!(*gates_age.value(), 64);
-    ///
-    /// ages.insert("Steve Jobs", 65);
-    /// let jobs_age = ages.get_or_insert("Steve Jobs", -1);
-    /// assert_eq!(*jobs_age.value(), 65);
-    /// ```
-    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V> {
-        let guard = &epoch::pin();
-        Entry::new(self.inner.get_or_insert(key, value, guard))
-    }
-
-    /// Finds an entry with the specified key, or inserts a new `key`-`value` pair if none exist,
-    /// where value is calculated with a function.
-    ///
-    ///
-    /// <b>Note:</b> Another thread may write key value first, leading to the result of this closure
-    /// discarded. If closure is modifying some other state (such as shared counters or shared
-    /// objects), it may lead to <u>undesired behaviour</u> such as counters being changed without
-    /// result of closure inserted
-    ////
-    /// This function returns an [`Entry`] which
-    /// can be used to access the key's associated value.
-    ///
-    ///
-    /// # Example
-    /// ```
-    /// use crossbeam_skiplist::SkipMap;
-    ///
-    /// let ages = SkipMap::new();
-    /// let gates_age = ages.get_or_insert_with("Bill Gates", || 64);
-    /// assert_eq!(*gates_age.value(), 64);
-    ///
-    /// ages.insert("Steve Jobs", 65);
-    /// let jobs_age = ages.get_or_insert_with("Steve Jobs", || -1);
-    /// assert_eq!(*jobs_age.value(), 65);
-    /// ```
-    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V>
-    where
-        F: FnOnce() -> V,
-    {
-        let guard = &epoch::pin();
-        Entry::new(self.inner.get_or_insert_with(key, value_fn, guard))
-    }
-
-    /// Returns an iterator over all entries in the map,
-    /// sorted by key.
-    ///
-    /// This iterator returns [`Entry`]s which
-    /// can be used to access keys and their associated values.
-    ///
-    /// # Examples
-    /// ```
-    /// use crossbeam_skiplist::SkipMap;
-    ///
-    /// let numbers = SkipMap::new();
-    /// numbers.insert(6, "six");
-    /// numbers.insert(7, "seven");
-    /// numbers.insert(12, "twelve");
-    ///
-    /// // Print then numbers from least to greatest
-    /// for entry in numbers.iter() {
-    ///     let number = entry.key();
-    ///     let number_str = entry.value();
-    ///     println!("{} is {}", number, number_str);
-    /// }
-    /// ```
-    pub fn iter(&self) -> Iter<'_, K, V> {
-        Iter {
-            inner: self.inner.ref_iter(),
-        }
-    }
-
     /// Returns an iterator over a subset of entries in the map.
     ///
     /// This iterator returns [`Entry`]s which
@@ -340,10 +365,10 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V, C>
     where
         R: RangeBounds<Q>,
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         Range {
@@ -352,9 +377,10 @@ where
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord + Send + 'static,
+    C: Comparator<K>,
+    K: Send + 'static,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the map and returns the new entry.
@@ -374,7 +400,7 @@ where
     ///
     /// assert_eq!(*map.get("key").unwrap().value(), "value");
     /// ```
-    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.insert(key, value, guard))
     }
@@ -401,7 +427,7 @@ where
     /// map.compare_insert("absent_key", 0, |_| false);
     /// assert_eq!(*map.get("absent_key").unwrap().value(), 0);
     /// ```
-    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V>
+    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -427,9 +453,9 @@ where
     /// map.insert("key", "value");
     /// assert_eq!(*map.remove("key").unwrap().value(), "value");
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -458,7 +484,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_front(guard).map(Entry::new)
     }
@@ -485,7 +511,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_back(guard).map(Entry::new)
     }
@@ -509,15 +535,18 @@ where
     }
 }
 
-impl<K, V> Default for SkipMap<K, V> {
+impl<K, V, C> Default for SkipMap<K, V, C>
+where
+    C: Default,
+{
     fn default() -> Self {
-        Self::new()
+        Self::with_comparator(Default::default())
     }
 }
 
-impl<K, V> fmt::Debug for SkipMap<K, V>
+impl<K, V, C> fmt::Debug for SkipMap<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -525,7 +554,7 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipMap<K, V> {
+impl<K, V, C> IntoIterator for SkipMap<K, V, C> {
     type Item = (K, V);
     type IntoIter = IntoIter<K, V>;
 
@@ -536,27 +565,27 @@ impl<K, V> IntoIterator for SkipMap<K, V> {
     }
 }
 
-impl<'a, K, V> IntoIterator for &'a SkipMap<K, V>
+impl<'a, K, V, C> IntoIterator for &'a SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, K, V>;
-    type IntoIter = Iter<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
+    type IntoIter = Iter<'a, K, V, C>;
 
-    fn into_iter(self) -> Iter<'a, K, V> {
+    fn into_iter(self) -> Iter<'a, K, V, C> {
         self.iter()
     }
 }
 
-impl<K, V> FromIterator<(K, V)> for SkipMap<K, V>
+impl<K, V, C> FromIterator<(K, V)> for SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K> + Default,
 {
     fn from_iter<I>(iter: I) -> Self
     where
         I: IntoIterator<Item = (K, V)>,
     {
-        let s = Self::new();
+        let s = Self::default();
         for (k, v) in iter {
             s.get_or_insert(k, v);
         }
@@ -565,12 +594,12 @@ where
 }
 
 /// A reference-counted entry in a map.
-pub struct Entry<'a, K, V> {
-    inner: ManuallyDrop<base::RefEntry<'a, K, V>>,
+pub struct Entry<'a, K, V, C = BasicComparator> {
+    inner: ManuallyDrop<base::RefEntry<'a, K, V, C>>,
 }
 
-impl<'a, K, V> Entry<'a, K, V> {
-    fn new(inner: base::RefEntry<'a, K, V>) -> Self {
+impl<'a, K, V, C> Entry<'a, K, V, C> {
+    fn new(inner: base::RefEntry<'a, K, V, C>) -> Self {
         Self {
             inner: ManuallyDrop::new(inner),
         }
@@ -592,7 +621,7 @@ impl<'a, K, V> Entry<'a, K, V> {
     }
 }
 
-impl<K, V> Drop for Entry<'_, K, V> {
+impl<K, V, C> Drop for Entry<'_, K, V, C> {
     fn drop(&mut self) {
         unsafe {
             ManuallyDrop::into_inner(ptr::read(&self.inner)).release_with_pin(epoch::pin);
@@ -600,9 +629,9 @@ impl<K, V> Drop for Entry<'_, K, V> {
     }
 }
 
-impl<'a, K, V> Entry<'a, K, V>
+impl<'a, K, V, C> Entry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the map.
     pub fn move_next(&mut self) -> bool {
@@ -617,21 +646,22 @@ where
     }
 
     /// Returns the next entry in the map.
-    pub fn next(&self) -> Option<Entry<'a, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 
     /// Returns the previous entry in the map.
-    pub fn prev(&self) -> Option<Entry<'a, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.prev(guard).map(Entry::new)
     }
 }
 
-impl<K, V> Entry<'_, K, V>
+impl<K, V, C> Entry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    C: Comparator<K>,
+    K: Send + 'static,
     V: Send + 'static,
 {
     /// Removes the entry from the map.
@@ -643,7 +673,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, K, V> {
+impl<K, V, C> Clone for Entry<'_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -651,7 +681,7 @@ impl<K, V> Clone for Entry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -684,39 +714,39 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 }
 
 /// An iterator over the entries of a `SkipMap`.
-pub struct Iter<'a, K, V> {
-    inner: base::RefIter<'a, K, V>,
+pub struct Iter<'a, K, V, C = BasicComparator> {
+    inner: base::RefIter<'a, K, V, C>,
 }
 
-impl<'a, K, V> Iterator for Iter<'a, K, V>
+impl<'a, K, V, C> Iterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, K, V> DoubleEndedIterator for Iter<'a, K, V>
+impl<'a, K, V, C> DoubleEndedIterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, K, V> {
+impl<K, V, C> fmt::Debug for Iter<'_, K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
-impl<K, V> Drop for Iter<'_, K, V> {
+impl<K, V, C> Drop for Iter<'_, K, V, C> {
     fn drop(&mut self) {
         let guard = &epoch::pin();
         self.inner.drop_impl(guard);
@@ -724,44 +754,45 @@ impl<K, V> Drop for Iter<'_, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipMap`.
-pub struct Range<'a, Q, R, K, V>
+pub struct Range<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    pub(crate) inner: base::RefRange<'a, Q, R, K, V>,
+    pub(crate) inner: base::RefRange<'a, Q, R, K, V, C>,
 }
 
-impl<'a, Q, R, K, V> Iterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> Iterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, Q, R, K, V> DoubleEndedIterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> DoubleEndedIterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
+    K: fmt::Debug,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -775,9 +806,9 @@ where
     }
 }
 
-impl<Q, R, K, V> Drop for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> Drop for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/src/set.rs b/crossbeam-skiplist/src/set.rs
index 4e91f6c..60072ce 100644
--- a/crossbeam-skiplist/src/set.rs
+++ b/crossbeam-skiplist/src/set.rs
@@ -5,20 +5,28 @@ use core::{
     ops::{Bound, Deref, RangeBounds},
 };
 
-use crate::{equivalent::Comparable, map};
+use crate::{
+    comparator::{BasicComparator, Comparator},
+    map,
+};
 
 /// A set based on a lock-free skip list.
 ///
 /// This is an alternative to [`BTreeSet`] which supports
 /// concurrent access across multiple threads.
 ///
+/// A custom comparator may be provided, causing all
+/// elements to be ordered by the comparison function used
+/// instead of the standard `Ord` impl. See [`Comparator`].
+///
 /// [`BTreeSet`]: std::collections::BTreeSet
-pub struct SkipSet<T> {
-    inner: map::SkipMap<T, ()>,
+/// [`Comparator`]: crate::comparator::Comparator
+pub struct SkipSet<T, C = BasicComparator> {
+    inner: map::SkipMap<T, (), C>,
 }
 
 impl<T> SkipSet<T> {
-    /// Returns a new, empty set.
+    /// Returns a new, empty set with the default comparator.
     ///
     /// # Example
     ///
@@ -32,6 +40,23 @@ impl<T> SkipSet<T> {
             inner: map::SkipMap::new(),
         }
     }
+}
+
+impl<T, C> SkipSet<T, C> {
+    /// Returns a new, empty set with the given comparator.
+    ///
+    /// # Example
+    ///
+    /// ```
+    /// use crossbeam_skiplist::{SkipSet, comparator::BasicComparator};
+    ///
+    /// let set: SkipSet<i32> = SkipSet::with_comparator(BasicComparator);
+    /// ```
+    pub fn with_comparator(comparator: C) -> Self {
+        Self {
+            inner: map::SkipMap::with_comparator(comparator),
+        }
+    }
 
     /// Returns `true` if the set is empty.
     ///
@@ -71,9 +96,9 @@ impl<T> SkipSet<T> {
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -88,7 +113,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.front().unwrap(), 1);
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, T>> {
+    pub fn front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.front().map(Entry::new)
     }
 
@@ -105,7 +130,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.back().unwrap(), 2);
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, T>> {
+    pub fn back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.back().map(Entry::new)
     }
 
@@ -122,7 +147,7 @@ where
     /// ```
     pub fn contains<Q>(&self, key: &Q) -> bool
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.contains_key(key)
@@ -139,9 +164,9 @@ where
     /// assert_eq!(*set.get(&3).unwrap(), 3);
     /// assert!(set.get(&4).is_none());
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.get(key).map(Entry::new)
@@ -171,9 +196,9 @@ where
     /// let greater_than_thirteen = set.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.lower_bound(bound).map(Entry::new)
@@ -200,9 +225,9 @@ where
     /// let less_than_six = set.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.upper_bound(bound).map(Entry::new)
@@ -219,7 +244,7 @@ where
     /// let entry = set.get_or_insert(2);
     /// assert_eq!(*entry, 2);
     /// ```
-    pub fn get_or_insert(&self, key: T) -> Entry<'_, T> {
+    pub fn get_or_insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.get_or_insert(key, ()))
     }
 
@@ -241,7 +266,7 @@ where
     /// assert_eq!(*set_iter.next().unwrap(), 12);
     /// assert!(set_iter.next().is_none());
     /// ```
-    pub fn iter(&self) -> Iter<'_, T> {
+    pub fn iter(&self) -> Iter<'_, T, C> {
         Iter {
             inner: self.inner.iter(),
         }
@@ -264,10 +289,10 @@ where
     /// assert_eq!(*set_range.next().unwrap(), 7);
     /// assert!(set_range.next().is_none());
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T, C>
     where
         R: RangeBounds<Q>,
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         Range {
@@ -276,9 +301,10 @@ where
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord + Send + 'static,
+    C: Comparator<T>,
+    T: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the set and returns the new entry.
     ///
@@ -294,7 +320,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.get(&2).unwrap(), 2);
     /// ```
-    pub fn insert(&self, key: T) -> Entry<'_, T> {
+    pub fn insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.insert(key, ()))
     }
 
@@ -313,9 +339,9 @@ where
     /// assert_eq!(*set.remove(&2).unwrap(), 2);
     /// assert!(set.remove(&2).is_none());
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.remove(key).map(Entry::new)
@@ -342,7 +368,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_front().map(Entry::new)
     }
 
@@ -367,7 +393,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_back().map(Entry::new)
     }
 
@@ -390,22 +416,26 @@ where
     }
 }
 
-impl<T> Default for SkipSet<T> {
+impl<T, C> Default for SkipSet<T, C>
+where
+    C: Default,
+{
     fn default() -> Self {
-        Self::new()
+        Self::with_comparator(Default::default())
     }
 }
 
-impl<T> fmt::Debug for SkipSet<T>
+impl<T, C> fmt::Debug for SkipSet<T, C>
 where
-    T: Ord + fmt::Debug,
+    C: Comparator<T>,
+    T: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("SkipSet { .. }")
     }
 }
 
-impl<T> IntoIterator for SkipSet<T> {
+impl<T, C> IntoIterator for SkipSet<T, C> {
     type Item = T;
     type IntoIter = IntoIter<T>;
 
@@ -416,27 +446,27 @@ impl<T> IntoIterator for SkipSet<T> {
     }
 }
 
-impl<'a, T> IntoIterator for &'a SkipSet<T>
+impl<'a, T, C> IntoIterator for &'a SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    type Item = Entry<'a, T>;
-    type IntoIter = Iter<'a, T>;
+    type Item = Entry<'a, T, C>;
+    type IntoIter = Iter<'a, T, C>;
 
-    fn into_iter(self) -> Iter<'a, T> {
+    fn into_iter(self) -> Iter<'a, T, C> {
         self.iter()
     }
 }
 
-impl<T> FromIterator<T> for SkipSet<T>
+impl<T, C> FromIterator<T> for SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T> + Default,
 {
     fn from_iter<I>(iter: I) -> Self
     where
         I: IntoIterator<Item = T>,
     {
-        let s = Self::new();
+        let s = Self::default();
         for t in iter {
             s.get_or_insert(t);
         }
@@ -445,12 +475,12 @@ where
 }
 
 /// A reference-counted entry in a set.
-pub struct Entry<'a, T> {
-    inner: map::Entry<'a, T, ()>,
+pub struct Entry<'a, T, C = BasicComparator> {
+    inner: map::Entry<'a, T, (), C>,
 }
 
-impl<'a, T> Entry<'a, T> {
-    fn new(inner: map::Entry<'a, T, ()>) -> Self {
+impl<'a, T, C> Entry<'a, T, C> {
+    fn new(inner: map::Entry<'a, T, (), C>) -> Self {
         Self { inner }
     }
 
@@ -465,9 +495,9 @@ impl<'a, T> Entry<'a, T> {
     }
 }
 
-impl<'a, T> Entry<'a, T>
+impl<'a, T, C> Entry<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
     /// Moves to the next entry in the set.
     pub fn move_next(&mut self) -> bool {
@@ -480,19 +510,20 @@ where
     }
 
     /// Returns the next entry in the set.
-    pub fn next(&self) -> Option<Entry<'a, T>> {
+    pub fn next(&self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 
     /// Returns the previous entry in the set.
-    pub fn prev(&self) -> Option<Entry<'a, T>> {
+    pub fn prev(&self) -> Option<Entry<'a, T, C>> {
         self.inner.prev().map(Entry::new)
     }
 }
 
-impl<T> Entry<'_, T>
+impl<T, C> Entry<'_, T, C>
 where
-    T: Ord + Send + 'static,
+    C: Comparator<T>,
+    T: Send + 'static,
 {
     /// Removes the entry from the set.
     ///
@@ -502,7 +533,7 @@ where
     }
 }
 
-impl<T> Clone for Entry<'_, T> {
+impl<T, C> Clone for Entry<'_, T, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -510,7 +541,7 @@ impl<T> Clone for Entry<'_, T> {
     }
 }
 
-impl<T> fmt::Debug for Entry<'_, T>
+impl<T, C> fmt::Debug for Entry<'_, T, C>
 where
     T: fmt::Debug,
 {
@@ -521,7 +552,7 @@ where
     }
 }
 
-impl<T> Deref for Entry<'_, T> {
+impl<T, C> Deref for Entry<'_, T, C> {
     type Target = T;
 
     fn deref(&self) -> &Self::Target {
@@ -549,73 +580,74 @@ impl<T> fmt::Debug for IntoIter<T> {
 }
 
 /// An iterator over the entries of a `SkipSet`.
-pub struct Iter<'a, T> {
-    inner: map::Iter<'a, T, ()>,
+pub struct Iter<'a, T, C = BasicComparator> {
+    inner: map::Iter<'a, T, (), C>,
 }
 
-impl<'a, T> Iterator for Iter<'a, T>
+impl<'a, T, C> Iterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, T> DoubleEndedIterator for Iter<'a, T>
+impl<'a, T, C> DoubleEndedIterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<T> fmt::Debug for Iter<'_, T> {
+impl<T, C> fmt::Debug for Iter<'_, T, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
 /// An iterator over a subset of entries of a `SkipSet`.
-pub struct Range<'a, Q, R, T>
+pub struct Range<'a, Q, R, T, C = BasicComparator>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    inner: map::Range<'a, Q, R, T, ()>,
+    inner: map::Range<'a, Q, R, T, (), C>,
 }
 
-impl<'a, Q, R, T> Iterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> Iterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, Q, R, T> DoubleEndedIterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> DoubleEndedIterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<Q, R, T> fmt::Debug for Range<'_, Q, R, T>
+impl<Q, R, T, C> fmt::Debug for Range<'_, Q, R, T, C>
 where
-    T: Ord + Comparable<Q> + fmt::Debug,
+    C: Comparator<T> + Comparator<T, Q>,
+    T: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
 {
```

## Runs

| agent | setup | hidden tests | lines +/- (code) | test lines | output tokens | cost |
|---|---|---|---:|---:|---:|---:|
| claude | base | pass | +474/-300 | 98 | 20,298 | $0.702 |
| claude | muffle | pass | +474/-289 | 88 | 22,044 | $0.736 |
| claude | hush | pass | +471/-284 | 139 | 19,933 | $0.664 |
| claude | sloth | pass | +399/-292 | 111 | 17,426 | $0.598 |
| claude | all | pass | +428/-283 | 79 | 22,387 | $0.715 |
| codex | base | pass | +414/-295 | 135 | 6,376 | - |
| codex | muffle | pass | +426/-301 | 139 | 7,296 | - |
| codex | hush | pass | +432/-311 | 109 | 5,855 | - |
| codex | sloth | pass | +408/-301 | 192 | 6,953 | - |
| codex | all | pass | +442/-326 | 138 | 6,289 | - |

### claude, base: pass

Files: [crossbeam-skiplist/src/base.rs](../base/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/base.rs), [crossbeam-skiplist/src/comparator.rs](../base/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/comparator.rs), [crossbeam-skiplist/src/lib.rs](../base/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/lib.rs), [crossbeam-skiplist/src/map.rs](../base/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/map.rs), [crossbeam-skiplist/src/set.rs](../base/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/set.rs), [crossbeam-skiplist/tests/comparator.rs](../base/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/tests/comparator.rs)

<details><summary>diff</summary>

```diff
diff --git a/crossbeam-skiplist/src/base.rs b/crossbeam-skiplist/src/base.rs
index a73ee8a..4e7955e 100644
--- a/crossbeam-skiplist/src/base.rs
+++ b/crossbeam-skiplist/src/base.rs
@@ -15,8 +15,8 @@ use core::{
 use crossbeam_epoch::{self as epoch, Atomic, Collector, Guard, Shared};
 use crossbeam_utils::CachePadded;
 
-use super::equivalent::Comparable;
 use crate::alloc_helper::Global;
+use crate::comparator::{BasicComparator, Comparator};
 
 /// Number of bits needed to store height.
 const HEIGHT_BITS: usize = 5;
@@ -304,7 +304,7 @@ impl<'a, K, V> NodeRef<'a, K, V> {
     /// Decrements the reference count of a node, pinning the thread and destroying the node
     /// if the count become zero.
     #[inline]
-    unsafe fn decrement_with_pin<F>(self, parent: &SkipList<K, V>, pin: F)
+    unsafe fn decrement_with_pin<C, F>(self, parent: &SkipList<K, V, C>, pin: F)
     where
         F: FnOnce() -> Guard,
     {
@@ -451,7 +451,7 @@ struct HotData {
 }
 
 /// A lock-free skip list.
-// TODO(stjepang): Embed a custom `epoch::Collector` inside `SkipList<K, V>`. Instead of adding
+// TODO(stjepang): Embed a custom `epoch::Collector` inside `SkipList<K, V, C>`. Instead of adding
 // garbage to the default global collector, we should add it to a local collector tied to the
 // particular skip list instance.
 //
@@ -463,26 +463,37 @@ struct HotData {
 // As a further future optimization, if `!mem::needs_drop::<K>() && !mem::needs_drop::<V>()`
 // (neither key nor the value have destructors), there's no point in creating a new local
 // collector, so we should simply use the global one.
-pub struct SkipList<K, V> {
+pub struct SkipList<K, V, C = BasicComparator> {
     /// The head of the skip list (just a dummy node, not a real entry).
     head: Head<K, V>,
 
     /// The `Collector` associated with this skip list.
     collector: Collector,
 
+    /// The comparator that defines the ordering of keys.
+    comparator: C,
+
     /// Hot data associated with the skip list, stored in a dedicated cache line.
     hot_data: CachePadded<HotData>,
 }
 
-unsafe impl<K: Send + Sync, V: Send + Sync> Send for SkipList<K, V> {}
-unsafe impl<K: Send + Sync, V: Send + Sync> Sync for SkipList<K, V> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C> Send for SkipList<K, V, C> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C> Sync for SkipList<K, V, C> {}
 
-impl<K, V> SkipList<K, V> {
-    /// Returns a new, empty skip list.
+impl<K, V> SkipList<K, V, BasicComparator> {
+    /// Returns a new, empty skip list ordered by the keys' `Ord` implementation.
     pub fn new(collector: Collector) -> Self {
+        Self::with_comparator(collector, BasicComparator)
+    }
+}
+
+impl<K, V, C> SkipList<K, V, C> {
+    /// Returns a new, empty skip list that orders its keys with `comparator`.
+    pub fn with_comparator(collector: Collector, comparator: C) -> Self {
         Self {
             head: Head::new(),
             collector,
+            comparator,
             hot_data: CachePadded::new(HotData {
                 seed: AtomicUsize::new(1),
                 len: AtomicUsize::new(0),
@@ -517,12 +528,12 @@ impl<K, V> SkipList<K, V> {
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Returns the entry with the smallest key.
-    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.next_node(self.head.as_tower(), Bound::Unbounded, guard)?;
         Some(Entry {
@@ -533,7 +544,7 @@ where
     }
 
     /// Returns the entry with the largest key.
-    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.search_bound::<K>(Bound::Unbounded, true, guard)?;
         Some(Entry {
@@ -546,21 +557,21 @@ where
     /// Returns `true` if the map contains a value for the specified key.
     pub fn contains_key<Q>(&self, key: &Q, guard: &Guard) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.get(key, guard).is_some()
     }
 
     /// Returns an entry with the specified `key`.
-    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>>
+    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
         let n = self.search_bound(Bound::Included(key), false, guard)?;
-        if !n.key.equivalent(key) {
+        if !self.comparator.equivalent(&n.key, key) {
             return None;
         }
 
@@ -578,9 +589,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -599,9 +610,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -614,7 +625,7 @@ where
     }
 
     /// Finds an entry with the specified key, or inserts a new `key`-`value` pair if none exist.
-    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| false, guard)
     }
 
@@ -626,7 +637,7 @@ where
     /// discarded. If closure is modifying some other state (such as shared counters or shared
     /// objects), it may lead to <u>undesired behaviour</u> such as counters being changed without
     /// result of closure inserted
-    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -634,7 +645,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V> {
+    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V, C> {
         self.check_guard(guard);
         Iter {
             parent: self,
@@ -645,7 +656,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn ref_iter(&self) -> RefIter<'_, K, V> {
+    pub fn ref_iter(&self) -> RefIter<'_, K, V, C> {
         RefIter {
             parent: self,
             head: None,
@@ -658,9 +669,9 @@ where
         &'a self,
         range: R,
         guard: &'g Guard,
-    ) -> Range<'a, 'g, Q, R, K, V>
+    ) -> Range<'a, 'g, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -677,9 +688,9 @@ where
 
     /// Returns an iterator over a subset of entries in the skip list.
     #[allow(clippy::needless_lifetimes)]
-    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V>
+    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -825,7 +836,7 @@ where
         guard: &'a Guard,
     ) -> Option<NodeRef<'a, K, V>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -887,11 +898,11 @@ where
                         // bound, we return the last node before the condition became true. For the
                         // lower bound, we return the first node after the condition became true.
                         if upper_bound {
-                            if !below_upper_bound(&bound, &c.key) {
+                            if !below_upper_bound(&self.comparator, &bound, &c.key) {
                                 break;
                             }
                             result = Some(c);
-                        } else if above_lower_bound(&bound, &c.key) {
+                        } else if above_lower_bound(&self.comparator, &bound, &c.key) {
                             result = Some(c);
                             break;
                         }
@@ -910,7 +921,7 @@ where
     /// Searches for a key in the skip list and returns a list of all adjacent nodes.
     fn search_position<'a, Q>(&'a self, key: &Q, guard: &'a Guard) -> Position<'a, K, V>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -971,7 +982,7 @@ where
 
                         // If `curr` contains a key that is greater than or equal to `key`, we're
                         // done with this level.
-                        match c.key.compare(key) {
+                        match self.comparator.compare(&c.key, key) {
                             cmp::Ordering::Greater => break,
                             cmp::Ordering::Equal => {
                                 result.found = Some(c);
@@ -1004,7 +1015,7 @@ where
         value: F,
         replace: CompareF,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
         CompareF: Fn(&V) -> bool,
@@ -1155,7 +1166,10 @@ where
                     // the tower without breaking any invariants. Note that building higher levels
                     // is completely optional. Only the lowest level really matters, and all the
                     // higher levels are there just to make searching faster.
-                    if succ.as_ref().map(|s| &s.key) == Some(&n.key) {
+                    if succ
+                        .as_ref()
+                        .is_some_and(|s| self.comparator.equivalent(&s.key, &n.key))
+                    {
                         search = self.search_position(&n.key, guard);
                         continue;
                     }
@@ -1218,16 +1232,17 @@ where
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the skip list and returns the new entry.
     ///
     /// If there is an existing entry with this key, it will be removed before inserting the new
     /// one.
-    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| true, guard)
     }
 
@@ -1242,7 +1257,7 @@ where
         value: V,
         compare_fn: F,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -1250,9 +1265,9 @@ where
     }
 
     /// Removes an entry with the specified `key` from the map and returns it.
-    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -1320,7 +1335,7 @@ where
     }
 
     /// Removes an entry from the front of the skip list.
-    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.front(guard)?;
@@ -1335,7 +1350,7 @@ where
     }
 
     /// Removes an entry from the back of the skip list.
-    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.back(guard)?;
@@ -1393,7 +1408,7 @@ where
     }
 }
 
-impl<K, V> Drop for SkipList<K, V> {
+impl<K, V, C> Drop for SkipList<K, V, C> {
     fn drop(&mut self) {
         unsafe {
             let mut node = NodeRef::from_shared(
@@ -1419,9 +1434,9 @@ impl<K, V> Drop for SkipList<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipList<K, V>
+impl<K, V, C> fmt::Debug for SkipList<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -1429,7 +1444,7 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipList<K, V> {
+impl<K, V, C> IntoIterator for SkipList<K, V, C> {
     type Item = (K, V);
     type IntoIter = IntoIter<K, V>;
 
@@ -1464,13 +1479,13 @@ impl<K, V> IntoIterator for SkipList<K, V> {
 /// The lifetimes of the key and value are the same as that of the `Guard`
 /// used when creating the `Entry` (`'g`). This lifetime is also constrained to
 /// not outlive the `SkipList`.
-pub struct Entry<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Entry<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'g, K, V>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Entry<'a, 'g, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1487,7 +1502,7 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1496,14 +1511,15 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     ///
     /// This method may return `None` if the reference count is already 0 and
     /// the node has been queued for deletion.
-    pub fn pin(&self) -> Option<RefEntry<'a, K, V>> {
+    pub fn pin(&self) -> Option<RefEntry<'a, K, V, C>> {
         unsafe { RefEntry::try_acquire(self.parent, self.node) }
     }
 }
 
-impl<K, V> Entry<'_, '_, K, V>
+impl<K, V, C> Entry<'_, '_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1526,7 +1542,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, '_, K, V> {
+impl<K, V, C> Clone for Entry<'_, '_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             parent: self.parent,
@@ -1536,7 +1552,7 @@ impl<K, V> Clone for Entry<'_, '_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1549,9 +1565,9 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K, V> Entry<'a, 'g, K, V>
+impl<'a: 'g, 'g, K, V, C> Entry<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self) -> bool {
@@ -1565,7 +1581,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self.parent.next_node(
             self.node.as_tower(),
             Bound::Excluded(&self.node.key),
@@ -1590,7 +1606,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self
             .parent
             .search_bound(Bound::Excluded(&self.node.key), true, self.guard)?;
@@ -1606,12 +1622,12 @@ where
 ///
 /// You *must* call `release` to free this type, otherwise the node will be
 /// leaked. This is because releasing the entry requires a `Guard`.
-pub struct RefEntry<'a, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct RefEntry<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'a, K, V>,
 }
 
-impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefEntry<'a, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1628,7 +1644,7 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1650,9 +1666,9 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     /// Tries to create a new `RefEntry` by incrementing the reference count of
     /// a node.
     unsafe fn try_acquire(
-        parent: &'a SkipList<K, V>,
+        parent: &'a SkipList<K, V, C>,
         node: NodeRef<'_, K, V>,
-    ) -> Option<RefEntry<'a, K, V>> {
+    ) -> Option<RefEntry<'a, K, V, C>> {
         if unsafe { node.try_increment() } {
             Some(RefEntry {
                 parent,
@@ -1667,9 +1683,10 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 }
 
-impl<K, V> RefEntry<'_, K, V>
+impl<K, V, C> RefEntry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1694,7 +1711,7 @@ where
     }
 }
 
-impl<K, V> Clone for RefEntry<'_, K, V> {
+impl<K, V, C> Clone for RefEntry<'_, K, V, C> {
     fn clone(&self) -> Self {
         unsafe {
             // Incrementing will always succeed since we're already holding a reference to the node.
@@ -1707,7 +1724,7 @@ impl<K, V> Clone for RefEntry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for RefEntry<'_, K, V>
+impl<K, V, C> fmt::Debug for RefEntry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1720,9 +1737,9 @@ where
     }
 }
 
-impl<'a, K, V> RefEntry<'a, K, V>
+impl<'a, K, V, C> RefEntry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self, guard: &Guard) -> bool {
@@ -1736,7 +1753,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1763,7 +1780,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1780,20 +1797,20 @@ where
 }
 
 /// An iterator over the entries of a `SkipList`.
-pub struct Iter<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Iter<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Iterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Iterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1804,7 +1821,7 @@ where
             }
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1817,11 +1834,11 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> DoubleEndedIterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> DoubleEndedIterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -1831,7 +1848,7 @@ where
                 .search_bound::<K>(Bound::Unbounded, true, self.guard),
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1844,7 +1861,7 @@ where
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Iter<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1858,13 +1875,13 @@ where
 }
 
 /// An iterator over reference-counted entries of a `SkipList`.
-pub struct RefIter<'a, K, V> {
-    parent: &'a SkipList<K, V>,
-    head: Option<RefEntry<'a, K, V>>,
-    tail: Option<RefEntry<'a, K, V>>,
+pub struct RefIter<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
+    head: Option<RefEntry<'a, K, V, C>>,
+    tail: Option<RefEntry<'a, K, V, C>>,
 }
 
-impl<K, V> fmt::Debug for RefIter<'_, K, V>
+impl<K, V, C> fmt::Debug for RefIter<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1883,12 +1900,12 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V>
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match &self.head {
             Some(e) => e.next(guard),
@@ -1896,7 +1913,9 @@ where
         };
         match (&next_head, &self.tail) {
             // The next key is larger than the latest tail key we observed with this iterator.
-            (Some(ref next), Some(t)) if next.key() >= t.key() => {
+            (Some(ref next), Some(t))
+                if self.parent.comparator.compare(next.key(), t.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1915,7 +1934,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match &self.tail {
             Some(e) => e.prev(guard),
@@ -1923,7 +1942,9 @@ where
         };
         match (&self.head, &next_tail) {
             // The prev key is smaller than the latest head key we observed with this iterator.
-            (Some(h), Some(next)) if h.key() >= next.key() => {
+            (Some(h), Some(next))
+                if self.parent.comparator.compare(h.key(), next.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1942,7 +1963,7 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C> {
     /// Decrements the reference count of `RefEntry` owned by the iterator.
     pub fn drop_impl(&mut self, guard: &Guard) {
         self.parent.check_guard(guard);
@@ -1956,13 +1977,13 @@ impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipList`.
-pub struct Range<'a: 'g, 'g, Q, R, K, V>
+pub struct Range<'a: 'g, 'g, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     range: R,
@@ -1970,15 +1991,15 @@ where
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> Iterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> Iterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1991,14 +2012,14 @@ where
             match self.tail {
                 Some(t) => {
                     let bound = Bound::Excluded(&t.as_ref().key);
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2013,13 +2034,13 @@ where
     }
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -2032,14 +2053,14 @@ where
             match self.head {
                 Some(h) => {
                     let bound = Bound::Excluded(&h.as_ref().key);
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2054,9 +2075,10 @@ where
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, '_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, '_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2071,38 +2093,39 @@ where
 }
 
 /// An iterator over reference-counted subset of entries of a `SkipList`.
-pub struct RefRange<'a, Q, R, K, V>
+pub struct RefRange<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
-    pub(crate) head: Option<RefEntry<'a, K, V>>,
-    pub(crate) tail: Option<RefEntry<'a, K, V>>,
+    parent: &'a SkipList<K, V, C>,
+    pub(crate) head: Option<RefEntry<'a, K, V, C>>,
+    pub(crate) tail: Option<RefEntry<'a, K, V, C>>,
     pub(crate) range: R,
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-unsafe impl<Q, R, K, V> Send for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C> Send for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-unsafe impl<Q, R, K, V> Sync for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C> Sync for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-impl<Q, R, K, V> fmt::Debug for RefRange<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2116,14 +2139,14 @@ where
     }
 }
 
-impl<'a, Q, R, K: 'a, V: 'a> RefRange<'a, Q, R, K, V>
+impl<'a, Q, R, K: 'a, V: 'a, C> RefRange<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match self.head {
             Some(ref e) => e.next(guard),
@@ -2134,7 +2157,7 @@ where
             match self.tail {
                 Some(ref t) => {
                     let bound = Bound::Excluded(t.key());
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2150,7 +2173,7 @@ where
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2171,7 +2194,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match self.tail {
             Some(ref e) => e.prev(guard),
@@ -2182,7 +2205,7 @@ where
             match self.head {
                 Some(ref h) => {
                     let bound = Bound::Excluded(h.key());
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2198,7 +2221,7 @@ where
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2307,9 +2330,9 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 
 /// Helper function to retry an operation until pinning succeeds or `None` is
 /// returned.
-pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V>(mut f: F) -> Option<RefEntry<'a, K, V>>
+pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V, C>(mut f: F) -> Option<RefEntry<'a, K, V, C>>
 where
-    F: FnMut() -> Option<Entry<'a, 'g, K, V>>,
+    F: FnMut() -> Option<Entry<'a, 'g, K, V, C>>,
 {
     loop {
         if let Some(e) = f()?.pin() {
@@ -2319,27 +2342,27 @@ where
 }
 
 /// Helper function to check if a value is above a lower bound
-fn above_lower_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn above_lower_bound<V, T, C>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_ge(),
-        Bound::Excluded(key) => other.compare(key).is_gt(),
+        Bound::Included(key) => comparator.compare(other, key).is_ge(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_gt(),
     }
 }
 
 /// Helper function to check if a value is below an upper bound
-fn below_upper_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn below_upper_bound<V, T, C>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_le(),
-        Bound::Excluded(key) => other.compare(key).is_lt(),
+        Bound::Included(key) => comparator.compare(other, key).is_le(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_lt(),
     }
 }
diff --git a/crossbeam-skiplist/src/comparator.rs b/crossbeam-skiplist/src/comparator.rs
new file mode 100644
index 0000000..e2cfa5e
--- /dev/null
+++ b/crossbeam-skiplist/src/comparator.rs
@@ -0,0 +1,53 @@
+//! Runtime-selectable key orderings for skip lists.
+//!
+//! By default a skip list orders its keys with their [`Ord`] implementation, through
+//! [`BasicComparator`]. Supplying a different [`Comparator`] (for instance one that ignores
+//! case, or one that wraps a boxed closure) lets the ordering be chosen at runtime.
+//!
+//! A comparator must define a total order that is consistent with its [`Equivalator`]
+//! implementation: `equivalent(a, b)` must hold exactly when `compare(a, b)` is
+//! [`Ordering::Equal`]. When the stored key type and the query type differ, comparisons in both
+//! directions must agree with the ordering on stored keys.
+
+use core::cmp::Ordering;
+
+use crate::equivalent::{Comparable, Equivalent};
+
+/// Decides whether two values are equivalent.
+pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
+    /// Returns `true` if `lhs` and `rhs` are equivalent.
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
+}
+
+/// Defines a total order between two values.
+pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
+    /// Compares `lhs` with `rhs`.
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
+}
+
+/// The comparator that orders keys by their [`Ord`] implementation.
+///
+/// This is the default comparator of skip lists. It is implemented through the crate's
+/// [`Equivalent`] and [`Comparable`] traits.
+#[derive(Clone, Copy, Debug, Default)]
+pub struct BasicComparator;
+
+impl<L: ?Sized, R: ?Sized> Equivalator<L, R> for BasicComparator
+where
+    L: Equivalent<R>,
+{
+    #[inline]
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
+        lhs.equivalent(rhs)
+    }
+}
+
+impl<L: ?Sized, R: ?Sized> Comparator<L, R> for BasicComparator
+where
+    L: Comparable<R>,
+{
+    #[inline]
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
+        lhs.compare(rhs)
+    }
+}
diff --git a/crossbeam-skiplist/src/lib.rs b/crossbeam-skiplist/src/lib.rs
index 5ff8e74..5337e3d 100644
--- a/crossbeam-skiplist/src/lib.rs
+++ b/crossbeam-skiplist/src/lib.rs
@@ -265,4 +265,5 @@ pub mod set;
 #[doc(inline)]
 pub use crate::{map::SkipMap, set::SkipSet};
 
+pub mod comparator;
 pub mod equivalent;
diff --git a/crossbeam-skiplist/src/map.rs b/crossbeam-skiplist/src/map.rs
index c7c5408..bf685c4 100644
--- a/crossbeam-skiplist/src/map.rs
+++ b/crossbeam-skiplist/src/map.rs
@@ -11,7 +11,7 @@ use crossbeam_epoch as epoch;
 
 use crate::{
     base::{self, try_pin_loop},
-    equivalent::Comparable,
+    comparator::{BasicComparator, Comparator},
 };
 
 /// An ordered map based on a lock-free skip list.
@@ -20,12 +20,12 @@ use crate::{
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeMap`]: std::collections::BTreeMap
-pub struct SkipMap<K, V> {
-    inner: base::SkipList<K, V>,
+pub struct SkipMap<K, V, C = BasicComparator> {
+    inner: base::SkipList<K, V, C>,
 }
 
-impl<K, V> SkipMap<K, V> {
-    /// Returns a new, empty map.
+impl<K, V> SkipMap<K, V, BasicComparator> {
+    /// Returns a new, empty map ordered by the keys' `Ord` implementation.
     ///
     /// # Example
     ///
@@ -35,8 +35,58 @@ impl<K, V> SkipMap<K, V> {
     /// let map: SkipMap<i32, &str> = SkipMap::new();
     /// ```
     pub fn new() -> Self {
+        Self::with_comparator(BasicComparator)
+    }
+}
+
+impl<K, V, C> SkipMap<K, V, C> {
+    /// Returns a new, empty map that orders its keys with `comparator`.
+    ///
+    /// # Example
+    ///
+    /// ```
+    /// use std::cmp::Ordering;
+    /// use crossbeam_skiplist::{
+    ///     SkipMap,
+    ///     comparator::{Comparator, Equivalator},
+    /// };
+    ///
+    /// struct IgnoreCase;
+    ///
+    /// impl Equivalator<String, str> for IgnoreCase {
+    ///     fn equivalent(&self, lhs: &String, rhs: &str) -> bool {
+    ///         lhs.eq_ignore_ascii_case(rhs)
+    ///     }
+    /// }
+    ///
+    /// impl Comparator<String, str> for IgnoreCase {
+    ///     fn compare(&self, lhs: &String, rhs: &str) -> Ordering {
+    ///         let l = lhs.bytes().map(|b| b.to_ascii_lowercase());
+    ///         l.cmp(rhs.bytes().map(|b| b.to_ascii_lowercase()))
+    ///     }
+    /// }
+    ///
+    /// impl Equivalator<String> for IgnoreCase {
+    ///     fn equivalent(&self, lhs: &String, rhs: &String) -> bool {
+    ///         lhs.eq_ignore_ascii_case(rhs)
+    ///     }
+    /// }
+    ///
+    /// impl Comparator<String> for IgnoreCase {
+    ///     fn compare(&self, lhs: &String, rhs: &String) -> Ordering {
+    ///         self.compare(lhs, rhs.as_str())
+    ///     }
+    /// }
+    ///
+    /// let map = SkipMap::<String, u32, _>::with_comparator(IgnoreCase);
+    /// map.insert("abc".to_string(), 1);
+    /// map.insert("ABC".to_string(), 2);
+    /// assert_eq!(map.len(), 1);
+    /// assert_eq!(*map.get("aBc").unwrap().value(), 2);
+    /// ```
+    pub fn with_comparator(comparator: C) -> Self {
         Self {
-            inner: base::SkipList::new(epoch::default_collector().clone()),
+            inner: base::SkipList::with_comparator(epoch::default_collector().clone(), comparator),
         }
     }
 
@@ -80,9 +130,9 @@ impl<K, V> SkipMap<K, V> {
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -99,7 +149,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.front().unwrap().value(), "five");
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.front(guard)).map(Entry::new)
     }
@@ -119,7 +169,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.back().unwrap().value(), "six");
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.back(guard)).map(Entry::new)
     }
@@ -138,7 +188,7 @@ where
     /// ```
     pub fn contains_key<Q>(&self, key: &Q) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -160,9 +210,9 @@ where
     /// numbers.insert("six", 6);
     /// assert_eq!(*numbers.get("six").unwrap().value(), 6);
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -195,9 +245,9 @@ where
     /// let greater_than_thirteen = numbers.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -227,9 +277,9 @@ where
     /// let less_than_six = numbers.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -253,7 +303,7 @@ where
     /// let jobs_age = ages.get_or_insert("Steve Jobs", -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.get_or_insert(key, value, guard))
     }
@@ -283,7 +333,7 @@ where
     /// let jobs_age = ages.get_or_insert_with("Steve Jobs", || -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -313,7 +363,7 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn iter(&self) -> Iter<'_, K, V> {
+    pub fn iter(&self) -> Iter<'_, K, V, C> {
         Iter {
             inner: self.inner.ref_iter(),
         }
@@ -340,10 +390,10 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V, C>
     where
         R: RangeBounds<Q>,
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         Range {
@@ -352,9 +402,10 @@ where
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the map and returns the new entry.
@@ -374,7 +425,7 @@ where
     ///
     /// assert_eq!(*map.get("key").unwrap().value(), "value");
     /// ```
-    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.insert(key, value, guard))
     }
@@ -401,7 +452,7 @@ where
     /// map.compare_insert("absent_key", 0, |_| false);
     /// assert_eq!(*map.get("absent_key").unwrap().value(), 0);
     /// ```
-    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V>
+    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -427,9 +478,9 @@ where
     /// map.insert("key", "value");
     /// assert_eq!(*map.remove("key").unwrap().value(), "value");
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -458,7 +509,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_front(guard).map(Entry::new)
     }
@@ -485,7 +536,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_back(guard).map(Entry::new)
     }
@@ -509,15 +560,15 @@ where
     }
 }
 
-impl<K, V> Default for SkipMap<K, V> {
+impl<K, V, C: Default> Default for SkipMap<K, V, C> {
     fn default() -> Self {
-        Self::new()
+        Self::with_comparator(C::default())
     }
 }
 
-impl<K, V> fmt::Debug for SkipMap<K, V>
+impl<K, V, C> fmt::Debug for SkipMap<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -525,7 +576,7 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipMap<K, V> {
+impl<K, V, C> IntoIterator for SkipMap<K, V, C> {
     type Item = (K, V);
     type IntoIter = IntoIter<K, V>;
 
@@ -536,27 +587,27 @@ impl<K, V> IntoIterator for SkipMap<K, V> {
     }
 }
 
-impl<'a, K, V> IntoIterator for &'a SkipMap<K, V>
+impl<'a, K, V, C> IntoIterator for &'a SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, K, V>;
-    type IntoIter = Iter<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
+    type IntoIter = Iter<'a, K, V, C>;
 
-    fn into_iter(self) -> Iter<'a, K, V> {
+    fn into_iter(self) -> Iter<'a, K, V, C> {
         self.iter()
     }
 }
 
-impl<K, V> FromIterator<(K, V)> for SkipMap<K, V>
+impl<K, V, C> FromIterator<(K, V)> for SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K> + Default,
 {
     fn from_iter<I>(iter: I) -> Self
     where
         I: IntoIterator<Item = (K, V)>,
     {
-        let s = Self::new();
+        let s = Self::with_comparator(C::default());
         for (k, v) in iter {
             s.get_or_insert(k, v);
         }
@@ -565,12 +616,12 @@ where
 }
 
 /// A reference-counted entry in a map.
-pub struct Entry<'a, K, V> {
-    inner: ManuallyDrop<base::RefEntry<'a, K, V>>,
+pub struct Entry<'a, K, V, C = BasicComparator> {
+    inner: ManuallyDrop<base::RefEntry<'a, K, V, C>>,
 }
 
-impl<'a, K, V> Entry<'a, K, V> {
-    fn new(inner: base::RefEntry<'a, K, V>) -> Self {
+impl<'a, K, V, C> Entry<'a, K, V, C> {
+    fn new(inner: base::RefEntry<'a, K, V, C>) -> Self {
         Self {
             inner: ManuallyDrop::new(inner),
         }
@@ -592,7 +643,7 @@ impl<'a, K, V> Entry<'a, K, V> {
     }
 }
 
-impl<K, V> Drop for Entry<'_, K, V> {
+impl<K, V, C> Drop for Entry<'_, K, V, C> {
     fn drop(&mut self) {
         unsafe {
             ManuallyDrop::into_inner(ptr::read(&self.inner)).release_with_pin(epoch::pin);
@@ -600,9 +651,9 @@ impl<K, V> Drop for Entry<'_, K, V> {
     }
 }
 
-impl<'a, K, V> Entry<'a, K, V>
+impl<'a, K, V, C> Entry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the map.
     pub fn move_next(&mut self) -> bool {
@@ -617,21 +668,22 @@ where
     }
 
     /// Returns the next entry in the map.
-    pub fn next(&self) -> Option<Entry<'a, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 
     /// Returns the previous entry in the map.
-    pub fn prev(&self) -> Option<Entry<'a, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.prev(guard).map(Entry::new)
     }
 }
 
-impl<K, V> Entry<'_, K, V>
+impl<K, V, C> Entry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the map.
@@ -643,7 +695,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, K, V> {
+impl<K, V, C> Clone for Entry<'_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -651,7 +703,7 @@ impl<K, V> Clone for Entry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -684,39 +736,39 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 }
 
 /// An iterator over the entries of a `SkipMap`.
-pub struct Iter<'a, K, V> {
-    inner: base::RefIter<'a, K, V>,
+pub struct Iter<'a, K, V, C = BasicComparator> {
+    inner: base::RefIter<'a, K, V, C>,
 }
 
-impl<'a, K, V> Iterator for Iter<'a, K, V>
+impl<'a, K, V, C> Iterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, K, V> DoubleEndedIterator for Iter<'a, K, V>
+impl<'a, K, V, C> DoubleEndedIterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, K, V> {
+impl<K, V, C> fmt::Debug for Iter<'_, K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
-impl<K, V> Drop for Iter<'_, K, V> {
+impl<K, V, C> Drop for Iter<'_, K, V, C> {
     fn drop(&mut self) {
         let guard = &epoch::pin();
         self.inner.drop_impl(guard);
@@ -724,44 +776,45 @@ impl<K, V> Drop for Iter<'_, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipMap`.
-pub struct Range<'a, Q, R, K, V>
+pub struct Range<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    pub(crate) inner: base::RefRange<'a, Q, R, K, V>,
+    pub(crate) inner: base::RefRange<'a, Q, R, K, V, C>,
 }
 
-impl<'a, Q, R, K, V> Iterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> Iterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, Q, R, K, V> DoubleEndedIterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> DoubleEndedIterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -775,9 +828,9 @@ where
     }
 }
 
-impl<Q, R, K, V> Drop for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> Drop for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/src/set.rs b/crossbeam-skiplist/src/set.rs
index 4e91f6c..b4fa6c2 100644
--- a/crossbeam-skiplist/src/set.rs
+++ b/crossbeam-skiplist/src/set.rs
@@ -5,7 +5,10 @@ use core::{
     ops::{Bound, Deref, RangeBounds},
 };
 
-use crate::{equivalent::Comparable, map};
+use crate::{
+    comparator::{BasicComparator, Comparator},
+    map,
+};
 
 /// A set based on a lock-free skip list.
 ///
@@ -13,12 +16,12 @@ use crate::{equivalent::Comparable, map};
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeSet`]: std::collections::BTreeSet
-pub struct SkipSet<T> {
-    inner: map::SkipMap<T, ()>,
+pub struct SkipSet<T, C = BasicComparator> {
+    inner: map::SkipMap<T, (), C>,
 }
 
-impl<T> SkipSet<T> {
-    /// Returns a new, empty set.
+impl<T> SkipSet<T, BasicComparator> {
+    /// Returns a new, empty set ordered by the elements' `Ord` implementation.
     ///
     /// # Example
     ///
@@ -28,8 +31,46 @@ impl<T> SkipSet<T> {
     /// let set: SkipSet<i32> = SkipSet::new();
     /// ```
     pub fn new() -> Self {
+        Self::with_comparator(BasicComparator)
+    }
+}
+
+impl<T, C> SkipSet<T, C> {
+    /// Returns a new, empty set that orders its elements with `comparator`.
+    ///
+    /// # Example
+    ///
+    /// ```
+    /// use std::cmp::Ordering;
+    /// use crossbeam_skiplist::{
+    ///     SkipSet,
+    ///     comparator::{Comparator, Equivalator},
+    /// };
+    ///
+    /// struct Reverse;
+    ///
+    /// impl Equivalator<i32> for Reverse {
+    ///     fn equivalent(&self, lhs: &i32, rhs: &i32) -> bool {
+    ///         lhs == rhs
+    ///     }
+    /// }
+    ///
+    /// impl Comparator<i32> for Reverse {
+    ///     fn compare(&self, lhs: &i32, rhs: &i32) -> Ordering {
+    ///         rhs.cmp(lhs)
+    ///     }
+    /// }
+    ///
+    /// let set = SkipSet::with_comparator(Reverse);
+    /// set.insert(1);
+    /// set.insert(3);
+    /// set.insert(2);
+    /// let items: Vec<i32> = set.iter().map(|e| *e.value()).collect();
+    /// assert_eq!(items, [3, 2, 1]);
+    /// ```
+    pub fn with_comparator(comparator: C) -> Self {
         Self {
-            inner: map::SkipMap::new(),
+            inner: map::SkipMap::with_comparator(comparator),
         }
     }
 
@@ -71,9 +112,9 @@ impl<T> SkipSet<T> {
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -88,7 +129,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.front().unwrap(), 1);
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, T>> {
+    pub fn front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.front().map(Entry::new)
     }
 
@@ -105,7 +146,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.back().unwrap(), 2);
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, T>> {
+    pub fn back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.back().map(Entry::new)
     }
 
@@ -122,7 +163,7 @@ where
     /// ```
     pub fn contains<Q>(&self, key: &Q) -> bool
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.contains_key(key)
@@ -139,9 +180,9 @@ where
     /// assert_eq!(*set.get(&3).unwrap(), 3);
     /// assert!(set.get(&4).is_none());
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.get(key).map(Entry::new)
@@ -171,9 +212,9 @@ where
     /// let greater_than_thirteen = set.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.lower_bound(bound).map(Entry::new)
@@ -200,9 +241,9 @@ where
     /// let less_than_six = set.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.upper_bound(bound).map(Entry::new)
@@ -219,7 +260,7 @@ where
     /// let entry = set.get_or_insert(2);
     /// assert_eq!(*entry, 2);
     /// ```
-    pub fn get_or_insert(&self, key: T) -> Entry<'_, T> {
+    pub fn get_or_insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.get_or_insert(key, ()))
     }
 
@@ -241,7 +282,7 @@ where
     /// assert_eq!(*set_iter.next().unwrap(), 12);
     /// assert!(set_iter.next().is_none());
     /// ```
-    pub fn iter(&self) -> Iter<'_, T> {
+    pub fn iter(&self) -> Iter<'_, T, C> {
         Iter {
             inner: self.inner.iter(),
         }
@@ -264,10 +305,10 @@ where
     /// assert_eq!(*set_range.next().unwrap(), 7);
     /// assert!(set_range.next().is_none());
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T, C>
     where
         R: RangeBounds<Q>,
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         Range {
@@ -276,9 +317,10 @@ where
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T>,
 {
     /// Inserts a `key`-`value` pair into the set and returns the new entry.
     ///
@@ -294,7 +336,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.get(&2).unwrap(), 2);
     /// ```
-    pub fn insert(&self, key: T) -> Entry<'_, T> {
+    pub fn insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.insert(key, ()))
     }
 
@@ -313,9 +355,9 @@ where
     /// assert_eq!(*set.remove(&2).unwrap(), 2);
     /// assert!(set.remove(&2).is_none());
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.remove(key).map(Entry::new)
@@ -342,7 +384,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_front().map(Entry::new)
     }
 
@@ -367,7 +409,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_back().map(Entry::new)
     }
 
@@ -390,22 +432,22 @@ where
     }
 }
 
-impl<T> Default for SkipSet<T> {
+impl<T, C: Default> Default for SkipSet<T, C> {
     fn default() -> Self {
-        Self::new()
+        Self::with_comparator(C::default())
     }
 }
 
-impl<T> fmt::Debug for SkipSet<T>
+impl<T, C> fmt::Debug for SkipSet<T, C>
 where
-    T: Ord + fmt::Debug,
+    T: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("SkipSet { .. }")
     }
 }
 
-impl<T> IntoIterator for SkipSet<T> {
+impl<T, C> IntoIterator for SkipSet<T, C> {
     type Item = T;
     type IntoIter = IntoIter<T>;
 
@@ -416,27 +458,27 @@ impl<T> IntoIterator for SkipSet<T> {
     }
 }
 
-impl<'a, T> IntoIterator for &'a SkipSet<T>
+impl<'a, T, C> IntoIterator for &'a SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    type Item = Entry<'a, T>;
-    type IntoIter = Iter<'a, T>;
+    type Item = Entry<'a, T, C>;
+    type IntoIter = Iter<'a, T, C>;
 
-    fn into_iter(self) -> Iter<'a, T> {
+    fn into_iter(self) -> Iter<'a, T, C> {
         self.iter()
     }
 }
 
-impl<T> FromIterator<T> for SkipSet<T>
+impl<T, C> FromIterator<T> for SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T> + Default,
 {
     fn from_iter<I>(iter: I) -> Self
     where
         I: IntoIterator<Item = T>,
     {
-        let s = Self::new();
+        let s = Self::with_comparator(C::default());
         for t in iter {
             s.get_or_insert(t);
         }
@@ -445,12 +487,12 @@ where
 }
 
 /// A reference-counted entry in a set.
-pub struct Entry<'a, T> {
-    inner: map::Entry<'a, T, ()>,
+pub struct Entry<'a, T, C = BasicComparator> {
+    inner: map::Entry<'a, T, (), C>,
 }
 
-impl<'a, T> Entry<'a, T> {
-    fn new(inner: map::Entry<'a, T, ()>) -> Self {
+impl<'a, T, C> Entry<'a, T, C> {
+    fn new(inner: map::Entry<'a, T, (), C>) -> Self {
         Self { inner }
     }
 
@@ -465,9 +507,9 @@ impl<'a, T> Entry<'a, T> {
     }
 }
 
-impl<'a, T> Entry<'a, T>
+impl<'a, T, C> Entry<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
     /// Moves to the next entry in the set.
     pub fn move_next(&mut self) -> bool {
@@ -480,19 +522,20 @@ where
     }
 
     /// Returns the next entry in the set.
-    pub fn next(&self) -> Option<Entry<'a, T>> {
+    pub fn next(&self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 
     /// Returns the previous entry in the set.
-    pub fn prev(&self) -> Option<Entry<'a, T>> {
+    pub fn prev(&self) -> Option<Entry<'a, T, C>> {
         self.inner.prev().map(Entry::new)
     }
 }
 
-impl<T> Entry<'_, T>
+impl<T, C> Entry<'_, T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T>,
 {
     /// Removes the entry from the set.
     ///
@@ -502,7 +545,7 @@ where
     }
 }
 
-impl<T> Clone for Entry<'_, T> {
+impl<T, C> Clone for Entry<'_, T, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -510,7 +553,7 @@ impl<T> Clone for Entry<'_, T> {
     }
 }
 
-impl<T> fmt::Debug for Entry<'_, T>
+impl<T, C> fmt::Debug for Entry<'_, T, C>
 where
     T: fmt::Debug,
 {
@@ -521,7 +564,7 @@ where
     }
 }
 
-impl<T> Deref for Entry<'_, T> {
+impl<T, C> Deref for Entry<'_, T, C> {
     type Target = T;
 
     fn deref(&self) -> &Self::Target {
@@ -549,73 +592,74 @@ impl<T> fmt::Debug for IntoIter<T> {
 }
 
 /// An iterator over the entries of a `SkipSet`.
-pub struct Iter<'a, T> {
-    inner: map::Iter<'a, T, ()>,
+pub struct Iter<'a, T, C = BasicComparator> {
+    inner: map::Iter<'a, T, (), C>,
 }
 
-impl<'a, T> Iterator for Iter<'a, T>
+impl<'a, T, C> Iterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, T> DoubleEndedIterator for Iter<'a, T>
+impl<'a, T, C> DoubleEndedIterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<T> fmt::Debug for Iter<'_, T> {
+impl<T, C> fmt::Debug for Iter<'_, T, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
 /// An iterator over a subset of entries of a `SkipSet`.
-pub struct Range<'a, Q, R, T>
+pub struct Range<'a, Q, R, T, C = BasicComparator>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    inner: map::Range<'a, Q, R, T, ()>,
+    inner: map::Range<'a, Q, R, T, (), C>,
 }
 
-impl<'a, Q, R, T> Iterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> Iterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, Q, R, T> DoubleEndedIterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> DoubleEndedIterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<Q, R, T> fmt::Debug for Range<'_, Q, R, T>
+impl<Q, R, T, C> fmt::Debug for Range<'_, Q, R, T, C>
 where
-    T: Ord + Comparable<Q> + fmt::Debug,
+    T: fmt::Debug,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/tests/comparator.rs b/crossbeam-skiplist/tests/comparator.rs
new file mode 100644
index 0000000..8cff5c8
--- /dev/null
+++ b/crossbeam-skiplist/tests/comparator.rs
@@ -0,0 +1,98 @@
+use std::{cmp::Ordering, ops::Bound};
+
+use crossbeam_skiplist::{
+    SkipMap, SkipSet,
+    comparator::{BasicComparator, Comparator, Equivalator},
+};
+
+#[derive(Clone, Copy)]
+struct IgnoreCase;
+
+fn fold(s: &str) -> impl Iterator<Item = u8> + '_ {
+    s.bytes().map(|b| b.to_ascii_lowercase())
+}
+
+impl Equivalator<String, str> for IgnoreCase {
+    fn equivalent(&self, lhs: &String, rhs: &str) -> bool {
+        lhs.eq_ignore_ascii_case(rhs)
+    }
+}
+impl Comparator<String, str> for IgnoreCase {
+    fn compare(&self, lhs: &String, rhs: &str) -> Ordering {
+        fold(lhs).cmp(fold(rhs))
+    }
+}
+impl Equivalator<String> for IgnoreCase {
+    fn equivalent(&self, lhs: &String, rhs: &String) -> bool {
+        lhs.eq_ignore_ascii_case(rhs)
+    }
+}
+impl Comparator<String> for IgnoreCase {
+    fn compare(&self, lhs: &String, rhs: &String) -> Ordering {
+        fold(lhs).cmp(fold(rhs))
+    }
+}
+
+type CompareFn = Box<dyn Fn(&i32, &i32) -> Ordering + Send + Sync>;
+
+struct Boxed(CompareFn);
+
+impl Equivalator<i32> for Boxed {
+    fn equivalent(&self, lhs: &i32, rhs: &i32) -> bool {
+        (self.0)(lhs, rhs) == Ordering::Equal
+    }
+}
+impl Comparator<i32> for Boxed {
+    fn compare(&self, lhs: &i32, rhs: &i32) -> Ordering {
+        (self.0)(lhs, rhs)
+    }
+}
+
+#[test]
+fn case_insensitive_map() {
+    let map = SkipMap::<String, u32, _>::with_comparator(IgnoreCase);
+    map.insert("abc".to_string(), 1);
+    map.insert("ABC".to_string(), 2);
+    map.insert("b".to_string(), 3);
+    assert_eq!(map.len(), 2);
+    assert_eq!(*map.get("aBc").unwrap().value(), 2);
+    assert!(map.contains_key("B"));
+    assert_eq!(
+        map.range::<str, _>((Bound::Included("A"), Bound::Excluded("AZ")))
+            .count(),
+        1
+    );
+    assert_eq!(*map.remove("ABC").unwrap().value(), 2);
+    assert!(map.get("abc").is_none());
+}
+
+#[test]
+fn boxed_closure_set() {
+    let set = SkipSet::with_comparator(Boxed(Box::new(|a, b| b.cmp(a))));
+    for i in [3, 1, 2, 5, 4] {
+        set.insert(i);
+    }
+    let items: Vec<i32> = set.iter().map(|e| *e).collect();
+    assert_eq!(items, [5, 4, 3, 2, 1]);
+    let rev: Vec<i32> = set.iter().rev().map(|e| *e).collect();
+    assert_eq!(rev, [1, 2, 3, 4, 5]);
+    assert_eq!(*set.front().unwrap(), 5);
+    assert_eq!(*set.pop_back().unwrap(), 1);
+    assert_eq!(
+        set.range((Bound::Included(&4), Bound::Included(&2)))
+            .count(),
+        3
+    );
+}
+
+#[test]
+fn basic_comparator_matches_ord() {
+    let c = BasicComparator;
+    assert_eq!(c.compare(&1, &2), Ordering::Less);
+    assert!(c.equivalent("a", "a"));
+    let map: SkipMap<i32, i32> = SkipMap::new();
+    let map2 = SkipMap::<i32, i32, BasicComparator>::with_comparator(BasicComparator);
+    map.insert(1, 1);
+    map2.insert(1, 1);
+    assert_eq!(map.len(), map2.len());
+}
```

</details>

<details><summary>reply</summary>

Adding the `C` parameter across `base.rs`. Next I'll fix the impl headers and bounds by hand.

Updating `map.rs` and `set.rs` with the same `C` parameter changes now.

Everything passes. Now I'll run rustfmt, then add a test for runtime comparators, including a case-insensitive map and a boxed closure.

Test bug (an unsized `str` range). I'll switch it to a `(Bound<&str>, Bound<&str>)` range.

`SkipMap`, `SkipSet` and `base::SkipList` now take a comparator type `C`, defaulting to `BasicComparator`. The existing tests and doctests still pass, and a new test file passes too. Clippy shows only the two spin-loop warnings in `tests/base.rs` that were already there. The crate also builds with `--no-default-features --features alloc`.

- **`comparator` module:** `crossbeam_skiplist::comparator` (in `src/comparator.rs`) has `Equivalator<L, R = L>`, `Comparator<L, R = L>: Equivalator<L, R>`, and the zero-sized `BasicComparator`. `BasicComparator` derives `Clone`, `Copy`, `Debug` and `Default`, and is implemented through the existing `Equivalent`/`Comparable` traits, so it orders exactly as before.
- **Defaulted type parameter:** `C` is the last parameter, defaulting to `BasicComparator`, on `SkipList`, `SkipMap`, `SkipSet` and the entry, iterator and range types in `base`, `map` and `set`. Code that writes `SkipMap<K, V>` or calls `SkipMap::new()` compiles unchanged, and `new()` still exists only for `BasicComparator`.
- **Constructors:** `with_comparator` exists on `SkipMap`, `SkipSet` and `base::SkipList`, with the signatures you gave.
- **Ordering:** every `K: Ord` or `K: Comparable<Q>` bound is now `C: Comparator<K>` or `C: Comparator<K, Q>`. This covers lookups, insert, remove, range, iterator head/tail checks and `Entry`/`RefEntry` `next`/`prev`/`remove`.
- **Equality check:** the equal-key check while building the tower used to be `==` on `K`. It now goes through the comparator.

A few things beyond the brief:
- `Default` and `FromIterator` are now implemented for any `C: Default`.
- The `SkipList` `Send`/`Sync` impls require `C: Send + Sync`.
- The `Debug` impls no longer require `K: Ord`.

`tests/comparator.rs` has three tests:
- A case-insensitive `SkipMap<String, u32, _>` where `"abc"` and `"ABC"` are one key and `get("aBc")` with a `&str` finds it.
- A `SkipSet` ordered by a boxed closure, with a reversed ordering.
- `BasicComparator` giving the same results as `new()`.

I also added doc examples on both `with_comparator` methods.

I didn't update `CHANGELOG.md`, and nothing is committed.

</details>

### claude, muffle: pass

Files: [crossbeam-skiplist/CHANGELOG.md](../muffle/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/CHANGELOG.md), [crossbeam-skiplist/src/base.rs](../muffle/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/base.rs), [crossbeam-skiplist/src/comparator.rs](../muffle/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/comparator.rs), [crossbeam-skiplist/src/lib.rs](../muffle/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/lib.rs), [crossbeam-skiplist/src/map.rs](../muffle/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/map.rs), [crossbeam-skiplist/src/set.rs](../muffle/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/set.rs), [crossbeam-skiplist/tests/map.rs](../muffle/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/tests/map.rs)

<details><summary>diff</summary>

```diff
diff --git a/crossbeam-skiplist/CHANGELOG.md b/crossbeam-skiplist/CHANGELOG.md
index 6fe1728..68a6f1b 100644
--- a/crossbeam-skiplist/CHANGELOG.md
+++ b/crossbeam-skiplist/CHANGELOG.md
@@ -1,3 +1,9 @@
+# Unreleased
+
+- Add `comparator` module with the `Equivalator` and `Comparator` traits and `BasicComparator`.
+- Add a `C` comparator type parameter (defaulting to `BasicComparator`) to `SkipMap`, `SkipSet`, `base::SkipList` and their entry, iterator and range types.
+- Add `with_comparator` constructors to `SkipMap`, `SkipSet` and `base::SkipList`.
+
 # Version 0.1.3
 
 - Remove dependency on `cfg-if`. (#1072)
diff --git a/crossbeam-skiplist/src/base.rs b/crossbeam-skiplist/src/base.rs
index a73ee8a..1e7ee7e 100644
--- a/crossbeam-skiplist/src/base.rs
+++ b/crossbeam-skiplist/src/base.rs
@@ -15,7 +15,7 @@ use core::{
 use crossbeam_epoch::{self as epoch, Atomic, Collector, Guard, Shared};
 use crossbeam_utils::CachePadded;
 
-use super::equivalent::Comparable;
+use super::comparator::{BasicComparator, Comparator};
 use crate::alloc_helper::Global;
 
 /// Number of bits needed to store height.
@@ -304,7 +304,7 @@ impl<'a, K, V> NodeRef<'a, K, V> {
     /// Decrements the reference count of a node, pinning the thread and destroying the node
     /// if the count become zero.
     #[inline]
-    unsafe fn decrement_with_pin<F>(self, parent: &SkipList<K, V>, pin: F)
+    unsafe fn decrement_with_pin<C, F>(self, parent: &SkipList<K, V, C>, pin: F)
     where
         F: FnOnce() -> Guard,
     {
@@ -451,7 +451,7 @@ struct HotData {
 }
 
 /// A lock-free skip list.
-// TODO(stjepang): Embed a custom `epoch::Collector` inside `SkipList<K, V>`. Instead of adding
+// TODO(stjepang): Embed a custom `epoch::Collector` inside `SkipList<K, V, C>`. Instead of adding
 // garbage to the default global collector, we should add it to a local collector tied to the
 // particular skip list instance.
 //
@@ -463,7 +463,7 @@ struct HotData {
 // As a further future optimization, if `!mem::needs_drop::<K>() && !mem::needs_drop::<V>()`
 // (neither key nor the value have destructors), there's no point in creating a new local
 // collector, so we should simply use the global one.
-pub struct SkipList<K, V> {
+pub struct SkipList<K, V, C = BasicComparator> {
     /// The head of the skip list (just a dummy node, not a real entry).
     head: Head<K, V>,
 
@@ -472,14 +472,24 @@ pub struct SkipList<K, V> {
 
     /// Hot data associated with the skip list, stored in a dedicated cache line.
     hot_data: CachePadded<HotData>,
+
+    /// The comparator that defines the ordering of keys.
+    comparator: C,
 }
 
-unsafe impl<K: Send + Sync, V: Send + Sync> Send for SkipList<K, V> {}
-unsafe impl<K: Send + Sync, V: Send + Sync> Sync for SkipList<K, V> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Send + Sync> Send for SkipList<K, V, C> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Send + Sync> Sync for SkipList<K, V, C> {}
 
-impl<K, V> SkipList<K, V> {
-    /// Returns a new, empty skip list.
+impl<K, V> SkipList<K, V, BasicComparator> {
+    /// Returns a new, empty skip list that orders keys by their `Ord` implementation.
     pub fn new(collector: Collector) -> Self {
+        Self::with_comparator(collector, BasicComparator)
+    }
+}
+
+impl<K, V, C> SkipList<K, V, C> {
+    /// Returns a new, empty skip list that orders keys using `comparator`.
+    pub fn with_comparator(collector: Collector, comparator: C) -> Self {
         Self {
             head: Head::new(),
             collector,
@@ -488,6 +498,7 @@ impl<K, V> SkipList<K, V> {
                 len: AtomicUsize::new(0),
                 max_height: AtomicUsize::new(1),
             }),
+            comparator,
         }
     }
 
@@ -517,12 +528,12 @@ impl<K, V> SkipList<K, V> {
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Returns the entry with the smallest key.
-    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.next_node(self.head.as_tower(), Bound::Unbounded, guard)?;
         Some(Entry {
@@ -533,7 +544,7 @@ where
     }
 
     /// Returns the entry with the largest key.
-    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.search_bound::<K>(Bound::Unbounded, true, guard)?;
         Some(Entry {
@@ -546,21 +557,21 @@ where
     /// Returns `true` if the map contains a value for the specified key.
     pub fn contains_key<Q>(&self, key: &Q, guard: &Guard) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.get(key, guard).is_some()
     }
 
     /// Returns an entry with the specified `key`.
-    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>>
+    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
         let n = self.search_bound(Bound::Included(key), false, guard)?;
-        if !n.key.equivalent(key) {
+        if !self.comparator.equivalent(&n.key, key) {
             return None;
         }
 
@@ -578,9 +589,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -599,9 +610,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -614,7 +625,7 @@ where
     }
 
     /// Finds an entry with the specified key, or inserts a new `key`-`value` pair if none exist.
-    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| false, guard)
     }
 
@@ -626,7 +637,7 @@ where
     /// discarded. If closure is modifying some other state (such as shared counters or shared
     /// objects), it may lead to <u>undesired behaviour</u> such as counters being changed without
     /// result of closure inserted
-    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -634,7 +645,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V> {
+    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V, C> {
         self.check_guard(guard);
         Iter {
             parent: self,
@@ -645,7 +656,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn ref_iter(&self) -> RefIter<'_, K, V> {
+    pub fn ref_iter(&self) -> RefIter<'_, K, V, C> {
         RefIter {
             parent: self,
             head: None,
@@ -658,9 +669,9 @@ where
         &'a self,
         range: R,
         guard: &'g Guard,
-    ) -> Range<'a, 'g, Q, R, K, V>
+    ) -> Range<'a, 'g, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -677,9 +688,9 @@ where
 
     /// Returns an iterator over a subset of entries in the skip list.
     #[allow(clippy::needless_lifetimes)]
-    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V>
+    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -825,7 +836,7 @@ where
         guard: &'a Guard,
     ) -> Option<NodeRef<'a, K, V>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -887,11 +898,11 @@ where
                         // bound, we return the last node before the condition became true. For the
                         // lower bound, we return the first node after the condition became true.
                         if upper_bound {
-                            if !below_upper_bound(&bound, &c.key) {
+                            if !below_upper_bound(&self.comparator, &bound, &c.key) {
                                 break;
                             }
                             result = Some(c);
-                        } else if above_lower_bound(&bound, &c.key) {
+                        } else if above_lower_bound(&self.comparator, &bound, &c.key) {
                             result = Some(c);
                             break;
                         }
@@ -910,7 +921,7 @@ where
     /// Searches for a key in the skip list and returns a list of all adjacent nodes.
     fn search_position<'a, Q>(&'a self, key: &Q, guard: &'a Guard) -> Position<'a, K, V>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -971,7 +982,7 @@ where
 
                         // If `curr` contains a key that is greater than or equal to `key`, we're
                         // done with this level.
-                        match c.key.compare(key) {
+                        match self.comparator.compare(&c.key, key) {
                             cmp::Ordering::Greater => break,
                             cmp::Ordering::Equal => {
                                 result.found = Some(c);
@@ -1004,7 +1015,7 @@ where
         value: F,
         replace: CompareF,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
         CompareF: Fn(&V) -> bool,
@@ -1018,7 +1029,7 @@ where
             let guard = &*(guard as *const _);
 
             // First try searching for the key.
-            // Note that the `Ord` implementation for `K` may panic during the search.
+            // Note that the comparator may panic during the search.
             let mut search = self.search_position(&key, guard);
             if let Some(r) = search.found {
                 let replace = replace(&r.value);
@@ -1155,7 +1166,10 @@ where
                     // the tower without breaking any invariants. Note that building higher levels
                     // is completely optional. Only the lowest level really matters, and all the
                     // higher levels are there just to make searching faster.
-                    if succ.as_ref().map(|s| &s.key) == Some(&n.key) {
+                    if succ
+                        .as_ref()
+                        .is_some_and(|s| self.comparator.equivalent(&s.key, &n.key))
+                    {
                         search = self.search_position(&n.key, guard);
                         continue;
                     }
@@ -1218,16 +1232,17 @@ where
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K, K>,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the skip list and returns the new entry.
     ///
     /// If there is an existing entry with this key, it will be removed before inserting the new
     /// one.
-    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| true, guard)
     }
 
@@ -1242,7 +1257,7 @@ where
         value: V,
         compare_fn: F,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -1250,9 +1265,9 @@ where
     }
 
     /// Removes an entry with the specified `key` from the map and returns it.
-    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -1320,7 +1335,7 @@ where
     }
 
     /// Removes an entry from the front of the skip list.
-    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.front(guard)?;
@@ -1335,7 +1350,7 @@ where
     }
 
     /// Removes an entry from the back of the skip list.
-    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.back(guard)?;
@@ -1393,7 +1408,7 @@ where
     }
 }
 
-impl<K, V> Drop for SkipList<K, V> {
+impl<K, V, C> Drop for SkipList<K, V, C> {
     fn drop(&mut self) {
         unsafe {
             let mut node = NodeRef::from_shared(
@@ -1419,9 +1434,9 @@ impl<K, V> Drop for SkipList<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipList<K, V>
+impl<K, V, C> fmt::Debug for SkipList<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -1429,7 +1444,7 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipList<K, V> {
+impl<K, V, C> IntoIterator for SkipList<K, V, C> {
     type Item = (K, V);
     type IntoIter = IntoIter<K, V>;
 
@@ -1464,13 +1479,13 @@ impl<K, V> IntoIterator for SkipList<K, V> {
 /// The lifetimes of the key and value are the same as that of the `Guard`
 /// used when creating the `Entry` (`'g`). This lifetime is also constrained to
 /// not outlive the `SkipList`.
-pub struct Entry<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Entry<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'g, K, V>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Entry<'a, 'g, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1487,7 +1502,7 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1496,14 +1511,15 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     ///
     /// This method may return `None` if the reference count is already 0 and
     /// the node has been queued for deletion.
-    pub fn pin(&self) -> Option<RefEntry<'a, K, V>> {
+    pub fn pin(&self) -> Option<RefEntry<'a, K, V, C>> {
         unsafe { RefEntry::try_acquire(self.parent, self.node) }
     }
 }
 
-impl<K, V> Entry<'_, '_, K, V>
+impl<K, V, C> Entry<'_, '_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K, K>,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1526,7 +1542,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, '_, K, V> {
+impl<K, V, C> Clone for Entry<'_, '_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             parent: self.parent,
@@ -1536,7 +1552,7 @@ impl<K, V> Clone for Entry<'_, '_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1549,9 +1565,9 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K, V> Entry<'a, 'g, K, V>
+impl<'a: 'g, 'g, K, V, C> Entry<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self) -> bool {
@@ -1565,7 +1581,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self.parent.next_node(
             self.node.as_tower(),
             Bound::Excluded(&self.node.key),
@@ -1590,7 +1606,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self
             .parent
             .search_bound(Bound::Excluded(&self.node.key), true, self.guard)?;
@@ -1606,12 +1622,12 @@ where
 ///
 /// You *must* call `release` to free this type, otherwise the node will be
 /// leaked. This is because releasing the entry requires a `Guard`.
-pub struct RefEntry<'a, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct RefEntry<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'a, K, V>,
 }
 
-impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefEntry<'a, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1628,7 +1644,7 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1650,9 +1666,9 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     /// Tries to create a new `RefEntry` by incrementing the reference count of
     /// a node.
     unsafe fn try_acquire(
-        parent: &'a SkipList<K, V>,
+        parent: &'a SkipList<K, V, C>,
         node: NodeRef<'_, K, V>,
-    ) -> Option<RefEntry<'a, K, V>> {
+    ) -> Option<RefEntry<'a, K, V, C>> {
         if unsafe { node.try_increment() } {
             Some(RefEntry {
                 parent,
@@ -1667,9 +1683,10 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 }
 
-impl<K, V> RefEntry<'_, K, V>
+impl<K, V, C> RefEntry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K, K>,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1694,7 +1711,7 @@ where
     }
 }
 
-impl<K, V> Clone for RefEntry<'_, K, V> {
+impl<K, V, C> Clone for RefEntry<'_, K, V, C> {
     fn clone(&self) -> Self {
         unsafe {
             // Incrementing will always succeed since we're already holding a reference to the node.
@@ -1707,7 +1724,7 @@ impl<K, V> Clone for RefEntry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for RefEntry<'_, K, V>
+impl<K, V, C> fmt::Debug for RefEntry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1720,9 +1737,9 @@ where
     }
 }
 
-impl<'a, K, V> RefEntry<'a, K, V>
+impl<'a, K, V, C> RefEntry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self, guard: &Guard) -> bool {
@@ -1736,7 +1753,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1763,7 +1780,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1780,20 +1797,20 @@ where
 }
 
 /// An iterator over the entries of a `SkipList`.
-pub struct Iter<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Iter<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Iterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Iterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1804,7 +1821,7 @@ where
             }
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1817,11 +1834,11 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> DoubleEndedIterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> DoubleEndedIterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -1831,7 +1848,7 @@ where
                 .search_bound::<K>(Bound::Unbounded, true, self.guard),
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1844,7 +1861,7 @@ where
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Iter<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1858,13 +1875,13 @@ where
 }
 
 /// An iterator over reference-counted entries of a `SkipList`.
-pub struct RefIter<'a, K, V> {
-    parent: &'a SkipList<K, V>,
-    head: Option<RefEntry<'a, K, V>>,
-    tail: Option<RefEntry<'a, K, V>>,
+pub struct RefIter<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
+    head: Option<RefEntry<'a, K, V, C>>,
+    tail: Option<RefEntry<'a, K, V, C>>,
 }
 
-impl<K, V> fmt::Debug for RefIter<'_, K, V>
+impl<K, V, C> fmt::Debug for RefIter<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1883,12 +1900,12 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V>
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match &self.head {
             Some(e) => e.next(guard),
@@ -1896,7 +1913,9 @@ where
         };
         match (&next_head, &self.tail) {
             // The next key is larger than the latest tail key we observed with this iterator.
-            (Some(ref next), Some(t)) if next.key() >= t.key() => {
+            (Some(ref next), Some(t))
+                if self.parent.comparator.compare(next.key(), t.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1915,7 +1934,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match &self.tail {
             Some(e) => e.prev(guard),
@@ -1923,7 +1942,9 @@ where
         };
         match (&self.head, &next_tail) {
             // The prev key is smaller than the latest head key we observed with this iterator.
-            (Some(h), Some(next)) if h.key() >= next.key() => {
+            (Some(h), Some(next))
+                if self.parent.comparator.compare(h.key(), next.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1942,7 +1963,7 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C> {
     /// Decrements the reference count of `RefEntry` owned by the iterator.
     pub fn drop_impl(&mut self, guard: &Guard) {
         self.parent.check_guard(guard);
@@ -1956,13 +1977,13 @@ impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipList`.
-pub struct Range<'a: 'g, 'g, Q, R, K, V>
+pub struct Range<'a: 'g, 'g, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     range: R,
@@ -1970,15 +1991,15 @@ where
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> Iterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> Iterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1991,14 +2012,14 @@ where
             match self.tail {
                 Some(t) => {
                     let bound = Bound::Excluded(&t.as_ref().key);
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2013,13 +2034,13 @@ where
     }
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -2032,14 +2053,14 @@ where
             match self.head {
                 Some(h) => {
                     let bound = Bound::Excluded(&h.as_ref().key);
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2054,9 +2075,10 @@ where
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, '_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, '_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K, K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2071,38 +2093,39 @@ where
 }
 
 /// An iterator over reference-counted subset of entries of a `SkipList`.
-pub struct RefRange<'a, Q, R, K, V>
+pub struct RefRange<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
-    pub(crate) head: Option<RefEntry<'a, K, V>>,
-    pub(crate) tail: Option<RefEntry<'a, K, V>>,
+    parent: &'a SkipList<K, V, C>,
+    pub(crate) head: Option<RefEntry<'a, K, V, C>>,
+    pub(crate) tail: Option<RefEntry<'a, K, V, C>>,
     pub(crate) range: R,
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-unsafe impl<Q, R, K, V> Send for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C> Send for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-unsafe impl<Q, R, K, V> Sync for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C> Sync for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-impl<Q, R, K, V> fmt::Debug for RefRange<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K, K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2116,14 +2139,14 @@ where
     }
 }
 
-impl<'a, Q, R, K: 'a, V: 'a> RefRange<'a, Q, R, K, V>
+impl<'a, Q, R, K: 'a, V: 'a, C> RefRange<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match self.head {
             Some(ref e) => e.next(guard),
@@ -2134,7 +2157,7 @@ where
             match self.tail {
                 Some(ref t) => {
                     let bound = Bound::Excluded(t.key());
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2150,7 +2173,7 @@ where
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2171,7 +2194,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match self.tail {
             Some(ref e) => e.prev(guard),
@@ -2182,7 +2205,7 @@ where
             match self.head {
                 Some(ref h) => {
                     let bound = Bound::Excluded(h.key());
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2198,7 +2221,7 @@ where
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2307,9 +2330,9 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 
 /// Helper function to retry an operation until pinning succeeds or `None` is
 /// returned.
-pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V>(mut f: F) -> Option<RefEntry<'a, K, V>>
+pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V, C>(mut f: F) -> Option<RefEntry<'a, K, V, C>>
 where
-    F: FnMut() -> Option<Entry<'a, 'g, K, V>>,
+    F: FnMut() -> Option<Entry<'a, 'g, K, V, C>>,
 {
     loop {
         if let Some(e) = f()?.pin() {
@@ -2319,27 +2342,27 @@ where
 }
 
 /// Helper function to check if a value is above a lower bound
-fn above_lower_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn above_lower_bound<V, T, C>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_ge(),
-        Bound::Excluded(key) => other.compare(key).is_gt(),
+        Bound::Included(key) => comparator.compare(other, key).is_ge(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_gt(),
     }
 }
 
 /// Helper function to check if a value is below an upper bound
-fn below_upper_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn below_upper_bound<V, T, C>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_le(),
-        Bound::Excluded(key) => other.compare(key).is_lt(),
+        Bound::Included(key) => comparator.compare(other, key).is_le(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_lt(),
     }
 }
diff --git a/crossbeam-skiplist/src/comparator.rs b/crossbeam-skiplist/src/comparator.rs
new file mode 100644
index 0000000..c258716
--- /dev/null
+++ b/crossbeam-skiplist/src/comparator.rs
@@ -0,0 +1,60 @@
+//! Runtime-selectable key ordering for skip lists.
+//!
+//! A [`Comparator`] decides how the keys of a [`SkipMap`](crate::SkipMap),
+//! [`SkipSet`](crate::SkipSet) or [`SkipList`](crate::base::SkipList) are ordered. The default,
+//! [`BasicComparator`], uses the ordering of the key type, exactly like [`BTreeMap`] does.
+//!
+//! [`BTreeMap`]: https://doc.rust-lang.org/std/collections/struct.BTreeMap.html
+
+use core::cmp::Ordering;
+
+use crate::equivalent::{Comparable, Equivalent};
+
+/// Decides whether two keys are equal.
+///
+/// `L` is the type of the key stored in the collection and `R` is the type of the key used for
+/// lookups; they may differ, e.g. `String` and `str`.
+pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
+    /// Returns `true` if `lhs` and `rhs` are equal.
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
+}
+
+/// Decides the ordering of two keys.
+///
+/// # Contract
+///
+/// The ordering must be a total order that is consistent over time, and consistent with
+/// [`Equivalator::equivalent`]: `equivalent` must return `true` exactly when `compare` returns
+/// [`Ordering::Equal`]. When `L` and `R` differ, comparing a stored key with a lookup key must
+/// agree with the ordering of the stored keys among themselves.
+pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
+    /// Returns the ordering of `lhs` relative to `rhs`.
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
+}
+
+/// A comparator that uses the [`Comparable`] and [`Equivalent`] implementations of the stored
+/// key, i.e. the regular `Ord` ordering.
+///
+/// This is the default comparator of all skip list types.
+#[derive(Clone, Copy, Debug, Default)]
+pub struct BasicComparator;
+
+impl<L: ?Sized, R: ?Sized> Equivalator<L, R> for BasicComparator
+where
+    L: Equivalent<R>,
+{
+    #[inline]
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
+        lhs.equivalent(rhs)
+    }
+}
+
+impl<L: ?Sized, R: ?Sized> Comparator<L, R> for BasicComparator
+where
+    L: Comparable<R>,
+{
+    #[inline]
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
+        lhs.compare(rhs)
+    }
+}
diff --git a/crossbeam-skiplist/src/lib.rs b/crossbeam-skiplist/src/lib.rs
index 5ff8e74..5337e3d 100644
--- a/crossbeam-skiplist/src/lib.rs
+++ b/crossbeam-skiplist/src/lib.rs
@@ -265,4 +265,5 @@ pub mod set;
 #[doc(inline)]
 pub use crate::{map::SkipMap, set::SkipSet};
 
+pub mod comparator;
 pub mod equivalent;
diff --git a/crossbeam-skiplist/src/map.rs b/crossbeam-skiplist/src/map.rs
index c7c5408..67a1f17 100644
--- a/crossbeam-skiplist/src/map.rs
+++ b/crossbeam-skiplist/src/map.rs
@@ -11,7 +11,7 @@ use crossbeam_epoch as epoch;
 
 use crate::{
     base::{self, try_pin_loop},
-    equivalent::Comparable,
+    comparator::{BasicComparator, Comparator},
 };
 
 /// An ordered map based on a lock-free skip list.
@@ -20,12 +20,12 @@ use crate::{
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeMap`]: std::collections::BTreeMap
-pub struct SkipMap<K, V> {
-    inner: base::SkipList<K, V>,
+pub struct SkipMap<K, V, C = BasicComparator> {
+    inner: base::SkipList<K, V, C>,
 }
 
 impl<K, V> SkipMap<K, V> {
-    /// Returns a new, empty map.
+    /// Returns a new, empty map that orders keys by their `Ord` implementation.
     ///
     /// # Example
     ///
@@ -35,8 +35,58 @@ impl<K, V> SkipMap<K, V> {
     /// let map: SkipMap<i32, &str> = SkipMap::new();
     /// ```
     pub fn new() -> Self {
+        Self::with_comparator(BasicComparator)
+    }
+}
+
+impl<K, V, C> SkipMap<K, V, C> {
+    /// Returns a new, empty map that orders keys using `comparator`.
+    ///
+    /// # Example
+    ///
+    /// ```
+    /// use std::cmp::Ordering;
+    /// use crossbeam_skiplist::{
+    ///     comparator::{Comparator, Equivalator},
+    ///     SkipMap,
+    /// };
+    ///
+    /// struct CaseInsensitive;
+    ///
+    /// impl Equivalator<String, str> for CaseInsensitive {
+    ///     fn equivalent(&self, lhs: &String, rhs: &str) -> bool {
+    ///         lhs.eq_ignore_ascii_case(rhs)
+    ///     }
+    /// }
+    ///
+    /// impl Comparator<String, str> for CaseInsensitive {
+    ///     fn compare(&self, lhs: &String, rhs: &str) -> Ordering {
+    ///         let l = lhs.bytes().map(|b| b.to_ascii_lowercase());
+    ///         l.cmp(rhs.bytes().map(|b| b.to_ascii_lowercase()))
+    ///     }
+    /// }
+    ///
+    /// impl Equivalator<String> for CaseInsensitive {
+    ///     fn equivalent(&self, lhs: &String, rhs: &String) -> bool {
+    ///         self.equivalent(lhs, rhs.as_str())
+    ///     }
+    /// }
+    ///
+    /// impl Comparator<String> for CaseInsensitive {
+    ///     fn compare(&self, lhs: &String, rhs: &String) -> Ordering {
+    ///         self.compare(lhs, rhs.as_str())
+    ///     }
+    /// }
+    ///
+    /// let map = SkipMap::<String, u32, _>::with_comparator(CaseInsensitive);
+    /// map.insert("abc".to_string(), 1);
+    /// map.insert("ABC".to_string(), 2);
+    /// assert_eq!(map.len(), 1);
+    /// assert_eq!(*map.get("aBc").unwrap().value(), 2);
+    /// ```
+    pub fn with_comparator(comparator: C) -> Self {
         Self {
-            inner: base::SkipList::new(epoch::default_collector().clone()),
+            inner: base::SkipList::with_comparator(epoch::default_collector().clone(), comparator),
         }
     }
 
@@ -80,9 +130,9 @@ impl<K, V> SkipMap<K, V> {
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -99,7 +149,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.front().unwrap().value(), "five");
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.front(guard)).map(Entry::new)
     }
@@ -119,7 +169,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.back().unwrap().value(), "six");
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.back(guard)).map(Entry::new)
     }
@@ -138,7 +188,7 @@ where
     /// ```
     pub fn contains_key<Q>(&self, key: &Q) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -160,9 +210,9 @@ where
     /// numbers.insert("six", 6);
     /// assert_eq!(*numbers.get("six").unwrap().value(), 6);
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -195,9 +245,9 @@ where
     /// let greater_than_thirteen = numbers.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -227,9 +277,9 @@ where
     /// let less_than_six = numbers.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -253,7 +303,7 @@ where
     /// let jobs_age = ages.get_or_insert("Steve Jobs", -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.get_or_insert(key, value, guard))
     }
@@ -283,7 +333,7 @@ where
     /// let jobs_age = ages.get_or_insert_with("Steve Jobs", || -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -313,7 +363,7 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn iter(&self) -> Iter<'_, K, V> {
+    pub fn iter(&self) -> Iter<'_, K, V, C> {
         Iter {
             inner: self.inner.ref_iter(),
         }
@@ -340,10 +390,10 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V, C>
     where
         R: RangeBounds<Q>,
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         Range {
@@ -352,9 +402,10 @@ where
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K, K>,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the map and returns the new entry.
@@ -374,7 +425,7 @@ where
     ///
     /// assert_eq!(*map.get("key").unwrap().value(), "value");
     /// ```
-    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.insert(key, value, guard))
     }
@@ -401,7 +452,7 @@ where
     /// map.compare_insert("absent_key", 0, |_| false);
     /// assert_eq!(*map.get("absent_key").unwrap().value(), 0);
     /// ```
-    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V>
+    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -427,9 +478,9 @@ where
     /// map.insert("key", "value");
     /// assert_eq!(*map.remove("key").unwrap().value(), "value");
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -458,7 +509,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_front(guard).map(Entry::new)
     }
@@ -485,7 +536,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_back(guard).map(Entry::new)
     }
@@ -515,9 +566,9 @@ impl<K, V> Default for SkipMap<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipMap<K, V>
+impl<K, V, C> fmt::Debug for SkipMap<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -525,7 +576,7 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipMap<K, V> {
+impl<K, V, C> IntoIterator for SkipMap<K, V, C> {
     type Item = (K, V);
     type IntoIter = IntoIter<K, V>;
 
@@ -536,14 +587,14 @@ impl<K, V> IntoIterator for SkipMap<K, V> {
     }
 }
 
-impl<'a, K, V> IntoIterator for &'a SkipMap<K, V>
+impl<'a, K, V, C> IntoIterator for &'a SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
-    type Item = Entry<'a, K, V>;
-    type IntoIter = Iter<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
+    type IntoIter = Iter<'a, K, V, C>;
 
-    fn into_iter(self) -> Iter<'a, K, V> {
+    fn into_iter(self) -> Iter<'a, K, V, C> {
         self.iter()
     }
 }
@@ -565,12 +616,12 @@ where
 }
 
 /// A reference-counted entry in a map.
-pub struct Entry<'a, K, V> {
-    inner: ManuallyDrop<base::RefEntry<'a, K, V>>,
+pub struct Entry<'a, K, V, C = BasicComparator> {
+    inner: ManuallyDrop<base::RefEntry<'a, K, V, C>>,
 }
 
-impl<'a, K, V> Entry<'a, K, V> {
-    fn new(inner: base::RefEntry<'a, K, V>) -> Self {
+impl<'a, K, V, C> Entry<'a, K, V, C> {
+    fn new(inner: base::RefEntry<'a, K, V, C>) -> Self {
         Self {
             inner: ManuallyDrop::new(inner),
         }
@@ -592,7 +643,7 @@ impl<'a, K, V> Entry<'a, K, V> {
     }
 }
 
-impl<K, V> Drop for Entry<'_, K, V> {
+impl<K, V, C> Drop for Entry<'_, K, V, C> {
     fn drop(&mut self) {
         unsafe {
             ManuallyDrop::into_inner(ptr::read(&self.inner)).release_with_pin(epoch::pin);
@@ -600,9 +651,9 @@ impl<K, V> Drop for Entry<'_, K, V> {
     }
 }
 
-impl<'a, K, V> Entry<'a, K, V>
+impl<'a, K, V, C> Entry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Moves to the next entry in the map.
     pub fn move_next(&mut self) -> bool {
@@ -617,21 +668,22 @@ where
     }
 
     /// Returns the next entry in the map.
-    pub fn next(&self) -> Option<Entry<'a, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 
     /// Returns the previous entry in the map.
-    pub fn prev(&self) -> Option<Entry<'a, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.prev(guard).map(Entry::new)
     }
 }
 
-impl<K, V> Entry<'_, K, V>
+impl<K, V, C> Entry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K, K>,
     V: Send + 'static,
 {
     /// Removes the entry from the map.
@@ -643,7 +695,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, K, V> {
+impl<K, V, C> Clone for Entry<'_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -651,7 +703,7 @@ impl<K, V> Clone for Entry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -684,39 +736,39 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 }
 
 /// An iterator over the entries of a `SkipMap`.
-pub struct Iter<'a, K, V> {
-    inner: base::RefIter<'a, K, V>,
+pub struct Iter<'a, K, V, C = BasicComparator> {
+    inner: base::RefIter<'a, K, V, C>,
 }
 
-impl<'a, K, V> Iterator for Iter<'a, K, V>
+impl<'a, K, V, C> Iterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, K, V> DoubleEndedIterator for Iter<'a, K, V>
+impl<'a, K, V, C> DoubleEndedIterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, K, V> {
+impl<K, V, C> fmt::Debug for Iter<'_, K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
-impl<K, V> Drop for Iter<'_, K, V> {
+impl<K, V, C> Drop for Iter<'_, K, V, C> {
     fn drop(&mut self) {
         let guard = &epoch::pin();
         self.inner.drop_impl(guard);
@@ -724,44 +776,45 @@ impl<K, V> Drop for Iter<'_, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipMap`.
-pub struct Range<'a, Q, R, K, V>
+pub struct Range<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    pub(crate) inner: base::RefRange<'a, Q, R, K, V>,
+    pub(crate) inner: base::RefRange<'a, Q, R, K, V, C>,
 }
 
-impl<'a, Q, R, K, V> Iterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> Iterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, Q, R, K, V> DoubleEndedIterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> DoubleEndedIterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K, K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -775,9 +828,9 @@ where
     }
 }
 
-impl<Q, R, K, V> Drop for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> Drop for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/src/set.rs b/crossbeam-skiplist/src/set.rs
index 4e91f6c..fd0e1e3 100644
--- a/crossbeam-skiplist/src/set.rs
+++ b/crossbeam-skiplist/src/set.rs
@@ -5,7 +5,10 @@ use core::{
     ops::{Bound, Deref, RangeBounds},
 };
 
-use crate::{equivalent::Comparable, map};
+use crate::{
+    comparator::{BasicComparator, Comparator},
+    map,
+};
 
 /// A set based on a lock-free skip list.
 ///
@@ -13,12 +16,12 @@ use crate::{equivalent::Comparable, map};
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeSet`]: std::collections::BTreeSet
-pub struct SkipSet<T> {
-    inner: map::SkipMap<T, ()>,
+pub struct SkipSet<T, C = BasicComparator> {
+    inner: map::SkipMap<T, (), C>,
 }
 
 impl<T> SkipSet<T> {
-    /// Returns a new, empty set.
+    /// Returns a new, empty set that orders elements by their `Ord` implementation.
     ///
     /// # Example
     ///
@@ -28,8 +31,44 @@ impl<T> SkipSet<T> {
     /// let set: SkipSet<i32> = SkipSet::new();
     /// ```
     pub fn new() -> Self {
+        Self::with_comparator(BasicComparator)
+    }
+}
+
+impl<T, C> SkipSet<T, C> {
+    /// Returns a new, empty set that orders elements using `comparator`.
+    ///
+    /// # Example
+    ///
+    /// ```
+    /// use std::cmp::Ordering;
+    /// use crossbeam_skiplist::{
+    ///     comparator::{Comparator, Equivalator},
+    ///     SkipSet,
+    /// };
+    ///
+    /// struct Reverse;
+    ///
+    /// impl Equivalator<i32> for Reverse {
+    ///     fn equivalent(&self, lhs: &i32, rhs: &i32) -> bool {
+    ///         lhs == rhs
+    ///     }
+    /// }
+    ///
+    /// impl Comparator<i32> for Reverse {
+    ///     fn compare(&self, lhs: &i32, rhs: &i32) -> Ordering {
+    ///         rhs.cmp(lhs)
+    ///     }
+    /// }
+    ///
+    /// let set = SkipSet::with_comparator(Reverse);
+    /// set.insert(1);
+    /// set.insert(3);
+    /// assert_eq!(*set.front().unwrap(), 3);
+    /// ```
+    pub fn with_comparator(comparator: C) -> Self {
         Self {
-            inner: map::SkipMap::new(),
+            inner: map::SkipMap::with_comparator(comparator),
         }
     }
 
@@ -71,9 +110,9 @@ impl<T> SkipSet<T> {
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T, T>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -88,7 +127,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.front().unwrap(), 1);
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, T>> {
+    pub fn front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.front().map(Entry::new)
     }
 
@@ -105,7 +144,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.back().unwrap(), 2);
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, T>> {
+    pub fn back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.back().map(Entry::new)
     }
 
@@ -122,7 +161,7 @@ where
     /// ```
     pub fn contains<Q>(&self, key: &Q) -> bool
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.contains_key(key)
@@ -139,9 +178,9 @@ where
     /// assert_eq!(*set.get(&3).unwrap(), 3);
     /// assert!(set.get(&4).is_none());
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.get(key).map(Entry::new)
@@ -171,9 +210,9 @@ where
     /// let greater_than_thirteen = set.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.lower_bound(bound).map(Entry::new)
@@ -200,9 +239,9 @@ where
     /// let less_than_six = set.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.upper_bound(bound).map(Entry::new)
@@ -219,7 +258,7 @@ where
     /// let entry = set.get_or_insert(2);
     /// assert_eq!(*entry, 2);
     /// ```
-    pub fn get_or_insert(&self, key: T) -> Entry<'_, T> {
+    pub fn get_or_insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.get_or_insert(key, ()))
     }
 
@@ -241,7 +280,7 @@ where
     /// assert_eq!(*set_iter.next().unwrap(), 12);
     /// assert!(set_iter.next().is_none());
     /// ```
-    pub fn iter(&self) -> Iter<'_, T> {
+    pub fn iter(&self) -> Iter<'_, T, C> {
         Iter {
             inner: self.inner.iter(),
         }
@@ -264,10 +303,10 @@ where
     /// assert_eq!(*set_range.next().unwrap(), 7);
     /// assert!(set_range.next().is_none());
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T, C>
     where
         R: RangeBounds<Q>,
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         Range {
@@ -276,9 +315,10 @@ where
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T, T>,
 {
     /// Inserts a `key`-`value` pair into the set and returns the new entry.
     ///
@@ -294,7 +334,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.get(&2).unwrap(), 2);
     /// ```
-    pub fn insert(&self, key: T) -> Entry<'_, T> {
+    pub fn insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.insert(key, ()))
     }
 
@@ -313,9 +353,9 @@ where
     /// assert_eq!(*set.remove(&2).unwrap(), 2);
     /// assert!(set.remove(&2).is_none());
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.remove(key).map(Entry::new)
@@ -342,7 +382,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_front().map(Entry::new)
     }
 
@@ -367,7 +407,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_back().map(Entry::new)
     }
 
@@ -396,16 +436,16 @@ impl<T> Default for SkipSet<T> {
     }
 }
 
-impl<T> fmt::Debug for SkipSet<T>
+impl<T, C> fmt::Debug for SkipSet<T, C>
 where
-    T: Ord + fmt::Debug,
+    T: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("SkipSet { .. }")
     }
 }
 
-impl<T> IntoIterator for SkipSet<T> {
+impl<T, C> IntoIterator for SkipSet<T, C> {
     type Item = T;
     type IntoIter = IntoIter<T>;
 
@@ -416,14 +456,14 @@ impl<T> IntoIterator for SkipSet<T> {
     }
 }
 
-impl<'a, T> IntoIterator for &'a SkipSet<T>
+impl<'a, T, C> IntoIterator for &'a SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T, T>,
 {
-    type Item = Entry<'a, T>;
-    type IntoIter = Iter<'a, T>;
+    type Item = Entry<'a, T, C>;
+    type IntoIter = Iter<'a, T, C>;
 
-    fn into_iter(self) -> Iter<'a, T> {
+    fn into_iter(self) -> Iter<'a, T, C> {
         self.iter()
     }
 }
@@ -445,12 +485,12 @@ where
 }
 
 /// A reference-counted entry in a set.
-pub struct Entry<'a, T> {
-    inner: map::Entry<'a, T, ()>,
+pub struct Entry<'a, T, C = BasicComparator> {
+    inner: map::Entry<'a, T, (), C>,
 }
 
-impl<'a, T> Entry<'a, T> {
-    fn new(inner: map::Entry<'a, T, ()>) -> Self {
+impl<'a, T, C> Entry<'a, T, C> {
+    fn new(inner: map::Entry<'a, T, (), C>) -> Self {
         Self { inner }
     }
 
@@ -465,9 +505,9 @@ impl<'a, T> Entry<'a, T> {
     }
 }
 
-impl<'a, T> Entry<'a, T>
+impl<'a, T, C> Entry<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T, T>,
 {
     /// Moves to the next entry in the set.
     pub fn move_next(&mut self) -> bool {
@@ -480,19 +520,20 @@ where
     }
 
     /// Returns the next entry in the set.
-    pub fn next(&self) -> Option<Entry<'a, T>> {
+    pub fn next(&self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 
     /// Returns the previous entry in the set.
-    pub fn prev(&self) -> Option<Entry<'a, T>> {
+    pub fn prev(&self) -> Option<Entry<'a, T, C>> {
         self.inner.prev().map(Entry::new)
     }
 }
 
-impl<T> Entry<'_, T>
+impl<T, C> Entry<'_, T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T, T>,
 {
     /// Removes the entry from the set.
     ///
@@ -502,7 +543,7 @@ where
     }
 }
 
-impl<T> Clone for Entry<'_, T> {
+impl<T, C> Clone for Entry<'_, T, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -510,7 +551,7 @@ impl<T> Clone for Entry<'_, T> {
     }
 }
 
-impl<T> fmt::Debug for Entry<'_, T>
+impl<T, C> fmt::Debug for Entry<'_, T, C>
 where
     T: fmt::Debug,
 {
@@ -521,7 +562,7 @@ where
     }
 }
 
-impl<T> Deref for Entry<'_, T> {
+impl<T, C> Deref for Entry<'_, T, C> {
     type Target = T;
 
     fn deref(&self) -> &Self::Target {
@@ -549,73 +590,74 @@ impl<T> fmt::Debug for IntoIter<T> {
 }
 
 /// An iterator over the entries of a `SkipSet`.
-pub struct Iter<'a, T> {
-    inner: map::Iter<'a, T, ()>,
+pub struct Iter<'a, T, C = BasicComparator> {
+    inner: map::Iter<'a, T, (), C>,
 }
 
-impl<'a, T> Iterator for Iter<'a, T>
+impl<'a, T, C> Iterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T, T>,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, T> DoubleEndedIterator for Iter<'a, T>
+impl<'a, T, C> DoubleEndedIterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T, T>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<T> fmt::Debug for Iter<'_, T> {
+impl<T, C> fmt::Debug for Iter<'_, T, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
 /// An iterator over a subset of entries of a `SkipSet`.
-pub struct Range<'a, Q, R, T>
+pub struct Range<'a, Q, R, T, C = BasicComparator>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T, T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    inner: map::Range<'a, Q, R, T, ()>,
+    inner: map::Range<'a, Q, R, T, (), C>,
 }
 
-impl<'a, Q, R, T> Iterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> Iterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T, T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, Q, R, T> DoubleEndedIterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> DoubleEndedIterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T, T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<Q, R, T> fmt::Debug for Range<'_, Q, R, T>
+impl<Q, R, T, C> fmt::Debug for Range<'_, Q, R, T, C>
 where
-    T: Ord + Comparable<Q> + fmt::Debug,
+    T: fmt::Debug,
+    C: Comparator<T, T> + Comparator<T, Q>,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/tests/map.rs b/crossbeam-skiplist/tests/map.rs
index 2fa8c2b..a889109 100644
--- a/crossbeam-skiplist/tests/map.rs
+++ b/crossbeam-skiplist/tests/map.rs
@@ -962,3 +962,91 @@ fn issue_1178() {
         map.insert(k, v);
     }
 }
+
+mod comparator {
+    use std::cmp::Ordering;
+
+    use crossbeam_skiplist::{
+        SkipMap, SkipSet,
+        comparator::{Comparator, Equivalator},
+    };
+
+    struct IgnoreCase;
+
+    fn fold(s: &str) -> impl Iterator<Item = u8> + '_ {
+        s.bytes().map(|b| b.to_ascii_lowercase())
+    }
+
+    impl Equivalator<String, str> for IgnoreCase {
+        fn equivalent(&self, lhs: &String, rhs: &str) -> bool {
+            self.compare(lhs, rhs).is_eq()
+        }
+    }
+    impl Comparator<String, str> for IgnoreCase {
+        fn compare(&self, lhs: &String, rhs: &str) -> Ordering {
+            fold(lhs).cmp(fold(rhs))
+        }
+    }
+    impl Equivalator<String> for IgnoreCase {
+        fn equivalent(&self, lhs: &String, rhs: &String) -> bool {
+            self.compare(lhs, rhs).is_eq()
+        }
+    }
+    impl Comparator<String> for IgnoreCase {
+        fn compare(&self, lhs: &String, rhs: &String) -> Ordering {
+            fold(lhs).cmp(fold(rhs))
+        }
+    }
+
+    #[test]
+    fn case_insensitive_map() {
+        let map = SkipMap::<String, u32, _>::with_comparator(IgnoreCase);
+        map.insert("abc".to_string(), 1);
+        map.insert("ABC".to_string(), 2);
+        map.insert("Abd".to_string(), 3);
+        map.insert("aaa".to_string(), 4);
+        assert_eq!(map.len(), 3);
+        assert_eq!(*map.get("aBc").unwrap().value(), 2);
+        assert!(map.contains_key("AAA"));
+        let keys: Vec<_> = map.iter().map(|e| e.key().clone()).collect();
+        assert_eq!(keys, ["aaa", "ABC", "Abd"]);
+        let r: Vec<_> = map
+            .range::<String, _>("AB".to_string().."abd".to_string())
+            .map(|e| *e.value())
+            .collect();
+        assert_eq!(r, [2]);
+        let r: Vec<_> = map.iter().rev().map(|e| *e.value()).collect();
+        assert_eq!(r, [3, 2, 4]);
+        assert_eq!(*map.remove("ABC").unwrap().value(), 2);
+        assert!(map.get("abc").is_none());
+        assert_eq!(map.len(), 2);
+    }
+
+    #[test]
+    fn reversed_set() {
+        struct Rev;
+        impl Equivalator<i32> for Rev {
+            fn equivalent(&self, l: &i32, r: &i32) -> bool {
+                l == r
+            }
+        }
+        impl Comparator<i32> for Rev {
+            fn compare(&self, l: &i32, r: &i32) -> Ordering {
+                r.cmp(l)
+            }
+        }
+        let set = SkipSet::with_comparator(Rev);
+        for i in 0..100 {
+            set.insert(i);
+        }
+        let v: Vec<_> = set.iter().map(|e| *e).collect();
+        assert_eq!(v, (0..100).rev().collect::<Vec<_>>());
+        assert_eq!(*set.front().unwrap(), 99);
+        assert_eq!(*set.pop_back().unwrap(), 0);
+        let r: Vec<_> = set
+            .range((std::ops::Bound::Included(50), std::ops::Bound::Included(48)))
+            .map(|e| *e)
+            .collect();
+        assert_eq!(r, [50, 49, 48]);
+    }
+}
```

</details>

<details><summary>reply</summary>

Mid-way through refactoring `base.rs` to add the `C` comparator parameter; a header-rewrite regex failed on a line, so I'm fixing it.

Now manual edits: struct, constructors, search internals, and the bound helpers.

Header script already turned it into `impl<K, V, C>`; adjusting the pattern.

Still wiring the `C` comparator through `map.rs`; now fixing the `new`, `Default` and `FromIterator` impls so they stay tied to `BasicComparator`, then compiling.

Code and tests are done and passing; I'm adding a changelog entry and cleaning up my scratch files.

`SkipMap`, `SkipSet` and `base::SkipList` now take a comparator at runtime through the new `crossbeam_skiplist::comparator` module. The existing tests and doctests pass, and clippy and `cargo doc` are clean. I also ran `cargo check --no-default-features --features alloc`, which succeeds. I haven't run the benches (they need nightly).

- **New module:** it has `Equivalator`, `Comparator` and `BasicComparator` as you specified. `BasicComparator` goes through the existing `Equivalent`/`Comparable` traits, so its ordering is the same as today's.
- **Type parameter:** `C = BasicComparator` is the new last parameter on the three collections and on `Entry`, `RefEntry`, `Iter`, `RefIter`, `Range` and `RefRange`, plus the map and set equivalents. Code that names `SkipMap<K, V>` or calls `SkipMap::new()` is unaffected, and `new()` is still tied to `BasicComparator`.
- **Constructors:** `with_comparator` exists on all three, with the signatures you gave.
- **Bounds:** every lookup, insert, remove, range, iteration and unlink path now calls the comparator instead of `Ord`. The stored key type `K` needs `C: Comparator<K, K>`, and a query type `Q` needs `C: Comparator<K, Q>`. For example, a `SkipMap<String, u32, _>` with a case-insensitive comparator can be queried with a `&str`.
- **Looser bounds:** I dropped the `K: Ord` bound from `Debug` impls, since they never compare keys.
- **Send/Sync:** `SkipList`'s `Send`/`Sync` impls now also require `C: Send + Sync`.
- **Unchanged:** `Default` and `FromIterator` stay tied to `BasicComparator`, and `IntoIter` has no comparator parameter.
- **Tests and docs:** I added two tests in `tests/map.rs`, one for a case-insensitive map and one for a reversed-order set. The case-insensitive test covers `get` with `&str`, `contains_key`, iteration in both directions, a range, `remove` and `len`. Doc examples are on `SkipMap::with_comparator` and `SkipSet::with_comparator`.
- **Changelog:** I added an "Unreleased" entry to `CHANGELOG.md`.

I did not commit anything.

</details>

### claude, hush: pass

Files: [crossbeam-skiplist/src/base.rs](../hush/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/base.rs), [crossbeam-skiplist/src/comparator.rs](../hush/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/comparator.rs), [crossbeam-skiplist/src/lib.rs](../hush/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/lib.rs), [crossbeam-skiplist/src/map.rs](../hush/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/map.rs), [crossbeam-skiplist/src/set.rs](../hush/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/set.rs), [crossbeam-skiplist/tests/comparator.rs](../hush/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/tests/comparator.rs)

<details><summary>diff</summary>

```diff
diff --git a/crossbeam-skiplist/src/base.rs b/crossbeam-skiplist/src/base.rs
index a73ee8a..f2cccd3 100644
--- a/crossbeam-skiplist/src/base.rs
+++ b/crossbeam-skiplist/src/base.rs
@@ -15,7 +15,7 @@ use core::{
 use crossbeam_epoch::{self as epoch, Atomic, Collector, Guard, Shared};
 use crossbeam_utils::CachePadded;
 
-use super::equivalent::Comparable;
+use super::comparator::{BasicComparator, Comparator};
 use crate::alloc_helper::Global;
 
 /// Number of bits needed to store height.
@@ -304,7 +304,7 @@ impl<'a, K, V> NodeRef<'a, K, V> {
     /// Decrements the reference count of a node, pinning the thread and destroying the node
     /// if the count become zero.
     #[inline]
-    unsafe fn decrement_with_pin<F>(self, parent: &SkipList<K, V>, pin: F)
+    unsafe fn decrement_with_pin<F, C>(self, parent: &SkipList<K, V, C>, pin: F)
     where
         F: FnOnce() -> Guard,
     {
@@ -451,7 +451,7 @@ struct HotData {
 }
 
 /// A lock-free skip list.
-// TODO(stjepang): Embed a custom `epoch::Collector` inside `SkipList<K, V>`. Instead of adding
+// TODO(stjepang): Embed a custom `epoch::Collector` inside `SkipList<K, V, C>`. Instead of adding
 // garbage to the default global collector, we should add it to a local collector tied to the
 // particular skip list instance.
 //
@@ -463,7 +463,7 @@ struct HotData {
 // As a further future optimization, if `!mem::needs_drop::<K>() && !mem::needs_drop::<V>()`
 // (neither key nor the value have destructors), there's no point in creating a new local
 // collector, so we should simply use the global one.
-pub struct SkipList<K, V> {
+pub struct SkipList<K, V, C = BasicComparator> {
     /// The head of the skip list (just a dummy node, not a real entry).
     head: Head<K, V>,
 
@@ -472,15 +472,26 @@ pub struct SkipList<K, V> {
 
     /// Hot data associated with the skip list, stored in a dedicated cache line.
     hot_data: CachePadded<HotData>,
+
+    /// The comparator that defines the ordering of keys.
+    comparator: C,
 }
 
-unsafe impl<K: Send + Sync, V: Send + Sync> Send for SkipList<K, V> {}
-unsafe impl<K: Send + Sync, V: Send + Sync> Sync for SkipList<K, V> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Send + Sync> Send for SkipList<K, V, C> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Send + Sync> Sync for SkipList<K, V, C> {}
 
 impl<K, V> SkipList<K, V> {
     /// Returns a new, empty skip list.
     pub fn new(collector: Collector) -> Self {
+        Self::with_comparator(collector, BasicComparator)
+    }
+}
+
+impl<K, V, C> SkipList<K, V, C> {
+    /// Returns a new, empty skip list that orders its keys with `comparator`.
+    pub fn with_comparator(collector: Collector, comparator: C) -> Self {
         Self {
+            comparator,
             head: Head::new(),
             collector,
             hot_data: CachePadded::new(HotData {
@@ -517,12 +528,12 @@ impl<K, V> SkipList<K, V> {
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Returns the entry with the smallest key.
-    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.next_node(self.head.as_tower(), Bound::Unbounded, guard)?;
         Some(Entry {
@@ -533,7 +544,7 @@ where
     }
 
     /// Returns the entry with the largest key.
-    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.search_bound::<K>(Bound::Unbounded, true, guard)?;
         Some(Entry {
@@ -546,21 +557,21 @@ where
     /// Returns `true` if the map contains a value for the specified key.
     pub fn contains_key<Q>(&self, key: &Q, guard: &Guard) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.get(key, guard).is_some()
     }
 
     /// Returns an entry with the specified `key`.
-    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>>
+    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
         let n = self.search_bound(Bound::Included(key), false, guard)?;
-        if !n.key.equivalent(key) {
+        if !self.comparator.equivalent(&n.key, key) {
             return None;
         }
 
@@ -578,9 +589,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -599,9 +610,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -614,7 +625,7 @@ where
     }
 
     /// Finds an entry with the specified key, or inserts a new `key`-`value` pair if none exist.
-    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| false, guard)
     }
 
@@ -626,7 +637,7 @@ where
     /// discarded. If closure is modifying some other state (such as shared counters or shared
     /// objects), it may lead to <u>undesired behaviour</u> such as counters being changed without
     /// result of closure inserted
-    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -634,7 +645,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V> {
+    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V, C> {
         self.check_guard(guard);
         Iter {
             parent: self,
@@ -645,7 +656,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn ref_iter(&self) -> RefIter<'_, K, V> {
+    pub fn ref_iter(&self) -> RefIter<'_, K, V, C> {
         RefIter {
             parent: self,
             head: None,
@@ -658,9 +669,9 @@ where
         &'a self,
         range: R,
         guard: &'g Guard,
-    ) -> Range<'a, 'g, Q, R, K, V>
+    ) -> Range<'a, 'g, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -677,9 +688,9 @@ where
 
     /// Returns an iterator over a subset of entries in the skip list.
     #[allow(clippy::needless_lifetimes)]
-    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V>
+    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -825,7 +836,7 @@ where
         guard: &'a Guard,
     ) -> Option<NodeRef<'a, K, V>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -887,11 +898,11 @@ where
                         // bound, we return the last node before the condition became true. For the
                         // lower bound, we return the first node after the condition became true.
                         if upper_bound {
-                            if !below_upper_bound(&bound, &c.key) {
+                            if !below_upper_bound(&self.comparator, &bound, &c.key) {
                                 break;
                             }
                             result = Some(c);
-                        } else if above_lower_bound(&bound, &c.key) {
+                        } else if above_lower_bound(&self.comparator, &bound, &c.key) {
                             result = Some(c);
                             break;
                         }
@@ -910,7 +921,7 @@ where
     /// Searches for a key in the skip list and returns a list of all adjacent nodes.
     fn search_position<'a, Q>(&'a self, key: &Q, guard: &'a Guard) -> Position<'a, K, V>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -971,7 +982,7 @@ where
 
                         // If `curr` contains a key that is greater than or equal to `key`, we're
                         // done with this level.
-                        match c.key.compare(key) {
+                        match self.comparator.compare(&c.key, key) {
                             cmp::Ordering::Greater => break,
                             cmp::Ordering::Equal => {
                                 result.found = Some(c);
@@ -1004,7 +1015,7 @@ where
         value: F,
         replace: CompareF,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
         CompareF: Fn(&V) -> bool,
@@ -1155,7 +1166,10 @@ where
                     // the tower without breaking any invariants. Note that building higher levels
                     // is completely optional. Only the lowest level really matters, and all the
                     // higher levels are there just to make searching faster.
-                    if succ.as_ref().map(|s| &s.key) == Some(&n.key) {
+                    if succ
+                        .as_ref()
+                        .is_some_and(|s| self.comparator.equivalent(&s.key, &n.key))
+                    {
                         search = self.search_position(&n.key, guard);
                         continue;
                     }
@@ -1218,16 +1232,17 @@ where
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
     V: Send + 'static,
+    C: Comparator<K, K>,
 {
     /// Inserts a `key`-`value` pair into the skip list and returns the new entry.
     ///
     /// If there is an existing entry with this key, it will be removed before inserting the new
     /// one.
-    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| true, guard)
     }
 
@@ -1242,7 +1257,7 @@ where
         value: V,
         compare_fn: F,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -1250,9 +1265,9 @@ where
     }
 
     /// Removes an entry with the specified `key` from the map and returns it.
-    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -1320,7 +1335,7 @@ where
     }
 
     /// Removes an entry from the front of the skip list.
-    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.front(guard)?;
@@ -1335,7 +1350,7 @@ where
     }
 
     /// Removes an entry from the back of the skip list.
-    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.back(guard)?;
@@ -1393,7 +1408,7 @@ where
     }
 }
 
-impl<K, V> Drop for SkipList<K, V> {
+impl<K, V, C> Drop for SkipList<K, V, C> {
     fn drop(&mut self) {
         unsafe {
             let mut node = NodeRef::from_shared(
@@ -1419,9 +1434,9 @@ impl<K, V> Drop for SkipList<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipList<K, V>
+impl<K, V, C> fmt::Debug for SkipList<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -1429,7 +1444,7 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipList<K, V> {
+impl<K, V, C> IntoIterator for SkipList<K, V, C> {
     type Item = (K, V);
     type IntoIter = IntoIter<K, V>;
 
@@ -1464,13 +1479,13 @@ impl<K, V> IntoIterator for SkipList<K, V> {
 /// The lifetimes of the key and value are the same as that of the `Guard`
 /// used when creating the `Entry` (`'g`). This lifetime is also constrained to
 /// not outlive the `SkipList`.
-pub struct Entry<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Entry<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'g, K, V>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Entry<'a, 'g, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1487,7 +1502,7 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1496,15 +1511,16 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     ///
     /// This method may return `None` if the reference count is already 0 and
     /// the node has been queued for deletion.
-    pub fn pin(&self) -> Option<RefEntry<'a, K, V>> {
+    pub fn pin(&self) -> Option<RefEntry<'a, K, V, C>> {
         unsafe { RefEntry::try_acquire(self.parent, self.node) }
     }
 }
 
-impl<K, V> Entry<'_, '_, K, V>
+impl<K, V, C> Entry<'_, '_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
     V: Send + 'static,
+    C: Comparator<K, K>,
 {
     /// Removes the entry from the skip list.
     ///
@@ -1526,7 +1542,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, '_, K, V> {
+impl<K, V, C> Clone for Entry<'_, '_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             parent: self.parent,
@@ -1536,7 +1552,7 @@ impl<K, V> Clone for Entry<'_, '_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1549,9 +1565,9 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K, V> Entry<'a, 'g, K, V>
+impl<'a: 'g, 'g, K, V, C> Entry<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self) -> bool {
@@ -1565,7 +1581,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self.parent.next_node(
             self.node.as_tower(),
             Bound::Excluded(&self.node.key),
@@ -1590,7 +1606,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self
             .parent
             .search_bound(Bound::Excluded(&self.node.key), true, self.guard)?;
@@ -1606,12 +1622,12 @@ where
 ///
 /// You *must* call `release` to free this type, otherwise the node will be
 /// leaked. This is because releasing the entry requires a `Guard`.
-pub struct RefEntry<'a, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct RefEntry<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'a, K, V>,
 }
 
-impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefEntry<'a, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1628,7 +1644,7 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1650,9 +1666,9 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     /// Tries to create a new `RefEntry` by incrementing the reference count of
     /// a node.
     unsafe fn try_acquire(
-        parent: &'a SkipList<K, V>,
+        parent: &'a SkipList<K, V, C>,
         node: NodeRef<'_, K, V>,
-    ) -> Option<RefEntry<'a, K, V>> {
+    ) -> Option<RefEntry<'a, K, V, C>> {
         if unsafe { node.try_increment() } {
             Some(RefEntry {
                 parent,
@@ -1667,10 +1683,11 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 }
 
-impl<K, V> RefEntry<'_, K, V>
+impl<K, V, C> RefEntry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
     V: Send + 'static,
+    C: Comparator<K, K>,
 {
     /// Removes the entry from the skip list.
     ///
@@ -1694,7 +1711,7 @@ where
     }
 }
 
-impl<K, V> Clone for RefEntry<'_, K, V> {
+impl<K, V, C> Clone for RefEntry<'_, K, V, C> {
     fn clone(&self) -> Self {
         unsafe {
             // Incrementing will always succeed since we're already holding a reference to the node.
@@ -1707,7 +1724,7 @@ impl<K, V> Clone for RefEntry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for RefEntry<'_, K, V>
+impl<K, V, C> fmt::Debug for RefEntry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1720,9 +1737,9 @@ where
     }
 }
 
-impl<'a, K, V> RefEntry<'a, K, V>
+impl<'a, K, V, C> RefEntry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self, guard: &Guard) -> bool {
@@ -1736,7 +1753,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1763,7 +1780,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1780,20 +1797,20 @@ where
 }
 
 /// An iterator over the entries of a `SkipList`.
-pub struct Iter<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Iter<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Iterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Iterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1804,7 +1821,7 @@ where
             }
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1817,11 +1834,11 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> DoubleEndedIterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> DoubleEndedIterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -1831,7 +1848,7 @@ where
                 .search_bound::<K>(Bound::Unbounded, true, self.guard),
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1844,7 +1861,7 @@ where
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Iter<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1858,13 +1875,13 @@ where
 }
 
 /// An iterator over reference-counted entries of a `SkipList`.
-pub struct RefIter<'a, K, V> {
-    parent: &'a SkipList<K, V>,
-    head: Option<RefEntry<'a, K, V>>,
-    tail: Option<RefEntry<'a, K, V>>,
+pub struct RefIter<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
+    head: Option<RefEntry<'a, K, V, C>>,
+    tail: Option<RefEntry<'a, K, V, C>>,
 }
 
-impl<K, V> fmt::Debug for RefIter<'_, K, V>
+impl<K, V, C> fmt::Debug for RefIter<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1883,12 +1900,12 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V>
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match &self.head {
             Some(e) => e.next(guard),
@@ -1896,7 +1913,9 @@ where
         };
         match (&next_head, &self.tail) {
             // The next key is larger than the latest tail key we observed with this iterator.
-            (Some(ref next), Some(t)) if next.key() >= t.key() => {
+            (Some(ref next), Some(t))
+                if self.parent.comparator.compare(next.key(), t.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1915,7 +1934,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match &self.tail {
             Some(e) => e.prev(guard),
@@ -1923,7 +1942,9 @@ where
         };
         match (&self.head, &next_tail) {
             // The prev key is smaller than the latest head key we observed with this iterator.
-            (Some(h), Some(next)) if h.key() >= next.key() => {
+            (Some(h), Some(next))
+                if self.parent.comparator.compare(h.key(), next.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1942,7 +1963,7 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C> {
     /// Decrements the reference count of `RefEntry` owned by the iterator.
     pub fn drop_impl(&mut self, guard: &Guard) {
         self.parent.check_guard(guard);
@@ -1956,13 +1977,13 @@ impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipList`.
-pub struct Range<'a: 'g, 'g, Q, R, K, V>
+pub struct Range<'a: 'g, 'g, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     range: R,
@@ -1970,15 +1991,16 @@ where
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> Iterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> Iterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, Q>,
+    C: Comparator<K, K>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1991,14 +2013,14 @@ where
             match self.tail {
                 Some(t) => {
                     let bound = Bound::Excluded(&t.as_ref().key);
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2013,13 +2035,14 @@ where
     }
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, Q>,
+    C: Comparator<K, K>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -2032,14 +2055,14 @@ where
             match self.head {
                 Some(h) => {
                     let bound = Bound::Excluded(&h.as_ref().key);
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2054,9 +2077,10 @@ where
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, '_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, '_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2071,38 +2095,39 @@ where
 }
 
 /// An iterator over reference-counted subset of entries of a `SkipList`.
-pub struct RefRange<'a, Q, R, K, V>
+pub struct RefRange<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
-    pub(crate) head: Option<RefEntry<'a, K, V>>,
-    pub(crate) tail: Option<RefEntry<'a, K, V>>,
+    parent: &'a SkipList<K, V, C>,
+    pub(crate) head: Option<RefEntry<'a, K, V, C>>,
+    pub(crate) tail: Option<RefEntry<'a, K, V, C>>,
     pub(crate) range: R,
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-unsafe impl<Q, R, K, V> Send for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C> Send for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-unsafe impl<Q, R, K, V> Sync for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C> Sync for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-impl<Q, R, K, V> fmt::Debug for RefRange<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2116,14 +2141,15 @@ where
     }
 }
 
-impl<'a, Q, R, K: 'a, V: 'a> RefRange<'a, Q, R, K, V>
+impl<'a, Q, R, K: 'a, V: 'a, C> RefRange<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, Q>,
+    C: Comparator<K, K>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match self.head {
             Some(ref e) => e.next(guard),
@@ -2134,7 +2160,7 @@ where
             match self.tail {
                 Some(ref t) => {
                     let bound = Bound::Excluded(t.key());
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2150,7 +2176,7 @@ where
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2171,7 +2197,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match self.tail {
             Some(ref e) => e.prev(guard),
@@ -2182,7 +2208,7 @@ where
             match self.head {
                 Some(ref h) => {
                     let bound = Bound::Excluded(h.key());
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2198,7 +2224,7 @@ where
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2217,7 +2243,14 @@ where
             None
         }
     }
+}
 
+impl<'a, Q, R, K: 'a, V: 'a, C> RefRange<'a, Q, R, K, V, C>
+where
+    C: Comparator<K, Q>,
+    R: RangeBounds<Q>,
+    Q: ?Sized,
+{
     /// Decrements a reference count owned by this iterator.
     pub fn drop_impl(&mut self, guard: &Guard) {
         self.parent.check_guard(guard);
@@ -2307,9 +2340,9 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 
 /// Helper function to retry an operation until pinning succeeds or `None` is
 /// returned.
-pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V>(mut f: F) -> Option<RefEntry<'a, K, V>>
+pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V, C>(mut f: F) -> Option<RefEntry<'a, K, V, C>>
 where
-    F: FnMut() -> Option<Entry<'a, 'g, K, V>>,
+    F: FnMut() -> Option<Entry<'a, 'g, K, V, C>>,
 {
     loop {
         if let Some(e) = f()?.pin() {
@@ -2319,27 +2352,27 @@ where
 }
 
 /// Helper function to check if a value is above a lower bound
-fn above_lower_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn above_lower_bound<V, T, C>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_ge(),
-        Bound::Excluded(key) => other.compare(key).is_gt(),
+        Bound::Included(key) => comparator.compare(other, key).is_ge(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_gt(),
     }
 }
 
 /// Helper function to check if a value is below an upper bound
-fn below_upper_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn below_upper_bound<V, T, C>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_le(),
-        Bound::Excluded(key) => other.compare(key).is_lt(),
+        Bound::Included(key) => comparator.compare(other, key).is_le(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_lt(),
     }
 }
diff --git a/crossbeam-skiplist/src/comparator.rs b/crossbeam-skiplist/src/comparator.rs
new file mode 100644
index 0000000..282e7dc
--- /dev/null
+++ b/crossbeam-skiplist/src/comparator.rs
@@ -0,0 +1,55 @@
+//! Traits for comparing keys with a runtime-chosen ordering.
+
+use core::cmp::Ordering;
+
+use crate::equivalent::{Comparable, Equivalent};
+
+/// Key equivalence with a comparator value.
+///
+/// Unlike [`Equivalent`], the implementor is a separate value (the comparator) rather than the
+/// key itself, so the equivalence can be chosen at runtime.
+pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
+    /// Returns `true` if `lhs` and `rhs` are equivalent.
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
+}
+
+/// Key ordering with a comparator value.
+///
+/// Unlike [`Comparable`], the implementor is a separate value (the comparator) rather than the
+/// key itself, so the ordering can be chosen at runtime.
+///
+/// # Contract
+///
+/// The ordering must be a total order, consistent with [`Equivalator::equivalent`], and must not
+/// change while the comparator is in use by a collection.
+pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
+    /// Returns the ordering of `lhs` relative to `rhs`.
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
+}
+
+/// The default comparator. Orders keys through the [`Comparable`] and [`Equivalent`] traits,
+/// which for most types means their [`Ord`] implementation.
+#[derive(Clone, Copy, Debug, Default)]
+pub struct BasicComparator;
+
+impl<L, R> Equivalator<L, R> for BasicComparator
+where
+    L: ?Sized + Equivalent<R>,
+    R: ?Sized,
+{
+    #[inline]
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
+        Equivalent::equivalent(lhs, rhs)
+    }
+}
+
+impl<L, R> Comparator<L, R> for BasicComparator
+where
+    L: ?Sized + Comparable<R>,
+    R: ?Sized,
+{
+    #[inline]
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
+        Comparable::compare(lhs, rhs)
+    }
+}
diff --git a/crossbeam-skiplist/src/lib.rs b/crossbeam-skiplist/src/lib.rs
index 5ff8e74..5337e3d 100644
--- a/crossbeam-skiplist/src/lib.rs
+++ b/crossbeam-skiplist/src/lib.rs
@@ -265,4 +265,5 @@ pub mod set;
 #[doc(inline)]
 pub use crate::{map::SkipMap, set::SkipSet};
 
+pub mod comparator;
 pub mod equivalent;
diff --git a/crossbeam-skiplist/src/map.rs b/crossbeam-skiplist/src/map.rs
index c7c5408..b918e8b 100644
--- a/crossbeam-skiplist/src/map.rs
+++ b/crossbeam-skiplist/src/map.rs
@@ -11,7 +11,7 @@ use crossbeam_epoch as epoch;
 
 use crate::{
     base::{self, try_pin_loop},
-    equivalent::Comparable,
+    comparator::{BasicComparator, Comparator},
 };
 
 /// An ordered map based on a lock-free skip list.
@@ -20,8 +20,8 @@ use crate::{
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeMap`]: std::collections::BTreeMap
-pub struct SkipMap<K, V> {
-    inner: base::SkipList<K, V>,
+pub struct SkipMap<K, V, C = BasicComparator> {
+    inner: base::SkipList<K, V, C>,
 }
 
 impl<K, V> SkipMap<K, V> {
@@ -35,8 +35,57 @@ impl<K, V> SkipMap<K, V> {
     /// let map: SkipMap<i32, &str> = SkipMap::new();
     /// ```
     pub fn new() -> Self {
+        Self::with_comparator(BasicComparator)
+    }
+}
+
+impl<K, V, C> SkipMap<K, V, C> {
+    /// Returns a new, empty map that orders its keys with `comparator`.
+    ///
+    /// # Example
+    ///
+    /// ```
+    /// use std::cmp::Ordering;
+    /// use crossbeam_skiplist::{
+    ///     SkipMap,
+    ///     comparator::{Comparator, Equivalator},
+    /// };
+    ///
+    /// struct IgnoreCase;
+    ///
+    /// impl Equivalator<String, str> for IgnoreCase {
+    ///     fn equivalent(&self, lhs: &String, rhs: &str) -> bool {
+    ///         lhs.eq_ignore_ascii_case(rhs)
+    ///     }
+    /// }
+    ///
+    /// impl Comparator<String, str> for IgnoreCase {
+    ///     fn compare(&self, lhs: &String, rhs: &str) -> Ordering {
+    ///         let l = lhs.bytes().map(|b| b.to_ascii_lowercase());
+    ///         let r = rhs.bytes().map(|b| b.to_ascii_lowercase());
+    ///         l.cmp(r)
+    ///     }
+    /// }
+    ///
+    /// impl Equivalator<String> for IgnoreCase {
+    ///     fn equivalent(&self, lhs: &String, rhs: &String) -> bool {
+    ///         lhs.eq_ignore_ascii_case(rhs)
+    ///     }
+    /// }
+    ///
+    /// impl Comparator<String> for IgnoreCase {
+    ///     fn compare(&self, lhs: &String, rhs: &String) -> Ordering {
+    ///         self.compare(lhs, rhs.as_str())
+    ///     }
+    /// }
+    ///
+    /// let map = SkipMap::with_comparator(IgnoreCase);
+    /// map.insert("abc".to_string(), 1);
+    /// assert_eq!(*map.get("aBc").unwrap().value(), 1);
+    /// ```
+    pub fn with_comparator(comparator: C) -> Self {
         Self {
-            inner: base::SkipList::new(epoch::default_collector().clone()),
+            inner: base::SkipList::with_comparator(epoch::default_collector().clone(), comparator),
         }
     }
 
@@ -80,9 +129,9 @@ impl<K, V> SkipMap<K, V> {
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -99,7 +148,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.front().unwrap().value(), "five");
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.front(guard)).map(Entry::new)
     }
@@ -119,7 +168,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.back().unwrap().value(), "six");
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.back(guard)).map(Entry::new)
     }
@@ -138,7 +187,7 @@ where
     /// ```
     pub fn contains_key<Q>(&self, key: &Q) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -160,9 +209,9 @@ where
     /// numbers.insert("six", 6);
     /// assert_eq!(*numbers.get("six").unwrap().value(), 6);
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -195,9 +244,9 @@ where
     /// let greater_than_thirteen = numbers.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -227,9 +276,9 @@ where
     /// let less_than_six = numbers.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -253,7 +302,7 @@ where
     /// let jobs_age = ages.get_or_insert("Steve Jobs", -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.get_or_insert(key, value, guard))
     }
@@ -283,7 +332,7 @@ where
     /// let jobs_age = ages.get_or_insert_with("Steve Jobs", || -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -313,7 +362,7 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn iter(&self) -> Iter<'_, K, V> {
+    pub fn iter(&self) -> Iter<'_, K, V, C> {
         Iter {
             inner: self.inner.ref_iter(),
         }
@@ -340,10 +389,10 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V, C>
     where
         R: RangeBounds<Q>,
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         Range {
@@ -352,10 +401,11 @@ where
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
     V: Send + 'static,
+    C: Comparator<K, K>,
 {
     /// Inserts a `key`-`value` pair into the map and returns the new entry.
     ///
@@ -374,7 +424,7 @@ where
     ///
     /// assert_eq!(*map.get("key").unwrap().value(), "value");
     /// ```
-    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.insert(key, value, guard))
     }
@@ -401,7 +451,7 @@ where
     /// map.compare_insert("absent_key", 0, |_| false);
     /// assert_eq!(*map.get("absent_key").unwrap().value(), 0);
     /// ```
-    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V>
+    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -427,9 +477,9 @@ where
     /// map.insert("key", "value");
     /// assert_eq!(*map.remove("key").unwrap().value(), "value");
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -458,7 +508,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_front(guard).map(Entry::new)
     }
@@ -485,7 +535,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_back(guard).map(Entry::new)
     }
@@ -515,9 +565,9 @@ impl<K, V> Default for SkipMap<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipMap<K, V>
+impl<K, V, C> fmt::Debug for SkipMap<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -525,7 +575,7 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipMap<K, V> {
+impl<K, V, C> IntoIterator for SkipMap<K, V, C> {
     type Item = (K, V);
     type IntoIter = IntoIter<K, V>;
 
@@ -536,14 +586,14 @@ impl<K, V> IntoIterator for SkipMap<K, V> {
     }
 }
 
-impl<'a, K, V> IntoIterator for &'a SkipMap<K, V>
+impl<'a, K, V, C> IntoIterator for &'a SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
-    type Item = Entry<'a, K, V>;
-    type IntoIter = Iter<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
+    type IntoIter = Iter<'a, K, V, C>;
 
-    fn into_iter(self) -> Iter<'a, K, V> {
+    fn into_iter(self) -> Iter<'a, K, V, C> {
         self.iter()
     }
 }
@@ -565,12 +615,12 @@ where
 }
 
 /// A reference-counted entry in a map.
-pub struct Entry<'a, K, V> {
-    inner: ManuallyDrop<base::RefEntry<'a, K, V>>,
+pub struct Entry<'a, K, V, C = BasicComparator> {
+    inner: ManuallyDrop<base::RefEntry<'a, K, V, C>>,
 }
 
-impl<'a, K, V> Entry<'a, K, V> {
-    fn new(inner: base::RefEntry<'a, K, V>) -> Self {
+impl<'a, K, V, C> Entry<'a, K, V, C> {
+    fn new(inner: base::RefEntry<'a, K, V, C>) -> Self {
         Self {
             inner: ManuallyDrop::new(inner),
         }
@@ -592,7 +642,7 @@ impl<'a, K, V> Entry<'a, K, V> {
     }
 }
 
-impl<K, V> Drop for Entry<'_, K, V> {
+impl<K, V, C> Drop for Entry<'_, K, V, C> {
     fn drop(&mut self) {
         unsafe {
             ManuallyDrop::into_inner(ptr::read(&self.inner)).release_with_pin(epoch::pin);
@@ -600,9 +650,9 @@ impl<K, V> Drop for Entry<'_, K, V> {
     }
 }
 
-impl<'a, K, V> Entry<'a, K, V>
+impl<'a, K, V, C> Entry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Moves to the next entry in the map.
     pub fn move_next(&mut self) -> bool {
@@ -617,22 +667,23 @@ where
     }
 
     /// Returns the next entry in the map.
-    pub fn next(&self) -> Option<Entry<'a, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 
     /// Returns the previous entry in the map.
-    pub fn prev(&self) -> Option<Entry<'a, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.prev(guard).map(Entry::new)
     }
 }
 
-impl<K, V> Entry<'_, K, V>
+impl<K, V, C> Entry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
     V: Send + 'static,
+    C: Comparator<K, K>,
 {
     /// Removes the entry from the map.
     ///
@@ -643,7 +694,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, K, V> {
+impl<K, V, C> Clone for Entry<'_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -651,7 +702,7 @@ impl<K, V> Clone for Entry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -684,39 +735,39 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 }
 
 /// An iterator over the entries of a `SkipMap`.
-pub struct Iter<'a, K, V> {
-    inner: base::RefIter<'a, K, V>,
+pub struct Iter<'a, K, V, C = BasicComparator> {
+    inner: base::RefIter<'a, K, V, C>,
 }
 
-impl<'a, K, V> Iterator for Iter<'a, K, V>
+impl<'a, K, V, C> Iterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, K, V> DoubleEndedIterator for Iter<'a, K, V>
+impl<'a, K, V, C> DoubleEndedIterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, K, V> {
+impl<K, V, C> fmt::Debug for Iter<'_, K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
-impl<K, V> Drop for Iter<'_, K, V> {
+impl<K, V, C> Drop for Iter<'_, K, V, C> {
     fn drop(&mut self) {
         let guard = &epoch::pin();
         self.inner.drop_impl(guard);
@@ -724,44 +775,47 @@ impl<K, V> Drop for Iter<'_, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipMap`.
-pub struct Range<'a, Q, R, K, V>
+pub struct Range<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    pub(crate) inner: base::RefRange<'a, Q, R, K, V>,
+    pub(crate) inner: base::RefRange<'a, Q, R, K, V, C>,
 }
 
-impl<'a, Q, R, K, V> Iterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> Iterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, Q>,
+    C: Comparator<K, K>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, Q, R, K, V> DoubleEndedIterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> DoubleEndedIterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, Q>,
+    C: Comparator<K, K>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -775,9 +829,9 @@ where
     }
 }
 
-impl<Q, R, K, V> Drop for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> Drop for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/src/set.rs b/crossbeam-skiplist/src/set.rs
index 4e91f6c..2bc985f 100644
--- a/crossbeam-skiplist/src/set.rs
+++ b/crossbeam-skiplist/src/set.rs
@@ -5,7 +5,10 @@ use core::{
     ops::{Bound, Deref, RangeBounds},
 };
 
-use crate::{equivalent::Comparable, map};
+use crate::{
+    comparator::{BasicComparator, Comparator},
+    map,
+};
 
 /// A set based on a lock-free skip list.
 ///
@@ -13,8 +16,8 @@ use crate::{equivalent::Comparable, map};
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeSet`]: std::collections::BTreeSet
-pub struct SkipSet<T> {
-    inner: map::SkipMap<T, ()>,
+pub struct SkipSet<T, C = BasicComparator> {
+    inner: map::SkipMap<T, (), C>,
 }
 
 impl<T> SkipSet<T> {
@@ -28,8 +31,44 @@ impl<T> SkipSet<T> {
     /// let set: SkipSet<i32> = SkipSet::new();
     /// ```
     pub fn new() -> Self {
+        Self::with_comparator(BasicComparator)
+    }
+}
+
+impl<T, C> SkipSet<T, C> {
+    /// Returns a new, empty set that orders its elements with `comparator`.
+    ///
+    /// # Example
+    ///
+    /// ```
+    /// use std::cmp::Ordering;
+    /// use crossbeam_skiplist::{
+    ///     SkipSet,
+    ///     comparator::{Comparator, Equivalator},
+    /// };
+    ///
+    /// struct Reverse;
+    ///
+    /// impl Equivalator<i32> for Reverse {
+    ///     fn equivalent(&self, lhs: &i32, rhs: &i32) -> bool {
+    ///         lhs == rhs
+    ///     }
+    /// }
+    ///
+    /// impl Comparator<i32> for Reverse {
+    ///     fn compare(&self, lhs: &i32, rhs: &i32) -> Ordering {
+    ///         rhs.cmp(lhs)
+    ///     }
+    /// }
+    ///
+    /// let set = SkipSet::with_comparator(Reverse);
+    /// set.insert(1);
+    /// set.insert(2);
+    /// assert_eq!(*set.front().unwrap(), 2);
+    /// ```
+    pub fn with_comparator(comparator: C) -> Self {
         Self {
-            inner: map::SkipMap::new(),
+            inner: map::SkipMap::with_comparator(comparator),
         }
     }
 
@@ -71,9 +110,9 @@ impl<T> SkipSet<T> {
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T, T>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -88,7 +127,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.front().unwrap(), 1);
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, T>> {
+    pub fn front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.front().map(Entry::new)
     }
 
@@ -105,7 +144,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.back().unwrap(), 2);
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, T>> {
+    pub fn back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.back().map(Entry::new)
     }
 
@@ -122,7 +161,7 @@ where
     /// ```
     pub fn contains<Q>(&self, key: &Q) -> bool
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.contains_key(key)
@@ -139,9 +178,9 @@ where
     /// assert_eq!(*set.get(&3).unwrap(), 3);
     /// assert!(set.get(&4).is_none());
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.get(key).map(Entry::new)
@@ -171,9 +210,9 @@ where
     /// let greater_than_thirteen = set.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.lower_bound(bound).map(Entry::new)
@@ -200,9 +239,9 @@ where
     /// let less_than_six = set.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.upper_bound(bound).map(Entry::new)
@@ -219,7 +258,7 @@ where
     /// let entry = set.get_or_insert(2);
     /// assert_eq!(*entry, 2);
     /// ```
-    pub fn get_or_insert(&self, key: T) -> Entry<'_, T> {
+    pub fn get_or_insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.get_or_insert(key, ()))
     }
 
@@ -241,7 +280,7 @@ where
     /// assert_eq!(*set_iter.next().unwrap(), 12);
     /// assert!(set_iter.next().is_none());
     /// ```
-    pub fn iter(&self) -> Iter<'_, T> {
+    pub fn iter(&self) -> Iter<'_, T, C> {
         Iter {
             inner: self.inner.iter(),
         }
@@ -264,10 +303,10 @@ where
     /// assert_eq!(*set_range.next().unwrap(), 7);
     /// assert!(set_range.next().is_none());
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T, C>
     where
         R: RangeBounds<Q>,
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         Range {
@@ -276,9 +315,10 @@ where
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T, T>,
 {
     /// Inserts a `key`-`value` pair into the set and returns the new entry.
     ///
@@ -294,7 +334,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.get(&2).unwrap(), 2);
     /// ```
-    pub fn insert(&self, key: T) -> Entry<'_, T> {
+    pub fn insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.insert(key, ()))
     }
 
@@ -313,9 +353,9 @@ where
     /// assert_eq!(*set.remove(&2).unwrap(), 2);
     /// assert!(set.remove(&2).is_none());
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.remove(key).map(Entry::new)
@@ -342,7 +382,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_front().map(Entry::new)
     }
 
@@ -367,7 +407,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_back().map(Entry::new)
     }
 
@@ -396,16 +436,16 @@ impl<T> Default for SkipSet<T> {
     }
 }
 
-impl<T> fmt::Debug for SkipSet<T>
+impl<T, C> fmt::Debug for SkipSet<T, C>
 where
-    T: Ord + fmt::Debug,
+    T: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("SkipSet { .. }")
     }
 }
 
-impl<T> IntoIterator for SkipSet<T> {
+impl<T, C> IntoIterator for SkipSet<T, C> {
     type Item = T;
     type IntoIter = IntoIter<T>;
 
@@ -416,14 +456,14 @@ impl<T> IntoIterator for SkipSet<T> {
     }
 }
 
-impl<'a, T> IntoIterator for &'a SkipSet<T>
+impl<'a, T, C> IntoIterator for &'a SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T, T>,
 {
-    type Item = Entry<'a, T>;
-    type IntoIter = Iter<'a, T>;
+    type Item = Entry<'a, T, C>;
+    type IntoIter = Iter<'a, T, C>;
 
-    fn into_iter(self) -> Iter<'a, T> {
+    fn into_iter(self) -> Iter<'a, T, C> {
         self.iter()
     }
 }
@@ -445,12 +485,12 @@ where
 }
 
 /// A reference-counted entry in a set.
-pub struct Entry<'a, T> {
-    inner: map::Entry<'a, T, ()>,
+pub struct Entry<'a, T, C = BasicComparator> {
+    inner: map::Entry<'a, T, (), C>,
 }
 
-impl<'a, T> Entry<'a, T> {
-    fn new(inner: map::Entry<'a, T, ()>) -> Self {
+impl<'a, T, C> Entry<'a, T, C> {
+    fn new(inner: map::Entry<'a, T, (), C>) -> Self {
         Self { inner }
     }
 
@@ -465,9 +505,9 @@ impl<'a, T> Entry<'a, T> {
     }
 }
 
-impl<'a, T> Entry<'a, T>
+impl<'a, T, C> Entry<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T, T>,
 {
     /// Moves to the next entry in the set.
     pub fn move_next(&mut self) -> bool {
@@ -480,19 +520,20 @@ where
     }
 
     /// Returns the next entry in the set.
-    pub fn next(&self) -> Option<Entry<'a, T>> {
+    pub fn next(&self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 
     /// Returns the previous entry in the set.
-    pub fn prev(&self) -> Option<Entry<'a, T>> {
+    pub fn prev(&self) -> Option<Entry<'a, T, C>> {
         self.inner.prev().map(Entry::new)
     }
 }
 
-impl<T> Entry<'_, T>
+impl<T, C> Entry<'_, T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T, T>,
 {
     /// Removes the entry from the set.
     ///
@@ -502,7 +543,7 @@ where
     }
 }
 
-impl<T> Clone for Entry<'_, T> {
+impl<T, C> Clone for Entry<'_, T, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -510,7 +551,7 @@ impl<T> Clone for Entry<'_, T> {
     }
 }
 
-impl<T> fmt::Debug for Entry<'_, T>
+impl<T, C> fmt::Debug for Entry<'_, T, C>
 where
     T: fmt::Debug,
 {
@@ -521,7 +562,7 @@ where
     }
 }
 
-impl<T> Deref for Entry<'_, T> {
+impl<T, C> Deref for Entry<'_, T, C> {
     type Target = T;
 
     fn deref(&self) -> &Self::Target {
@@ -549,73 +590,76 @@ impl<T> fmt::Debug for IntoIter<T> {
 }
 
 /// An iterator over the entries of a `SkipSet`.
-pub struct Iter<'a, T> {
-    inner: map::Iter<'a, T, ()>,
+pub struct Iter<'a, T, C = BasicComparator> {
+    inner: map::Iter<'a, T, (), C>,
 }
 
-impl<'a, T> Iterator for Iter<'a, T>
+impl<'a, T, C> Iterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T, T>,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, T> DoubleEndedIterator for Iter<'a, T>
+impl<'a, T, C> DoubleEndedIterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T, T>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<T> fmt::Debug for Iter<'_, T> {
+impl<T, C> fmt::Debug for Iter<'_, T, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
 /// An iterator over a subset of entries of a `SkipSet`.
-pub struct Range<'a, Q, R, T>
+pub struct Range<'a, Q, R, T, C = BasicComparator>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    inner: map::Range<'a, Q, R, T, ()>,
+    inner: map::Range<'a, Q, R, T, (), C>,
 }
 
-impl<'a, Q, R, T> Iterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> Iterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T, Q>,
+    C: Comparator<T, T>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, Q, R, T> DoubleEndedIterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> DoubleEndedIterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T, Q>,
+    C: Comparator<T, T>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<Q, R, T> fmt::Debug for Range<'_, Q, R, T>
+impl<Q, R, T, C> fmt::Debug for Range<'_, Q, R, T, C>
 where
-    T: Ord + Comparable<Q> + fmt::Debug,
+    T: fmt::Debug,
+    C: Comparator<T, Q>,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/tests/comparator.rs b/crossbeam-skiplist/tests/comparator.rs
new file mode 100644
index 0000000..7752534
--- /dev/null
+++ b/crossbeam-skiplist/tests/comparator.rs
@@ -0,0 +1,139 @@
+use std::{cmp::Ordering, ops::Bound};
+
+use crossbeam_epoch as epoch;
+use crossbeam_skiplist::{
+    SkipMap, SkipSet,
+    base::SkipList,
+    comparator::{BasicComparator, Comparator, Equivalator},
+};
+
+/// Compares strings ignoring ASCII case, unless `sensitive` is set.
+#[derive(Clone, Copy)]
+struct Case {
+    sensitive: bool,
+}
+
+impl Equivalator<String, str> for Case {
+    fn equivalent(&self, lhs: &String, rhs: &str) -> bool {
+        self.compare(lhs, rhs).is_eq()
+    }
+}
+
+impl Comparator<String, str> for Case {
+    fn compare(&self, lhs: &String, rhs: &str) -> Ordering {
+        if self.sensitive {
+            lhs.as_str().cmp(rhs)
+        } else {
+            let l = lhs.bytes().map(|b| b.to_ascii_lowercase());
+            l.cmp(rhs.bytes().map(|b| b.to_ascii_lowercase()))
+        }
+    }
+}
+
+impl Equivalator<String> for Case {
+    fn equivalent(&self, lhs: &String, rhs: &String) -> bool {
+        self.compare(lhs, rhs.as_str()).is_eq()
+    }
+}
+
+impl Comparator<String> for Case {
+    fn compare(&self, lhs: &String, rhs: &String) -> Ordering {
+        self.compare(lhs, rhs.as_str())
+    }
+}
+
+struct Reverse;
+
+impl Equivalator<i32> for Reverse {
+    fn equivalent(&self, lhs: &i32, rhs: &i32) -> bool {
+        lhs == rhs
+    }
+}
+
+impl Comparator<i32> for Reverse {
+    fn compare(&self, lhs: &i32, rhs: &i32) -> Ordering {
+        rhs.cmp(lhs)
+    }
+}
+
+#[test]
+fn basic_comparator() {
+    assert_eq!(BasicComparator.compare(&1, &2), Ordering::Less);
+    assert!(BasicComparator.equivalent("a", "a"));
+    assert_eq!(
+        BasicComparator.compare(&"b".to_string(), "a"),
+        Ordering::Greater
+    );
+}
+
+#[test]
+fn map_ignores_case() {
+    let map = SkipMap::with_comparator(Case { sensitive: false });
+    map.insert("abc".to_string(), 1);
+    map.insert("ABC".to_string(), 2);
+    map.insert("b".to_string(), 3);
+    assert_eq!(map.len(), 2);
+    assert_eq!(*map.get("aBc").unwrap().value(), 2);
+    assert!(map.contains_key("B"));
+    assert_eq!(map.remove("ABC").unwrap().value(), &2);
+    assert!(!map.contains_key("abc"));
+    assert_eq!(map.len(), 1);
+}
+
+#[test]
+fn map_case_sensitive() {
+    let map = SkipMap::with_comparator(Case { sensitive: true });
+    map.insert("abc".to_string(), 1);
+    map.insert("ABC".to_string(), 2);
+    assert_eq!(map.len(), 2);
+    assert!(map.get("aBc").is_none());
+    // Uppercase sorts first.
+    assert_eq!(map.front().unwrap().key(), "ABC");
+}
+
+#[test]
+fn map_range_and_iter() {
+    let map = SkipMap::with_comparator(Reverse);
+    for i in 0..10 {
+        map.insert(i, i * 10);
+    }
+    let keys: Vec<i32> = map.iter().map(|e| *e.key()).collect();
+    assert_eq!(keys, (0..10).rev().collect::<Vec<_>>());
+    let keys: Vec<i32> = map.range(&6..=&3).map(|e| *e.key()).collect();
+    assert_eq!(keys, [6, 5, 4, 3]);
+    let keys: Vec<i32> = map.range(&6..=&3).rev().map(|e| *e.key()).collect();
+    assert_eq!(keys, [3, 4, 5, 6]);
+    assert_eq!(*map.lower_bound(Bound::Excluded(&5)).unwrap().key(), 4);
+    assert_eq!(*map.upper_bound(Bound::Excluded(&5)).unwrap().key(), 6);
+    assert_eq!(*map.pop_front().unwrap().key(), 9);
+    assert_eq!(*map.pop_back().unwrap().key(), 0);
+}
+
+#[test]
+fn set_with_comparator() {
+    let set = SkipSet::with_comparator(Reverse);
+    set.insert(1);
+    set.insert(3);
+    set.insert(2);
+    assert!(set.contains(&2));
+    assert_eq!(set.iter().map(|e| *e).collect::<Vec<_>>(), [3, 2, 1]);
+    assert_eq!(*set.back().unwrap(), 1);
+}
+
+#[test]
+fn base_with_comparator() {
+    let list = SkipList::with_comparator(epoch::default_collector().clone(), Reverse);
+    let guard = &epoch::pin();
+    list.insert(1, (), guard).release(guard);
+    list.insert(2, (), guard).release(guard);
+    assert_eq!(*list.front(guard).unwrap().key(), 2);
+    assert_eq!(*list.back(guard).unwrap().key(), 1);
+}
+
+#[test]
+fn default_still_works() {
+    let map: SkipMap<i32, i32> = SkipMap::new();
+    map.insert(2, 2);
+    map.insert(1, 1);
+    assert_eq!(*map.front().unwrap().key(), 1);
+}
```

</details>

<details><summary>reply</summary>

Reading `base.rs` to plan the type-parameter changes.

Fixing remaining compile errors: add the `C` bound to the insert/remove impl and replace the key `==` with the comparator.

`base.rs` compiles. Now `map.rs` and `set.rs`.

Now the manual structural edits: constructors, Default, FromIterator, `C` bounds on Send impls.

Done. `crossbeam_skiplist::comparator` is in with `Equivalator`, `Comparator` and `BasicComparator`. `SkipList`, `SkipMap`, `SkipSet` and their entry, iter and range types take a last type parameter `C = BasicComparator`, plus `with_comparator` on each.

All existing tests and doctests pass. The new `tests/comparator.rs` passes, including the case-insensitive `get("aBc")` lookup. I did not run the benches, which need nightly. Clippy's only remaining warnings are the existing busy-wait loops in `tests/base.rs`.

- **Looser bounds:** `K: Ord` is gone from the generic impls. They now need `C: Comparator<K, K>`, or `C: Comparator<K, Q>` for lookups.
- **Default-only impls:** `new()`, `Default` and `FromIterator` exist only for `BasicComparator` and still require `Ord`.
- **Closures:** there is no blanket `Comparator` impl for closures, so a boxed closure needs a small wrapper type that implements the traits. I didn't add one because you didn't ask for it.
- **`IntoIter`:** the owning iterator types stay without `C`.

</details>

### claude, sloth: pass

Files: [crossbeam-skiplist/src/base.rs](../sloth/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/base.rs), [crossbeam-skiplist/src/comparator.rs](../sloth/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/comparator.rs), [crossbeam-skiplist/src/lib.rs](../sloth/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/lib.rs), [crossbeam-skiplist/src/map.rs](../sloth/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/map.rs), [crossbeam-skiplist/src/set.rs](../sloth/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/set.rs), [crossbeam-skiplist/tests/map.rs](../sloth/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/tests/map.rs), [crossbeam-skiplist/tests/set.rs](../sloth/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/tests/set.rs)

<details><summary>diff</summary>

```diff
diff --git a/crossbeam-skiplist/src/base.rs b/crossbeam-skiplist/src/base.rs
index a73ee8a..8aec145 100644
--- a/crossbeam-skiplist/src/base.rs
+++ b/crossbeam-skiplist/src/base.rs
@@ -15,7 +15,7 @@ use core::{
 use crossbeam_epoch::{self as epoch, Atomic, Collector, Guard, Shared};
 use crossbeam_utils::CachePadded;
 
-use super::equivalent::Comparable;
+use super::comparator::{BasicComparator, Comparator};
 use crate::alloc_helper::Global;
 
 /// Number of bits needed to store height.
@@ -304,7 +304,7 @@ impl<'a, K, V> NodeRef<'a, K, V> {
     /// Decrements the reference count of a node, pinning the thread and destroying the node
     /// if the count become zero.
     #[inline]
-    unsafe fn decrement_with_pin<F>(self, parent: &SkipList<K, V>, pin: F)
+    unsafe fn decrement_with_pin<F, C>(self, parent: &SkipList<K, V, C>, pin: F)
     where
         F: FnOnce() -> Guard,
     {
@@ -451,7 +451,7 @@ struct HotData {
 }
 
 /// A lock-free skip list.
-// TODO(stjepang): Embed a custom `epoch::Collector` inside `SkipList<K, V>`. Instead of adding
+// TODO(stjepang): Embed a custom `epoch::Collector` inside `SkipList<K, V, C>`. Instead of adding
 // garbage to the default global collector, we should add it to a local collector tied to the
 // particular skip list instance.
 //
@@ -463,7 +463,7 @@ struct HotData {
 // As a further future optimization, if `!mem::needs_drop::<K>() && !mem::needs_drop::<V>()`
 // (neither key nor the value have destructors), there's no point in creating a new local
 // collector, so we should simply use the global one.
-pub struct SkipList<K, V> {
+pub struct SkipList<K, V, C = BasicComparator> {
     /// The head of the skip list (just a dummy node, not a real entry).
     head: Head<K, V>,
 
@@ -472,14 +472,24 @@ pub struct SkipList<K, V> {
 
     /// Hot data associated with the skip list, stored in a dedicated cache line.
     hot_data: CachePadded<HotData>,
+
+    /// The comparator that orders the keys.
+    comparator: C,
 }
 
-unsafe impl<K: Send + Sync, V: Send + Sync> Send for SkipList<K, V> {}
-unsafe impl<K: Send + Sync, V: Send + Sync> Sync for SkipList<K, V> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C> Send for SkipList<K, V, C> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C> Sync for SkipList<K, V, C> {}
 
 impl<K, V> SkipList<K, V> {
     /// Returns a new, empty skip list.
     pub fn new(collector: Collector) -> Self {
+        Self::with_comparator(collector, BasicComparator)
+    }
+}
+
+impl<K, V, C> SkipList<K, V, C> {
+    /// Returns a new, empty skip list that orders keys with `comparator`.
+    pub fn with_comparator(collector: Collector, comparator: C) -> Self {
         Self {
             head: Head::new(),
             collector,
@@ -488,6 +498,7 @@ impl<K, V> SkipList<K, V> {
                 len: AtomicUsize::new(0),
                 max_height: AtomicUsize::new(1),
             }),
+            comparator,
         }
     }
 
@@ -517,12 +528,12 @@ impl<K, V> SkipList<K, V> {
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Returns the entry with the smallest key.
-    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.next_node(self.head.as_tower(), Bound::Unbounded, guard)?;
         Some(Entry {
@@ -533,7 +544,7 @@ where
     }
 
     /// Returns the entry with the largest key.
-    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.search_bound::<K>(Bound::Unbounded, true, guard)?;
         Some(Entry {
@@ -546,21 +557,21 @@ where
     /// Returns `true` if the map contains a value for the specified key.
     pub fn contains_key<Q>(&self, key: &Q, guard: &Guard) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.get(key, guard).is_some()
     }
 
     /// Returns an entry with the specified `key`.
-    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>>
+    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
         let n = self.search_bound(Bound::Included(key), false, guard)?;
-        if !n.key.equivalent(key) {
+        if !self.comparator.equivalent(&n.key, key) {
             return None;
         }
 
@@ -578,9 +589,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -599,9 +610,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -614,7 +625,7 @@ where
     }
 
     /// Finds an entry with the specified key, or inserts a new `key`-`value` pair if none exist.
-    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| false, guard)
     }
 
@@ -626,7 +637,7 @@ where
     /// discarded. If closure is modifying some other state (such as shared counters or shared
     /// objects), it may lead to <u>undesired behaviour</u> such as counters being changed without
     /// result of closure inserted
-    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -634,7 +645,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V> {
+    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V, C> {
         self.check_guard(guard);
         Iter {
             parent: self,
@@ -645,7 +656,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn ref_iter(&self) -> RefIter<'_, K, V> {
+    pub fn ref_iter(&self) -> RefIter<'_, K, V, C> {
         RefIter {
             parent: self,
             head: None,
@@ -658,9 +669,9 @@ where
         &'a self,
         range: R,
         guard: &'g Guard,
-    ) -> Range<'a, 'g, Q, R, K, V>
+    ) -> Range<'a, 'g, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -677,9 +688,9 @@ where
 
     /// Returns an iterator over a subset of entries in the skip list.
     #[allow(clippy::needless_lifetimes)]
-    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V>
+    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -825,7 +836,7 @@ where
         guard: &'a Guard,
     ) -> Option<NodeRef<'a, K, V>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -887,11 +898,11 @@ where
                         // bound, we return the last node before the condition became true. For the
                         // lower bound, we return the first node after the condition became true.
                         if upper_bound {
-                            if !below_upper_bound(&bound, &c.key) {
+                            if !below_upper_bound(&self.comparator, &bound, &c.key) {
                                 break;
                             }
                             result = Some(c);
-                        } else if above_lower_bound(&bound, &c.key) {
+                        } else if above_lower_bound(&self.comparator, &bound, &c.key) {
                             result = Some(c);
                             break;
                         }
@@ -910,7 +921,7 @@ where
     /// Searches for a key in the skip list and returns a list of all adjacent nodes.
     fn search_position<'a, Q>(&'a self, key: &Q, guard: &'a Guard) -> Position<'a, K, V>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -971,7 +982,7 @@ where
 
                         // If `curr` contains a key that is greater than or equal to `key`, we're
                         // done with this level.
-                        match c.key.compare(key) {
+                        match self.comparator.compare(&c.key, key) {
                             cmp::Ordering::Greater => break,
                             cmp::Ordering::Equal => {
                                 result.found = Some(c);
@@ -1004,7 +1015,7 @@ where
         value: F,
         replace: CompareF,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
         CompareF: Fn(&V) -> bool,
@@ -1155,7 +1166,10 @@ where
                     // the tower without breaking any invariants. Note that building higher levels
                     // is completely optional. Only the lowest level really matters, and all the
                     // higher levels are there just to make searching faster.
-                    if succ.as_ref().map(|s| &s.key) == Some(&n.key) {
+                    if succ
+                        .as_ref()
+                        .is_some_and(|s| self.comparator.equivalent(&s.key, &n.key))
+                    {
                         search = self.search_position(&n.key, guard);
                         continue;
                     }
@@ -1218,16 +1232,17 @@ where
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K, K>,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the skip list and returns the new entry.
     ///
     /// If there is an existing entry with this key, it will be removed before inserting the new
     /// one.
-    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| true, guard)
     }
 
@@ -1242,7 +1257,7 @@ where
         value: V,
         compare_fn: F,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -1250,9 +1265,9 @@ where
     }
 
     /// Removes an entry with the specified `key` from the map and returns it.
-    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -1320,7 +1335,7 @@ where
     }
 
     /// Removes an entry from the front of the skip list.
-    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.front(guard)?;
@@ -1335,7 +1350,7 @@ where
     }
 
     /// Removes an entry from the back of the skip list.
-    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.back(guard)?;
@@ -1393,7 +1408,7 @@ where
     }
 }
 
-impl<K, V> Drop for SkipList<K, V> {
+impl<K, V, C> Drop for SkipList<K, V, C> {
     fn drop(&mut self) {
         unsafe {
             let mut node = NodeRef::from_shared(
@@ -1419,9 +1434,10 @@ impl<K, V> Drop for SkipList<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipList<K, V>
+impl<K, V, C> fmt::Debug for SkipList<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
+    C: Comparator<K, K>,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -1429,7 +1445,7 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipList<K, V> {
+impl<K, V, C> IntoIterator for SkipList<K, V, C> {
     type Item = (K, V);
     type IntoIter = IntoIter<K, V>;
 
@@ -1464,13 +1480,13 @@ impl<K, V> IntoIterator for SkipList<K, V> {
 /// The lifetimes of the key and value are the same as that of the `Guard`
 /// used when creating the `Entry` (`'g`). This lifetime is also constrained to
 /// not outlive the `SkipList`.
-pub struct Entry<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Entry<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'g, K, V>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Entry<'a, 'g, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1487,7 +1503,7 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1496,14 +1512,15 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     ///
     /// This method may return `None` if the reference count is already 0 and
     /// the node has been queued for deletion.
-    pub fn pin(&self) -> Option<RefEntry<'a, K, V>> {
+    pub fn pin(&self) -> Option<RefEntry<'a, K, V, C>> {
         unsafe { RefEntry::try_acquire(self.parent, self.node) }
     }
 }
 
-impl<K, V> Entry<'_, '_, K, V>
+impl<K, V, C> Entry<'_, '_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K, K>,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1526,7 +1543,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, '_, K, V> {
+impl<K, V, C> Clone for Entry<'_, '_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             parent: self.parent,
@@ -1536,7 +1553,7 @@ impl<K, V> Clone for Entry<'_, '_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1549,9 +1566,9 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K, V> Entry<'a, 'g, K, V>
+impl<'a: 'g, 'g, K, V, C> Entry<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self) -> bool {
@@ -1565,7 +1582,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self.parent.next_node(
             self.node.as_tower(),
             Bound::Excluded(&self.node.key),
@@ -1590,7 +1607,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self
             .parent
             .search_bound(Bound::Excluded(&self.node.key), true, self.guard)?;
@@ -1606,12 +1623,12 @@ where
 ///
 /// You *must* call `release` to free this type, otherwise the node will be
 /// leaked. This is because releasing the entry requires a `Guard`.
-pub struct RefEntry<'a, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct RefEntry<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'a, K, V>,
 }
 
-impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefEntry<'a, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1628,7 +1645,7 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1650,9 +1667,9 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     /// Tries to create a new `RefEntry` by incrementing the reference count of
     /// a node.
     unsafe fn try_acquire(
-        parent: &'a SkipList<K, V>,
+        parent: &'a SkipList<K, V, C>,
         node: NodeRef<'_, K, V>,
-    ) -> Option<RefEntry<'a, K, V>> {
+    ) -> Option<RefEntry<'a, K, V, C>> {
         if unsafe { node.try_increment() } {
             Some(RefEntry {
                 parent,
@@ -1667,9 +1684,10 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 }
 
-impl<K, V> RefEntry<'_, K, V>
+impl<K, V, C> RefEntry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K, K>,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1694,7 +1712,7 @@ where
     }
 }
 
-impl<K, V> Clone for RefEntry<'_, K, V> {
+impl<K, V, C> Clone for RefEntry<'_, K, V, C> {
     fn clone(&self) -> Self {
         unsafe {
             // Incrementing will always succeed since we're already holding a reference to the node.
@@ -1707,7 +1725,7 @@ impl<K, V> Clone for RefEntry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for RefEntry<'_, K, V>
+impl<K, V, C> fmt::Debug for RefEntry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1720,9 +1738,9 @@ where
     }
 }
 
-impl<'a, K, V> RefEntry<'a, K, V>
+impl<'a, K, V, C> RefEntry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self, guard: &Guard) -> bool {
@@ -1736,7 +1754,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1763,7 +1781,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1780,20 +1798,20 @@ where
 }
 
 /// An iterator over the entries of a `SkipList`.
-pub struct Iter<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Iter<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Iterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Iterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1804,7 +1822,7 @@ where
             }
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1817,11 +1835,11 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> DoubleEndedIterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> DoubleEndedIterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -1831,7 +1849,7 @@ where
                 .search_bound::<K>(Bound::Unbounded, true, self.guard),
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1844,7 +1862,7 @@ where
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Iter<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1858,13 +1876,13 @@ where
 }
 
 /// An iterator over reference-counted entries of a `SkipList`.
-pub struct RefIter<'a, K, V> {
-    parent: &'a SkipList<K, V>,
-    head: Option<RefEntry<'a, K, V>>,
-    tail: Option<RefEntry<'a, K, V>>,
+pub struct RefIter<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
+    head: Option<RefEntry<'a, K, V, C>>,
+    tail: Option<RefEntry<'a, K, V, C>>,
 }
 
-impl<K, V> fmt::Debug for RefIter<'_, K, V>
+impl<K, V, C> fmt::Debug for RefIter<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1883,12 +1901,12 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V>
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match &self.head {
             Some(e) => e.next(guard),
@@ -1896,7 +1914,9 @@ where
         };
         match (&next_head, &self.tail) {
             // The next key is larger than the latest tail key we observed with this iterator.
-            (Some(ref next), Some(t)) if next.key() >= t.key() => {
+            (Some(ref next), Some(t))
+                if self.parent.comparator.compare(next.key(), t.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1915,7 +1935,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match &self.tail {
             Some(e) => e.prev(guard),
@@ -1923,7 +1943,9 @@ where
         };
         match (&self.head, &next_tail) {
             // The prev key is smaller than the latest head key we observed with this iterator.
-            (Some(h), Some(next)) if h.key() >= next.key() => {
+            (Some(h), Some(next))
+                if self.parent.comparator.compare(h.key(), next.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1942,7 +1964,7 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C> {
     /// Decrements the reference count of `RefEntry` owned by the iterator.
     pub fn drop_impl(&mut self, guard: &Guard) {
         self.parent.check_guard(guard);
@@ -1956,13 +1978,13 @@ impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipList`.
-pub struct Range<'a: 'g, 'g, Q, R, K, V>
+pub struct Range<'a: 'g, 'g, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     range: R,
@@ -1970,15 +1992,15 @@ where
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> Iterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> Iterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1991,14 +2013,14 @@ where
             match self.tail {
                 Some(t) => {
                     let bound = Bound::Excluded(&t.as_ref().key);
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2013,13 +2035,13 @@ where
     }
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -2032,14 +2054,14 @@ where
             match self.head {
                 Some(h) => {
                     let bound = Bound::Excluded(&h.as_ref().key);
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2054,9 +2076,10 @@ where
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, '_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, '_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K, K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2071,38 +2094,39 @@ where
 }
 
 /// An iterator over reference-counted subset of entries of a `SkipList`.
-pub struct RefRange<'a, Q, R, K, V>
+pub struct RefRange<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
-    pub(crate) head: Option<RefEntry<'a, K, V>>,
-    pub(crate) tail: Option<RefEntry<'a, K, V>>,
+    parent: &'a SkipList<K, V, C>,
+    pub(crate) head: Option<RefEntry<'a, K, V, C>>,
+    pub(crate) tail: Option<RefEntry<'a, K, V, C>>,
     pub(crate) range: R,
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-unsafe impl<Q, R, K, V> Send for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C> Send for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-unsafe impl<Q, R, K, V> Sync for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C> Sync for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-impl<Q, R, K, V> fmt::Debug for RefRange<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K, K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2116,14 +2140,14 @@ where
     }
 }
 
-impl<'a, Q, R, K: 'a, V: 'a> RefRange<'a, Q, R, K, V>
+impl<'a, Q, R, K: 'a, V: 'a, C> RefRange<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match self.head {
             Some(ref e) => e.next(guard),
@@ -2134,7 +2158,7 @@ where
             match self.tail {
                 Some(ref t) => {
                     let bound = Bound::Excluded(t.key());
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2150,7 +2174,7 @@ where
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2171,7 +2195,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match self.tail {
             Some(ref e) => e.prev(guard),
@@ -2182,7 +2206,7 @@ where
             match self.head {
                 Some(ref h) => {
                     let bound = Bound::Excluded(h.key());
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2198,7 +2222,7 @@ where
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2307,9 +2331,9 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 
 /// Helper function to retry an operation until pinning succeeds or `None` is
 /// returned.
-pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V>(mut f: F) -> Option<RefEntry<'a, K, V>>
+pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V, C>(mut f: F) -> Option<RefEntry<'a, K, V, C>>
 where
-    F: FnMut() -> Option<Entry<'a, 'g, K, V>>,
+    F: FnMut() -> Option<Entry<'a, 'g, K, V, C>>,
 {
     loop {
         if let Some(e) = f()?.pin() {
@@ -2319,27 +2343,27 @@ where
 }
 
 /// Helper function to check if a value is above a lower bound
-fn above_lower_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn above_lower_bound<C, V, T>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_ge(),
-        Bound::Excluded(key) => other.compare(key).is_gt(),
+        Bound::Included(key) => comparator.compare(other, key).is_ge(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_gt(),
     }
 }
 
 /// Helper function to check if a value is below an upper bound
-fn below_upper_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn below_upper_bound<C, V, T>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_le(),
-        Bound::Excluded(key) => other.compare(key).is_lt(),
+        Bound::Included(key) => comparator.compare(other, key).is_le(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_lt(),
     }
 }
diff --git a/crossbeam-skiplist/src/comparator.rs b/crossbeam-skiplist/src/comparator.rs
new file mode 100644
index 0000000..6f3d260
--- /dev/null
+++ b/crossbeam-skiplist/src/comparator.rs
@@ -0,0 +1,47 @@
+//! Traits for runtime-selectable key ordering.
+
+use core::cmp::Ordering;
+
+use crate::equivalent::{Comparable, Equivalent};
+
+/// Key equivalence under a comparator.
+///
+/// Like [`Equivalent`], but the logic lives in a value rather than in the key type, so it can be
+/// chosen at runtime.
+pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
+    /// Returns `true` if `lhs` and `rhs` are equal.
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
+}
+
+/// Key ordering under a comparator.
+///
+/// Like [`Comparable`], but the logic lives in a value rather than in the key type, so it can be
+/// chosen at runtime.
+pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
+    /// Returns the ordering of `lhs` relative to `rhs`.
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
+}
+
+/// The comparator that orders keys with their own `Ord` implementation.
+#[derive(Clone, Copy, Debug, Default)]
+pub struct BasicComparator;
+
+impl<L: ?Sized, R: ?Sized> Equivalator<L, R> for BasicComparator
+where
+    L: Equivalent<R>,
+{
+    #[inline]
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
+        Equivalent::equivalent(lhs, rhs)
+    }
+}
+
+impl<L: ?Sized, R: ?Sized> Comparator<L, R> for BasicComparator
+where
+    L: Comparable<R>,
+{
+    #[inline]
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
+        Comparable::compare(lhs, rhs)
+    }
+}
diff --git a/crossbeam-skiplist/src/lib.rs b/crossbeam-skiplist/src/lib.rs
index 5ff8e74..5337e3d 100644
--- a/crossbeam-skiplist/src/lib.rs
+++ b/crossbeam-skiplist/src/lib.rs
@@ -265,4 +265,5 @@ pub mod set;
 #[doc(inline)]
 pub use crate::{map::SkipMap, set::SkipSet};
 
+pub mod comparator;
 pub mod equivalent;
diff --git a/crossbeam-skiplist/src/map.rs b/crossbeam-skiplist/src/map.rs
index c7c5408..fb8e08c 100644
--- a/crossbeam-skiplist/src/map.rs
+++ b/crossbeam-skiplist/src/map.rs
@@ -11,7 +11,7 @@ use crossbeam_epoch as epoch;
 
 use crate::{
     base::{self, try_pin_loop},
-    equivalent::Comparable,
+    comparator::{BasicComparator, Comparator},
 };
 
 /// An ordered map based on a lock-free skip list.
@@ -20,8 +20,8 @@ use crate::{
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeMap`]: std::collections::BTreeMap
-pub struct SkipMap<K, V> {
-    inner: base::SkipList<K, V>,
+pub struct SkipMap<K, V, C = BasicComparator> {
+    inner: base::SkipList<K, V, C>,
 }
 
 impl<K, V> SkipMap<K, V> {
@@ -35,8 +35,23 @@ impl<K, V> SkipMap<K, V> {
     /// let map: SkipMap<i32, &str> = SkipMap::new();
     /// ```
     pub fn new() -> Self {
+        Self::with_comparator(BasicComparator)
+    }
+}
+
+impl<K, V, C> SkipMap<K, V, C> {
+    /// Returns a new, empty map that orders keys with `comparator`.
+    ///
+    /// # Example
+    ///
+    /// ```
+    /// use crossbeam_skiplist::{SkipMap, comparator::BasicComparator};
+    ///
+    /// let map: SkipMap<i32, &str, _> = SkipMap::with_comparator(BasicComparator);
+    /// ```
+    pub fn with_comparator(comparator: C) -> Self {
         Self {
-            inner: base::SkipList::new(epoch::default_collector().clone()),
+            inner: base::SkipList::with_comparator(epoch::default_collector().clone(), comparator),
         }
     }
 
@@ -80,9 +95,9 @@ impl<K, V> SkipMap<K, V> {
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -99,7 +114,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.front().unwrap().value(), "five");
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.front(guard)).map(Entry::new)
     }
@@ -119,7 +134,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.back().unwrap().value(), "six");
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.back(guard)).map(Entry::new)
     }
@@ -138,7 +153,7 @@ where
     /// ```
     pub fn contains_key<Q>(&self, key: &Q) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -160,9 +175,9 @@ where
     /// numbers.insert("six", 6);
     /// assert_eq!(*numbers.get("six").unwrap().value(), 6);
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -195,9 +210,9 @@ where
     /// let greater_than_thirteen = numbers.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -227,9 +242,9 @@ where
     /// let less_than_six = numbers.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -253,7 +268,7 @@ where
     /// let jobs_age = ages.get_or_insert("Steve Jobs", -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.get_or_insert(key, value, guard))
     }
@@ -283,7 +298,7 @@ where
     /// let jobs_age = ages.get_or_insert_with("Steve Jobs", || -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -313,7 +328,7 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn iter(&self) -> Iter<'_, K, V> {
+    pub fn iter(&self) -> Iter<'_, K, V, C> {
         Iter {
             inner: self.inner.ref_iter(),
         }
@@ -340,10 +355,10 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V, C>
     where
         R: RangeBounds<Q>,
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         Range {
@@ -352,9 +367,10 @@ where
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K, K>,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the map and returns the new entry.
@@ -374,7 +390,7 @@ where
     ///
     /// assert_eq!(*map.get("key").unwrap().value(), "value");
     /// ```
-    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.insert(key, value, guard))
     }
@@ -401,7 +417,7 @@ where
     /// map.compare_insert("absent_key", 0, |_| false);
     /// assert_eq!(*map.get("absent_key").unwrap().value(), 0);
     /// ```
-    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V>
+    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -427,9 +443,9 @@ where
     /// map.insert("key", "value");
     /// assert_eq!(*map.remove("key").unwrap().value(), "value");
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -458,7 +474,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_front(guard).map(Entry::new)
     }
@@ -485,7 +501,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_back(guard).map(Entry::new)
     }
@@ -515,9 +531,10 @@ impl<K, V> Default for SkipMap<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipMap<K, V>
+impl<K, V, C> fmt::Debug for SkipMap<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
+    C: Comparator<K, K>,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -525,7 +542,7 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipMap<K, V> {
+impl<K, V, C> IntoIterator for SkipMap<K, V, C> {
     type Item = (K, V);
     type IntoIter = IntoIter<K, V>;
 
@@ -536,22 +553,19 @@ impl<K, V> IntoIterator for SkipMap<K, V> {
     }
 }
 
-impl<'a, K, V> IntoIterator for &'a SkipMap<K, V>
+impl<'a, K, V, C> IntoIterator for &'a SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
-    type Item = Entry<'a, K, V>;
-    type IntoIter = Iter<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
+    type IntoIter = Iter<'a, K, V, C>;
 
-    fn into_iter(self) -> Iter<'a, K, V> {
+    fn into_iter(self) -> Iter<'a, K, V, C> {
         self.iter()
     }
 }
 
-impl<K, V> FromIterator<(K, V)> for SkipMap<K, V>
-where
-    K: Ord,
-{
+impl<K: Ord, V> FromIterator<(K, V)> for SkipMap<K, V> {
     fn from_iter<I>(iter: I) -> Self
     where
         I: IntoIterator<Item = (K, V)>,
@@ -565,12 +579,12 @@ where
 }
 
 /// A reference-counted entry in a map.
-pub struct Entry<'a, K, V> {
-    inner: ManuallyDrop<base::RefEntry<'a, K, V>>,
+pub struct Entry<'a, K, V, C = BasicComparator> {
+    inner: ManuallyDrop<base::RefEntry<'a, K, V, C>>,
 }
 
-impl<'a, K, V> Entry<'a, K, V> {
-    fn new(inner: base::RefEntry<'a, K, V>) -> Self {
+impl<'a, K, V, C> Entry<'a, K, V, C> {
+    fn new(inner: base::RefEntry<'a, K, V, C>) -> Self {
         Self {
             inner: ManuallyDrop::new(inner),
         }
@@ -592,7 +606,7 @@ impl<'a, K, V> Entry<'a, K, V> {
     }
 }
 
-impl<K, V> Drop for Entry<'_, K, V> {
+impl<K, V, C> Drop for Entry<'_, K, V, C> {
     fn drop(&mut self) {
         unsafe {
             ManuallyDrop::into_inner(ptr::read(&self.inner)).release_with_pin(epoch::pin);
@@ -600,9 +614,9 @@ impl<K, V> Drop for Entry<'_, K, V> {
     }
 }
 
-impl<'a, K, V> Entry<'a, K, V>
+impl<'a, K, V, C> Entry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
     /// Moves to the next entry in the map.
     pub fn move_next(&mut self) -> bool {
@@ -617,21 +631,22 @@ where
     }
 
     /// Returns the next entry in the map.
-    pub fn next(&self) -> Option<Entry<'a, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 
     /// Returns the previous entry in the map.
-    pub fn prev(&self) -> Option<Entry<'a, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.prev(guard).map(Entry::new)
     }
 }
 
-impl<K, V> Entry<'_, K, V>
+impl<K, V, C> Entry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K, K>,
     V: Send + 'static,
 {
     /// Removes the entry from the map.
@@ -643,7 +658,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, K, V> {
+impl<K, V, C> Clone for Entry<'_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -651,7 +666,7 @@ impl<K, V> Clone for Entry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -684,39 +699,39 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 }
 
 /// An iterator over the entries of a `SkipMap`.
-pub struct Iter<'a, K, V> {
-    inner: base::RefIter<'a, K, V>,
+pub struct Iter<'a, K, V, C = BasicComparator> {
+    inner: base::RefIter<'a, K, V, C>,
 }
 
-impl<'a, K, V> Iterator for Iter<'a, K, V>
+impl<'a, K, V, C> Iterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, K, V> DoubleEndedIterator for Iter<'a, K, V>
+impl<'a, K, V, C> DoubleEndedIterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K, K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, K, V> {
+impl<K, V, C> fmt::Debug for Iter<'_, K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
-impl<K, V> Drop for Iter<'_, K, V> {
+impl<K, V, C> Drop for Iter<'_, K, V, C> {
     fn drop(&mut self) {
         let guard = &epoch::pin();
         self.inner.drop_impl(guard);
@@ -724,44 +739,45 @@ impl<K, V> Drop for Iter<'_, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipMap`.
-pub struct Range<'a, Q, R, K, V>
+pub struct Range<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    pub(crate) inner: base::RefRange<'a, Q, R, K, V>,
+    pub(crate) inner: base::RefRange<'a, Q, R, K, V, C>,
 }
 
-impl<'a, Q, R, K, V> Iterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> Iterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, Q, R, K, V> DoubleEndedIterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> DoubleEndedIterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K, K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -775,9 +791,9 @@ where
     }
 }
 
-impl<Q, R, K, V> Drop for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> Drop for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K, K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/src/set.rs b/crossbeam-skiplist/src/set.rs
index 4e91f6c..674e984 100644
--- a/crossbeam-skiplist/src/set.rs
+++ b/crossbeam-skiplist/src/set.rs
@@ -5,7 +5,10 @@ use core::{
     ops::{Bound, Deref, RangeBounds},
 };
 
-use crate::{equivalent::Comparable, map};
+use crate::{
+    comparator::{BasicComparator, Comparator},
+    map,
+};
 
 /// A set based on a lock-free skip list.
 ///
@@ -13,8 +16,8 @@ use crate::{equivalent::Comparable, map};
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeSet`]: std::collections::BTreeSet
-pub struct SkipSet<T> {
-    inner: map::SkipMap<T, ()>,
+pub struct SkipSet<T, C = BasicComparator> {
+    inner: map::SkipMap<T, (), C>,
 }
 
 impl<T> SkipSet<T> {
@@ -28,8 +31,23 @@ impl<T> SkipSet<T> {
     /// let set: SkipSet<i32> = SkipSet::new();
     /// ```
     pub fn new() -> Self {
+        Self::with_comparator(BasicComparator)
+    }
+}
+
+impl<T, C> SkipSet<T, C> {
+    /// Returns a new, empty set that orders elements with `comparator`.
+    ///
+    /// # Example
+    ///
+    /// ```
+    /// use crossbeam_skiplist::{SkipSet, comparator::BasicComparator};
+    ///
+    /// let set: SkipSet<i32, _> = SkipSet::with_comparator(BasicComparator);
+    /// ```
+    pub fn with_comparator(comparator: C) -> Self {
         Self {
-            inner: map::SkipMap::new(),
+            inner: map::SkipMap::with_comparator(comparator),
         }
     }
 
@@ -71,9 +89,9 @@ impl<T> SkipSet<T> {
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T, T>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -88,7 +106,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.front().unwrap(), 1);
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, T>> {
+    pub fn front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.front().map(Entry::new)
     }
 
@@ -105,7 +123,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.back().unwrap(), 2);
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, T>> {
+    pub fn back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.back().map(Entry::new)
     }
 
@@ -122,7 +140,7 @@ where
     /// ```
     pub fn contains<Q>(&self, key: &Q) -> bool
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.contains_key(key)
@@ -139,9 +157,9 @@ where
     /// assert_eq!(*set.get(&3).unwrap(), 3);
     /// assert!(set.get(&4).is_none());
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.get(key).map(Entry::new)
@@ -171,9 +189,9 @@ where
     /// let greater_than_thirteen = set.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.lower_bound(bound).map(Entry::new)
@@ -200,9 +218,9 @@ where
     /// let less_than_six = set.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.upper_bound(bound).map(Entry::new)
@@ -219,7 +237,7 @@ where
     /// let entry = set.get_or_insert(2);
     /// assert_eq!(*entry, 2);
     /// ```
-    pub fn get_or_insert(&self, key: T) -> Entry<'_, T> {
+    pub fn get_or_insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.get_or_insert(key, ()))
     }
 
@@ -241,7 +259,7 @@ where
     /// assert_eq!(*set_iter.next().unwrap(), 12);
     /// assert!(set_iter.next().is_none());
     /// ```
-    pub fn iter(&self) -> Iter<'_, T> {
+    pub fn iter(&self) -> Iter<'_, T, C> {
         Iter {
             inner: self.inner.iter(),
         }
@@ -264,10 +282,10 @@ where
     /// assert_eq!(*set_range.next().unwrap(), 7);
     /// assert!(set_range.next().is_none());
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T, C>
     where
         R: RangeBounds<Q>,
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         Range {
@@ -276,9 +294,10 @@ where
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T, T>,
 {
     /// Inserts a `key`-`value` pair into the set and returns the new entry.
     ///
@@ -294,7 +313,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.get(&2).unwrap(), 2);
     /// ```
-    pub fn insert(&self, key: T) -> Entry<'_, T> {
+    pub fn insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.insert(key, ()))
     }
 
@@ -313,9 +332,9 @@ where
     /// assert_eq!(*set.remove(&2).unwrap(), 2);
     /// assert!(set.remove(&2).is_none());
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.remove(key).map(Entry::new)
@@ -342,7 +361,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_front().map(Entry::new)
     }
 
@@ -367,7 +386,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_back().map(Entry::new)
     }
 
@@ -396,16 +415,17 @@ impl<T> Default for SkipSet<T> {
     }
 }
 
-impl<T> fmt::Debug for SkipSet<T>
+impl<T, C> fmt::Debug for SkipSet<T, C>
 where
-    T: Ord + fmt::Debug,
+    T: fmt::Debug,
+    C: Comparator<T, T>,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("SkipSet { .. }")
     }
 }
 
-impl<T> IntoIterator for SkipSet<T> {
+impl<T, C> IntoIterator for SkipSet<T, C> {
     type Item = T;
     type IntoIter = IntoIter<T>;
 
@@ -416,22 +436,19 @@ impl<T> IntoIterator for SkipSet<T> {
     }
 }
 
-impl<'a, T> IntoIterator for &'a SkipSet<T>
+impl<'a, T, C> IntoIterator for &'a SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T, T>,
 {
-    type Item = Entry<'a, T>;
-    type IntoIter = Iter<'a, T>;
+    type Item = Entry<'a, T, C>;
+    type IntoIter = Iter<'a, T, C>;
 
-    fn into_iter(self) -> Iter<'a, T> {
+    fn into_iter(self) -> Iter<'a, T, C> {
         self.iter()
     }
 }
 
-impl<T> FromIterator<T> for SkipSet<T>
-where
-    T: Ord,
-{
+impl<T: Ord> FromIterator<T> for SkipSet<T> {
     fn from_iter<I>(iter: I) -> Self
     where
         I: IntoIterator<Item = T>,
@@ -445,12 +462,12 @@ where
 }
 
 /// A reference-counted entry in a set.
-pub struct Entry<'a, T> {
-    inner: map::Entry<'a, T, ()>,
+pub struct Entry<'a, T, C = BasicComparator> {
+    inner: map::Entry<'a, T, (), C>,
 }
 
-impl<'a, T> Entry<'a, T> {
-    fn new(inner: map::Entry<'a, T, ()>) -> Self {
+impl<'a, T, C> Entry<'a, T, C> {
+    fn new(inner: map::Entry<'a, T, (), C>) -> Self {
         Self { inner }
     }
 
@@ -465,9 +482,9 @@ impl<'a, T> Entry<'a, T> {
     }
 }
 
-impl<'a, T> Entry<'a, T>
+impl<'a, T, C> Entry<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T, T>,
 {
     /// Moves to the next entry in the set.
     pub fn move_next(&mut self) -> bool {
@@ -480,19 +497,20 @@ where
     }
 
     /// Returns the next entry in the set.
-    pub fn next(&self) -> Option<Entry<'a, T>> {
+    pub fn next(&self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 
     /// Returns the previous entry in the set.
-    pub fn prev(&self) -> Option<Entry<'a, T>> {
+    pub fn prev(&self) -> Option<Entry<'a, T, C>> {
         self.inner.prev().map(Entry::new)
     }
 }
 
-impl<T> Entry<'_, T>
+impl<T, C> Entry<'_, T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T, T>,
 {
     /// Removes the entry from the set.
     ///
@@ -502,7 +520,7 @@ where
     }
 }
 
-impl<T> Clone for Entry<'_, T> {
+impl<T, C> Clone for Entry<'_, T, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -510,7 +528,7 @@ impl<T> Clone for Entry<'_, T> {
     }
 }
 
-impl<T> fmt::Debug for Entry<'_, T>
+impl<T, C> fmt::Debug for Entry<'_, T, C>
 where
     T: fmt::Debug,
 {
@@ -521,7 +539,7 @@ where
     }
 }
 
-impl<T> Deref for Entry<'_, T> {
+impl<T, C> Deref for Entry<'_, T, C> {
     type Target = T;
 
     fn deref(&self) -> &Self::Target {
@@ -549,73 +567,74 @@ impl<T> fmt::Debug for IntoIter<T> {
 }
 
 /// An iterator over the entries of a `SkipSet`.
-pub struct Iter<'a, T> {
-    inner: map::Iter<'a, T, ()>,
+pub struct Iter<'a, T, C = BasicComparator> {
+    inner: map::Iter<'a, T, (), C>,
 }
 
-impl<'a, T> Iterator for Iter<'a, T>
+impl<'a, T, C> Iterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T, T>,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, T> DoubleEndedIterator for Iter<'a, T>
+impl<'a, T, C> DoubleEndedIterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T, T>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<T> fmt::Debug for Iter<'_, T> {
+impl<T, C> fmt::Debug for Iter<'_, T, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
 /// An iterator over a subset of entries of a `SkipSet`.
-pub struct Range<'a, Q, R, T>
+pub struct Range<'a, Q, R, T, C = BasicComparator>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T, T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    inner: map::Range<'a, Q, R, T, ()>,
+    inner: map::Range<'a, Q, R, T, (), C>,
 }
 
-impl<'a, Q, R, T> Iterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> Iterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T, T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, Q, R, T> DoubleEndedIterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> DoubleEndedIterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T, T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<Q, R, T> fmt::Debug for Range<'_, Q, R, T>
+impl<Q, R, T, C> fmt::Debug for Range<'_, Q, R, T, C>
 where
-    T: Ord + Comparable<Q> + fmt::Debug,
+    T: fmt::Debug,
+    C: Comparator<T, T> + Comparator<T, Q>,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/tests/map.rs b/crossbeam-skiplist/tests/map.rs
index 2fa8c2b..b2821a8 100644
--- a/crossbeam-skiplist/tests/map.rs
+++ b/crossbeam-skiplist/tests/map.rs
@@ -4,7 +4,12 @@ use std::{
     sync::{Arc, Barrier},
 };
 
-use crossbeam_skiplist::SkipMap;
+use std::cmp::Ordering;
+
+use crossbeam_skiplist::{
+    SkipMap,
+    comparator::{Comparator, Equivalator},
+};
 use crossbeam_utils::thread;
 
 #[test]
@@ -962,3 +967,76 @@ fn issue_1178() {
         map.insert(k, v);
     }
 }
+
+struct IgnoreCase;
+
+impl Equivalator<String, String> for IgnoreCase {
+    fn equivalent(&self, lhs: &String, rhs: &String) -> bool {
+        self.compare(lhs, rhs).is_eq()
+    }
+}
+
+impl Comparator<String, String> for IgnoreCase {
+    fn compare(&self, lhs: &String, rhs: &String) -> Ordering {
+        self.compare(lhs.as_str(), rhs.as_str())
+    }
+}
+
+impl Equivalator<String, str> for IgnoreCase {
+    fn equivalent(&self, lhs: &String, rhs: &str) -> bool {
+        self.compare(lhs, rhs).is_eq()
+    }
+}
+
+impl Comparator<String, str> for IgnoreCase {
+    fn compare(&self, lhs: &String, rhs: &str) -> Ordering {
+        self.compare(lhs.as_str(), rhs)
+    }
+}
+
+impl IgnoreCase {
+    fn compare(&self, lhs: &str, rhs: &str) -> Ordering {
+        lhs.to_lowercase().cmp(&rhs.to_lowercase())
+    }
+}
+
+#[test]
+fn with_comparator_ignores_case() {
+    let m = SkipMap::<String, u32, _>::with_comparator(IgnoreCase);
+    m.insert("abc".to_string(), 1);
+    m.insert("ABC".to_string(), 2);
+    m.insert("b".to_string(), 3);
+    assert_eq!(m.len(), 2);
+    assert_eq!(*m.get("aBc").unwrap().value(), 2);
+    assert!(m.contains_key("B"));
+    let keys: Vec<_> = m
+        .range::<str, _>((Bound::Included("A"), Bound::Included("B")))
+        .map(|e| e.key().clone())
+        .collect();
+    assert_eq!(keys, ["ABC", "b"]);
+    assert_eq!(*m.remove("ABC").unwrap().value(), 2);
+    assert_eq!(m.len(), 1);
+}
+
+#[test]
+fn with_comparator_reverse_order() {
+    struct Reverse;
+    impl Equivalator<i32> for Reverse {
+        fn equivalent(&self, lhs: &i32, rhs: &i32) -> bool {
+            lhs == rhs
+        }
+    }
+    impl Comparator<i32> for Reverse {
+        fn compare(&self, lhs: &i32, rhs: &i32) -> Ordering {
+            rhs.cmp(lhs)
+        }
+    }
+    let m = SkipMap::with_comparator(Reverse);
+    for i in 0..100 {
+        m.insert(i, ());
+    }
+    let keys: Vec<_> = m.iter().map(|e| *e.key()).collect();
+    assert_eq!(keys, (0..100).rev().collect::<Vec<_>>());
+    assert_eq!(*m.front().unwrap().key(), 99);
+    assert_eq!(*m.iter().next_back().unwrap().key(), 0);
+}
diff --git a/crossbeam-skiplist/tests/set.rs b/crossbeam-skiplist/tests/set.rs
index e439bf0..1c95d8c 100644
--- a/crossbeam-skiplist/tests/set.rs
+++ b/crossbeam-skiplist/tests/set.rs
@@ -4,7 +4,12 @@ use std::{
     sync::{Arc, Barrier},
 };
 
-use crossbeam_skiplist::SkipSet;
+use std::cmp::Ordering;
+
+use crossbeam_skiplist::{
+    SkipSet,
+    comparator::{Comparator, Equivalator},
+};
 use crossbeam_utils::thread;
 
 #[test]
@@ -717,3 +722,29 @@ fn concurrent_insert_get_same_key() {
     }
     handle.join().unwrap()
 }
+
+#[test]
+fn with_comparator_reverse_order() {
+    struct Reverse;
+    impl Equivalator<i32> for Reverse {
+        fn equivalent(&self, lhs: &i32, rhs: &i32) -> bool {
+            lhs == rhs
+        }
+    }
+    impl Comparator<i32> for Reverse {
+        fn compare(&self, lhs: &i32, rhs: &i32) -> Ordering {
+            rhs.cmp(lhs)
+        }
+    }
+    let s = SkipSet::with_comparator(Reverse);
+    for i in 0..10 {
+        s.insert(i);
+    }
+    assert_eq!(
+        s.iter().map(|e| *e.value()).collect::<Vec<_>>(),
+        (0..10).rev().collect::<Vec<_>>()
+    );
+    assert!(s.contains(&3));
+    assert!(s.remove(&3).is_some());
+    assert!(!s.contains(&3));
+}
```

</details>

<details><summary>reply</summary>

Status: I've read `base.rs` and now I'm threading a comparator type `C` through it, using a scripted rewrite and then fixing whatever the compiler flags.

Now fix the doubled `C`, the struct fields, the constructors, and the helper functions.

Status: `base.rs` compiles with the comparator; I'm now applying the same transformation to `map.rs` and `set.rs`.

Status: fixing the `new()`/`with_comparator` split in `map.rs` that my script got slightly wrong, then the same for `set.rs`.

Status: the remaining error is in my own test (`RangeInclusive<&str>` can't be a `RangeBounds<str>`). I'm switching it to a `(Bound, Bound)` pair.

`SkipMap`, `SkipSet` and `base::SkipList` now take a runtime comparator as a new last type parameter `C`, defaulting to `BasicComparator`. All tests pass, including the existing ones, with `cargo test` (unit, integration and doc-tests). I did not build the benches (they need nightly) or run clippy.

- **New module:** `crossbeam_skiplist::comparator` has `Equivalator`, `Comparator` and `BasicComparator`, as you specified. `BasicComparator` goes through the existing `Equivalent`/`Comparable` traits, so it orders exactly as today.
- **Type parameter:** `Entry`, `RefEntry`, `Iter`, `RefIter`, `Range`, `RefRange` and the map and set equivalents all carry `C` with the same default. Existing code that names `SkipMap<K, V>` compiles unchanged.
- **Constructors:** `with_comparator` exists on `SkipMap`, `SkipSet` and `base::SkipList` with the signatures you gave. `new()`, `Default` and `FromIterator` stay on `BasicComparator` only.
- **Comparisons:** every lookup, insert, remove, bound, range and iterator step now goes through the comparator instead of `Ord`. That includes the `>=` checks inside `Iter`/`RefIter` and the duplicate-key check when linking tower levels. Lookups need `C: Comparator<K, Q>`, so the query type can differ from the stored key type.
- **Tests added:**
  - `tests/map.rs`: a case-insensitive comparator on a `SkipMap<String, u32, _>`. It covers `get("aBc")` with a `&str`, `contains_key`, a range query and `remove`.
  - `tests/map.rs` and `tests/set.rs`: a reverse-order comparator on a map and a set.

I left out `Debug` and `Default` for non-default comparators, and a CHANGELOG entry.

Calling `range` with a `&str` query on `String` keys needs a `(Bound<&str>, Bound<&str>)` pair, because `RangeInclusive<&str>` is not `RangeBounds<str>`. That is how `RangeBounds` works, not something I changed.

</details>

### claude, all: pass

Files: [crossbeam-skiplist/src/base.rs](../all/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/base.rs), [crossbeam-skiplist/src/comparator.rs](../all/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/comparator.rs), [crossbeam-skiplist/src/lib.rs](../all/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/lib.rs), [crossbeam-skiplist/src/map.rs](../all/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/map.rs), [crossbeam-skiplist/src/set.rs](../all/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/set.rs), [crossbeam-skiplist/tests/map.rs](../all/claude/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/tests/map.rs)

<details><summary>diff</summary>

```diff
diff --git a/crossbeam-skiplist/src/base.rs b/crossbeam-skiplist/src/base.rs
index a73ee8a..9ecaec5 100644
--- a/crossbeam-skiplist/src/base.rs
+++ b/crossbeam-skiplist/src/base.rs
@@ -15,7 +15,7 @@ use core::{
 use crossbeam_epoch::{self as epoch, Atomic, Collector, Guard, Shared};
 use crossbeam_utils::CachePadded;
 
-use super::equivalent::Comparable;
+use super::comparator::{BasicComparator, Comparator};
 use crate::alloc_helper::Global;
 
 /// Number of bits needed to store height.
@@ -304,7 +304,7 @@ impl<'a, K, V> NodeRef<'a, K, V> {
     /// Decrements the reference count of a node, pinning the thread and destroying the node
     /// if the count become zero.
     #[inline]
-    unsafe fn decrement_with_pin<F>(self, parent: &SkipList<K, V>, pin: F)
+    unsafe fn decrement_with_pin<C, F>(self, parent: &SkipList<K, V, C>, pin: F)
     where
         F: FnOnce() -> Guard,
     {
@@ -451,7 +451,7 @@ struct HotData {
 }
 
 /// A lock-free skip list.
-// TODO(stjepang): Embed a custom `epoch::Collector` inside `SkipList<K, V>`. Instead of adding
+// TODO(stjepang): Embed a custom `epoch::Collector` inside `SkipList<K, V, C>`. Instead of adding
 // garbage to the default global collector, we should add it to a local collector tied to the
 // particular skip list instance.
 //
@@ -463,26 +463,37 @@ struct HotData {
 // As a further future optimization, if `!mem::needs_drop::<K>() && !mem::needs_drop::<V>()`
 // (neither key nor the value have destructors), there's no point in creating a new local
 // collector, so we should simply use the global one.
-pub struct SkipList<K, V> {
+pub struct SkipList<K, V, C = BasicComparator> {
     /// The head of the skip list (just a dummy node, not a real entry).
     head: Head<K, V>,
 
     /// The `Collector` associated with this skip list.
     collector: Collector,
 
+    /// The comparator that defines the ordering of keys.
+    comparator: C,
+
     /// Hot data associated with the skip list, stored in a dedicated cache line.
     hot_data: CachePadded<HotData>,
 }
 
-unsafe impl<K: Send + Sync, V: Send + Sync> Send for SkipList<K, V> {}
-unsafe impl<K: Send + Sync, V: Send + Sync> Sync for SkipList<K, V> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Send + Sync> Send for SkipList<K, V, C> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Send + Sync> Sync for SkipList<K, V, C> {}
 
 impl<K, V> SkipList<K, V> {
-    /// Returns a new, empty skip list.
+    /// Returns a new, empty skip list ordered by the keys' `Ord` implementation.
     pub fn new(collector: Collector) -> Self {
+        Self::with_comparator(collector, BasicComparator)
+    }
+}
+
+impl<K, V, C> SkipList<K, V, C> {
+    /// Returns a new, empty skip list ordered by `comparator`.
+    pub fn with_comparator(collector: Collector, comparator: C) -> Self {
         Self {
             head: Head::new(),
             collector,
+            comparator,
             hot_data: CachePadded::new(HotData {
                 seed: AtomicUsize::new(1),
                 len: AtomicUsize::new(0),
@@ -517,12 +528,12 @@ impl<K, V> SkipList<K, V> {
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Returns the entry with the smallest key.
-    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.next_node(self.head.as_tower(), Bound::Unbounded, guard)?;
         Some(Entry {
@@ -533,7 +544,7 @@ where
     }
 
     /// Returns the entry with the largest key.
-    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.search_bound::<K>(Bound::Unbounded, true, guard)?;
         Some(Entry {
@@ -546,21 +557,21 @@ where
     /// Returns `true` if the map contains a value for the specified key.
     pub fn contains_key<Q>(&self, key: &Q, guard: &Guard) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.get(key, guard).is_some()
     }
 
     /// Returns an entry with the specified `key`.
-    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>>
+    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
         let n = self.search_bound(Bound::Included(key), false, guard)?;
-        if !n.key.equivalent(key) {
+        if !self.comparator.equivalent(&n.key, key) {
             return None;
         }
 
@@ -578,9 +589,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -599,9 +610,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -614,7 +625,7 @@ where
     }
 
     /// Finds an entry with the specified key, or inserts a new `key`-`value` pair if none exist.
-    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| false, guard)
     }
 
@@ -626,7 +637,7 @@ where
     /// discarded. If closure is modifying some other state (such as shared counters or shared
     /// objects), it may lead to <u>undesired behaviour</u> such as counters being changed without
     /// result of closure inserted
-    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -634,7 +645,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V> {
+    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V, C> {
         self.check_guard(guard);
         Iter {
             parent: self,
@@ -645,7 +656,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn ref_iter(&self) -> RefIter<'_, K, V> {
+    pub fn ref_iter(&self) -> RefIter<'_, K, V, C> {
         RefIter {
             parent: self,
             head: None,
@@ -658,9 +669,9 @@ where
         &'a self,
         range: R,
         guard: &'g Guard,
-    ) -> Range<'a, 'g, Q, R, K, V>
+    ) -> Range<'a, 'g, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -677,9 +688,9 @@ where
 
     /// Returns an iterator over a subset of entries in the skip list.
     #[allow(clippy::needless_lifetimes)]
-    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V>
+    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -825,7 +836,7 @@ where
         guard: &'a Guard,
     ) -> Option<NodeRef<'a, K, V>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -887,11 +898,11 @@ where
                         // bound, we return the last node before the condition became true. For the
                         // lower bound, we return the first node after the condition became true.
                         if upper_bound {
-                            if !below_upper_bound(&bound, &c.key) {
+                            if !below_upper_bound(&self.comparator, &bound, &c.key) {
                                 break;
                             }
                             result = Some(c);
-                        } else if above_lower_bound(&bound, &c.key) {
+                        } else if above_lower_bound(&self.comparator, &bound, &c.key) {
                             result = Some(c);
                             break;
                         }
@@ -910,7 +921,7 @@ where
     /// Searches for a key in the skip list and returns a list of all adjacent nodes.
     fn search_position<'a, Q>(&'a self, key: &Q, guard: &'a Guard) -> Position<'a, K, V>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -971,7 +982,7 @@ where
 
                         // If `curr` contains a key that is greater than or equal to `key`, we're
                         // done with this level.
-                        match c.key.compare(key) {
+                        match self.comparator.compare(&c.key, key) {
                             cmp::Ordering::Greater => break,
                             cmp::Ordering::Equal => {
                                 result.found = Some(c);
@@ -1004,7 +1015,7 @@ where
         value: F,
         replace: CompareF,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
         CompareF: Fn(&V) -> bool,
@@ -1155,7 +1166,10 @@ where
                     // the tower without breaking any invariants. Note that building higher levels
                     // is completely optional. Only the lowest level really matters, and all the
                     // higher levels are there just to make searching faster.
-                    if succ.as_ref().map(|s| &s.key) == Some(&n.key) {
+                    if succ
+                        .as_ref()
+                        .is_some_and(|s| self.comparator.equivalent(&s.key, &n.key))
+                    {
                         search = self.search_position(&n.key, guard);
                         continue;
                     }
@@ -1218,16 +1232,17 @@ where
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the skip list and returns the new entry.
     ///
     /// If there is an existing entry with this key, it will be removed before inserting the new
     /// one.
-    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| true, guard)
     }
 
@@ -1242,7 +1257,7 @@ where
         value: V,
         compare_fn: F,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -1250,9 +1265,9 @@ where
     }
 
     /// Removes an entry with the specified `key` from the map and returns it.
-    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -1320,7 +1335,7 @@ where
     }
 
     /// Removes an entry from the front of the skip list.
-    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.front(guard)?;
@@ -1335,7 +1350,7 @@ where
     }
 
     /// Removes an entry from the back of the skip list.
-    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.back(guard)?;
@@ -1393,7 +1408,7 @@ where
     }
 }
 
-impl<K, V> Drop for SkipList<K, V> {
+impl<K, V, C> Drop for SkipList<K, V, C> {
     fn drop(&mut self) {
         unsafe {
             let mut node = NodeRef::from_shared(
@@ -1419,9 +1434,10 @@ impl<K, V> Drop for SkipList<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipList<K, V>
+impl<K, V, C> fmt::Debug for SkipList<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
+    C: Comparator<K>,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -1429,7 +1445,7 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipList<K, V> {
+impl<K, V, C> IntoIterator for SkipList<K, V, C> {
     type Item = (K, V);
     type IntoIter = IntoIter<K, V>;
 
@@ -1464,13 +1480,13 @@ impl<K, V> IntoIterator for SkipList<K, V> {
 /// The lifetimes of the key and value are the same as that of the `Guard`
 /// used when creating the `Entry` (`'g`). This lifetime is also constrained to
 /// not outlive the `SkipList`.
-pub struct Entry<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Entry<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'g, K, V>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Entry<'a, 'g, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1487,7 +1503,7 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1496,14 +1512,15 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     ///
     /// This method may return `None` if the reference count is already 0 and
     /// the node has been queued for deletion.
-    pub fn pin(&self) -> Option<RefEntry<'a, K, V>> {
+    pub fn pin(&self) -> Option<RefEntry<'a, K, V, C>> {
         unsafe { RefEntry::try_acquire(self.parent, self.node) }
     }
 }
 
-impl<K, V> Entry<'_, '_, K, V>
+impl<K, V, C> Entry<'_, '_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1526,7 +1543,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, '_, K, V> {
+impl<K, V, C> Clone for Entry<'_, '_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             parent: self.parent,
@@ -1536,7 +1553,7 @@ impl<K, V> Clone for Entry<'_, '_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1549,9 +1566,9 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K, V> Entry<'a, 'g, K, V>
+impl<'a: 'g, 'g, K, V, C> Entry<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self) -> bool {
@@ -1565,7 +1582,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self.parent.next_node(
             self.node.as_tower(),
             Bound::Excluded(&self.node.key),
@@ -1590,7 +1607,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self
             .parent
             .search_bound(Bound::Excluded(&self.node.key), true, self.guard)?;
@@ -1606,12 +1623,12 @@ where
 ///
 /// You *must* call `release` to free this type, otherwise the node will be
 /// leaked. This is because releasing the entry requires a `Guard`.
-pub struct RefEntry<'a, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct RefEntry<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'a, K, V>,
 }
 
-impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefEntry<'a, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1628,7 +1645,7 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1650,9 +1667,9 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     /// Tries to create a new `RefEntry` by incrementing the reference count of
     /// a node.
     unsafe fn try_acquire(
-        parent: &'a SkipList<K, V>,
+        parent: &'a SkipList<K, V, C>,
         node: NodeRef<'_, K, V>,
-    ) -> Option<RefEntry<'a, K, V>> {
+    ) -> Option<RefEntry<'a, K, V, C>> {
         if unsafe { node.try_increment() } {
             Some(RefEntry {
                 parent,
@@ -1667,9 +1684,10 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 }
 
-impl<K, V> RefEntry<'_, K, V>
+impl<K, V, C> RefEntry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1694,7 +1712,7 @@ where
     }
 }
 
-impl<K, V> Clone for RefEntry<'_, K, V> {
+impl<K, V, C> Clone for RefEntry<'_, K, V, C> {
     fn clone(&self) -> Self {
         unsafe {
             // Incrementing will always succeed since we're already holding a reference to the node.
@@ -1707,7 +1725,7 @@ impl<K, V> Clone for RefEntry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for RefEntry<'_, K, V>
+impl<K, V, C> fmt::Debug for RefEntry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1720,9 +1738,9 @@ where
     }
 }
 
-impl<'a, K, V> RefEntry<'a, K, V>
+impl<'a, K, V, C> RefEntry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self, guard: &Guard) -> bool {
@@ -1736,7 +1754,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1763,7 +1781,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1780,20 +1798,20 @@ where
 }
 
 /// An iterator over the entries of a `SkipList`.
-pub struct Iter<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Iter<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Iterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Iterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1804,7 +1822,7 @@ where
             }
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1817,11 +1835,11 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> DoubleEndedIterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> DoubleEndedIterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -1831,7 +1849,7 @@ where
                 .search_bound::<K>(Bound::Unbounded, true, self.guard),
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1844,7 +1862,7 @@ where
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Iter<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1858,13 +1876,13 @@ where
 }
 
 /// An iterator over reference-counted entries of a `SkipList`.
-pub struct RefIter<'a, K, V> {
-    parent: &'a SkipList<K, V>,
-    head: Option<RefEntry<'a, K, V>>,
-    tail: Option<RefEntry<'a, K, V>>,
+pub struct RefIter<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
+    head: Option<RefEntry<'a, K, V, C>>,
+    tail: Option<RefEntry<'a, K, V, C>>,
 }
 
-impl<K, V> fmt::Debug for RefIter<'_, K, V>
+impl<K, V, C> fmt::Debug for RefIter<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1883,12 +1901,12 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V>
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match &self.head {
             Some(e) => e.next(guard),
@@ -1896,7 +1914,9 @@ where
         };
         match (&next_head, &self.tail) {
             // The next key is larger than the latest tail key we observed with this iterator.
-            (Some(ref next), Some(t)) if next.key() >= t.key() => {
+            (Some(ref next), Some(t))
+                if self.parent.comparator.compare(next.key(), t.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1915,7 +1935,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match &self.tail {
             Some(e) => e.prev(guard),
@@ -1923,7 +1943,9 @@ where
         };
         match (&self.head, &next_tail) {
             // The prev key is smaller than the latest head key we observed with this iterator.
-            (Some(h), Some(next)) if h.key() >= next.key() => {
+            (Some(h), Some(next))
+                if self.parent.comparator.compare(h.key(), next.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1942,7 +1964,7 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C> {
     /// Decrements the reference count of `RefEntry` owned by the iterator.
     pub fn drop_impl(&mut self, guard: &Guard) {
         self.parent.check_guard(guard);
@@ -1956,13 +1978,13 @@ impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipList`.
-pub struct Range<'a: 'g, 'g, Q, R, K, V>
+pub struct Range<'a: 'g, 'g, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     range: R,
@@ -1970,15 +1992,15 @@ where
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> Iterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> Iterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1991,14 +2013,14 @@ where
             match self.tail {
                 Some(t) => {
                     let bound = Bound::Excluded(&t.as_ref().key);
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2013,13 +2035,13 @@ where
     }
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -2032,14 +2054,14 @@ where
             match self.head {
                 Some(h) => {
                     let bound = Bound::Excluded(&h.as_ref().key);
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2054,9 +2076,10 @@ where
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, '_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, '_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2071,38 +2094,39 @@ where
 }
 
 /// An iterator over reference-counted subset of entries of a `SkipList`.
-pub struct RefRange<'a, Q, R, K, V>
+pub struct RefRange<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
-    pub(crate) head: Option<RefEntry<'a, K, V>>,
-    pub(crate) tail: Option<RefEntry<'a, K, V>>,
+    parent: &'a SkipList<K, V, C>,
+    pub(crate) head: Option<RefEntry<'a, K, V, C>>,
+    pub(crate) tail: Option<RefEntry<'a, K, V, C>>,
     pub(crate) range: R,
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-unsafe impl<Q, R, K, V> Send for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C> Send for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-unsafe impl<Q, R, K, V> Sync for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C> Sync for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-impl<Q, R, K, V> fmt::Debug for RefRange<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2116,14 +2140,14 @@ where
     }
 }
 
-impl<'a, Q, R, K: 'a, V: 'a> RefRange<'a, Q, R, K, V>
+impl<'a, Q, R, K: 'a, V: 'a, C> RefRange<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match self.head {
             Some(ref e) => e.next(guard),
@@ -2134,7 +2158,7 @@ where
             match self.tail {
                 Some(ref t) => {
                     let bound = Bound::Excluded(t.key());
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2150,7 +2174,7 @@ where
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2171,7 +2195,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match self.tail {
             Some(ref e) => e.prev(guard),
@@ -2182,7 +2206,7 @@ where
             match self.head {
                 Some(ref h) => {
                     let bound = Bound::Excluded(h.key());
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2198,7 +2222,7 @@ where
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2307,9 +2331,9 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 
 /// Helper function to retry an operation until pinning succeeds or `None` is
 /// returned.
-pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V>(mut f: F) -> Option<RefEntry<'a, K, V>>
+pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V, C>(mut f: F) -> Option<RefEntry<'a, K, V, C>>
 where
-    F: FnMut() -> Option<Entry<'a, 'g, K, V>>,
+    F: FnMut() -> Option<Entry<'a, 'g, K, V, C>>,
 {
     loop {
         if let Some(e) = f()?.pin() {
@@ -2319,27 +2343,27 @@ where
 }
 
 /// Helper function to check if a value is above a lower bound
-fn above_lower_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn above_lower_bound<K, T, C>(comparator: &C, bound: &Bound<&T>, other: &K) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<K, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_ge(),
-        Bound::Excluded(key) => other.compare(key).is_gt(),
+        Bound::Included(key) => comparator.compare(other, key).is_ge(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_gt(),
     }
 }
 
 /// Helper function to check if a value is below an upper bound
-fn below_upper_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn below_upper_bound<K, T, C>(comparator: &C, bound: &Bound<&T>, other: &K) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<K, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_le(),
-        Bound::Excluded(key) => other.compare(key).is_lt(),
+        Bound::Included(key) => comparator.compare(other, key).is_le(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_lt(),
     }
 }
diff --git a/crossbeam-skiplist/src/comparator.rs b/crossbeam-skiplist/src/comparator.rs
new file mode 100644
index 0000000..231bc7d
--- /dev/null
+++ b/crossbeam-skiplist/src/comparator.rs
@@ -0,0 +1,44 @@
+//! Runtime-selectable key ordering for skip lists.
+
+use core::cmp::Ordering;
+
+use crate::equivalent::{Comparable, Equivalent};
+
+/// Decides whether two keys are equal.
+pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
+    /// Returns `true` if `lhs` and `rhs` are equal.
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
+}
+
+/// Decides how two keys are ordered.
+///
+/// `equivalent` must agree with `compare` returning `Ordering::Equal`, and the ordering must be
+/// total and consistent for the lifetime of the collection using it.
+pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
+    /// Returns the ordering of `lhs` relative to `rhs`.
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
+}
+
+/// Orders keys through the [`Equivalent`] and [`Comparable`] traits, i.e. by their `Ord`.
+#[derive(Clone, Copy, Debug, Default)]
+pub struct BasicComparator;
+
+impl<L: ?Sized, R: ?Sized> Equivalator<L, R> for BasicComparator
+where
+    L: Equivalent<R>,
+{
+    #[inline]
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
+        lhs.equivalent(rhs)
+    }
+}
+
+impl<L: ?Sized, R: ?Sized> Comparator<L, R> for BasicComparator
+where
+    L: Comparable<R>,
+{
+    #[inline]
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
+        lhs.compare(rhs)
+    }
+}
diff --git a/crossbeam-skiplist/src/lib.rs b/crossbeam-skiplist/src/lib.rs
index 5ff8e74..5337e3d 100644
--- a/crossbeam-skiplist/src/lib.rs
+++ b/crossbeam-skiplist/src/lib.rs
@@ -265,4 +265,5 @@ pub mod set;
 #[doc(inline)]
 pub use crate::{map::SkipMap, set::SkipSet};
 
+pub mod comparator;
 pub mod equivalent;
diff --git a/crossbeam-skiplist/src/map.rs b/crossbeam-skiplist/src/map.rs
index c7c5408..9bbb443 100644
--- a/crossbeam-skiplist/src/map.rs
+++ b/crossbeam-skiplist/src/map.rs
@@ -11,7 +11,7 @@ use crossbeam_epoch as epoch;
 
 use crate::{
     base::{self, try_pin_loop},
-    equivalent::Comparable,
+    comparator::{BasicComparator, Comparator},
 };
 
 /// An ordered map based on a lock-free skip list.
@@ -20,8 +20,8 @@ use crate::{
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeMap`]: std::collections::BTreeMap
-pub struct SkipMap<K, V> {
-    inner: base::SkipList<K, V>,
+pub struct SkipMap<K, V, C = BasicComparator> {
+    inner: base::SkipList<K, V, C>,
 }
 
 impl<K, V> SkipMap<K, V> {
@@ -39,6 +39,54 @@ impl<K, V> SkipMap<K, V> {
             inner: base::SkipList::new(epoch::default_collector().clone()),
         }
     }
+}
+
+impl<K, V, C> SkipMap<K, V, C> {
+    /// Returns a new, empty map ordered by `comparator`.
+    ///
+    /// # Example
+    ///
+    /// ```
+    /// use crossbeam_skiplist::{
+    ///     SkipMap,
+    ///     comparator::{Comparator, Equivalator},
+    /// };
+    ///
+    /// struct IgnoreCase;
+    ///
+    /// impl Equivalator<String, str> for IgnoreCase {
+    ///     fn equivalent(&self, lhs: &String, rhs: &str) -> bool {
+    ///         lhs.eq_ignore_ascii_case(rhs)
+    ///     }
+    /// }
+    ///
+    /// impl Comparator<String, str> for IgnoreCase {
+    ///     fn compare(&self, lhs: &String, rhs: &str) -> std::cmp::Ordering {
+    ///         lhs.to_ascii_lowercase().as_str().cmp(&rhs.to_ascii_lowercase())
+    ///     }
+    /// }
+    ///
+    /// impl Equivalator<String> for IgnoreCase {
+    ///     fn equivalent(&self, lhs: &String, rhs: &String) -> bool {
+    ///         lhs.eq_ignore_ascii_case(rhs)
+    ///     }
+    /// }
+    ///
+    /// impl Comparator<String> for IgnoreCase {
+    ///     fn compare(&self, lhs: &String, rhs: &String) -> std::cmp::Ordering {
+    ///         self.compare(lhs, rhs.as_str())
+    ///     }
+    /// }
+    ///
+    /// let map = SkipMap::<String, u32, _>::with_comparator(IgnoreCase);
+    /// map.insert("abc".to_string(), 1);
+    /// assert_eq!(*map.get("aBc").unwrap().value(), 1);
+    /// ```
+    pub fn with_comparator(comparator: C) -> Self {
+        Self {
+            inner: base::SkipList::with_comparator(epoch::default_collector().clone(), comparator),
+        }
+    }
 
     /// Returns `true` if the map is empty.
     ///
@@ -80,9 +128,9 @@ impl<K, V> SkipMap<K, V> {
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -99,7 +147,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.front().unwrap().value(), "five");
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.front(guard)).map(Entry::new)
     }
@@ -119,7 +167,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.back().unwrap().value(), "six");
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.back(guard)).map(Entry::new)
     }
@@ -138,7 +186,7 @@ where
     /// ```
     pub fn contains_key<Q>(&self, key: &Q) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -160,9 +208,9 @@ where
     /// numbers.insert("six", 6);
     /// assert_eq!(*numbers.get("six").unwrap().value(), 6);
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -195,9 +243,9 @@ where
     /// let greater_than_thirteen = numbers.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -227,9 +275,9 @@ where
     /// let less_than_six = numbers.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -253,7 +301,7 @@ where
     /// let jobs_age = ages.get_or_insert("Steve Jobs", -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.get_or_insert(key, value, guard))
     }
@@ -283,7 +331,7 @@ where
     /// let jobs_age = ages.get_or_insert_with("Steve Jobs", || -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -313,7 +361,7 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn iter(&self) -> Iter<'_, K, V> {
+    pub fn iter(&self) -> Iter<'_, K, V, C> {
         Iter {
             inner: self.inner.ref_iter(),
         }
@@ -340,10 +388,10 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V, C>
     where
         R: RangeBounds<Q>,
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         Range {
@@ -352,9 +400,10 @@ where
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the map and returns the new entry.
@@ -374,7 +423,7 @@ where
     ///
     /// assert_eq!(*map.get("key").unwrap().value(), "value");
     /// ```
-    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.insert(key, value, guard))
     }
@@ -401,7 +450,7 @@ where
     /// map.compare_insert("absent_key", 0, |_| false);
     /// assert_eq!(*map.get("absent_key").unwrap().value(), 0);
     /// ```
-    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V>
+    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -427,9 +476,9 @@ where
     /// map.insert("key", "value");
     /// assert_eq!(*map.remove("key").unwrap().value(), "value");
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -458,7 +507,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_front(guard).map(Entry::new)
     }
@@ -485,7 +534,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_back(guard).map(Entry::new)
     }
@@ -515,9 +564,10 @@ impl<K, V> Default for SkipMap<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipMap<K, V>
+impl<K, V, C> fmt::Debug for SkipMap<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
+    C: Comparator<K>,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -525,7 +575,7 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipMap<K, V> {
+impl<K, V, C> IntoIterator for SkipMap<K, V, C> {
     type Item = (K, V);
     type IntoIter = IntoIter<K, V>;
 
@@ -536,14 +586,14 @@ impl<K, V> IntoIterator for SkipMap<K, V> {
     }
 }
 
-impl<'a, K, V> IntoIterator for &'a SkipMap<K, V>
+impl<'a, K, V, C> IntoIterator for &'a SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, K, V>;
-    type IntoIter = Iter<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
+    type IntoIter = Iter<'a, K, V, C>;
 
-    fn into_iter(self) -> Iter<'a, K, V> {
+    fn into_iter(self) -> Iter<'a, K, V, C> {
         self.iter()
     }
 }
@@ -565,12 +615,12 @@ where
 }
 
 /// A reference-counted entry in a map.
-pub struct Entry<'a, K, V> {
-    inner: ManuallyDrop<base::RefEntry<'a, K, V>>,
+pub struct Entry<'a, K, V, C = BasicComparator> {
+    inner: ManuallyDrop<base::RefEntry<'a, K, V, C>>,
 }
 
-impl<'a, K, V> Entry<'a, K, V> {
-    fn new(inner: base::RefEntry<'a, K, V>) -> Self {
+impl<'a, K, V, C> Entry<'a, K, V, C> {
+    fn new(inner: base::RefEntry<'a, K, V, C>) -> Self {
         Self {
             inner: ManuallyDrop::new(inner),
         }
@@ -592,7 +642,7 @@ impl<'a, K, V> Entry<'a, K, V> {
     }
 }
 
-impl<K, V> Drop for Entry<'_, K, V> {
+impl<K, V, C> Drop for Entry<'_, K, V, C> {
     fn drop(&mut self) {
         unsafe {
             ManuallyDrop::into_inner(ptr::read(&self.inner)).release_with_pin(epoch::pin);
@@ -600,9 +650,9 @@ impl<K, V> Drop for Entry<'_, K, V> {
     }
 }
 
-impl<'a, K, V> Entry<'a, K, V>
+impl<'a, K, V, C> Entry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the map.
     pub fn move_next(&mut self) -> bool {
@@ -617,21 +667,22 @@ where
     }
 
     /// Returns the next entry in the map.
-    pub fn next(&self) -> Option<Entry<'a, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 
     /// Returns the previous entry in the map.
-    pub fn prev(&self) -> Option<Entry<'a, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.prev(guard).map(Entry::new)
     }
 }
 
-impl<K, V> Entry<'_, K, V>
+impl<K, V, C> Entry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the map.
@@ -643,7 +694,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, K, V> {
+impl<K, V, C> Clone for Entry<'_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -651,7 +702,7 @@ impl<K, V> Clone for Entry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -684,39 +735,39 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 }
 
 /// An iterator over the entries of a `SkipMap`.
-pub struct Iter<'a, K, V> {
-    inner: base::RefIter<'a, K, V>,
+pub struct Iter<'a, K, V, C = BasicComparator> {
+    inner: base::RefIter<'a, K, V, C>,
 }
 
-impl<'a, K, V> Iterator for Iter<'a, K, V>
+impl<'a, K, V, C> Iterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, K, V> DoubleEndedIterator for Iter<'a, K, V>
+impl<'a, K, V, C> DoubleEndedIterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, K, V> {
+impl<K, V, C> fmt::Debug for Iter<'_, K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
-impl<K, V> Drop for Iter<'_, K, V> {
+impl<K, V, C> Drop for Iter<'_, K, V, C> {
     fn drop(&mut self) {
         let guard = &epoch::pin();
         self.inner.drop_impl(guard);
@@ -724,44 +775,45 @@ impl<K, V> Drop for Iter<'_, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipMap`.
-pub struct Range<'a, Q, R, K, V>
+pub struct Range<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    pub(crate) inner: base::RefRange<'a, Q, R, K, V>,
+    pub(crate) inner: base::RefRange<'a, Q, R, K, V, C>,
 }
 
-impl<'a, Q, R, K, V> Iterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> Iterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, Q, R, K, V> DoubleEndedIterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> DoubleEndedIterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -775,9 +827,9 @@ where
     }
 }
 
-impl<Q, R, K, V> Drop for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> Drop for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/src/set.rs b/crossbeam-skiplist/src/set.rs
index 4e91f6c..79d6da5 100644
--- a/crossbeam-skiplist/src/set.rs
+++ b/crossbeam-skiplist/src/set.rs
@@ -5,7 +5,10 @@ use core::{
     ops::{Bound, Deref, RangeBounds},
 };
 
-use crate::{equivalent::Comparable, map};
+use crate::{
+    comparator::{BasicComparator, Comparator},
+    map,
+};
 
 /// A set based on a lock-free skip list.
 ///
@@ -13,8 +16,8 @@ use crate::{equivalent::Comparable, map};
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeSet`]: std::collections::BTreeSet
-pub struct SkipSet<T> {
-    inner: map::SkipMap<T, ()>,
+pub struct SkipSet<T, C = BasicComparator> {
+    inner: map::SkipMap<T, (), C>,
 }
 
 impl<T> SkipSet<T> {
@@ -32,6 +35,23 @@ impl<T> SkipSet<T> {
             inner: map::SkipMap::new(),
         }
     }
+}
+
+impl<T, C> SkipSet<T, C> {
+    /// Returns a new, empty set ordered by `comparator`.
+    ///
+    /// # Example
+    ///
+    /// ```
+    /// use crossbeam_skiplist::{SkipSet, comparator::BasicComparator};
+    ///
+    /// let set: SkipSet<i32, _> = SkipSet::with_comparator(BasicComparator);
+    /// ```
+    pub fn with_comparator(comparator: C) -> Self {
+        Self {
+            inner: map::SkipMap::with_comparator(comparator),
+        }
+    }
 
     /// Returns `true` if the set is empty.
     ///
@@ -71,9 +91,9 @@ impl<T> SkipSet<T> {
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -88,7 +108,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.front().unwrap(), 1);
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, T>> {
+    pub fn front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.front().map(Entry::new)
     }
 
@@ -105,7 +125,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.back().unwrap(), 2);
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, T>> {
+    pub fn back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.back().map(Entry::new)
     }
 
@@ -122,7 +142,7 @@ where
     /// ```
     pub fn contains<Q>(&self, key: &Q) -> bool
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.contains_key(key)
@@ -139,9 +159,9 @@ where
     /// assert_eq!(*set.get(&3).unwrap(), 3);
     /// assert!(set.get(&4).is_none());
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.get(key).map(Entry::new)
@@ -171,9 +191,9 @@ where
     /// let greater_than_thirteen = set.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.lower_bound(bound).map(Entry::new)
@@ -200,9 +220,9 @@ where
     /// let less_than_six = set.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.upper_bound(bound).map(Entry::new)
@@ -219,7 +239,7 @@ where
     /// let entry = set.get_or_insert(2);
     /// assert_eq!(*entry, 2);
     /// ```
-    pub fn get_or_insert(&self, key: T) -> Entry<'_, T> {
+    pub fn get_or_insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.get_or_insert(key, ()))
     }
 
@@ -241,7 +261,7 @@ where
     /// assert_eq!(*set_iter.next().unwrap(), 12);
     /// assert!(set_iter.next().is_none());
     /// ```
-    pub fn iter(&self) -> Iter<'_, T> {
+    pub fn iter(&self) -> Iter<'_, T, C> {
         Iter {
             inner: self.inner.iter(),
         }
@@ -264,10 +284,10 @@ where
     /// assert_eq!(*set_range.next().unwrap(), 7);
     /// assert!(set_range.next().is_none());
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T, C>
     where
         R: RangeBounds<Q>,
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         Range {
@@ -276,9 +296,10 @@ where
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T>,
 {
     /// Inserts a `key`-`value` pair into the set and returns the new entry.
     ///
@@ -294,7 +315,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.get(&2).unwrap(), 2);
     /// ```
-    pub fn insert(&self, key: T) -> Entry<'_, T> {
+    pub fn insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.insert(key, ()))
     }
 
@@ -313,9 +334,9 @@ where
     /// assert_eq!(*set.remove(&2).unwrap(), 2);
     /// assert!(set.remove(&2).is_none());
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.remove(key).map(Entry::new)
@@ -342,7 +363,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_front().map(Entry::new)
     }
 
@@ -367,7 +388,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_back().map(Entry::new)
     }
 
@@ -396,16 +417,17 @@ impl<T> Default for SkipSet<T> {
     }
 }
 
-impl<T> fmt::Debug for SkipSet<T>
+impl<T, C> fmt::Debug for SkipSet<T, C>
 where
-    T: Ord + fmt::Debug,
+    T: fmt::Debug,
+    C: Comparator<T>,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("SkipSet { .. }")
     }
 }
 
-impl<T> IntoIterator for SkipSet<T> {
+impl<T, C> IntoIterator for SkipSet<T, C> {
     type Item = T;
     type IntoIter = IntoIter<T>;
 
@@ -416,14 +438,14 @@ impl<T> IntoIterator for SkipSet<T> {
     }
 }
 
-impl<'a, T> IntoIterator for &'a SkipSet<T>
+impl<'a, T, C> IntoIterator for &'a SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    type Item = Entry<'a, T>;
-    type IntoIter = Iter<'a, T>;
+    type Item = Entry<'a, T, C>;
+    type IntoIter = Iter<'a, T, C>;
 
-    fn into_iter(self) -> Iter<'a, T> {
+    fn into_iter(self) -> Iter<'a, T, C> {
         self.iter()
     }
 }
@@ -445,12 +467,12 @@ where
 }
 
 /// A reference-counted entry in a set.
-pub struct Entry<'a, T> {
-    inner: map::Entry<'a, T, ()>,
+pub struct Entry<'a, T, C = BasicComparator> {
+    inner: map::Entry<'a, T, (), C>,
 }
 
-impl<'a, T> Entry<'a, T> {
-    fn new(inner: map::Entry<'a, T, ()>) -> Self {
+impl<'a, T, C> Entry<'a, T, C> {
+    fn new(inner: map::Entry<'a, T, (), C>) -> Self {
         Self { inner }
     }
 
@@ -465,9 +487,9 @@ impl<'a, T> Entry<'a, T> {
     }
 }
 
-impl<'a, T> Entry<'a, T>
+impl<'a, T, C> Entry<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
     /// Moves to the next entry in the set.
     pub fn move_next(&mut self) -> bool {
@@ -480,19 +502,20 @@ where
     }
 
     /// Returns the next entry in the set.
-    pub fn next(&self) -> Option<Entry<'a, T>> {
+    pub fn next(&self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 
     /// Returns the previous entry in the set.
-    pub fn prev(&self) -> Option<Entry<'a, T>> {
+    pub fn prev(&self) -> Option<Entry<'a, T, C>> {
         self.inner.prev().map(Entry::new)
     }
 }
 
-impl<T> Entry<'_, T>
+impl<T, C> Entry<'_, T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T>,
 {
     /// Removes the entry from the set.
     ///
@@ -502,7 +525,7 @@ where
     }
 }
 
-impl<T> Clone for Entry<'_, T> {
+impl<T, C> Clone for Entry<'_, T, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -510,7 +533,7 @@ impl<T> Clone for Entry<'_, T> {
     }
 }
 
-impl<T> fmt::Debug for Entry<'_, T>
+impl<T, C> fmt::Debug for Entry<'_, T, C>
 where
     T: fmt::Debug,
 {
@@ -521,7 +544,7 @@ where
     }
 }
 
-impl<T> Deref for Entry<'_, T> {
+impl<T, C> Deref for Entry<'_, T, C> {
     type Target = T;
 
     fn deref(&self) -> &Self::Target {
@@ -549,73 +572,74 @@ impl<T> fmt::Debug for IntoIter<T> {
 }
 
 /// An iterator over the entries of a `SkipSet`.
-pub struct Iter<'a, T> {
-    inner: map::Iter<'a, T, ()>,
+pub struct Iter<'a, T, C = BasicComparator> {
+    inner: map::Iter<'a, T, (), C>,
 }
 
-impl<'a, T> Iterator for Iter<'a, T>
+impl<'a, T, C> Iterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, T> DoubleEndedIterator for Iter<'a, T>
+impl<'a, T, C> DoubleEndedIterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<T> fmt::Debug for Iter<'_, T> {
+impl<T, C> fmt::Debug for Iter<'_, T, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
 /// An iterator over a subset of entries of a `SkipSet`.
-pub struct Range<'a, Q, R, T>
+pub struct Range<'a, Q, R, T, C = BasicComparator>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    inner: map::Range<'a, Q, R, T, ()>,
+    inner: map::Range<'a, Q, R, T, (), C>,
 }
 
-impl<'a, Q, R, T> Iterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> Iterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, Q, R, T> DoubleEndedIterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> DoubleEndedIterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<Q, R, T> fmt::Debug for Range<'_, Q, R, T>
+impl<Q, R, T, C> fmt::Debug for Range<'_, Q, R, T, C>
 where
-    T: Ord + Comparable<Q> + fmt::Debug,
+    T: fmt::Debug,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/tests/map.rs b/crossbeam-skiplist/tests/map.rs
index 2fa8c2b..a3b30a8 100644
--- a/crossbeam-skiplist/tests/map.rs
+++ b/crossbeam-skiplist/tests/map.rs
@@ -962,3 +962,82 @@ fn issue_1178() {
         map.insert(k, v);
     }
 }
+
+mod comparator {
+    use std::{cmp::Ordering, ops::Bound};
+
+    use crossbeam_skiplist::{
+        SkipMap, SkipSet,
+        comparator::{Comparator, Equivalator},
+    };
+
+    struct IgnoreCase;
+
+    impl Equivalator<String, str> for IgnoreCase {
+        fn equivalent(&self, lhs: &String, rhs: &str) -> bool {
+            lhs.eq_ignore_ascii_case(rhs)
+        }
+    }
+
+    impl Comparator<String, str> for IgnoreCase {
+        fn compare(&self, lhs: &String, rhs: &str) -> Ordering {
+            lhs.to_ascii_lowercase()
+                .as_str()
+                .cmp(&rhs.to_ascii_lowercase())
+        }
+    }
+
+    impl Equivalator<String> for IgnoreCase {
+        fn equivalent(&self, lhs: &String, rhs: &String) -> bool {
+            lhs.eq_ignore_ascii_case(rhs)
+        }
+    }
+
+    impl Comparator<String> for IgnoreCase {
+        fn compare(&self, lhs: &String, rhs: &String) -> Ordering {
+            self.compare(lhs, rhs.as_str())
+        }
+    }
+
+    #[test]
+    fn map_ignores_case() {
+        let map = SkipMap::<String, u32, _>::with_comparator(IgnoreCase);
+        map.insert("abc".to_string(), 1);
+        map.insert("ABC".to_string(), 2);
+        map.insert("b".to_string(), 3);
+        assert_eq!(map.len(), 2);
+        assert_eq!(*map.get("aBc").unwrap().value(), 2);
+        assert!(map.contains_key("B"));
+        let keys: Vec<_> = map
+            .range::<str, _>((Bound::Included("A"), Bound::Included("BB")))
+            .map(|e| e.key().clone())
+            .collect();
+        assert_eq!(keys, ["ABC", "b"]);
+        assert_eq!(map.iter().rev().next().unwrap().key(), "b");
+        assert_eq!(*map.remove("ABC").unwrap().value(), 2);
+        assert!(map.get("abc").is_none());
+    }
+
+    #[test]
+    fn set_reverse_order() {
+        struct Rev;
+        impl Equivalator<i32> for Rev {
+            fn equivalent(&self, l: &i32, r: &i32) -> bool {
+                l == r
+            }
+        }
+        impl Comparator<i32> for Rev {
+            fn compare(&self, l: &i32, r: &i32) -> Ordering {
+                r.cmp(l)
+            }
+        }
+        let set = SkipSet::with_comparator(Rev);
+        for i in 0..100 {
+            set.insert(i);
+        }
+        let v: Vec<_> = set.iter().map(|e| *e.value()).collect();
+        assert_eq!(v, (0..100).rev().collect::<Vec<_>>());
+        assert!(set.remove(&50).is_some());
+        assert_eq!(set.len(), 99);
+    }
+}
```

</details>

<details><summary>reply</summary>

Editing `base.rs` to thread the new `C` comparator parameter through it, using a scratch script outside `/tmp`.

Fixing the remaining `map.rs` impl headers (`IntoIterator`, `Default`, `FromIterator`, `new`/`with_comparator`), then repeating for `set.rs`.

Everything compiles. Adding a test for the case-insensitive comparator and running the suite.

Done. `crossbeam_skiplist::comparator` is added, and `SkipMap`, `SkipSet`, `base::SkipList` and their entry, iterator and range types take a last type parameter `C` defaulting to `BasicComparator`. `with_comparator` exists on all three collections. Lookups, inserts, removes and ranges use the comparator. All tests pass, including two new ones, but the new tests only cover `SkipMap` and `SkipSet`, not `base::SkipList::with_comparator` directly.

- **Tests:** The new ones are in `tests/map.rs`, one for a case-insensitive `SkipMap<String, u32, _>` and one for a reverse-ordered `SkipSet`. In the first, `get("aBc")` finds `"abc"`, and `range`, `remove` and `iter().rev()` also work.
- **`new()`, `Default` and `FromIterator`:** These stay `BasicComparator`-only. `new()` and `FromIterator` still require `K: Ord`.
- **Not run:** Clippy fails on `benches/*` because they need nightly. The lib itself checks with no warnings.
- **Not added:** There is no impl that turns a boxed closure into a `Comparator`. You implement the two traits yourself, as the case-insensitive example does.

</details>

### codex, base: pass

Files: [crossbeam-skiplist/src/base.rs](../base/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/base.rs), [crossbeam-skiplist/src/comparator.rs](../base/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/comparator.rs), [crossbeam-skiplist/src/lib.rs](../base/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/lib.rs), [crossbeam-skiplist/src/map.rs](../base/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/map.rs), [crossbeam-skiplist/src/set.rs](../base/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/set.rs), [crossbeam-skiplist/tests/comparator.rs](../base/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/tests/comparator.rs)

<details><summary>diff</summary>

```diff
diff --git a/crossbeam-skiplist/src/base.rs b/crossbeam-skiplist/src/base.rs
index a73ee8a..d589cdb 100644
--- a/crossbeam-skiplist/src/base.rs
+++ b/crossbeam-skiplist/src/base.rs
@@ -15,8 +15,8 @@ use core::{
 use crossbeam_epoch::{self as epoch, Atomic, Collector, Guard, Shared};
 use crossbeam_utils::CachePadded;
 
-use super::equivalent::Comparable;
 use crate::alloc_helper::Global;
+use crate::comparator::{BasicComparator, Comparator};
 
 /// Number of bits needed to store height.
 const HEIGHT_BITS: usize = 5;
@@ -304,7 +304,7 @@ impl<'a, K, V> NodeRef<'a, K, V> {
     /// Decrements the reference count of a node, pinning the thread and destroying the node
     /// if the count become zero.
     #[inline]
-    unsafe fn decrement_with_pin<F>(self, parent: &SkipList<K, V>, pin: F)
+    unsafe fn decrement_with_pin<F, C>(self, parent: &SkipList<K, V, C>, pin: F)
     where
         F: FnOnce() -> Guard,
     {
@@ -451,7 +451,7 @@ struct HotData {
 }
 
 /// A lock-free skip list.
-// TODO(stjepang): Embed a custom `epoch::Collector` inside `SkipList<K, V>`. Instead of adding
+// TODO(stjepang): Embed a custom `epoch::Collector` inside `SkipList<K, V, C>`. Instead of adding
 // garbage to the default global collector, we should add it to a local collector tied to the
 // particular skip list instance.
 //
@@ -463,10 +463,12 @@ struct HotData {
 // As a further future optimization, if `!mem::needs_drop::<K>() && !mem::needs_drop::<V>()`
 // (neither key nor the value have destructors), there's no point in creating a new local
 // collector, so we should simply use the global one.
-pub struct SkipList<K, V> {
+pub struct SkipList<K, V, C = BasicComparator> {
     /// The head of the skip list (just a dummy node, not a real entry).
     head: Head<K, V>,
 
+    comparator: C,
+
     /// The `Collector` associated with this skip list.
     collector: Collector,
 
@@ -474,13 +476,14 @@ pub struct SkipList<K, V> {
     hot_data: CachePadded<HotData>,
 }
 
-unsafe impl<K: Send + Sync, V: Send + Sync> Send for SkipList<K, V> {}
-unsafe impl<K: Send + Sync, V: Send + Sync> Sync for SkipList<K, V> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Send> Send for SkipList<K, V, C> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Sync> Sync for SkipList<K, V, C> {}
 
-impl<K, V> SkipList<K, V> {
+impl<K, V, C> SkipList<K, V, C> {
     /// Returns a new, empty skip list.
-    pub fn new(collector: Collector) -> Self {
+    pub fn with_comparator(collector: Collector, comparator: C) -> Self {
         Self {
+            comparator,
             head: Head::new(),
             collector,
             hot_data: CachePadded::new(HotData {
@@ -517,12 +520,12 @@ impl<K, V> SkipList<K, V> {
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Returns the entry with the smallest key.
-    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.next_node(self.head.as_tower(), Bound::Unbounded, guard)?;
         Some(Entry {
@@ -533,7 +536,7 @@ where
     }
 
     /// Returns the entry with the largest key.
-    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.search_bound::<K>(Bound::Unbounded, true, guard)?;
         Some(Entry {
@@ -546,21 +549,21 @@ where
     /// Returns `true` if the map contains a value for the specified key.
     pub fn contains_key<Q>(&self, key: &Q, guard: &Guard) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.get(key, guard).is_some()
     }
 
     /// Returns an entry with the specified `key`.
-    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>>
+    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
         let n = self.search_bound(Bound::Included(key), false, guard)?;
-        if !n.key.equivalent(key) {
+        if !self.comparator.equivalent(&n.key, key) {
             return None;
         }
 
@@ -578,9 +581,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -599,9 +602,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -614,7 +617,7 @@ where
     }
 
     /// Finds an entry with the specified key, or inserts a new `key`-`value` pair if none exist.
-    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| false, guard)
     }
 
@@ -626,7 +629,7 @@ where
     /// discarded. If closure is modifying some other state (such as shared counters or shared
     /// objects), it may lead to <u>undesired behaviour</u> such as counters being changed without
     /// result of closure inserted
-    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -634,7 +637,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V> {
+    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V, C> {
         self.check_guard(guard);
         Iter {
             parent: self,
@@ -645,7 +648,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn ref_iter(&self) -> RefIter<'_, K, V> {
+    pub fn ref_iter(&self) -> RefIter<'_, K, V, C> {
         RefIter {
             parent: self,
             head: None,
@@ -658,9 +661,9 @@ where
         &'a self,
         range: R,
         guard: &'g Guard,
-    ) -> Range<'a, 'g, Q, R, K, V>
+    ) -> Range<'a, 'g, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -677,9 +680,9 @@ where
 
     /// Returns an iterator over a subset of entries in the skip list.
     #[allow(clippy::needless_lifetimes)]
-    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V>
+    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -825,7 +828,7 @@ where
         guard: &'a Guard,
     ) -> Option<NodeRef<'a, K, V>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -887,11 +890,11 @@ where
                         // bound, we return the last node before the condition became true. For the
                         // lower bound, we return the first node after the condition became true.
                         if upper_bound {
-                            if !below_upper_bound(&bound, &c.key) {
+                            if !below_upper_bound(&self.comparator, &bound, &c.key) {
                                 break;
                             }
                             result = Some(c);
-                        } else if above_lower_bound(&bound, &c.key) {
+                        } else if above_lower_bound(&self.comparator, &bound, &c.key) {
                             result = Some(c);
                             break;
                         }
@@ -910,7 +913,7 @@ where
     /// Searches for a key in the skip list and returns a list of all adjacent nodes.
     fn search_position<'a, Q>(&'a self, key: &Q, guard: &'a Guard) -> Position<'a, K, V>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -971,7 +974,7 @@ where
 
                         // If `curr` contains a key that is greater than or equal to `key`, we're
                         // done with this level.
-                        match c.key.compare(key) {
+                        match self.comparator.compare(&c.key, key) {
                             cmp::Ordering::Greater => break,
                             cmp::Ordering::Equal => {
                                 result.found = Some(c);
@@ -1004,7 +1007,7 @@ where
         value: F,
         replace: CompareF,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
         CompareF: Fn(&V) -> bool,
@@ -1018,7 +1021,7 @@ where
             let guard = &*(guard as *const _);
 
             // First try searching for the key.
-            // Note that the `Ord` implementation for `K` may panic during the search.
+            // Note that the comparator may panic during the search.
             let mut search = self.search_position(&key, guard);
             if let Some(r) = search.found {
                 let replace = replace(&r.value);
@@ -1155,7 +1158,10 @@ where
                     // the tower without breaking any invariants. Note that building higher levels
                     // is completely optional. Only the lowest level really matters, and all the
                     // higher levels are there just to make searching faster.
-                    if succ.as_ref().map(|s| &s.key) == Some(&n.key) {
+                    if succ
+                        .as_ref()
+                        .is_some_and(|s| self.comparator.equivalent(&s.key, &n.key))
+                    {
                         search = self.search_position(&n.key, guard);
                         continue;
                     }
@@ -1218,16 +1224,17 @@ where
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the skip list and returns the new entry.
     ///
     /// If there is an existing entry with this key, it will be removed before inserting the new
     /// one.
-    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| true, guard)
     }
 
@@ -1242,7 +1249,7 @@ where
         value: V,
         compare_fn: F,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -1250,9 +1257,9 @@ where
     }
 
     /// Removes an entry with the specified `key` from the map and returns it.
-    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -1320,7 +1327,7 @@ where
     }
 
     /// Removes an entry from the front of the skip list.
-    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.front(guard)?;
@@ -1335,7 +1342,7 @@ where
     }
 
     /// Removes an entry from the back of the skip list.
-    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.back(guard)?;
@@ -1393,7 +1400,7 @@ where
     }
 }
 
-impl<K, V> Drop for SkipList<K, V> {
+impl<K, V, C> Drop for SkipList<K, V, C> {
     fn drop(&mut self) {
         unsafe {
             let mut node = NodeRef::from_shared(
@@ -1419,9 +1426,10 @@ impl<K, V> Drop for SkipList<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipList<K, V>
+impl<K, V, C> fmt::Debug for SkipList<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
+    C: Comparator<K>,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -1429,7 +1437,7 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipList<K, V> {
+impl<K, V, C> IntoIterator for SkipList<K, V, C> {
     type Item = (K, V);
     type IntoIter = IntoIter<K, V>;
 
@@ -1464,13 +1472,13 @@ impl<K, V> IntoIterator for SkipList<K, V> {
 /// The lifetimes of the key and value are the same as that of the `Guard`
 /// used when creating the `Entry` (`'g`). This lifetime is also constrained to
 /// not outlive the `SkipList`.
-pub struct Entry<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Entry<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'g, K, V>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Entry<'a, 'g, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1487,7 +1495,7 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1496,14 +1504,15 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     ///
     /// This method may return `None` if the reference count is already 0 and
     /// the node has been queued for deletion.
-    pub fn pin(&self) -> Option<RefEntry<'a, K, V>> {
+    pub fn pin(&self) -> Option<RefEntry<'a, K, V, C>> {
         unsafe { RefEntry::try_acquire(self.parent, self.node) }
     }
 }
 
-impl<K, V> Entry<'_, '_, K, V>
+impl<K, V, C> Entry<'_, '_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1526,7 +1535,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, '_, K, V> {
+impl<K, V, C> Clone for Entry<'_, '_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             parent: self.parent,
@@ -1536,7 +1545,7 @@ impl<K, V> Clone for Entry<'_, '_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1549,9 +1558,9 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K, V> Entry<'a, 'g, K, V>
+impl<'a: 'g, 'g, K, V, C> Entry<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self) -> bool {
@@ -1565,7 +1574,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self.parent.next_node(
             self.node.as_tower(),
             Bound::Excluded(&self.node.key),
@@ -1590,7 +1599,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self
             .parent
             .search_bound(Bound::Excluded(&self.node.key), true, self.guard)?;
@@ -1606,12 +1615,12 @@ where
 ///
 /// You *must* call `release` to free this type, otherwise the node will be
 /// leaked. This is because releasing the entry requires a `Guard`.
-pub struct RefEntry<'a, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct RefEntry<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'a, K, V>,
 }
 
-impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefEntry<'a, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1628,7 +1637,7 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1650,9 +1659,9 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     /// Tries to create a new `RefEntry` by incrementing the reference count of
     /// a node.
     unsafe fn try_acquire(
-        parent: &'a SkipList<K, V>,
+        parent: &'a SkipList<K, V, C>,
         node: NodeRef<'_, K, V>,
-    ) -> Option<RefEntry<'a, K, V>> {
+    ) -> Option<RefEntry<'a, K, V, C>> {
         if unsafe { node.try_increment() } {
             Some(RefEntry {
                 parent,
@@ -1667,9 +1676,10 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 }
 
-impl<K, V> RefEntry<'_, K, V>
+impl<K, V, C> RefEntry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1694,7 +1704,7 @@ where
     }
 }
 
-impl<K, V> Clone for RefEntry<'_, K, V> {
+impl<K, V, C> Clone for RefEntry<'_, K, V, C> {
     fn clone(&self) -> Self {
         unsafe {
             // Incrementing will always succeed since we're already holding a reference to the node.
@@ -1707,7 +1717,7 @@ impl<K, V> Clone for RefEntry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for RefEntry<'_, K, V>
+impl<K, V, C> fmt::Debug for RefEntry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1720,9 +1730,9 @@ where
     }
 }
 
-impl<'a, K, V> RefEntry<'a, K, V>
+impl<'a, K, V, C> RefEntry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self, guard: &Guard) -> bool {
@@ -1736,7 +1746,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1763,7 +1773,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1780,20 +1790,20 @@ where
 }
 
 /// An iterator over the entries of a `SkipList`.
-pub struct Iter<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Iter<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Iterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Iterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1804,7 +1814,7 @@ where
             }
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1817,11 +1827,11 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> DoubleEndedIterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> DoubleEndedIterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -1831,7 +1841,7 @@ where
                 .search_bound::<K>(Bound::Unbounded, true, self.guard),
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1844,7 +1854,7 @@ where
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Iter<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1858,13 +1868,13 @@ where
 }
 
 /// An iterator over reference-counted entries of a `SkipList`.
-pub struct RefIter<'a, K, V> {
-    parent: &'a SkipList<K, V>,
-    head: Option<RefEntry<'a, K, V>>,
-    tail: Option<RefEntry<'a, K, V>>,
+pub struct RefIter<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
+    head: Option<RefEntry<'a, K, V, C>>,
+    tail: Option<RefEntry<'a, K, V, C>>,
 }
 
-impl<K, V> fmt::Debug for RefIter<'_, K, V>
+impl<K, V, C> fmt::Debug for RefIter<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1883,12 +1893,12 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V>
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match &self.head {
             Some(e) => e.next(guard),
@@ -1896,7 +1906,9 @@ where
         };
         match (&next_head, &self.tail) {
             // The next key is larger than the latest tail key we observed with this iterator.
-            (Some(ref next), Some(t)) if next.key() >= t.key() => {
+            (Some(ref next), Some(t))
+                if self.parent.comparator.compare(next.key(), t.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1915,7 +1927,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match &self.tail {
             Some(e) => e.prev(guard),
@@ -1923,7 +1935,9 @@ where
         };
         match (&self.head, &next_tail) {
             // The prev key is smaller than the latest head key we observed with this iterator.
-            (Some(h), Some(next)) if h.key() >= next.key() => {
+            (Some(h), Some(next))
+                if self.parent.comparator.compare(h.key(), next.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1942,7 +1956,7 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C> {
     /// Decrements the reference count of `RefEntry` owned by the iterator.
     pub fn drop_impl(&mut self, guard: &Guard) {
         self.parent.check_guard(guard);
@@ -1956,13 +1970,13 @@ impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipList`.
-pub struct Range<'a: 'g, 'g, Q, R, K, V>
+pub struct Range<'a: 'g, 'g, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     range: R,
@@ -1970,15 +1984,15 @@ where
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> Iterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> Iterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1991,14 +2005,14 @@ where
             match self.tail {
                 Some(t) => {
                     let bound = Bound::Excluded(&t.as_ref().key);
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2013,13 +2027,13 @@ where
     }
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -2032,14 +2046,14 @@ where
             match self.head {
                 Some(h) => {
                     let bound = Bound::Excluded(&h.as_ref().key);
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2054,9 +2068,10 @@ where
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, '_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, '_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2071,38 +2086,39 @@ where
 }
 
 /// An iterator over reference-counted subset of entries of a `SkipList`.
-pub struct RefRange<'a, Q, R, K, V>
+pub struct RefRange<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
-    pub(crate) head: Option<RefEntry<'a, K, V>>,
-    pub(crate) tail: Option<RefEntry<'a, K, V>>,
+    parent: &'a SkipList<K, V, C>,
+    pub(crate) head: Option<RefEntry<'a, K, V, C>>,
+    pub(crate) tail: Option<RefEntry<'a, K, V, C>>,
     pub(crate) range: R,
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-unsafe impl<Q, R, K, V> Send for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C> Send for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q> + Sync,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-unsafe impl<Q, R, K, V> Sync for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C> Sync for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q> + Sync,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-impl<Q, R, K, V> fmt::Debug for RefRange<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2116,14 +2132,14 @@ where
     }
 }
 
-impl<'a, Q, R, K: 'a, V: 'a> RefRange<'a, Q, R, K, V>
+impl<'a, Q, R, K: 'a, V: 'a, C> RefRange<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match self.head {
             Some(ref e) => e.next(guard),
@@ -2134,7 +2150,7 @@ where
             match self.tail {
                 Some(ref t) => {
                     let bound = Bound::Excluded(t.key());
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2150,7 +2166,7 @@ where
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2171,7 +2187,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match self.tail {
             Some(ref e) => e.prev(guard),
@@ -2182,7 +2198,7 @@ where
             match self.head {
                 Some(ref h) => {
                     let bound = Bound::Excluded(h.key());
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2198,7 +2214,7 @@ where
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2307,9 +2323,9 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 
 /// Helper function to retry an operation until pinning succeeds or `None` is
 /// returned.
-pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V>(mut f: F) -> Option<RefEntry<'a, K, V>>
+pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V, C>(mut f: F) -> Option<RefEntry<'a, K, V, C>>
 where
-    F: FnMut() -> Option<Entry<'a, 'g, K, V>>,
+    F: FnMut() -> Option<Entry<'a, 'g, K, V, C>>,
 {
     loop {
         if let Some(e) = f()?.pin() {
@@ -2319,27 +2335,34 @@ where
 }
 
 /// Helper function to check if a value is above a lower bound
-fn above_lower_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn above_lower_bound<V, T, C>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_ge(),
-        Bound::Excluded(key) => other.compare(key).is_gt(),
+        Bound::Included(key) => comparator.compare(other, key).is_ge(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_gt(),
     }
 }
 
 /// Helper function to check if a value is below an upper bound
-fn below_upper_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn below_upper_bound<V, T, C>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_le(),
-        Bound::Excluded(key) => other.compare(key).is_lt(),
+        Bound::Included(key) => comparator.compare(other, key).is_le(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_lt(),
+    }
+}
+
+impl<K, V> SkipList<K, V> {
+    /// Returns an empty skip list with the default ordering.
+    pub fn new(collector: Collector) -> Self {
+        Self::with_comparator(collector, BasicComparator)
     }
 }
diff --git a/crossbeam-skiplist/src/comparator.rs b/crossbeam-skiplist/src/comparator.rs
new file mode 100644
index 0000000..8857949
--- /dev/null
+++ b/crossbeam-skiplist/src/comparator.rs
@@ -0,0 +1,63 @@
+//! Runtime key comparison for skip lists.
+//!
+//! Pass a comparator to `SkipMap::with_comparator`, `SkipSet::with_comparator`,
+//! or `SkipList::with_comparator` to choose an ordering for that collection.
+//! Functions and closures (including boxed comparison closures) returning
+//! [`Ordering`] implement both traits, with equivalence defined by `Ordering::Equal`.
+//! Implement the traits directly to support both stored keys and borrowed queries.
+use crate::equivalent::{Comparable, Equivalent};
+use core::cmp::Ordering;
+
+/// Tests whether a stored key and a query represent the same key.
+pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
+    /// Returns whether the keys are equivalent.
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
+}
+
+/// Defines the ordering of stored keys and queries.
+///
+/// Comparisons must define a consistent total order, and equivalence must agree
+/// with `Ordering::Equal`. Heterogeneous comparisons must agree with the stored
+/// key ordering. The ordering must remain stable while keys are in the collection.
+pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
+    /// Compares a stored key with another key or query.
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
+}
+
+/// The default comparator, using [`Equivalent`] and [`Comparable`].
+#[derive(Clone, Copy, Debug, Default)]
+pub struct BasicComparator;
+
+impl<L: ?Sized, R: ?Sized> Equivalator<L, R> for BasicComparator
+where
+    L: Equivalent<R>,
+{
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
+        lhs.equivalent(rhs)
+    }
+}
+impl<L: ?Sized, R: ?Sized> Comparator<L, R> for BasicComparator
+where
+    L: Comparable<R>,
+{
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
+        lhs.compare(rhs)
+    }
+}
+
+impl<L: ?Sized, R: ?Sized, F> Equivalator<L, R> for F
+where
+    F: Fn(&L, &R) -> Ordering,
+{
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
+        self(lhs, rhs) == Ordering::Equal
+    }
+}
+impl<L: ?Sized, R: ?Sized, F> Comparator<L, R> for F
+where
+    F: Fn(&L, &R) -> Ordering,
+{
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
+        self(lhs, rhs)
+    }
+}
diff --git a/crossbeam-skiplist/src/lib.rs b/crossbeam-skiplist/src/lib.rs
index 5ff8e74..252c0aa 100644
--- a/crossbeam-skiplist/src/lib.rs
+++ b/crossbeam-skiplist/src/lib.rs
@@ -266,3 +266,5 @@ pub mod set;
 pub use crate::{map::SkipMap, set::SkipSet};
 
 pub mod equivalent;
+
+pub mod comparator;
diff --git a/crossbeam-skiplist/src/map.rs b/crossbeam-skiplist/src/map.rs
index c7c5408..4942f7f 100644
--- a/crossbeam-skiplist/src/map.rs
+++ b/crossbeam-skiplist/src/map.rs
@@ -11,7 +11,7 @@ use crossbeam_epoch as epoch;
 
 use crate::{
     base::{self, try_pin_loop},
-    equivalent::Comparable,
+    comparator::{BasicComparator, Comparator},
 };
 
 /// An ordered map based on a lock-free skip list.
@@ -20,23 +20,26 @@ use crate::{
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeMap`]: std::collections::BTreeMap
-pub struct SkipMap<K, V> {
-    inner: base::SkipList<K, V>,
+pub struct SkipMap<K, V, C = BasicComparator> {
+    inner: base::SkipList<K, V, C>,
 }
 
-impl<K, V> SkipMap<K, V> {
-    /// Returns a new, empty map.
+impl<K, V, C> SkipMap<K, V, C> {
+    /// Returns an empty map ordered by `comparator`.
     ///
     /// # Example
     ///
     /// ```
     /// use crossbeam_skiplist::SkipMap;
     ///
-    /// let map: SkipMap<i32, &str> = SkipMap::new();
+    /// let map = SkipMap::with_comparator(|a: &i32, b: &i32| b.cmp(a));
+    /// map.insert(1, "one");
+    /// map.insert(2, "two");
+    /// assert_eq!(*map.front().unwrap().key(), 2);
     /// ```
-    pub fn new() -> Self {
+    pub fn with_comparator(comparator: C) -> Self {
         Self {
-            inner: base::SkipList::new(epoch::default_collector().clone()),
+            inner: base::SkipList::with_comparator(epoch::default_collector().clone(), comparator),
         }
     }
 
@@ -80,9 +83,9 @@ impl<K, V> SkipMap<K, V> {
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -99,7 +102,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.front().unwrap().value(), "five");
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.front(guard)).map(Entry::new)
     }
@@ -119,7 +122,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.back().unwrap().value(), "six");
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.back(guard)).map(Entry::new)
     }
@@ -138,7 +141,7 @@ where
     /// ```
     pub fn contains_key<Q>(&self, key: &Q) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -160,9 +163,9 @@ where
     /// numbers.insert("six", 6);
     /// assert_eq!(*numbers.get("six").unwrap().value(), 6);
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -195,9 +198,9 @@ where
     /// let greater_than_thirteen = numbers.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -227,9 +230,9 @@ where
     /// let less_than_six = numbers.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -253,7 +256,7 @@ where
     /// let jobs_age = ages.get_or_insert("Steve Jobs", -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.get_or_insert(key, value, guard))
     }
@@ -283,7 +286,7 @@ where
     /// let jobs_age = ages.get_or_insert_with("Steve Jobs", || -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -313,7 +316,7 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn iter(&self) -> Iter<'_, K, V> {
+    pub fn iter(&self) -> Iter<'_, K, V, C> {
         Iter {
             inner: self.inner.ref_iter(),
         }
@@ -340,10 +343,10 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V, C>
     where
         R: RangeBounds<Q>,
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         Range {
@@ -352,9 +355,10 @@ where
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the map and returns the new entry.
@@ -374,7 +378,7 @@ where
     ///
     /// assert_eq!(*map.get("key").unwrap().value(), "value");
     /// ```
-    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.insert(key, value, guard))
     }
@@ -401,7 +405,7 @@ where
     /// map.compare_insert("absent_key", 0, |_| false);
     /// assert_eq!(*map.get("absent_key").unwrap().value(), 0);
     /// ```
-    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V>
+    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -427,9 +431,9 @@ where
     /// map.insert("key", "value");
     /// assert_eq!(*map.remove("key").unwrap().value(), "value");
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -458,7 +462,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_front(guard).map(Entry::new)
     }
@@ -485,7 +489,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_back(guard).map(Entry::new)
     }
@@ -515,9 +519,10 @@ impl<K, V> Default for SkipMap<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipMap<K, V>
+impl<K, V, C> fmt::Debug for SkipMap<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
+    C: Comparator<K>,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -525,7 +530,7 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipMap<K, V> {
+impl<K, V, C> IntoIterator for SkipMap<K, V, C> {
     type Item = (K, V);
     type IntoIter = IntoIter<K, V>;
 
@@ -536,14 +541,14 @@ impl<K, V> IntoIterator for SkipMap<K, V> {
     }
 }
 
-impl<'a, K, V> IntoIterator for &'a SkipMap<K, V>
+impl<'a, K, V, C> IntoIterator for &'a SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, K, V>;
-    type IntoIter = Iter<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
+    type IntoIter = Iter<'a, K, V, C>;
 
-    fn into_iter(self) -> Iter<'a, K, V> {
+    fn into_iter(self) -> Iter<'a, K, V, C> {
         self.iter()
     }
 }
@@ -565,12 +570,12 @@ where
 }
 
 /// A reference-counted entry in a map.
-pub struct Entry<'a, K, V> {
-    inner: ManuallyDrop<base::RefEntry<'a, K, V>>,
+pub struct Entry<'a, K, V, C = BasicComparator> {
+    inner: ManuallyDrop<base::RefEntry<'a, K, V, C>>,
 }
 
-impl<'a, K, V> Entry<'a, K, V> {
-    fn new(inner: base::RefEntry<'a, K, V>) -> Self {
+impl<'a, K, V, C> Entry<'a, K, V, C> {
+    fn new(inner: base::RefEntry<'a, K, V, C>) -> Self {
         Self {
             inner: ManuallyDrop::new(inner),
         }
@@ -592,7 +597,7 @@ impl<'a, K, V> Entry<'a, K, V> {
     }
 }
 
-impl<K, V> Drop for Entry<'_, K, V> {
+impl<K, V, C> Drop for Entry<'_, K, V, C> {
     fn drop(&mut self) {
         unsafe {
             ManuallyDrop::into_inner(ptr::read(&self.inner)).release_with_pin(epoch::pin);
@@ -600,9 +605,9 @@ impl<K, V> Drop for Entry<'_, K, V> {
     }
 }
 
-impl<'a, K, V> Entry<'a, K, V>
+impl<'a, K, V, C> Entry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the map.
     pub fn move_next(&mut self) -> bool {
@@ -617,21 +622,22 @@ where
     }
 
     /// Returns the next entry in the map.
-    pub fn next(&self) -> Option<Entry<'a, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 
     /// Returns the previous entry in the map.
-    pub fn prev(&self) -> Option<Entry<'a, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.prev(guard).map(Entry::new)
     }
 }
 
-impl<K, V> Entry<'_, K, V>
+impl<K, V, C> Entry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the map.
@@ -643,7 +649,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, K, V> {
+impl<K, V, C> Clone for Entry<'_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -651,7 +657,7 @@ impl<K, V> Clone for Entry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -684,39 +690,39 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 }
 
 /// An iterator over the entries of a `SkipMap`.
-pub struct Iter<'a, K, V> {
-    inner: base::RefIter<'a, K, V>,
+pub struct Iter<'a, K, V, C = BasicComparator> {
+    inner: base::RefIter<'a, K, V, C>,
 }
 
-impl<'a, K, V> Iterator for Iter<'a, K, V>
+impl<'a, K, V, C> Iterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, K, V> DoubleEndedIterator for Iter<'a, K, V>
+impl<'a, K, V, C> DoubleEndedIterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, K, V> {
+impl<K, V, C> fmt::Debug for Iter<'_, K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
-impl<K, V> Drop for Iter<'_, K, V> {
+impl<K, V, C> Drop for Iter<'_, K, V, C> {
     fn drop(&mut self) {
         let guard = &epoch::pin();
         self.inner.drop_impl(guard);
@@ -724,44 +730,45 @@ impl<K, V> Drop for Iter<'_, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipMap`.
-pub struct Range<'a, Q, R, K, V>
+pub struct Range<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    pub(crate) inner: base::RefRange<'a, Q, R, K, V>,
+    pub(crate) inner: base::RefRange<'a, Q, R, K, V, C>,
 }
 
-impl<'a, Q, R, K, V> Iterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> Iterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, Q, R, K, V> DoubleEndedIterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> DoubleEndedIterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -775,9 +782,9 @@ where
     }
 }
 
-impl<Q, R, K, V> Drop for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> Drop for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
@@ -786,3 +793,10 @@ where
         self.inner.drop_impl(guard);
     }
 }
+
+impl<K, V> SkipMap<K, V> {
+    /// Returns an empty collection with the default ordering.
+    pub fn new() -> Self {
+        Self::with_comparator(BasicComparator)
+    }
+}
diff --git a/crossbeam-skiplist/src/set.rs b/crossbeam-skiplist/src/set.rs
index 4e91f6c..fb87e38 100644
--- a/crossbeam-skiplist/src/set.rs
+++ b/crossbeam-skiplist/src/set.rs
@@ -5,7 +5,10 @@ use core::{
     ops::{Bound, Deref, RangeBounds},
 };
 
-use crate::{equivalent::Comparable, map};
+use crate::{
+    comparator::{BasicComparator, Comparator},
+    map,
+};
 
 /// A set based on a lock-free skip list.
 ///
@@ -13,23 +16,26 @@ use crate::{equivalent::Comparable, map};
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeSet`]: std::collections::BTreeSet
-pub struct SkipSet<T> {
-    inner: map::SkipMap<T, ()>,
+pub struct SkipSet<T, C = BasicComparator> {
+    inner: map::SkipMap<T, (), C>,
 }
 
-impl<T> SkipSet<T> {
-    /// Returns a new, empty set.
+impl<T, C> SkipSet<T, C> {
+    /// Returns an empty set ordered by `comparator`.
     ///
     /// # Example
     ///
     /// ```
     /// use crossbeam_skiplist::SkipSet;
     ///
-    /// let set: SkipSet<i32> = SkipSet::new();
+    /// let set = SkipSet::with_comparator(|a: &i32, b: &i32| b.cmp(a));
+    /// set.insert(1);
+    /// set.insert(2);
+    /// assert_eq!(*set.front().unwrap().value(), 2);
     /// ```
-    pub fn new() -> Self {
+    pub fn with_comparator(comparator: C) -> Self {
         Self {
-            inner: map::SkipMap::new(),
+            inner: map::SkipMap::with_comparator(comparator),
         }
     }
 
@@ -71,9 +77,9 @@ impl<T> SkipSet<T> {
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -88,7 +94,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.front().unwrap(), 1);
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, T>> {
+    pub fn front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.front().map(Entry::new)
     }
 
@@ -105,7 +111,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.back().unwrap(), 2);
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, T>> {
+    pub fn back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.back().map(Entry::new)
     }
 
@@ -122,7 +128,7 @@ where
     /// ```
     pub fn contains<Q>(&self, key: &Q) -> bool
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.contains_key(key)
@@ -139,9 +145,9 @@ where
     /// assert_eq!(*set.get(&3).unwrap(), 3);
     /// assert!(set.get(&4).is_none());
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.get(key).map(Entry::new)
@@ -171,9 +177,9 @@ where
     /// let greater_than_thirteen = set.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.lower_bound(bound).map(Entry::new)
@@ -200,9 +206,9 @@ where
     /// let less_than_six = set.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.upper_bound(bound).map(Entry::new)
@@ -219,7 +225,7 @@ where
     /// let entry = set.get_or_insert(2);
     /// assert_eq!(*entry, 2);
     /// ```
-    pub fn get_or_insert(&self, key: T) -> Entry<'_, T> {
+    pub fn get_or_insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.get_or_insert(key, ()))
     }
 
@@ -241,7 +247,7 @@ where
     /// assert_eq!(*set_iter.next().unwrap(), 12);
     /// assert!(set_iter.next().is_none());
     /// ```
-    pub fn iter(&self) -> Iter<'_, T> {
+    pub fn iter(&self) -> Iter<'_, T, C> {
         Iter {
             inner: self.inner.iter(),
         }
@@ -264,10 +270,10 @@ where
     /// assert_eq!(*set_range.next().unwrap(), 7);
     /// assert!(set_range.next().is_none());
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T, C>
     where
         R: RangeBounds<Q>,
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         Range {
@@ -276,9 +282,10 @@ where
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T>,
 {
     /// Inserts a `key`-`value` pair into the set and returns the new entry.
     ///
@@ -294,7 +301,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.get(&2).unwrap(), 2);
     /// ```
-    pub fn insert(&self, key: T) -> Entry<'_, T> {
+    pub fn insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.insert(key, ()))
     }
 
@@ -313,9 +320,9 @@ where
     /// assert_eq!(*set.remove(&2).unwrap(), 2);
     /// assert!(set.remove(&2).is_none());
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.remove(key).map(Entry::new)
@@ -342,7 +349,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_front().map(Entry::new)
     }
 
@@ -367,7 +374,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_back().map(Entry::new)
     }
 
@@ -396,16 +403,17 @@ impl<T> Default for SkipSet<T> {
     }
 }
 
-impl<T> fmt::Debug for SkipSet<T>
+impl<T, C> fmt::Debug for SkipSet<T, C>
 where
-    T: Ord + fmt::Debug,
+    T: fmt::Debug,
+    C: Comparator<T>,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("SkipSet { .. }")
     }
 }
 
-impl<T> IntoIterator for SkipSet<T> {
+impl<T, C> IntoIterator for SkipSet<T, C> {
     type Item = T;
     type IntoIter = IntoIter<T>;
 
@@ -416,14 +424,14 @@ impl<T> IntoIterator for SkipSet<T> {
     }
 }
 
-impl<'a, T> IntoIterator for &'a SkipSet<T>
+impl<'a, T, C> IntoIterator for &'a SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    type Item = Entry<'a, T>;
-    type IntoIter = Iter<'a, T>;
+    type Item = Entry<'a, T, C>;
+    type IntoIter = Iter<'a, T, C>;
 
-    fn into_iter(self) -> Iter<'a, T> {
+    fn into_iter(self) -> Iter<'a, T, C> {
         self.iter()
     }
 }
@@ -445,12 +453,12 @@ where
 }
 
 /// A reference-counted entry in a set.
-pub struct Entry<'a, T> {
-    inner: map::Entry<'a, T, ()>,
+pub struct Entry<'a, T, C = BasicComparator> {
+    inner: map::Entry<'a, T, (), C>,
 }
 
-impl<'a, T> Entry<'a, T> {
-    fn new(inner: map::Entry<'a, T, ()>) -> Self {
+impl<'a, T, C> Entry<'a, T, C> {
+    fn new(inner: map::Entry<'a, T, (), C>) -> Self {
         Self { inner }
     }
 
@@ -465,9 +473,9 @@ impl<'a, T> Entry<'a, T> {
     }
 }
 
-impl<'a, T> Entry<'a, T>
+impl<'a, T, C> Entry<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
     /// Moves to the next entry in the set.
     pub fn move_next(&mut self) -> bool {
@@ -480,19 +488,20 @@ where
     }
 
     /// Returns the next entry in the set.
-    pub fn next(&self) -> Option<Entry<'a, T>> {
+    pub fn next(&self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 
     /// Returns the previous entry in the set.
-    pub fn prev(&self) -> Option<Entry<'a, T>> {
+    pub fn prev(&self) -> Option<Entry<'a, T, C>> {
         self.inner.prev().map(Entry::new)
     }
 }
 
-impl<T> Entry<'_, T>
+impl<T, C> Entry<'_, T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T>,
 {
     /// Removes the entry from the set.
     ///
@@ -502,7 +511,7 @@ where
     }
 }
 
-impl<T> Clone for Entry<'_, T> {
+impl<T, C> Clone for Entry<'_, T, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -510,7 +519,7 @@ impl<T> Clone for Entry<'_, T> {
     }
 }
 
-impl<T> fmt::Debug for Entry<'_, T>
+impl<T, C> fmt::Debug for Entry<'_, T, C>
 where
     T: fmt::Debug,
 {
@@ -521,7 +530,7 @@ where
     }
 }
 
-impl<T> Deref for Entry<'_, T> {
+impl<T, C> Deref for Entry<'_, T, C> {
     type Target = T;
 
     fn deref(&self) -> &Self::Target {
@@ -549,73 +558,74 @@ impl<T> fmt::Debug for IntoIter<T> {
 }
 
 /// An iterator over the entries of a `SkipSet`.
-pub struct Iter<'a, T> {
-    inner: map::Iter<'a, T, ()>,
+pub struct Iter<'a, T, C = BasicComparator> {
+    inner: map::Iter<'a, T, (), C>,
 }
 
-impl<'a, T> Iterator for Iter<'a, T>
+impl<'a, T, C> Iterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, T> DoubleEndedIterator for Iter<'a, T>
+impl<'a, T, C> DoubleEndedIterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<T> fmt::Debug for Iter<'_, T> {
+impl<T, C> fmt::Debug for Iter<'_, T, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
 /// An iterator over a subset of entries of a `SkipSet`.
-pub struct Range<'a, Q, R, T>
+pub struct Range<'a, Q, R, T, C = BasicComparator>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    inner: map::Range<'a, Q, R, T, ()>,
+    inner: map::Range<'a, Q, R, T, (), C>,
 }
 
-impl<'a, Q, R, T> Iterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> Iterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, Q, R, T> DoubleEndedIterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> DoubleEndedIterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<Q, R, T> fmt::Debug for Range<'_, Q, R, T>
+impl<Q, R, T, C> fmt::Debug for Range<'_, Q, R, T, C>
 where
-    T: Ord + Comparable<Q> + fmt::Debug,
+    T: fmt::Debug,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
 {
@@ -627,3 +637,10 @@ where
             .finish()
     }
 }
+
+impl<T> SkipSet<T> {
+    /// Returns an empty collection with the default ordering.
+    pub fn new() -> Self {
+        Self::with_comparator(BasicComparator)
+    }
+}
diff --git a/crossbeam-skiplist/tests/comparator.rs b/crossbeam-skiplist/tests/comparator.rs
new file mode 100644
index 0000000..018680e
--- /dev/null
+++ b/crossbeam-skiplist/tests/comparator.rs
@@ -0,0 +1,135 @@
+use std::cmp::Ordering;
+use std::ops::Bound::{Excluded, Included};
+
+use crossbeam_skiplist::{
+    SkipMap, SkipSet,
+    base::SkipList,
+    comparator::{BasicComparator, Comparator, Equivalator},
+};
+
+#[derive(Clone, Copy)]
+struct CaseOrder(bool);
+
+impl<R: AsRef<str> + ?Sized> Equivalator<String, R> for CaseOrder {
+    fn equivalent(&self, lhs: &String, rhs: &R) -> bool {
+        self.compare(lhs, rhs) == Ordering::Equal
+    }
+}
+
+impl<R: AsRef<str> + ?Sized> Comparator<String, R> for CaseOrder {
+    fn compare(&self, lhs: &String, rhs: &R) -> Ordering {
+        if self.0 {
+            lhs.to_lowercase().cmp(&rhs.as_ref().to_lowercase())
+        } else {
+            lhs.as_str().cmp(rhs.as_ref())
+        }
+    }
+}
+
+#[test]
+fn heterogeneous_case_order() {
+    for insensitive in [false, true] {
+        let map = SkipMap::with_comparator(CaseOrder(insensitive));
+        map.insert("abc".to_owned(), 1);
+        assert_eq!(map.get("aBc").is_some(), insensitive);
+        map.insert("ABC".to_owned(), 2);
+        assert_eq!(map.len(), if insensitive { 1 } else { 2 });
+        assert_eq!(*map.get("ABC").unwrap().value(), 2);
+        assert_eq!(*map.get_or_insert("ABC".to_owned(), 3).value(), 2);
+        map.insert("def".to_owned(), 4);
+        map.insert("ghi".to_owned(), 5);
+        let keys: Vec<_> = map
+            .range::<str, _>((Included("abc"), Excluded("ghi")))
+            .map(|e| e.key().clone())
+            .collect();
+        assert_eq!(keys.len(), 2);
+        let entry = map.get("def").unwrap();
+        assert_eq!(entry.next().unwrap().key(), "ghi");
+        assert!(entry.prev().is_some());
+        assert!(entry.remove());
+        assert!(!map.contains_key("def"));
+        assert!(map.remove("ABC").is_some());
+    }
+    let set = SkipSet::with_comparator(CaseOrder(true));
+    set.insert("abc".to_owned());
+    set.insert("ABC".to_owned());
+    assert_eq!(set.len(), 1);
+    assert!(set.contains("aBc"));
+    assert!(set.remove("AbC").is_some());
+}
+
+// Deliberately has no Ord, Eq, or PartialEq implementation.
+#[derive(Debug)]
+struct Key(i32);
+
+#[test]
+fn boxed_closure_and_non_ord_keys() {
+    type Compare = Box<dyn Fn(&Key, &Key) -> Ordering + Send + Sync>;
+    let comparator: Compare = Box::new(|a, b| b.0.cmp(&a.0));
+    let map = SkipMap::with_comparator(comparator);
+    for k in 0..10 {
+        map.insert(Key(k), k);
+    }
+    assert_eq!(
+        map.iter().map(|e| e.key().0).collect::<Vec<_>>(),
+        (0..10).rev().collect::<Vec<_>>()
+    );
+    assert_eq!(
+        map.iter().rev().map(|e| e.key().0).collect::<Vec<_>>(),
+        (0..10).collect::<Vec<_>>()
+    );
+    let lo = Key(8);
+    let hi = Key(2);
+    let mut range = map.range(&lo..&hi);
+    assert_eq!(range.next().unwrap().key().0, 8);
+    assert_eq!(range.next_back().unwrap().key().0, 3);
+    assert_eq!(
+        range.map(|e| e.key().0).collect::<Vec<_>>(),
+        vec![7, 6, 5, 4]
+    );
+    assert_eq!(map.front().unwrap().key().0, 9);
+    assert_eq!(map.back().unwrap().key().0, 0);
+    assert_eq!(map.lower_bound(Included(&Key(7))).unwrap().key().0, 7);
+    assert_eq!(map.upper_bound(Excluded(&Key(7))).unwrap().key().0, 8);
+    assert!(map.remove(&Key(5)).is_some());
+    map.clear();
+    assert!(map.is_empty());
+}
+
+#[test]
+fn base_entries_and_ranges() {
+    let list = SkipList::with_comparator(
+        crossbeam_epoch::default_collector().clone(),
+        CaseOrder(true),
+    );
+    let guard = &crossbeam_epoch::pin();
+    for key in ["abc", "DEF", "ghi"] {
+        list.insert(key.to_owned(), 1, guard);
+    }
+    assert!(list.get("AbC", guard).is_some());
+    let mut iter = list.iter(guard);
+    assert_eq!(iter.next().unwrap().key(), "abc");
+    assert_eq!(iter.next_back().unwrap().key(), "ghi");
+    assert_eq!(iter.next().unwrap().key(), "DEF");
+    assert!(iter.next_back().is_none());
+    let keys: Vec<_> = list
+        .range::<str, _>((Included("ABC"), Included("def")), guard)
+        .rev()
+        .map(|e| e.key().clone())
+        .collect();
+    assert_eq!(keys, ["DEF", "abc"]);
+    let entry = list.get("def", guard).unwrap().pin().unwrap();
+    assert_eq!(entry.next(guard).unwrap().key(), "ghi");
+    assert!(entry.remove(guard));
+    assert!(list.remove("ABC", guard).is_some());
+}
+
+#[test]
+fn default_comparator() {
+    let c = BasicComparator;
+    assert!(c.equivalent(&"abc".to_owned(), "abc"));
+    assert_eq!(c.compare(&"abc".to_owned(), "def"), Ordering::Less);
+    let _: SkipMap<i32, i32> = SkipMap::new();
+    let _: SkipSet<i32> = SkipSet::default();
+    let _: SkipList<i32, i32> = SkipList::new(crossbeam_epoch::default_collector().clone());
+}
```

</details>

<details><summary>reply</summary>

I’ll inspect the ordering code, thread the comparator through the collection types, and test runtime ordering with heterogeneous queries.

The comparator is now threaded through the map, set, entries, and iterators. I also found key comparisons in iterator boundary checks and insertion retries; those need the custom ordering too. Next I’ll check compatibility and add regression tests.

The new tests pass for case-insensitive `String`/`str` lookup, boxed closures, keys without `Ord`, reverse ordering, ranges, and entry navigation. The existing collection tests passed as well. I corrected some documentation examples affected by the new type parameter and am running the full suite again, plus an alloc-only build.

Implemented runtime comparators across `SkipMap`, `SkipSet`, and `base::SkipList`, including entries, iterators, and ranges.

- Added `comparator::{Equivalator, Comparator, BasicComparator}`.
- Added `with_comparator` constructors and closure support, including boxed closures.
- Preserved existing default ordering and `new()`.
- Added tests for case-insensitive heterogeneous lookup, reverse ordering, and keys without `Ord`.

Validation passed: all 127 tests and documentation examples, plus the alloc-only build.

</details>

### codex, muffle: pass

Files: [crossbeam-skiplist/src/base.rs](../muffle/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/base.rs), [crossbeam-skiplist/src/comparator.rs](../muffle/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/comparator.rs), [crossbeam-skiplist/src/lib.rs](../muffle/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/lib.rs), [crossbeam-skiplist/src/map.rs](../muffle/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/map.rs), [crossbeam-skiplist/src/set.rs](../muffle/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/set.rs), [crossbeam-skiplist/tests/comparator.rs](../muffle/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/tests/comparator.rs)

<details><summary>diff</summary>

```diff
diff --git a/crossbeam-skiplist/src/base.rs b/crossbeam-skiplist/src/base.rs
index a73ee8a..77919b1 100644
--- a/crossbeam-skiplist/src/base.rs
+++ b/crossbeam-skiplist/src/base.rs
@@ -15,7 +15,7 @@ use core::{
 use crossbeam_epoch::{self as epoch, Atomic, Collector, Guard, Shared};
 use crossbeam_utils::CachePadded;
 
-use super::equivalent::Comparable;
+use super::comparator::{BasicComparator, Comparator};
 use crate::alloc_helper::Global;
 
 /// Number of bits needed to store height.
@@ -304,7 +304,7 @@ impl<'a, K, V> NodeRef<'a, K, V> {
     /// Decrements the reference count of a node, pinning the thread and destroying the node
     /// if the count become zero.
     #[inline]
-    unsafe fn decrement_with_pin<F>(self, parent: &SkipList<K, V>, pin: F)
+    unsafe fn decrement_with_pin<F, C>(self, parent: &SkipList<K, V, C>, pin: F)
     where
         F: FnOnce() -> Guard,
     {
@@ -463,26 +463,36 @@ struct HotData {
 // As a further future optimization, if `!mem::needs_drop::<K>() && !mem::needs_drop::<V>()`
 // (neither key nor the value have destructors), there's no point in creating a new local
 // collector, so we should simply use the global one.
-pub struct SkipList<K, V> {
+pub struct SkipList<K, V, C = BasicComparator> {
     /// The head of the skip list (just a dummy node, not a real entry).
     head: Head<K, V>,
 
     /// The `Collector` associated with this skip list.
     collector: Collector,
 
+    comparator: C,
+
     /// Hot data associated with the skip list, stored in a dedicated cache line.
     hot_data: CachePadded<HotData>,
 }
 
-unsafe impl<K: Send + Sync, V: Send + Sync> Send for SkipList<K, V> {}
-unsafe impl<K: Send + Sync, V: Send + Sync> Sync for SkipList<K, V> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Send> Send for SkipList<K, V, C> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Sync> Sync for SkipList<K, V, C> {}
 
 impl<K, V> SkipList<K, V> {
     /// Returns a new, empty skip list.
     pub fn new(collector: Collector) -> Self {
+        Self::with_comparator(collector, BasicComparator)
+    }
+}
+
+impl<K, V, C> SkipList<K, V, C> {
+    /// Returns an empty skip list ordered by `comparator`.
+    pub fn with_comparator(collector: Collector, comparator: C) -> Self {
         Self {
             head: Head::new(),
             collector,
+            comparator,
             hot_data: CachePadded::new(HotData {
                 seed: AtomicUsize::new(1),
                 len: AtomicUsize::new(0),
@@ -490,7 +500,6 @@ impl<K, V> SkipList<K, V> {
             }),
         }
     }
-
     /// Returns `true` if the skip list is empty.
     pub fn is_empty(&self) -> bool {
         self.len() == 0
@@ -517,12 +526,12 @@ impl<K, V> SkipList<K, V> {
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Returns the entry with the smallest key.
-    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.next_node(self.head.as_tower(), Bound::Unbounded, guard)?;
         Some(Entry {
@@ -533,7 +542,7 @@ where
     }
 
     /// Returns the entry with the largest key.
-    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.search_bound::<K>(Bound::Unbounded, true, guard)?;
         Some(Entry {
@@ -546,21 +555,21 @@ where
     /// Returns `true` if the map contains a value for the specified key.
     pub fn contains_key<Q>(&self, key: &Q, guard: &Guard) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.get(key, guard).is_some()
     }
 
     /// Returns an entry with the specified `key`.
-    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>>
+    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
         let n = self.search_bound(Bound::Included(key), false, guard)?;
-        if !n.key.equivalent(key) {
+        if !self.comparator.equivalent(&n.key, key) {
             return None;
         }
 
@@ -578,9 +587,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -599,9 +608,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -614,7 +623,7 @@ where
     }
 
     /// Finds an entry with the specified key, or inserts a new `key`-`value` pair if none exist.
-    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| false, guard)
     }
 
@@ -626,7 +635,7 @@ where
     /// discarded. If closure is modifying some other state (such as shared counters or shared
     /// objects), it may lead to <u>undesired behaviour</u> such as counters being changed without
     /// result of closure inserted
-    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -634,7 +643,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V> {
+    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V, C> {
         self.check_guard(guard);
         Iter {
             parent: self,
@@ -645,7 +654,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn ref_iter(&self) -> RefIter<'_, K, V> {
+    pub fn ref_iter(&self) -> RefIter<'_, K, V, C> {
         RefIter {
             parent: self,
             head: None,
@@ -658,9 +667,9 @@ where
         &'a self,
         range: R,
         guard: &'g Guard,
-    ) -> Range<'a, 'g, Q, R, K, V>
+    ) -> Range<'a, 'g, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -677,9 +686,9 @@ where
 
     /// Returns an iterator over a subset of entries in the skip list.
     #[allow(clippy::needless_lifetimes)]
-    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V>
+    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -825,7 +834,7 @@ where
         guard: &'a Guard,
     ) -> Option<NodeRef<'a, K, V>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -887,11 +896,11 @@ where
                         // bound, we return the last node before the condition became true. For the
                         // lower bound, we return the first node after the condition became true.
                         if upper_bound {
-                            if !below_upper_bound(&bound, &c.key) {
+                            if !below_upper_bound(&self.comparator, &bound, &c.key) {
                                 break;
                             }
                             result = Some(c);
-                        } else if above_lower_bound(&bound, &c.key) {
+                        } else if above_lower_bound(&self.comparator, &bound, &c.key) {
                             result = Some(c);
                             break;
                         }
@@ -910,7 +919,7 @@ where
     /// Searches for a key in the skip list and returns a list of all adjacent nodes.
     fn search_position<'a, Q>(&'a self, key: &Q, guard: &'a Guard) -> Position<'a, K, V>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -971,7 +980,7 @@ where
 
                         // If `curr` contains a key that is greater than or equal to `key`, we're
                         // done with this level.
-                        match c.key.compare(key) {
+                        match self.comparator.compare(&c.key, key) {
                             cmp::Ordering::Greater => break,
                             cmp::Ordering::Equal => {
                                 result.found = Some(c);
@@ -1004,7 +1013,7 @@ where
         value: F,
         replace: CompareF,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
         CompareF: Fn(&V) -> bool,
@@ -1018,7 +1027,7 @@ where
             let guard = &*(guard as *const _);
 
             // First try searching for the key.
-            // Note that the `Ord` implementation for `K` may panic during the search.
+            // Note that the comparator may panic during the search.
             let mut search = self.search_position(&key, guard);
             if let Some(r) = search.found {
                 let replace = replace(&r.value);
@@ -1155,7 +1164,10 @@ where
                     // the tower without breaking any invariants. Note that building higher levels
                     // is completely optional. Only the lowest level really matters, and all the
                     // higher levels are there just to make searching faster.
-                    if succ.as_ref().map(|s| &s.key) == Some(&n.key) {
+                    if succ
+                        .as_ref()
+                        .is_some_and(|s| self.comparator.equivalent(&s.key, &n.key))
+                    {
                         search = self.search_position(&n.key, guard);
                         continue;
                     }
@@ -1218,16 +1230,17 @@ where
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the skip list and returns the new entry.
     ///
     /// If there is an existing entry with this key, it will be removed before inserting the new
     /// one.
-    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| true, guard)
     }
 
@@ -1242,7 +1255,7 @@ where
         value: V,
         compare_fn: F,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -1250,9 +1263,9 @@ where
     }
 
     /// Removes an entry with the specified `key` from the map and returns it.
-    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -1320,7 +1333,7 @@ where
     }
 
     /// Removes an entry from the front of the skip list.
-    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.front(guard)?;
@@ -1335,7 +1348,7 @@ where
     }
 
     /// Removes an entry from the back of the skip list.
-    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.back(guard)?;
@@ -1393,7 +1406,7 @@ where
     }
 }
 
-impl<K, V> Drop for SkipList<K, V> {
+impl<K, V, C> Drop for SkipList<K, V, C> {
     fn drop(&mut self) {
         unsafe {
             let mut node = NodeRef::from_shared(
@@ -1419,9 +1432,10 @@ impl<K, V> Drop for SkipList<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipList<K, V>
+impl<K, V, C> fmt::Debug for SkipList<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
+    C: Comparator<K>,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -1429,11 +1443,11 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipList<K, V> {
+impl<K, V, C> IntoIterator for SkipList<K, V, C> {
     type Item = (K, V);
-    type IntoIter = IntoIter<K, V>;
+    type IntoIter = IntoIter<K, V, C>;
 
-    fn into_iter(self) -> IntoIter<K, V> {
+    fn into_iter(self) -> IntoIter<K, V, C> {
         unsafe {
             // Load the front node.
             //
@@ -1453,6 +1467,7 @@ impl<K, V> IntoIterator for SkipList<K, V> {
             }
 
             IntoIter {
+                _comparator: PhantomData,
                 node: front as *mut Node<K, V>,
             }
         }
@@ -1464,13 +1479,13 @@ impl<K, V> IntoIterator for SkipList<K, V> {
 /// The lifetimes of the key and value are the same as that of the `Guard`
 /// used when creating the `Entry` (`'g`). This lifetime is also constrained to
 /// not outlive the `SkipList`.
-pub struct Entry<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Entry<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'g, K, V>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Entry<'a, 'g, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1487,7 +1502,7 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1496,14 +1511,15 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     ///
     /// This method may return `None` if the reference count is already 0 and
     /// the node has been queued for deletion.
-    pub fn pin(&self) -> Option<RefEntry<'a, K, V>> {
+    pub fn pin(&self) -> Option<RefEntry<'a, K, V, C>> {
         unsafe { RefEntry::try_acquire(self.parent, self.node) }
     }
 }
 
-impl<K, V> Entry<'_, '_, K, V>
+impl<K, V, C> Entry<'_, '_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1526,7 +1542,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, '_, K, V> {
+impl<K, V, C> Clone for Entry<'_, '_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             parent: self.parent,
@@ -1536,7 +1552,7 @@ impl<K, V> Clone for Entry<'_, '_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1549,9 +1565,9 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K, V> Entry<'a, 'g, K, V>
+impl<'a: 'g, 'g, K, V, C> Entry<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self) -> bool {
@@ -1565,7 +1581,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self.parent.next_node(
             self.node.as_tower(),
             Bound::Excluded(&self.node.key),
@@ -1590,7 +1606,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self
             .parent
             .search_bound(Bound::Excluded(&self.node.key), true, self.guard)?;
@@ -1606,12 +1622,12 @@ where
 ///
 /// You *must* call `release` to free this type, otherwise the node will be
 /// leaked. This is because releasing the entry requires a `Guard`.
-pub struct RefEntry<'a, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct RefEntry<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'a, K, V>,
 }
 
-impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefEntry<'a, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1628,7 +1644,7 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1650,9 +1666,9 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     /// Tries to create a new `RefEntry` by incrementing the reference count of
     /// a node.
     unsafe fn try_acquire(
-        parent: &'a SkipList<K, V>,
+        parent: &'a SkipList<K, V, C>,
         node: NodeRef<'_, K, V>,
-    ) -> Option<RefEntry<'a, K, V>> {
+    ) -> Option<RefEntry<'a, K, V, C>> {
         if unsafe { node.try_increment() } {
             Some(RefEntry {
                 parent,
@@ -1667,9 +1683,10 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 }
 
-impl<K, V> RefEntry<'_, K, V>
+impl<K, V, C> RefEntry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1694,7 +1711,7 @@ where
     }
 }
 
-impl<K, V> Clone for RefEntry<'_, K, V> {
+impl<K, V, C> Clone for RefEntry<'_, K, V, C> {
     fn clone(&self) -> Self {
         unsafe {
             // Incrementing will always succeed since we're already holding a reference to the node.
@@ -1707,7 +1724,7 @@ impl<K, V> Clone for RefEntry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for RefEntry<'_, K, V>
+impl<K, V, C> fmt::Debug for RefEntry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1720,9 +1737,9 @@ where
     }
 }
 
-impl<'a, K, V> RefEntry<'a, K, V>
+impl<'a, K, V, C> RefEntry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self, guard: &Guard) -> bool {
@@ -1736,7 +1753,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1763,7 +1780,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1780,20 +1797,20 @@ where
 }
 
 /// An iterator over the entries of a `SkipList`.
-pub struct Iter<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Iter<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Iterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Iterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1804,7 +1821,7 @@ where
             }
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1817,11 +1834,11 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> DoubleEndedIterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> DoubleEndedIterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -1831,7 +1848,7 @@ where
                 .search_bound::<K>(Bound::Unbounded, true, self.guard),
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1844,7 +1861,7 @@ where
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Iter<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1858,13 +1875,13 @@ where
 }
 
 /// An iterator over reference-counted entries of a `SkipList`.
-pub struct RefIter<'a, K, V> {
-    parent: &'a SkipList<K, V>,
-    head: Option<RefEntry<'a, K, V>>,
-    tail: Option<RefEntry<'a, K, V>>,
+pub struct RefIter<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
+    head: Option<RefEntry<'a, K, V, C>>,
+    tail: Option<RefEntry<'a, K, V, C>>,
 }
 
-impl<K, V> fmt::Debug for RefIter<'_, K, V>
+impl<K, V, C> fmt::Debug for RefIter<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1883,12 +1900,12 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V>
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match &self.head {
             Some(e) => e.next(guard),
@@ -1896,7 +1913,9 @@ where
         };
         match (&next_head, &self.tail) {
             // The next key is larger than the latest tail key we observed with this iterator.
-            (Some(ref next), Some(t)) if next.key() >= t.key() => {
+            (Some(ref next), Some(t))
+                if self.parent.comparator.compare(next.key(), t.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1915,7 +1934,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match &self.tail {
             Some(e) => e.prev(guard),
@@ -1923,7 +1942,9 @@ where
         };
         match (&self.head, &next_tail) {
             // The prev key is smaller than the latest head key we observed with this iterator.
-            (Some(h), Some(next)) if h.key() >= next.key() => {
+            (Some(h), Some(next))
+                if self.parent.comparator.compare(h.key(), next.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1942,7 +1963,7 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C> {
     /// Decrements the reference count of `RefEntry` owned by the iterator.
     pub fn drop_impl(&mut self, guard: &Guard) {
         self.parent.check_guard(guard);
@@ -1956,13 +1977,13 @@ impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipList`.
-pub struct Range<'a: 'g, 'g, Q, R, K, V>
+pub struct Range<'a: 'g, 'g, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     range: R,
@@ -1970,15 +1991,15 @@ where
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> Iterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> Iterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1991,14 +2012,14 @@ where
             match self.tail {
                 Some(t) => {
                     let bound = Bound::Excluded(&t.as_ref().key);
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2013,13 +2034,13 @@ where
     }
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -2032,14 +2053,14 @@ where
             match self.head {
                 Some(h) => {
                     let bound = Bound::Excluded(&h.as_ref().key);
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2054,9 +2075,10 @@ where
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, '_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, '_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2071,38 +2093,41 @@ where
 }
 
 /// An iterator over reference-counted subset of entries of a `SkipList`.
-pub struct RefRange<'a, Q, R, K, V>
+pub struct RefRange<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
-    pub(crate) head: Option<RefEntry<'a, K, V>>,
-    pub(crate) tail: Option<RefEntry<'a, K, V>>,
+    parent: &'a SkipList<K, V, C>,
+    pub(crate) head: Option<RefEntry<'a, K, V, C>>,
+    pub(crate) tail: Option<RefEntry<'a, K, V, C>>,
     pub(crate) range: R,
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-unsafe impl<Q, R, K, V> Send for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R: Send, K: Send + Sync, V: Send + Sync, C: Sync> Send
+    for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-unsafe impl<Q, R, K, V> Sync for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R: Sync, K: Send + Sync, V: Send + Sync, C: Sync> Sync
+    for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-impl<Q, R, K, V> fmt::Debug for RefRange<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2116,14 +2141,14 @@ where
     }
 }
 
-impl<'a, Q, R, K: 'a, V: 'a> RefRange<'a, Q, R, K, V>
+impl<'a, Q, R, K: 'a, V: 'a, C> RefRange<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match self.head {
             Some(ref e) => e.next(guard),
@@ -2134,7 +2159,7 @@ where
             match self.tail {
                 Some(ref t) => {
                     let bound = Bound::Excluded(t.key());
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2150,7 +2175,7 @@ where
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2171,7 +2196,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match self.tail {
             Some(ref e) => e.prev(guard),
@@ -2182,7 +2207,7 @@ where
             match self.head {
                 Some(ref h) => {
                     let bound = Bound::Excluded(h.key());
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2198,7 +2223,7 @@ where
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2231,14 +2256,15 @@ where
 }
 
 /// An owning iterator over the entries of a `SkipList`.
-pub struct IntoIter<K, V> {
+pub struct IntoIter<K, V, C = BasicComparator> {
+    _comparator: PhantomData<C>,
     /// The current node.
     ///
     /// All preceding nods have already been destroyed.
     node: *mut Node<K, V>,
 }
 
-impl<K, V> Drop for IntoIter<K, V> {
+impl<K, V, C> Drop for IntoIter<K, V, C> {
     fn drop(&mut self) {
         // Iterate through the whole chain and destroy every node.
         while let Some(node) = NonNull::new(self.node) {
@@ -2260,7 +2286,7 @@ impl<K, V> Drop for IntoIter<K, V> {
     }
 }
 
-impl<K, V> Iterator for IntoIter<K, V> {
+impl<K, V, C> Iterator for IntoIter<K, V, C> {
     type Item = (K, V);
 
     fn next(&mut self) -> Option<(K, V)> {
@@ -2299,7 +2325,7 @@ impl<K, V> Iterator for IntoIter<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for IntoIter<K, V> {
+impl<K, V, C> fmt::Debug for IntoIter<K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("IntoIter { .. }")
     }
@@ -2307,9 +2333,9 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 
 /// Helper function to retry an operation until pinning succeeds or `None` is
 /// returned.
-pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V>(mut f: F) -> Option<RefEntry<'a, K, V>>
+pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V, C>(mut f: F) -> Option<RefEntry<'a, K, V, C>>
 where
-    F: FnMut() -> Option<Entry<'a, 'g, K, V>>,
+    F: FnMut() -> Option<Entry<'a, 'g, K, V, C>>,
 {
     loop {
         if let Some(e) = f()?.pin() {
@@ -2319,27 +2345,27 @@ where
 }
 
 /// Helper function to check if a value is above a lower bound
-fn above_lower_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn above_lower_bound<V, T, C>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_ge(),
-        Bound::Excluded(key) => other.compare(key).is_gt(),
+        Bound::Included(key) => comparator.compare(other, key).is_ge(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_gt(),
     }
 }
 
 /// Helper function to check if a value is below an upper bound
-fn below_upper_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn below_upper_bound<V, T, C>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_le(),
-        Bound::Excluded(key) => other.compare(key).is_lt(),
+        Bound::Included(key) => comparator.compare(other, key).is_le(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_lt(),
     }
 }
diff --git a/crossbeam-skiplist/src/comparator.rs b/crossbeam-skiplist/src/comparator.rs
new file mode 100644
index 0000000..a1a7c0c
--- /dev/null
+++ b/crossbeam-skiplist/src/comparator.rs
@@ -0,0 +1,68 @@
+//! Runtime key comparison for skip lists.
+//!
+//! Closures and boxed comparison closures implement both traits. For example:
+//!
+//! ```
+//! use crossbeam_skiplist::SkipMap;
+//! use core::cmp::Ordering;
+//!
+//! let reverse = true;
+//! let compare: Box<dyn Fn(&i32, &i32) -> Ordering> = Box::new(move |a, b| {
+//!     if reverse { b.cmp(a) } else { a.cmp(b) }
+//! });
+//! let map = SkipMap::with_comparator(compare);
+//! map.insert(1, "one");
+//! map.insert(2, "two");
+//! assert_eq!(*map.front().unwrap().key(), 2);
+//! ```
+use crate::equivalent::{Comparable, Equivalent};
+use core::cmp::Ordering;
+
+/// Tests whether a stored key and a query represent the same key.
+/// Equivalence must agree with equality in [`Comparator::compare`].
+pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
+    /// Returns whether the keys are equivalent.
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
+}
+
+/// Defines a consistent total ordering of keys.
+///
+/// The ordering must remain stable while keys are in a collection, and comparisons
+/// with query types must agree with comparisons between stored keys.
+pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
+    /// Compares a stored key with another key or query.
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
+}
+
+/// The default ordering, using [`Equivalent`] and [`Comparable`].
+#[derive(Clone, Copy, Debug, Default)]
+pub struct BasicComparator;
+
+impl<L: ?Sized + Equivalent<R>, R: ?Sized> Equivalator<L, R> for BasicComparator {
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
+        lhs.equivalent(rhs)
+    }
+}
+impl<L: ?Sized + Comparable<R>, R: ?Sized> Comparator<L, R> for BasicComparator {
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
+        lhs.compare(rhs)
+    }
+}
+
+impl<L: ?Sized, R: ?Sized, F> Equivalator<L, R> for F
+where
+    F: Fn(&L, &R) -> Ordering + ?Sized,
+{
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
+        self(lhs, rhs) == Ordering::Equal
+    }
+}
+
+impl<L: ?Sized, R: ?Sized, F> Comparator<L, R> for F
+where
+    F: Fn(&L, &R) -> Ordering + ?Sized,
+{
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
+        self(lhs, rhs)
+    }
+}
diff --git a/crossbeam-skiplist/src/lib.rs b/crossbeam-skiplist/src/lib.rs
index 5ff8e74..252c0aa 100644
--- a/crossbeam-skiplist/src/lib.rs
+++ b/crossbeam-skiplist/src/lib.rs
@@ -266,3 +266,5 @@ pub mod set;
 pub use crate::{map::SkipMap, set::SkipSet};
 
 pub mod equivalent;
+
+pub mod comparator;
diff --git a/crossbeam-skiplist/src/map.rs b/crossbeam-skiplist/src/map.rs
index c7c5408..979dc5d 100644
--- a/crossbeam-skiplist/src/map.rs
+++ b/crossbeam-skiplist/src/map.rs
@@ -11,7 +11,7 @@ use crossbeam_epoch as epoch;
 
 use crate::{
     base::{self, try_pin_loop},
-    equivalent::Comparable,
+    comparator::{BasicComparator, Comparator},
 };
 
 /// An ordered map based on a lock-free skip list.
@@ -20,8 +20,8 @@ use crate::{
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeMap`]: std::collections::BTreeMap
-pub struct SkipMap<K, V> {
-    inner: base::SkipList<K, V>,
+pub struct SkipMap<K, V, C = BasicComparator> {
+    inner: base::SkipList<K, V, C>,
 }
 
 impl<K, V> SkipMap<K, V> {
@@ -39,6 +39,15 @@ impl<K, V> SkipMap<K, V> {
             inner: base::SkipList::new(epoch::default_collector().clone()),
         }
     }
+}
+
+impl<K, V, C> SkipMap<K, V, C> {
+    /// Returns an empty collection ordered by `comparator`.
+    pub fn with_comparator(comparator: C) -> Self {
+        Self {
+            inner: base::SkipList::with_comparator(epoch::default_collector().clone(), comparator),
+        }
+    }
 
     /// Returns `true` if the map is empty.
     ///
@@ -80,9 +89,9 @@ impl<K, V> SkipMap<K, V> {
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -99,7 +108,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.front().unwrap().value(), "five");
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.front(guard)).map(Entry::new)
     }
@@ -119,7 +128,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.back().unwrap().value(), "six");
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.back(guard)).map(Entry::new)
     }
@@ -138,7 +147,7 @@ where
     /// ```
     pub fn contains_key<Q>(&self, key: &Q) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -160,9 +169,9 @@ where
     /// numbers.insert("six", 6);
     /// assert_eq!(*numbers.get("six").unwrap().value(), 6);
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -195,9 +204,9 @@ where
     /// let greater_than_thirteen = numbers.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -227,9 +236,9 @@ where
     /// let less_than_six = numbers.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -253,7 +262,7 @@ where
     /// let jobs_age = ages.get_or_insert("Steve Jobs", -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.get_or_insert(key, value, guard))
     }
@@ -283,7 +292,7 @@ where
     /// let jobs_age = ages.get_or_insert_with("Steve Jobs", || -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -313,7 +322,7 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn iter(&self) -> Iter<'_, K, V> {
+    pub fn iter(&self) -> Iter<'_, K, V, C> {
         Iter {
             inner: self.inner.ref_iter(),
         }
@@ -340,10 +349,10 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V, C>
     where
         R: RangeBounds<Q>,
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         Range {
@@ -352,9 +361,10 @@ where
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the map and returns the new entry.
@@ -374,7 +384,7 @@ where
     ///
     /// assert_eq!(*map.get("key").unwrap().value(), "value");
     /// ```
-    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.insert(key, value, guard))
     }
@@ -401,7 +411,7 @@ where
     /// map.compare_insert("absent_key", 0, |_| false);
     /// assert_eq!(*map.get("absent_key").unwrap().value(), 0);
     /// ```
-    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V>
+    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -427,9 +437,9 @@ where
     /// map.insert("key", "value");
     /// assert_eq!(*map.remove("key").unwrap().value(), "value");
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -458,7 +468,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_front(guard).map(Entry::new)
     }
@@ -485,7 +495,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_back(guard).map(Entry::new)
     }
@@ -515,9 +525,10 @@ impl<K, V> Default for SkipMap<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipMap<K, V>
+impl<K, V, C> fmt::Debug for SkipMap<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
+    C: Comparator<K>,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -525,25 +536,25 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipMap<K, V> {
+impl<K, V, C> IntoIterator for SkipMap<K, V, C> {
     type Item = (K, V);
-    type IntoIter = IntoIter<K, V>;
+    type IntoIter = IntoIter<K, V, C>;
 
-    fn into_iter(self) -> IntoIter<K, V> {
+    fn into_iter(self) -> IntoIter<K, V, C> {
         IntoIter {
             inner: self.inner.into_iter(),
         }
     }
 }
 
-impl<'a, K, V> IntoIterator for &'a SkipMap<K, V>
+impl<'a, K, V, C> IntoIterator for &'a SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, K, V>;
-    type IntoIter = Iter<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
+    type IntoIter = Iter<'a, K, V, C>;
 
-    fn into_iter(self) -> Iter<'a, K, V> {
+    fn into_iter(self) -> Iter<'a, K, V, C> {
         self.iter()
     }
 }
@@ -565,12 +576,12 @@ where
 }
 
 /// A reference-counted entry in a map.
-pub struct Entry<'a, K, V> {
-    inner: ManuallyDrop<base::RefEntry<'a, K, V>>,
+pub struct Entry<'a, K, V, C = BasicComparator> {
+    inner: ManuallyDrop<base::RefEntry<'a, K, V, C>>,
 }
 
-impl<'a, K, V> Entry<'a, K, V> {
-    fn new(inner: base::RefEntry<'a, K, V>) -> Self {
+impl<'a, K, V, C> Entry<'a, K, V, C> {
+    fn new(inner: base::RefEntry<'a, K, V, C>) -> Self {
         Self {
             inner: ManuallyDrop::new(inner),
         }
@@ -592,7 +603,7 @@ impl<'a, K, V> Entry<'a, K, V> {
     }
 }
 
-impl<K, V> Drop for Entry<'_, K, V> {
+impl<K, V, C> Drop for Entry<'_, K, V, C> {
     fn drop(&mut self) {
         unsafe {
             ManuallyDrop::into_inner(ptr::read(&self.inner)).release_with_pin(epoch::pin);
@@ -600,9 +611,9 @@ impl<K, V> Drop for Entry<'_, K, V> {
     }
 }
 
-impl<'a, K, V> Entry<'a, K, V>
+impl<'a, K, V, C> Entry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the map.
     pub fn move_next(&mut self) -> bool {
@@ -617,21 +628,22 @@ where
     }
 
     /// Returns the next entry in the map.
-    pub fn next(&self) -> Option<Entry<'a, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 
     /// Returns the previous entry in the map.
-    pub fn prev(&self) -> Option<Entry<'a, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.prev(guard).map(Entry::new)
     }
 }
 
-impl<K, V> Entry<'_, K, V>
+impl<K, V, C> Entry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the map.
@@ -643,7 +655,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, K, V> {
+impl<K, V, C> Clone for Entry<'_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -651,7 +663,7 @@ impl<K, V> Clone for Entry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -665,11 +677,11 @@ where
 }
 
 /// An owning iterator over the entries of a `SkipMap`.
-pub struct IntoIter<K, V> {
-    inner: base::IntoIter<K, V>,
+pub struct IntoIter<K, V, C = BasicComparator> {
+    inner: base::IntoIter<K, V, C>,
 }
 
-impl<K, V> Iterator for IntoIter<K, V> {
+impl<K, V, C> Iterator for IntoIter<K, V, C> {
     type Item = (K, V);
 
     fn next(&mut self) -> Option<(K, V)> {
@@ -677,46 +689,46 @@ impl<K, V> Iterator for IntoIter<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for IntoIter<K, V> {
+impl<K, V, C> fmt::Debug for IntoIter<K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("IntoIter { .. }")
     }
 }
 
 /// An iterator over the entries of a `SkipMap`.
-pub struct Iter<'a, K, V> {
-    inner: base::RefIter<'a, K, V>,
+pub struct Iter<'a, K, V, C = BasicComparator> {
+    inner: base::RefIter<'a, K, V, C>,
 }
 
-impl<'a, K, V> Iterator for Iter<'a, K, V>
+impl<'a, K, V, C> Iterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, K, V> DoubleEndedIterator for Iter<'a, K, V>
+impl<'a, K, V, C> DoubleEndedIterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, K, V> {
+impl<K, V, C> fmt::Debug for Iter<'_, K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
-impl<K, V> Drop for Iter<'_, K, V> {
+impl<K, V, C> Drop for Iter<'_, K, V, C> {
     fn drop(&mut self) {
         let guard = &epoch::pin();
         self.inner.drop_impl(guard);
@@ -724,44 +736,45 @@ impl<K, V> Drop for Iter<'_, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipMap`.
-pub struct Range<'a, Q, R, K, V>
+pub struct Range<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    pub(crate) inner: base::RefRange<'a, Q, R, K, V>,
+    pub(crate) inner: base::RefRange<'a, Q, R, K, V, C>,
 }
 
-impl<'a, Q, R, K, V> Iterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> Iterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, Q, R, K, V> DoubleEndedIterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> DoubleEndedIterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -775,9 +788,9 @@ where
     }
 }
 
-impl<Q, R, K, V> Drop for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> Drop for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/src/set.rs b/crossbeam-skiplist/src/set.rs
index 4e91f6c..89e670d 100644
--- a/crossbeam-skiplist/src/set.rs
+++ b/crossbeam-skiplist/src/set.rs
@@ -5,7 +5,10 @@ use core::{
     ops::{Bound, Deref, RangeBounds},
 };
 
-use crate::{equivalent::Comparable, map};
+use crate::{
+    comparator::{BasicComparator, Comparator},
+    map,
+};
 
 /// A set based on a lock-free skip list.
 ///
@@ -13,8 +16,8 @@ use crate::{equivalent::Comparable, map};
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeSet`]: std::collections::BTreeSet
-pub struct SkipSet<T> {
-    inner: map::SkipMap<T, ()>,
+pub struct SkipSet<T, C = BasicComparator> {
+    inner: map::SkipMap<T, (), C>,
 }
 
 impl<T> SkipSet<T> {
@@ -32,6 +35,15 @@ impl<T> SkipSet<T> {
             inner: map::SkipMap::new(),
         }
     }
+}
+
+impl<T, C> SkipSet<T, C> {
+    /// Returns an empty collection ordered by `comparator`.
+    pub fn with_comparator(comparator: C) -> Self {
+        Self {
+            inner: map::SkipMap::with_comparator(comparator),
+        }
+    }
 
     /// Returns `true` if the set is empty.
     ///
@@ -71,9 +83,9 @@ impl<T> SkipSet<T> {
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -88,7 +100,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.front().unwrap(), 1);
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, T>> {
+    pub fn front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.front().map(Entry::new)
     }
 
@@ -105,7 +117,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.back().unwrap(), 2);
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, T>> {
+    pub fn back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.back().map(Entry::new)
     }
 
@@ -122,7 +134,7 @@ where
     /// ```
     pub fn contains<Q>(&self, key: &Q) -> bool
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.contains_key(key)
@@ -139,9 +151,9 @@ where
     /// assert_eq!(*set.get(&3).unwrap(), 3);
     /// assert!(set.get(&4).is_none());
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.get(key).map(Entry::new)
@@ -171,9 +183,9 @@ where
     /// let greater_than_thirteen = set.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.lower_bound(bound).map(Entry::new)
@@ -200,9 +212,9 @@ where
     /// let less_than_six = set.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.upper_bound(bound).map(Entry::new)
@@ -219,7 +231,7 @@ where
     /// let entry = set.get_or_insert(2);
     /// assert_eq!(*entry, 2);
     /// ```
-    pub fn get_or_insert(&self, key: T) -> Entry<'_, T> {
+    pub fn get_or_insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.get_or_insert(key, ()))
     }
 
@@ -241,7 +253,7 @@ where
     /// assert_eq!(*set_iter.next().unwrap(), 12);
     /// assert!(set_iter.next().is_none());
     /// ```
-    pub fn iter(&self) -> Iter<'_, T> {
+    pub fn iter(&self) -> Iter<'_, T, C> {
         Iter {
             inner: self.inner.iter(),
         }
@@ -264,10 +276,10 @@ where
     /// assert_eq!(*set_range.next().unwrap(), 7);
     /// assert!(set_range.next().is_none());
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T, C>
     where
         R: RangeBounds<Q>,
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         Range {
@@ -276,9 +288,10 @@ where
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T>,
 {
     /// Inserts a `key`-`value` pair into the set and returns the new entry.
     ///
@@ -294,7 +307,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.get(&2).unwrap(), 2);
     /// ```
-    pub fn insert(&self, key: T) -> Entry<'_, T> {
+    pub fn insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.insert(key, ()))
     }
 
@@ -313,9 +326,9 @@ where
     /// assert_eq!(*set.remove(&2).unwrap(), 2);
     /// assert!(set.remove(&2).is_none());
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.remove(key).map(Entry::new)
@@ -342,7 +355,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_front().map(Entry::new)
     }
 
@@ -367,7 +380,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_back().map(Entry::new)
     }
 
@@ -396,34 +409,35 @@ impl<T> Default for SkipSet<T> {
     }
 }
 
-impl<T> fmt::Debug for SkipSet<T>
+impl<T, C> fmt::Debug for SkipSet<T, C>
 where
-    T: Ord + fmt::Debug,
+    T: fmt::Debug,
+    C: Comparator<T>,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("SkipSet { .. }")
     }
 }
 
-impl<T> IntoIterator for SkipSet<T> {
+impl<T, C> IntoIterator for SkipSet<T, C> {
     type Item = T;
-    type IntoIter = IntoIter<T>;
+    type IntoIter = IntoIter<T, C>;
 
-    fn into_iter(self) -> IntoIter<T> {
+    fn into_iter(self) -> IntoIter<T, C> {
         IntoIter {
             inner: self.inner.into_iter(),
         }
     }
 }
 
-impl<'a, T> IntoIterator for &'a SkipSet<T>
+impl<'a, T, C> IntoIterator for &'a SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    type Item = Entry<'a, T>;
-    type IntoIter = Iter<'a, T>;
+    type Item = Entry<'a, T, C>;
+    type IntoIter = Iter<'a, T, C>;
 
-    fn into_iter(self) -> Iter<'a, T> {
+    fn into_iter(self) -> Iter<'a, T, C> {
         self.iter()
     }
 }
@@ -445,12 +459,12 @@ where
 }
 
 /// A reference-counted entry in a set.
-pub struct Entry<'a, T> {
-    inner: map::Entry<'a, T, ()>,
+pub struct Entry<'a, T, C = BasicComparator> {
+    inner: map::Entry<'a, T, (), C>,
 }
 
-impl<'a, T> Entry<'a, T> {
-    fn new(inner: map::Entry<'a, T, ()>) -> Self {
+impl<'a, T, C> Entry<'a, T, C> {
+    fn new(inner: map::Entry<'a, T, (), C>) -> Self {
         Self { inner }
     }
 
@@ -465,9 +479,9 @@ impl<'a, T> Entry<'a, T> {
     }
 }
 
-impl<'a, T> Entry<'a, T>
+impl<'a, T, C> Entry<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
     /// Moves to the next entry in the set.
     pub fn move_next(&mut self) -> bool {
@@ -480,19 +494,20 @@ where
     }
 
     /// Returns the next entry in the set.
-    pub fn next(&self) -> Option<Entry<'a, T>> {
+    pub fn next(&self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 
     /// Returns the previous entry in the set.
-    pub fn prev(&self) -> Option<Entry<'a, T>> {
+    pub fn prev(&self) -> Option<Entry<'a, T, C>> {
         self.inner.prev().map(Entry::new)
     }
 }
 
-impl<T> Entry<'_, T>
+impl<T, C> Entry<'_, T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T>,
 {
     /// Removes the entry from the set.
     ///
@@ -502,7 +517,7 @@ where
     }
 }
 
-impl<T> Clone for Entry<'_, T> {
+impl<T, C> Clone for Entry<'_, T, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -510,7 +525,7 @@ impl<T> Clone for Entry<'_, T> {
     }
 }
 
-impl<T> fmt::Debug for Entry<'_, T>
+impl<T, C> fmt::Debug for Entry<'_, T, C>
 where
     T: fmt::Debug,
 {
@@ -521,7 +536,7 @@ where
     }
 }
 
-impl<T> Deref for Entry<'_, T> {
+impl<T, C> Deref for Entry<'_, T, C> {
     type Target = T;
 
     fn deref(&self) -> &Self::Target {
@@ -530,11 +545,11 @@ impl<T> Deref for Entry<'_, T> {
 }
 
 /// An owning iterator over the entries of a `SkipSet`.
-pub struct IntoIter<T> {
-    inner: map::IntoIter<T, ()>,
+pub struct IntoIter<T, C = BasicComparator> {
+    inner: map::IntoIter<T, (), C>,
 }
 
-impl<T> Iterator for IntoIter<T> {
+impl<T, C> Iterator for IntoIter<T, C> {
     type Item = T;
 
     fn next(&mut self) -> Option<T> {
@@ -542,80 +557,81 @@ impl<T> Iterator for IntoIter<T> {
     }
 }
 
-impl<T> fmt::Debug for IntoIter<T> {
+impl<T, C> fmt::Debug for IntoIter<T, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("IntoIter { .. }")
     }
 }
 
 /// An iterator over the entries of a `SkipSet`.
-pub struct Iter<'a, T> {
-    inner: map::Iter<'a, T, ()>,
+pub struct Iter<'a, T, C = BasicComparator> {
+    inner: map::Iter<'a, T, (), C>,
 }
 
-impl<'a, T> Iterator for Iter<'a, T>
+impl<'a, T, C> Iterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, T> DoubleEndedIterator for Iter<'a, T>
+impl<'a, T, C> DoubleEndedIterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<T> fmt::Debug for Iter<'_, T> {
+impl<T, C> fmt::Debug for Iter<'_, T, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
 /// An iterator over a subset of entries of a `SkipSet`.
-pub struct Range<'a, Q, R, T>
+pub struct Range<'a, Q, R, T, C = BasicComparator>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    inner: map::Range<'a, Q, R, T, ()>,
+    inner: map::Range<'a, Q, R, T, (), C>,
 }
 
-impl<'a, Q, R, T> Iterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> Iterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, Q, R, T> DoubleEndedIterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> DoubleEndedIterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<Q, R, T> fmt::Debug for Range<'_, Q, R, T>
+impl<Q, R, T, C> fmt::Debug for Range<'_, Q, R, T, C>
 where
-    T: Ord + Comparable<Q> + fmt::Debug,
+    T: fmt::Debug,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/tests/comparator.rs b/crossbeam-skiplist/tests/comparator.rs
new file mode 100644
index 0000000..65ef351
--- /dev/null
+++ b/crossbeam-skiplist/tests/comparator.rs
@@ -0,0 +1,139 @@
+use std::cmp::Ordering;
+use std::ops::Bound::{Excluded, Included};
+
+use crossbeam_skiplist::comparator::{BasicComparator, Comparator, Equivalator};
+use crossbeam_skiplist::{SkipMap, SkipSet, base::SkipList};
+
+struct CaseSensitive(bool);
+
+impl<R: AsRef<str> + ?Sized> Equivalator<String, R> for CaseSensitive {
+    fn equivalent(&self, lhs: &String, rhs: &R) -> bool {
+        self.compare(lhs, rhs) == Ordering::Equal
+    }
+}
+impl<R: AsRef<str> + ?Sized> Comparator<String, R> for CaseSensitive {
+    fn compare(&self, lhs: &String, rhs: &R) -> Ordering {
+        if self.0 {
+            lhs.as_str().cmp(rhs.as_ref())
+        } else {
+            lhs.to_lowercase().cmp(&rhs.as_ref().to_lowercase())
+        }
+    }
+}
+
+#[test]
+fn case_insensitive_map() {
+    let map = SkipMap::with_comparator(CaseSensitive(false));
+    map.insert("abc".to_owned(), 1);
+    map.insert("ABC".to_owned(), 2);
+    assert_eq!(map.len(), 1);
+    assert_eq!(*map.get("aBc").unwrap().value(), 2);
+    assert_eq!(*map.get_or_insert("AbC".to_owned(), 3).value(), 2);
+    map.compare_insert("abc".to_owned(), 4, |v| *v == 2);
+    assert_eq!(*map.get("ABC").unwrap().value(), 4);
+    map.insert("DEF".to_owned(), 5);
+    map.insert("ghi".to_owned(), 6);
+    assert_eq!(map.lower_bound(Included("dEf")).unwrap().key(), "DEF");
+    assert_eq!(map.upper_bound(Excluded("dEf")).unwrap().key(), "abc");
+    let mut range = map.range::<str, _>((Included("ABC"), Excluded("GhI")));
+    assert_eq!(*range.next().unwrap().value(), 4);
+    assert_eq!(*range.next_back().unwrap().value(), 5);
+    assert!(range.next().is_none());
+    let first = map.front().unwrap();
+    assert_eq!(first.next().unwrap().key(), "DEF");
+    assert_eq!(map.back().unwrap().prev().unwrap().key(), "DEF");
+    assert_eq!(*map.remove("aBC").unwrap().value(), 4);
+    assert!(!map.contains_key("ABC"));
+    map.clear();
+    assert!(map.is_empty());
+
+    let sensitive = SkipSet::with_comparator(CaseSensitive(true));
+    sensitive.insert("abc".to_owned());
+    sensitive.insert("ABC".to_owned());
+    assert_eq!(sensitive.len(), 2);
+}
+
+// No Ord, Eq, Clone, or Debug implementation is required on the key or comparator.
+struct Key(i32);
+
+#[test]
+fn boxed_closure_and_unordered_keys() {
+    let descending: Box<dyn Fn(&Key, &Key) -> Ordering> = Box::new(|a, b| b.0.cmp(&a.0));
+    let set = SkipSet::with_comparator(descending);
+    for n in 0..10 {
+        set.insert(Key(n));
+    }
+    assert_eq!(
+        set.iter().map(|e| e.value().0).collect::<Vec<_>>(),
+        (0..10).rev().collect::<Vec<_>>()
+    );
+    let mut iter = set.iter();
+    for n in 0..5 {
+        assert_eq!(iter.next().unwrap().value().0, 9 - n);
+        assert_eq!(iter.next_back().unwrap().value().0, n);
+    }
+    assert!(iter.next().is_none());
+    drop(iter);
+    let bounds = (Included(Key(7)), Excluded(Key(2)));
+    assert_eq!(
+        set.range(bounds)
+            .rev()
+            .map(|e| e.value().0)
+            .collect::<Vec<_>>(),
+        vec![3, 4, 5, 6, 7]
+    );
+    assert!(set.get(&Key(5)).unwrap().remove());
+    assert!(set.remove(&Key(4)).is_some());
+    assert_eq!(set.pop_front().unwrap().value().0, 9);
+    assert_eq!(set.pop_back().unwrap().value().0, 0);
+    assert_eq!(
+        set.into_iter().map(|k| k.0).collect::<Vec<_>>(),
+        vec![8, 7, 6, 3, 2, 1]
+    );
+}
+
+#[test]
+fn base_comparator_and_defaults() {
+    assert_eq!(std::mem::size_of::<BasicComparator>(), 0);
+    assert!(BasicComparator.equivalent(&"abc".to_owned(), "abc"));
+    let collector = crossbeam_epoch::Collector::new();
+    let handle = collector.register();
+    let guard = &handle.pin();
+    let list = SkipList::with_comparator(collector.clone(), CaseSensitive(false));
+    list.insert("abc".to_owned(), 1, guard);
+    list.insert("ABC".to_owned(), 2, guard);
+    assert_eq!(list.len(), 1);
+    assert_eq!(*list.get("aBc", guard).unwrap().value(), 2);
+    let mut range = list.range::<str, _>((Included("ABC"), Included("ABC")), guard);
+    assert_eq!(*range.next_back().unwrap().value(), 2);
+    assert!(range.next().is_none());
+    let entry = list.get("ABC", guard).unwrap().pin().unwrap();
+    assert!(entry.remove(guard));
+    entry.release(guard);
+    assert!(list.is_empty());
+}
+
+#[test]
+fn concurrent_case_insensitive_insertion() {
+    let map = SkipMap::with_comparator(CaseSensitive(false));
+    std::thread::scope(|scope| {
+        for thread in 0..4 {
+            let map = &map;
+            scope.spawn(move || {
+                for n in 0..100 {
+                    let key = if thread % 2 == 0 {
+                        format!("KEY{n:03}")
+                    } else {
+                        format!("key{n:03}")
+                    };
+                    map.insert(key, n);
+                }
+            });
+        }
+    });
+    assert_eq!(map.len(), 100);
+    for n in 0..100 {
+        assert_eq!(*map.get(format!("Key{n:03}").as_str()).unwrap().value(), n);
+    }
+    assert_eq!(map.iter().count(), 100);
+}
```

</details>

<details><summary>reply</summary>

I’ll trace the current comparison paths, thread the comparator through the collection types, and add tests for runtime ordering and borrowed-key lookups.

The comparator is now threaded through the map, set, entries, and range iterators. I also found direct key comparisons in double-ended iteration and insertion retries; those need the comparator too so custom ordering stays consistent.

The new tests pass for case-insensitive `String`/`str` lookups, boxed comparison closures, and reverse ordering on keys without `Ord`. The alloc-only build also passes. I’m finishing the full test run, including the existing API examples.

Implemented runtime comparators across `SkipMap`, `SkipSet`, and `base::SkipList`, including entries, iterators, and ranges.

Added the public comparator traits, `BasicComparator`, and `with_comparator` constructors. Closures and boxed comparison closures are supported; existing `new()` behavior remains unchanged.

All 128 tests pass, including case-insensitive borrowed lookups and concurrent insertion. Clippy and the alloc-only build also pass.

</details>

### codex, hush: pass

Files: [crossbeam-skiplist/src/base.rs](../hush/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/base.rs), [crossbeam-skiplist/src/comparator.rs](../hush/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/comparator.rs), [crossbeam-skiplist/src/lib.rs](../hush/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/lib.rs), [crossbeam-skiplist/src/map.rs](../hush/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/map.rs), [crossbeam-skiplist/src/set.rs](../hush/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/set.rs), [crossbeam-skiplist/tests/comparator.rs](../hush/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/tests/comparator.rs)

<details><summary>diff</summary>

```diff
diff --git a/crossbeam-skiplist/src/base.rs b/crossbeam-skiplist/src/base.rs
index a73ee8a..cc4c2e3 100644
--- a/crossbeam-skiplist/src/base.rs
+++ b/crossbeam-skiplist/src/base.rs
@@ -15,7 +15,7 @@ use core::{
 use crossbeam_epoch::{self as epoch, Atomic, Collector, Guard, Shared};
 use crossbeam_utils::CachePadded;
 
-use super::equivalent::Comparable;
+use super::comparator::{BasicComparator, Comparator};
 use crate::alloc_helper::Global;
 
 /// Number of bits needed to store height.
@@ -304,7 +304,7 @@ impl<'a, K, V> NodeRef<'a, K, V> {
     /// Decrements the reference count of a node, pinning the thread and destroying the node
     /// if the count become zero.
     #[inline]
-    unsafe fn decrement_with_pin<F>(self, parent: &SkipList<K, V>, pin: F)
+    unsafe fn decrement_with_pin<F, C>(self, parent: &SkipList<K, V, C>, pin: F)
     where
         F: FnOnce() -> Guard,
     {
@@ -463,10 +463,12 @@ struct HotData {
 // As a further future optimization, if `!mem::needs_drop::<K>() && !mem::needs_drop::<V>()`
 // (neither key nor the value have destructors), there's no point in creating a new local
 // collector, so we should simply use the global one.
-pub struct SkipList<K, V> {
+pub struct SkipList<K, V, C = BasicComparator> {
     /// The head of the skip list (just a dummy node, not a real entry).
     head: Head<K, V>,
 
+    comparator: C,
+
     /// The `Collector` associated with this skip list.
     collector: Collector,
 
@@ -474,13 +476,21 @@ pub struct SkipList<K, V> {
     hot_data: CachePadded<HotData>,
 }
 
-unsafe impl<K: Send + Sync, V: Send + Sync> Send for SkipList<K, V> {}
-unsafe impl<K: Send + Sync, V: Send + Sync> Sync for SkipList<K, V> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Send> Send for SkipList<K, V, C> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Sync> Sync for SkipList<K, V, C> {}
 
 impl<K, V> SkipList<K, V> {
-    /// Returns a new, empty skip list.
+    /// Returns a new skip list using the default ordering.
     pub fn new(collector: Collector) -> Self {
+        Self::with_comparator(collector, BasicComparator)
+    }
+}
+
+impl<K, V, C> SkipList<K, V, C> {
+    /// Returns a new, empty skip list.
+    pub fn with_comparator(collector: Collector, comparator: C) -> Self {
         Self {
+            comparator,
             head: Head::new(),
             collector,
             hot_data: CachePadded::new(HotData {
@@ -517,12 +527,12 @@ impl<K, V> SkipList<K, V> {
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Returns the entry with the smallest key.
-    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.next_node(self.head.as_tower(), Bound::Unbounded, guard)?;
         Some(Entry {
@@ -533,7 +543,7 @@ where
     }
 
     /// Returns the entry with the largest key.
-    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.search_bound::<K>(Bound::Unbounded, true, guard)?;
         Some(Entry {
@@ -546,21 +556,21 @@ where
     /// Returns `true` if the map contains a value for the specified key.
     pub fn contains_key<Q>(&self, key: &Q, guard: &Guard) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.get(key, guard).is_some()
     }
 
     /// Returns an entry with the specified `key`.
-    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>>
+    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
         let n = self.search_bound(Bound::Included(key), false, guard)?;
-        if !n.key.equivalent(key) {
+        if !self.comparator.equivalent(&n.key, key) {
             return None;
         }
 
@@ -578,9 +588,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -599,9 +609,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -614,7 +624,7 @@ where
     }
 
     /// Finds an entry with the specified key, or inserts a new `key`-`value` pair if none exist.
-    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| false, guard)
     }
 
@@ -626,7 +636,7 @@ where
     /// discarded. If closure is modifying some other state (such as shared counters or shared
     /// objects), it may lead to <u>undesired behaviour</u> such as counters being changed without
     /// result of closure inserted
-    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -634,7 +644,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V> {
+    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V, C> {
         self.check_guard(guard);
         Iter {
             parent: self,
@@ -645,7 +655,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn ref_iter(&self) -> RefIter<'_, K, V> {
+    pub fn ref_iter(&self) -> RefIter<'_, K, V, C> {
         RefIter {
             parent: self,
             head: None,
@@ -658,9 +668,9 @@ where
         &'a self,
         range: R,
         guard: &'g Guard,
-    ) -> Range<'a, 'g, Q, R, K, V>
+    ) -> Range<'a, 'g, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -677,9 +687,9 @@ where
 
     /// Returns an iterator over a subset of entries in the skip list.
     #[allow(clippy::needless_lifetimes)]
-    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V>
+    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -825,7 +835,7 @@ where
         guard: &'a Guard,
     ) -> Option<NodeRef<'a, K, V>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -887,11 +897,11 @@ where
                         // bound, we return the last node before the condition became true. For the
                         // lower bound, we return the first node after the condition became true.
                         if upper_bound {
-                            if !below_upper_bound(&bound, &c.key) {
+                            if !below_upper_bound(&bound, &c.key, &self.comparator) {
                                 break;
                             }
                             result = Some(c);
-                        } else if above_lower_bound(&bound, &c.key) {
+                        } else if above_lower_bound(&bound, &c.key, &self.comparator) {
                             result = Some(c);
                             break;
                         }
@@ -910,7 +920,7 @@ where
     /// Searches for a key in the skip list and returns a list of all adjacent nodes.
     fn search_position<'a, Q>(&'a self, key: &Q, guard: &'a Guard) -> Position<'a, K, V>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -971,7 +981,7 @@ where
 
                         // If `curr` contains a key that is greater than or equal to `key`, we're
                         // done with this level.
-                        match c.key.compare(key) {
+                        match self.comparator.compare(&c.key, key) {
                             cmp::Ordering::Greater => break,
                             cmp::Ordering::Equal => {
                                 result.found = Some(c);
@@ -1004,7 +1014,7 @@ where
         value: F,
         replace: CompareF,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
         CompareF: Fn(&V) -> bool,
@@ -1018,7 +1028,7 @@ where
             let guard = &*(guard as *const _);
 
             // First try searching for the key.
-            // Note that the `Ord` implementation for `K` may panic during the search.
+            // Note that the comparator may panic during the search.
             let mut search = self.search_position(&key, guard);
             if let Some(r) = search.found {
                 let replace = replace(&r.value);
@@ -1155,7 +1165,10 @@ where
                     // the tower without breaking any invariants. Note that building higher levels
                     // is completely optional. Only the lowest level really matters, and all the
                     // higher levels are there just to make searching faster.
-                    if succ.as_ref().map(|s| &s.key) == Some(&n.key) {
+                    if succ
+                        .as_ref()
+                        .map_or(false, |s| self.comparator.equivalent(&s.key, &n.key))
+                    {
                         search = self.search_position(&n.key, guard);
                         continue;
                     }
@@ -1218,16 +1231,17 @@ where
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the skip list and returns the new entry.
     ///
     /// If there is an existing entry with this key, it will be removed before inserting the new
     /// one.
-    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| true, guard)
     }
 
@@ -1242,7 +1256,7 @@ where
         value: V,
         compare_fn: F,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -1250,9 +1264,9 @@ where
     }
 
     /// Removes an entry with the specified `key` from the map and returns it.
-    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -1320,7 +1334,7 @@ where
     }
 
     /// Removes an entry from the front of the skip list.
-    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.front(guard)?;
@@ -1335,7 +1349,7 @@ where
     }
 
     /// Removes an entry from the back of the skip list.
-    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.back(guard)?;
@@ -1393,7 +1407,7 @@ where
     }
 }
 
-impl<K, V> Drop for SkipList<K, V> {
+impl<K, V, C> Drop for SkipList<K, V, C> {
     fn drop(&mut self) {
         unsafe {
             let mut node = NodeRef::from_shared(
@@ -1419,9 +1433,10 @@ impl<K, V> Drop for SkipList<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipList<K, V>
+impl<K, V, C> fmt::Debug for SkipList<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
+    C: Comparator<K>,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -1429,11 +1444,11 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipList<K, V> {
+impl<K, V, C> IntoIterator for SkipList<K, V, C> {
     type Item = (K, V);
-    type IntoIter = IntoIter<K, V>;
+    type IntoIter = IntoIter<K, V, C>;
 
-    fn into_iter(self) -> IntoIter<K, V> {
+    fn into_iter(self) -> IntoIter<K, V, C> {
         unsafe {
             // Load the front node.
             //
@@ -1454,6 +1469,7 @@ impl<K, V> IntoIterator for SkipList<K, V> {
 
             IntoIter {
                 node: front as *mut Node<K, V>,
+                _comparator: PhantomData,
             }
         }
     }
@@ -1464,13 +1480,13 @@ impl<K, V> IntoIterator for SkipList<K, V> {
 /// The lifetimes of the key and value are the same as that of the `Guard`
 /// used when creating the `Entry` (`'g`). This lifetime is also constrained to
 /// not outlive the `SkipList`.
-pub struct Entry<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Entry<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'g, K, V>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Entry<'a, 'g, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1487,7 +1503,7 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1496,14 +1512,15 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     ///
     /// This method may return `None` if the reference count is already 0 and
     /// the node has been queued for deletion.
-    pub fn pin(&self) -> Option<RefEntry<'a, K, V>> {
+    pub fn pin(&self) -> Option<RefEntry<'a, K, V, C>> {
         unsafe { RefEntry::try_acquire(self.parent, self.node) }
     }
 }
 
-impl<K, V> Entry<'_, '_, K, V>
+impl<K, V, C> Entry<'_, '_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1526,7 +1543,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, '_, K, V> {
+impl<K, V, C> Clone for Entry<'_, '_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             parent: self.parent,
@@ -1536,7 +1553,7 @@ impl<K, V> Clone for Entry<'_, '_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1549,9 +1566,9 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K, V> Entry<'a, 'g, K, V>
+impl<'a: 'g, 'g, K, V, C> Entry<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self) -> bool {
@@ -1565,7 +1582,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self.parent.next_node(
             self.node.as_tower(),
             Bound::Excluded(&self.node.key),
@@ -1590,7 +1607,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self
             .parent
             .search_bound(Bound::Excluded(&self.node.key), true, self.guard)?;
@@ -1606,12 +1623,12 @@ where
 ///
 /// You *must* call `release` to free this type, otherwise the node will be
 /// leaked. This is because releasing the entry requires a `Guard`.
-pub struct RefEntry<'a, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct RefEntry<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'a, K, V>,
 }
 
-impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefEntry<'a, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1628,7 +1645,7 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1650,9 +1667,9 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     /// Tries to create a new `RefEntry` by incrementing the reference count of
     /// a node.
     unsafe fn try_acquire(
-        parent: &'a SkipList<K, V>,
+        parent: &'a SkipList<K, V, C>,
         node: NodeRef<'_, K, V>,
-    ) -> Option<RefEntry<'a, K, V>> {
+    ) -> Option<RefEntry<'a, K, V, C>> {
         if unsafe { node.try_increment() } {
             Some(RefEntry {
                 parent,
@@ -1667,9 +1684,10 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 }
 
-impl<K, V> RefEntry<'_, K, V>
+impl<K, V, C> RefEntry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1694,7 +1712,7 @@ where
     }
 }
 
-impl<K, V> Clone for RefEntry<'_, K, V> {
+impl<K, V, C> Clone for RefEntry<'_, K, V, C> {
     fn clone(&self) -> Self {
         unsafe {
             // Incrementing will always succeed since we're already holding a reference to the node.
@@ -1707,7 +1725,7 @@ impl<K, V> Clone for RefEntry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for RefEntry<'_, K, V>
+impl<K, V, C> fmt::Debug for RefEntry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1720,9 +1738,9 @@ where
     }
 }
 
-impl<'a, K, V> RefEntry<'a, K, V>
+impl<'a, K, V, C> RefEntry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self, guard: &Guard) -> bool {
@@ -1736,7 +1754,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1763,7 +1781,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1780,20 +1798,20 @@ where
 }
 
 /// An iterator over the entries of a `SkipList`.
-pub struct Iter<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Iter<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Iterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Iterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1804,7 +1822,7 @@ where
             }
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1817,11 +1835,11 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> DoubleEndedIterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> DoubleEndedIterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -1831,7 +1849,7 @@ where
                 .search_bound::<K>(Bound::Unbounded, true, self.guard),
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1844,7 +1862,7 @@ where
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Iter<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1858,13 +1876,13 @@ where
 }
 
 /// An iterator over reference-counted entries of a `SkipList`.
-pub struct RefIter<'a, K, V> {
-    parent: &'a SkipList<K, V>,
-    head: Option<RefEntry<'a, K, V>>,
-    tail: Option<RefEntry<'a, K, V>>,
+pub struct RefIter<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
+    head: Option<RefEntry<'a, K, V, C>>,
+    tail: Option<RefEntry<'a, K, V, C>>,
 }
 
-impl<K, V> fmt::Debug for RefIter<'_, K, V>
+impl<K, V, C> fmt::Debug for RefIter<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1883,12 +1901,12 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V>
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match &self.head {
             Some(e) => e.next(guard),
@@ -1896,7 +1914,9 @@ where
         };
         match (&next_head, &self.tail) {
             // The next key is larger than the latest tail key we observed with this iterator.
-            (Some(ref next), Some(t)) if next.key() >= t.key() => {
+            (Some(ref next), Some(t))
+                if self.parent.comparator.compare(next.key(), t.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1915,7 +1935,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match &self.tail {
             Some(e) => e.prev(guard),
@@ -1923,7 +1943,9 @@ where
         };
         match (&self.head, &next_tail) {
             // The prev key is smaller than the latest head key we observed with this iterator.
-            (Some(h), Some(next)) if h.key() >= next.key() => {
+            (Some(h), Some(next))
+                if self.parent.comparator.compare(h.key(), next.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1942,7 +1964,7 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C> {
     /// Decrements the reference count of `RefEntry` owned by the iterator.
     pub fn drop_impl(&mut self, guard: &Guard) {
         self.parent.check_guard(guard);
@@ -1956,13 +1978,13 @@ impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipList`.
-pub struct Range<'a: 'g, 'g, Q, R, K, V>
+pub struct Range<'a: 'g, 'g, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     range: R,
@@ -1970,15 +1992,15 @@ where
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> Iterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> Iterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1991,14 +2013,14 @@ where
             match self.tail {
                 Some(t) => {
                     let bound = Bound::Excluded(&t.as_ref().key);
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&bound, &h.key, &self.parent.comparator) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&bound, &h.key, &self.parent.comparator) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2013,13 +2035,13 @@ where
     }
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -2032,14 +2054,14 @@ where
             match self.head {
                 Some(h) => {
                     let bound = Bound::Excluded(&h.as_ref().key);
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&bound, &t.key, &self.parent.comparator) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&bound, &t.key, &self.parent.comparator) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2054,9 +2076,10 @@ where
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, '_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, '_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2071,38 +2094,45 @@ where
 }
 
 /// An iterator over reference-counted subset of entries of a `SkipList`.
-pub struct RefRange<'a, Q, R, K, V>
+pub struct RefRange<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
-    pub(crate) head: Option<RefEntry<'a, K, V>>,
-    pub(crate) tail: Option<RefEntry<'a, K, V>>,
+    parent: &'a SkipList<K, V, C>,
+    pub(crate) head: Option<RefEntry<'a, K, V, C>>,
+    pub(crate) tail: Option<RefEntry<'a, K, V, C>>,
     pub(crate) range: R,
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-unsafe impl<Q, R, K, V> Send for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C> Send for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
-    R: RangeBounds<Q>,
+    K: Send + Sync,
+    V: Send + Sync,
+    C: Comparator<K> + Sync,
+    C: Comparator<K, Q>,
+    R: RangeBounds<Q> + Send,
     Q: ?Sized,
 {
 }
 
-unsafe impl<Q, R, K, V> Sync for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C> Sync for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
-    R: RangeBounds<Q>,
+    K: Send + Sync,
+    V: Send + Sync,
+    C: Comparator<K> + Sync,
+    C: Comparator<K, Q>,
+    R: RangeBounds<Q> + Sync,
     Q: ?Sized,
 {
 }
 
-impl<Q, R, K, V> fmt::Debug for RefRange<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2116,14 +2146,14 @@ where
     }
 }
 
-impl<'a, Q, R, K: 'a, V: 'a> RefRange<'a, Q, R, K, V>
+impl<'a, Q, R, K: 'a, V: 'a, C> RefRange<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match self.head {
             Some(ref e) => e.next(guard),
@@ -2134,7 +2164,7 @@ where
             match self.tail {
                 Some(ref t) => {
                     let bound = Bound::Excluded(t.key());
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&bound, h.key(), &self.parent.comparator) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2150,7 +2180,7 @@ where
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&bound, h.key(), &self.parent.comparator) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2171,7 +2201,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match self.tail {
             Some(ref e) => e.prev(guard),
@@ -2182,7 +2212,7 @@ where
             match self.head {
                 Some(ref h) => {
                     let bound = Bound::Excluded(h.key());
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&bound, t.key(), &self.parent.comparator) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2198,7 +2228,7 @@ where
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&bound, t.key(), &self.parent.comparator) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2231,14 +2261,15 @@ where
 }
 
 /// An owning iterator over the entries of a `SkipList`.
-pub struct IntoIter<K, V> {
+pub struct IntoIter<K, V, C = BasicComparator> {
     /// The current node.
     ///
     /// All preceding nods have already been destroyed.
     node: *mut Node<K, V>,
+    _comparator: PhantomData<C>,
 }
 
-impl<K, V> Drop for IntoIter<K, V> {
+impl<K, V, C> Drop for IntoIter<K, V, C> {
     fn drop(&mut self) {
         // Iterate through the whole chain and destroy every node.
         while let Some(node) = NonNull::new(self.node) {
@@ -2260,7 +2291,7 @@ impl<K, V> Drop for IntoIter<K, V> {
     }
 }
 
-impl<K, V> Iterator for IntoIter<K, V> {
+impl<K, V, C> Iterator for IntoIter<K, V, C> {
     type Item = (K, V);
 
     fn next(&mut self) -> Option<(K, V)> {
@@ -2299,7 +2330,7 @@ impl<K, V> Iterator for IntoIter<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for IntoIter<K, V> {
+impl<K, V, C> fmt::Debug for IntoIter<K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("IntoIter { .. }")
     }
@@ -2307,9 +2338,9 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 
 /// Helper function to retry an operation until pinning succeeds or `None` is
 /// returned.
-pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V>(mut f: F) -> Option<RefEntry<'a, K, V>>
+pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V, C>(mut f: F) -> Option<RefEntry<'a, K, V, C>>
 where
-    F: FnMut() -> Option<Entry<'a, 'g, K, V>>,
+    F: FnMut() -> Option<Entry<'a, 'g, K, V, C>>,
 {
     loop {
         if let Some(e) = f()?.pin() {
@@ -2319,27 +2350,27 @@ where
 }
 
 /// Helper function to check if a value is above a lower bound
-fn above_lower_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn above_lower_bound<V, T, C>(bound: &Bound<&T>, other: &V, comparator: &C) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_ge(),
-        Bound::Excluded(key) => other.compare(key).is_gt(),
+        Bound::Included(key) => comparator.compare(other, key).is_ge(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_gt(),
     }
 }
 
 /// Helper function to check if a value is below an upper bound
-fn below_upper_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn below_upper_bound<V, T, C>(bound: &Bound<&T>, other: &V, comparator: &C) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_le(),
-        Bound::Excluded(key) => other.compare(key).is_lt(),
+        Bound::Included(key) => comparator.compare(other, key).is_le(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_lt(),
     }
 }
diff --git a/crossbeam-skiplist/src/comparator.rs b/crossbeam-skiplist/src/comparator.rs
new file mode 100644
index 0000000..392c2aa
--- /dev/null
+++ b/crossbeam-skiplist/src/comparator.rs
@@ -0,0 +1,61 @@
+//! Runtime key equivalence and ordering.
+
+use crate::equivalent::{Comparable, Equivalent};
+use core::cmp::Ordering;
+
+/// Tests whether a stored key and a query represent the same key.
+///
+/// Equivalence must agree with [`Comparator::compare`] returning [`Ordering::Equal`].
+pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
+    /// Returns whether the keys are equivalent.
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
+}
+
+/// Defines a consistent total ordering of keys.
+///
+/// The ordering must remain stable while keys are stored in a collection.
+/// Comparisons with query keys must agree with comparisons between stored keys.
+pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
+    /// Compares a stored key with another key or query.
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
+}
+
+/// The default ordering, using [`Equivalent`] and [`Comparable`].
+#[derive(Clone, Copy, Debug, Default)]
+pub struct BasicComparator;
+
+impl<L: ?Sized, R: ?Sized> Equivalator<L, R> for BasicComparator
+where
+    L: Equivalent<R>,
+{
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
+        lhs.equivalent(rhs)
+    }
+}
+
+impl<L: ?Sized, R: ?Sized> Comparator<L, R> for BasicComparator
+where
+    L: Comparable<R>,
+{
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
+        lhs.compare(rhs)
+    }
+}
+
+impl<L: ?Sized, R: ?Sized, F> Equivalator<L, R> for F
+where
+    F: Fn(&L, &R) -> Ordering,
+{
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
+        self(lhs, rhs) == Ordering::Equal
+    }
+}
+
+impl<L: ?Sized, R: ?Sized, F> Comparator<L, R> for F
+where
+    F: Fn(&L, &R) -> Ordering,
+{
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
+        self(lhs, rhs)
+    }
+}
diff --git a/crossbeam-skiplist/src/lib.rs b/crossbeam-skiplist/src/lib.rs
index 5ff8e74..252c0aa 100644
--- a/crossbeam-skiplist/src/lib.rs
+++ b/crossbeam-skiplist/src/lib.rs
@@ -266,3 +266,5 @@ pub mod set;
 pub use crate::{map::SkipMap, set::SkipSet};
 
 pub mod equivalent;
+
+pub mod comparator;
diff --git a/crossbeam-skiplist/src/map.rs b/crossbeam-skiplist/src/map.rs
index c7c5408..4971769 100644
--- a/crossbeam-skiplist/src/map.rs
+++ b/crossbeam-skiplist/src/map.rs
@@ -11,7 +11,7 @@ use crossbeam_epoch as epoch;
 
 use crate::{
     base::{self, try_pin_loop},
-    equivalent::Comparable,
+    comparator::{BasicComparator, Comparator},
 };
 
 /// An ordered map based on a lock-free skip list.
@@ -20,23 +20,31 @@ use crate::{
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeMap`]: std::collections::BTreeMap
-pub struct SkipMap<K, V> {
-    inner: base::SkipList<K, V>,
+pub struct SkipMap<K, V, C = BasicComparator> {
+    inner: base::SkipList<K, V, C>,
 }
 
 impl<K, V> SkipMap<K, V> {
-    /// Returns a new, empty map.
+    /// Returns an empty collection using the default ordering.
+    pub fn new() -> Self {
+        Self::with_comparator(BasicComparator)
+    }
+}
+
+impl<K, V, C> SkipMap<K, V, C> {
+    /// Returns a new, empty map with the given comparator.
     ///
     /// # Example
     ///
     /// ```
     /// use crossbeam_skiplist::SkipMap;
     ///
-    /// let map: SkipMap<i32, &str> = SkipMap::new();
+    /// let map = SkipMap::with_comparator(|a: &i32, b: &i32| b.cmp(a));
+    /// map.insert(1, "one");
     /// ```
-    pub fn new() -> Self {
+    pub fn with_comparator(comparator: C) -> Self {
         Self {
-            inner: base::SkipList::new(epoch::default_collector().clone()),
+            inner: base::SkipList::with_comparator(epoch::default_collector().clone(), comparator),
         }
     }
 
@@ -80,9 +88,9 @@ impl<K, V> SkipMap<K, V> {
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -99,7 +107,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.front().unwrap().value(), "five");
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.front(guard)).map(Entry::new)
     }
@@ -119,7 +127,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.back().unwrap().value(), "six");
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.back(guard)).map(Entry::new)
     }
@@ -138,7 +146,7 @@ where
     /// ```
     pub fn contains_key<Q>(&self, key: &Q) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -160,9 +168,9 @@ where
     /// numbers.insert("six", 6);
     /// assert_eq!(*numbers.get("six").unwrap().value(), 6);
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -195,9 +203,9 @@ where
     /// let greater_than_thirteen = numbers.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -227,9 +235,9 @@ where
     /// let less_than_six = numbers.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -253,7 +261,7 @@ where
     /// let jobs_age = ages.get_or_insert("Steve Jobs", -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.get_or_insert(key, value, guard))
     }
@@ -283,7 +291,7 @@ where
     /// let jobs_age = ages.get_or_insert_with("Steve Jobs", || -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -313,7 +321,7 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn iter(&self) -> Iter<'_, K, V> {
+    pub fn iter(&self) -> Iter<'_, K, V, C> {
         Iter {
             inner: self.inner.ref_iter(),
         }
@@ -340,10 +348,10 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V, C>
     where
         R: RangeBounds<Q>,
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         Range {
@@ -352,9 +360,10 @@ where
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the map and returns the new entry.
@@ -374,7 +383,7 @@ where
     ///
     /// assert_eq!(*map.get("key").unwrap().value(), "value");
     /// ```
-    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.insert(key, value, guard))
     }
@@ -401,7 +410,7 @@ where
     /// map.compare_insert("absent_key", 0, |_| false);
     /// assert_eq!(*map.get("absent_key").unwrap().value(), 0);
     /// ```
-    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V>
+    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -427,9 +436,9 @@ where
     /// map.insert("key", "value");
     /// assert_eq!(*map.remove("key").unwrap().value(), "value");
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -458,7 +467,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_front(guard).map(Entry::new)
     }
@@ -485,7 +494,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_back(guard).map(Entry::new)
     }
@@ -515,9 +524,10 @@ impl<K, V> Default for SkipMap<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipMap<K, V>
+impl<K, V, C> fmt::Debug for SkipMap<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
+    C: Comparator<K>,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -525,25 +535,25 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipMap<K, V> {
+impl<K, V, C> IntoIterator for SkipMap<K, V, C> {
     type Item = (K, V);
-    type IntoIter = IntoIter<K, V>;
+    type IntoIter = IntoIter<K, V, C>;
 
-    fn into_iter(self) -> IntoIter<K, V> {
+    fn into_iter(self) -> IntoIter<K, V, C> {
         IntoIter {
             inner: self.inner.into_iter(),
         }
     }
 }
 
-impl<'a, K, V> IntoIterator for &'a SkipMap<K, V>
+impl<'a, K, V, C> IntoIterator for &'a SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, K, V>;
-    type IntoIter = Iter<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
+    type IntoIter = Iter<'a, K, V, C>;
 
-    fn into_iter(self) -> Iter<'a, K, V> {
+    fn into_iter(self) -> Iter<'a, K, V, C> {
         self.iter()
     }
 }
@@ -565,12 +575,12 @@ where
 }
 
 /// A reference-counted entry in a map.
-pub struct Entry<'a, K, V> {
-    inner: ManuallyDrop<base::RefEntry<'a, K, V>>,
+pub struct Entry<'a, K, V, C = BasicComparator> {
+    inner: ManuallyDrop<base::RefEntry<'a, K, V, C>>,
 }
 
-impl<'a, K, V> Entry<'a, K, V> {
-    fn new(inner: base::RefEntry<'a, K, V>) -> Self {
+impl<'a, K, V, C> Entry<'a, K, V, C> {
+    fn new(inner: base::RefEntry<'a, K, V, C>) -> Self {
         Self {
             inner: ManuallyDrop::new(inner),
         }
@@ -592,7 +602,7 @@ impl<'a, K, V> Entry<'a, K, V> {
     }
 }
 
-impl<K, V> Drop for Entry<'_, K, V> {
+impl<K, V, C> Drop for Entry<'_, K, V, C> {
     fn drop(&mut self) {
         unsafe {
             ManuallyDrop::into_inner(ptr::read(&self.inner)).release_with_pin(epoch::pin);
@@ -600,9 +610,9 @@ impl<K, V> Drop for Entry<'_, K, V> {
     }
 }
 
-impl<'a, K, V> Entry<'a, K, V>
+impl<'a, K, V, C> Entry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the map.
     pub fn move_next(&mut self) -> bool {
@@ -617,21 +627,22 @@ where
     }
 
     /// Returns the next entry in the map.
-    pub fn next(&self) -> Option<Entry<'a, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 
     /// Returns the previous entry in the map.
-    pub fn prev(&self) -> Option<Entry<'a, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.prev(guard).map(Entry::new)
     }
 }
 
-impl<K, V> Entry<'_, K, V>
+impl<K, V, C> Entry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the map.
@@ -643,7 +654,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, K, V> {
+impl<K, V, C> Clone for Entry<'_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -651,7 +662,7 @@ impl<K, V> Clone for Entry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -665,11 +676,11 @@ where
 }
 
 /// An owning iterator over the entries of a `SkipMap`.
-pub struct IntoIter<K, V> {
-    inner: base::IntoIter<K, V>,
+pub struct IntoIter<K, V, C = BasicComparator> {
+    inner: base::IntoIter<K, V, C>,
 }
 
-impl<K, V> Iterator for IntoIter<K, V> {
+impl<K, V, C> Iterator for IntoIter<K, V, C> {
     type Item = (K, V);
 
     fn next(&mut self) -> Option<(K, V)> {
@@ -677,46 +688,46 @@ impl<K, V> Iterator for IntoIter<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for IntoIter<K, V> {
+impl<K, V, C> fmt::Debug for IntoIter<K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("IntoIter { .. }")
     }
 }
 
 /// An iterator over the entries of a `SkipMap`.
-pub struct Iter<'a, K, V> {
-    inner: base::RefIter<'a, K, V>,
+pub struct Iter<'a, K, V, C = BasicComparator> {
+    inner: base::RefIter<'a, K, V, C>,
 }
 
-impl<'a, K, V> Iterator for Iter<'a, K, V>
+impl<'a, K, V, C> Iterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, K, V> DoubleEndedIterator for Iter<'a, K, V>
+impl<'a, K, V, C> DoubleEndedIterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, K, V> {
+impl<K, V, C> fmt::Debug for Iter<'_, K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
-impl<K, V> Drop for Iter<'_, K, V> {
+impl<K, V, C> Drop for Iter<'_, K, V, C> {
     fn drop(&mut self) {
         let guard = &epoch::pin();
         self.inner.drop_impl(guard);
@@ -724,44 +735,45 @@ impl<K, V> Drop for Iter<'_, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipMap`.
-pub struct Range<'a, Q, R, K, V>
+pub struct Range<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    pub(crate) inner: base::RefRange<'a, Q, R, K, V>,
+    pub(crate) inner: base::RefRange<'a, Q, R, K, V, C>,
 }
 
-impl<'a, Q, R, K, V> Iterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> Iterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, Q, R, K, V> DoubleEndedIterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> DoubleEndedIterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -775,9 +787,9 @@ where
     }
 }
 
-impl<Q, R, K, V> Drop for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> Drop for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/src/set.rs b/crossbeam-skiplist/src/set.rs
index 4e91f6c..98f5c27 100644
--- a/crossbeam-skiplist/src/set.rs
+++ b/crossbeam-skiplist/src/set.rs
@@ -5,7 +5,10 @@ use core::{
     ops::{Bound, Deref, RangeBounds},
 };
 
-use crate::{equivalent::Comparable, map};
+use crate::{
+    comparator::{BasicComparator, Comparator},
+    map,
+};
 
 /// A set based on a lock-free skip list.
 ///
@@ -13,23 +16,31 @@ use crate::{equivalent::Comparable, map};
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeSet`]: std::collections::BTreeSet
-pub struct SkipSet<T> {
-    inner: map::SkipMap<T, ()>,
+pub struct SkipSet<T, C = BasicComparator> {
+    inner: map::SkipMap<T, (), C>,
 }
 
 impl<T> SkipSet<T> {
-    /// Returns a new, empty set.
+    /// Returns an empty collection using the default ordering.
+    pub fn new() -> Self {
+        Self::with_comparator(BasicComparator)
+    }
+}
+
+impl<T, C> SkipSet<T, C> {
+    /// Returns a new, empty set with the given comparator.
     ///
     /// # Example
     ///
     /// ```
     /// use crossbeam_skiplist::SkipSet;
     ///
-    /// let set: SkipSet<i32> = SkipSet::new();
+    /// let set = SkipSet::with_comparator(|a: &i32, b: &i32| b.cmp(a));
+    /// set.insert(1);
     /// ```
-    pub fn new() -> Self {
+    pub fn with_comparator(comparator: C) -> Self {
         Self {
-            inner: map::SkipMap::new(),
+            inner: map::SkipMap::with_comparator(comparator),
         }
     }
 
@@ -71,9 +82,9 @@ impl<T> SkipSet<T> {
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -88,7 +99,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.front().unwrap(), 1);
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, T>> {
+    pub fn front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.front().map(Entry::new)
     }
 
@@ -105,7 +116,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.back().unwrap(), 2);
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, T>> {
+    pub fn back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.back().map(Entry::new)
     }
 
@@ -122,7 +133,7 @@ where
     /// ```
     pub fn contains<Q>(&self, key: &Q) -> bool
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.contains_key(key)
@@ -139,9 +150,9 @@ where
     /// assert_eq!(*set.get(&3).unwrap(), 3);
     /// assert!(set.get(&4).is_none());
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.get(key).map(Entry::new)
@@ -171,9 +182,9 @@ where
     /// let greater_than_thirteen = set.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.lower_bound(bound).map(Entry::new)
@@ -200,9 +211,9 @@ where
     /// let less_than_six = set.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.upper_bound(bound).map(Entry::new)
@@ -219,7 +230,7 @@ where
     /// let entry = set.get_or_insert(2);
     /// assert_eq!(*entry, 2);
     /// ```
-    pub fn get_or_insert(&self, key: T) -> Entry<'_, T> {
+    pub fn get_or_insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.get_or_insert(key, ()))
     }
 
@@ -241,7 +252,7 @@ where
     /// assert_eq!(*set_iter.next().unwrap(), 12);
     /// assert!(set_iter.next().is_none());
     /// ```
-    pub fn iter(&self) -> Iter<'_, T> {
+    pub fn iter(&self) -> Iter<'_, T, C> {
         Iter {
             inner: self.inner.iter(),
         }
@@ -264,10 +275,10 @@ where
     /// assert_eq!(*set_range.next().unwrap(), 7);
     /// assert!(set_range.next().is_none());
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T, C>
     where
         R: RangeBounds<Q>,
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         Range {
@@ -276,9 +287,10 @@ where
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T>,
 {
     /// Inserts a `key`-`value` pair into the set and returns the new entry.
     ///
@@ -294,7 +306,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.get(&2).unwrap(), 2);
     /// ```
-    pub fn insert(&self, key: T) -> Entry<'_, T> {
+    pub fn insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.insert(key, ()))
     }
 
@@ -313,9 +325,9 @@ where
     /// assert_eq!(*set.remove(&2).unwrap(), 2);
     /// assert!(set.remove(&2).is_none());
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.remove(key).map(Entry::new)
@@ -342,7 +354,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_front().map(Entry::new)
     }
 
@@ -367,7 +379,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_back().map(Entry::new)
     }
 
@@ -396,34 +408,35 @@ impl<T> Default for SkipSet<T> {
     }
 }
 
-impl<T> fmt::Debug for SkipSet<T>
+impl<T, C> fmt::Debug for SkipSet<T, C>
 where
-    T: Ord + fmt::Debug,
+    T: fmt::Debug,
+    C: Comparator<T>,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("SkipSet { .. }")
     }
 }
 
-impl<T> IntoIterator for SkipSet<T> {
+impl<T, C> IntoIterator for SkipSet<T, C> {
     type Item = T;
-    type IntoIter = IntoIter<T>;
+    type IntoIter = IntoIter<T, C>;
 
-    fn into_iter(self) -> IntoIter<T> {
+    fn into_iter(self) -> IntoIter<T, C> {
         IntoIter {
             inner: self.inner.into_iter(),
         }
     }
 }
 
-impl<'a, T> IntoIterator for &'a SkipSet<T>
+impl<'a, T, C> IntoIterator for &'a SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    type Item = Entry<'a, T>;
-    type IntoIter = Iter<'a, T>;
+    type Item = Entry<'a, T, C>;
+    type IntoIter = Iter<'a, T, C>;
 
-    fn into_iter(self) -> Iter<'a, T> {
+    fn into_iter(self) -> Iter<'a, T, C> {
         self.iter()
     }
 }
@@ -445,12 +458,12 @@ where
 }
 
 /// A reference-counted entry in a set.
-pub struct Entry<'a, T> {
-    inner: map::Entry<'a, T, ()>,
+pub struct Entry<'a, T, C = BasicComparator> {
+    inner: map::Entry<'a, T, (), C>,
 }
 
-impl<'a, T> Entry<'a, T> {
-    fn new(inner: map::Entry<'a, T, ()>) -> Self {
+impl<'a, T, C> Entry<'a, T, C> {
+    fn new(inner: map::Entry<'a, T, (), C>) -> Self {
         Self { inner }
     }
 
@@ -465,9 +478,9 @@ impl<'a, T> Entry<'a, T> {
     }
 }
 
-impl<'a, T> Entry<'a, T>
+impl<'a, T, C> Entry<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
     /// Moves to the next entry in the set.
     pub fn move_next(&mut self) -> bool {
@@ -480,19 +493,20 @@ where
     }
 
     /// Returns the next entry in the set.
-    pub fn next(&self) -> Option<Entry<'a, T>> {
+    pub fn next(&self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 
     /// Returns the previous entry in the set.
-    pub fn prev(&self) -> Option<Entry<'a, T>> {
+    pub fn prev(&self) -> Option<Entry<'a, T, C>> {
         self.inner.prev().map(Entry::new)
     }
 }
 
-impl<T> Entry<'_, T>
+impl<T, C> Entry<'_, T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T>,
 {
     /// Removes the entry from the set.
     ///
@@ -502,7 +516,7 @@ where
     }
 }
 
-impl<T> Clone for Entry<'_, T> {
+impl<T, C> Clone for Entry<'_, T, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -510,7 +524,7 @@ impl<T> Clone for Entry<'_, T> {
     }
 }
 
-impl<T> fmt::Debug for Entry<'_, T>
+impl<T, C> fmt::Debug for Entry<'_, T, C>
 where
     T: fmt::Debug,
 {
@@ -521,7 +535,7 @@ where
     }
 }
 
-impl<T> Deref for Entry<'_, T> {
+impl<T, C> Deref for Entry<'_, T, C> {
     type Target = T;
 
     fn deref(&self) -> &Self::Target {
@@ -530,11 +544,11 @@ impl<T> Deref for Entry<'_, T> {
 }
 
 /// An owning iterator over the entries of a `SkipSet`.
-pub struct IntoIter<T> {
-    inner: map::IntoIter<T, ()>,
+pub struct IntoIter<T, C = BasicComparator> {
+    inner: map::IntoIter<T, (), C>,
 }
 
-impl<T> Iterator for IntoIter<T> {
+impl<T, C> Iterator for IntoIter<T, C> {
     type Item = T;
 
     fn next(&mut self) -> Option<T> {
@@ -542,80 +556,81 @@ impl<T> Iterator for IntoIter<T> {
     }
 }
 
-impl<T> fmt::Debug for IntoIter<T> {
+impl<T, C> fmt::Debug for IntoIter<T, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("IntoIter { .. }")
     }
 }
 
 /// An iterator over the entries of a `SkipSet`.
-pub struct Iter<'a, T> {
-    inner: map::Iter<'a, T, ()>,
+pub struct Iter<'a, T, C = BasicComparator> {
+    inner: map::Iter<'a, T, (), C>,
 }
 
-impl<'a, T> Iterator for Iter<'a, T>
+impl<'a, T, C> Iterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, T> DoubleEndedIterator for Iter<'a, T>
+impl<'a, T, C> DoubleEndedIterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<T> fmt::Debug for Iter<'_, T> {
+impl<T, C> fmt::Debug for Iter<'_, T, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
 /// An iterator over a subset of entries of a `SkipSet`.
-pub struct Range<'a, Q, R, T>
+pub struct Range<'a, Q, R, T, C = BasicComparator>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    inner: map::Range<'a, Q, R, T, ()>,
+    inner: map::Range<'a, Q, R, T, (), C>,
 }
 
-impl<'a, Q, R, T> Iterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> Iterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, Q, R, T> DoubleEndedIterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> DoubleEndedIterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<Q, R, T> fmt::Debug for Range<'_, Q, R, T>
+impl<Q, R, T, C> fmt::Debug for Range<'_, Q, R, T, C>
 where
-    T: Ord + Comparable<Q> + fmt::Debug,
+    T: fmt::Debug,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/tests/comparator.rs b/crossbeam-skiplist/tests/comparator.rs
new file mode 100644
index 0000000..7f2ddba
--- /dev/null
+++ b/crossbeam-skiplist/tests/comparator.rs
@@ -0,0 +1,109 @@
+use crossbeam_skiplist::{
+    SkipMap, SkipSet,
+    base::SkipList,
+    comparator::{Comparator, Equivalator},
+};
+use std::cmp::Ordering;
+use std::ops::Bound::{Excluded, Included};
+
+struct CaseSensitivity(bool);
+impl<R: AsRef<str> + ?Sized> Equivalator<String, R> for CaseSensitivity {
+    fn equivalent(&self, lhs: &String, rhs: &R) -> bool {
+        self.compare(lhs, rhs) == Ordering::Equal
+    }
+}
+impl<R: AsRef<str> + ?Sized> Comparator<String, R> for CaseSensitivity {
+    fn compare(&self, lhs: &String, rhs: &R) -> Ordering {
+        if self.0 {
+            lhs.as_str().cmp(rhs.as_ref())
+        } else {
+            lhs.to_lowercase().cmp(&rhs.as_ref().to_lowercase())
+        }
+    }
+}
+
+#[test]
+fn case_insensitive_map() {
+    let map = SkipMap::with_comparator(CaseSensitivity(false));
+    map.insert("abc".to_owned(), 1);
+    map.insert("ABC".to_owned(), 2);
+    assert_eq!(map.len(), 1);
+    assert_eq!(*map.get("aBc").unwrap().value(), 2);
+    assert_eq!(*map.get_or_insert("AbC".to_owned(), 3).value(), 2);
+    map.insert("DEF".to_owned(), 4);
+    map.insert("ghi".to_owned(), 5);
+    assert_eq!(map.lower_bound(Included("dEf")).unwrap().key(), "DEF");
+    assert_eq!(map.upper_bound(Excluded("GHI")).unwrap().key(), "DEF");
+    let mut range = map.range::<str, _>((Included("ABC"), Excluded("ghi")));
+    assert_eq!(*range.next().unwrap().value(), 2);
+    assert_eq!(*range.next_back().unwrap().value(), 4);
+    assert!(range.next().is_none());
+    let first = map.front().unwrap();
+    assert_eq!(first.next().unwrap().key(), "DEF");
+    assert_eq!(map.back().unwrap().prev().unwrap().key(), "DEF");
+    assert_eq!(*map.remove("aBc").unwrap().value(), 2);
+    assert!(!map.contains_key("ABC"));
+    map.clear();
+    assert!(map.is_empty());
+    let sensitive = SkipMap::with_comparator(CaseSensitivity(true));
+    sensitive.insert("abc".to_owned(), 1);
+    sensitive.insert("ABC".to_owned(), 2);
+    assert_eq!(sensitive.len(), 2);
+}
+
+#[test]
+fn case_insensitive_set() {
+    let set = SkipSet::with_comparator(CaseSensitivity(false));
+    set.insert("abc".to_owned());
+    set.insert("ABC".to_owned());
+    set.insert("DEF".to_owned());
+    assert_eq!(set.len(), 2);
+    assert!(set.contains("aBc"));
+    assert_eq!(
+        set.range::<str, _>((Included("ABC"), Included("def")))
+            .count(),
+        2
+    );
+    assert!(set.remove("AbC").is_some());
+    assert_eq!(set.pop_back().unwrap().value(), "DEF");
+    assert!(set.is_empty());
+}
+
+// Deliberately has no Ord, PartialOrd, Eq or PartialEq implementation.
+struct Key(i32);
+
+#[test]
+fn boxed_closure_and_unordered_keys() {
+    let compare: Box<dyn Fn(&Key, &Key) -> Ordering> = Box::new(|a, b| b.0.cmp(&a.0));
+    let map = SkipMap::with_comparator(compare);
+    for n in 0..100 {
+        map.insert(Key(n), n);
+    }
+    assert_eq!(
+        map.iter().map(|e| *e.value()).collect::<Vec<_>>(),
+        (0..100).rev().collect::<Vec<_>>()
+    );
+    assert_eq!(map.iter().rev().count(), 100);
+    assert_eq!(map.range(Key(80)..=Key(20)).count(), 61);
+    let entry = map.get(&Key(50)).unwrap();
+    assert!(entry.remove());
+    assert!(map.get(&Key(50)).is_none());
+    drop(entry);
+    assert_eq!(map.into_iter().count(), 99);
+}
+
+#[test]
+fn base_comparator() {
+    let collector = crossbeam_epoch::Collector::new();
+    let handle = collector.register();
+    let guard = &handle.pin();
+    let list = SkipList::with_comparator(collector.clone(), CaseSensitivity(false));
+    list.insert("ABC".to_owned(), 1, guard);
+    assert!(list.get("abc", guard).is_some());
+    assert_eq!(
+        list.range::<str, _>((Included("aBc"), Included("AbC")), guard)
+            .count(),
+        1
+    );
+    assert!(list.remove("abc", guard).is_some());
+}
```

</details>

<details><summary>reply</summary>

Done.
Added runtime comparators, boxed closures, heterogeneous queries, and comparator parameters throughout. Default ordering preserved. Tests and alloc-only checks passed.

</details>

### codex, sloth: pass

Files: [crossbeam-skiplist/src/base.rs](../sloth/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/base.rs), [crossbeam-skiplist/src/comparator.rs](../sloth/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/comparator.rs), [crossbeam-skiplist/src/lib.rs](../sloth/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/lib.rs), [crossbeam-skiplist/src/map.rs](../sloth/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/map.rs), [crossbeam-skiplist/src/set.rs](../sloth/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/set.rs), [crossbeam-skiplist/tests/base.rs](../sloth/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/tests/base.rs), [crossbeam-skiplist/tests/map.rs](../sloth/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/tests/map.rs), [crossbeam-skiplist/tests/set.rs](../sloth/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/tests/set.rs)

<details><summary>diff</summary>

```diff
diff --git a/crossbeam-skiplist/src/base.rs b/crossbeam-skiplist/src/base.rs
index a73ee8a..baa4339 100644
--- a/crossbeam-skiplist/src/base.rs
+++ b/crossbeam-skiplist/src/base.rs
@@ -15,8 +15,8 @@ use core::{
 use crossbeam_epoch::{self as epoch, Atomic, Collector, Guard, Shared};
 use crossbeam_utils::CachePadded;
 
-use super::equivalent::Comparable;
 use crate::alloc_helper::Global;
+use crate::comparator::{BasicComparator, Comparator};
 
 /// Number of bits needed to store height.
 const HEIGHT_BITS: usize = 5;
@@ -304,7 +304,7 @@ impl<'a, K, V> NodeRef<'a, K, V> {
     /// Decrements the reference count of a node, pinning the thread and destroying the node
     /// if the count become zero.
     #[inline]
-    unsafe fn decrement_with_pin<F>(self, parent: &SkipList<K, V>, pin: F)
+    unsafe fn decrement_with_pin<F, C>(self, parent: &SkipList<K, V, C>, pin: F)
     where
         F: FnOnce() -> Guard,
     {
@@ -463,26 +463,35 @@ struct HotData {
 // As a further future optimization, if `!mem::needs_drop::<K>() && !mem::needs_drop::<V>()`
 // (neither key nor the value have destructors), there's no point in creating a new local
 // collector, so we should simply use the global one.
-pub struct SkipList<K, V> {
+pub struct SkipList<K, V, C = BasicComparator> {
     /// The head of the skip list (just a dummy node, not a real entry).
     head: Head<K, V>,
 
     /// The `Collector` associated with this skip list.
     collector: Collector,
+    comparator: C,
 
     /// Hot data associated with the skip list, stored in a dedicated cache line.
     hot_data: CachePadded<HotData>,
 }
 
-unsafe impl<K: Send + Sync, V: Send + Sync> Send for SkipList<K, V> {}
-unsafe impl<K: Send + Sync, V: Send + Sync> Sync for SkipList<K, V> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Send + Sync> Send for SkipList<K, V, C> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Sync> Sync for SkipList<K, V, C> {}
 
 impl<K, V> SkipList<K, V> {
     /// Returns a new, empty skip list.
     pub fn new(collector: Collector) -> Self {
+        Self::with_comparator(collector, BasicComparator)
+    }
+}
+
+impl<K, V, C> SkipList<K, V, C> {
+    /// Returns an empty skip list with the given comparator.
+    pub fn with_comparator(collector: Collector, comparator: C) -> Self {
         Self {
             head: Head::new(),
             collector,
+            comparator,
             hot_data: CachePadded::new(HotData {
                 seed: AtomicUsize::new(1),
                 len: AtomicUsize::new(0),
@@ -517,12 +526,12 @@ impl<K, V> SkipList<K, V> {
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Returns the entry with the smallest key.
-    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.next_node(self.head.as_tower(), Bound::Unbounded, guard)?;
         Some(Entry {
@@ -533,7 +542,7 @@ where
     }
 
     /// Returns the entry with the largest key.
-    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.search_bound::<K>(Bound::Unbounded, true, guard)?;
         Some(Entry {
@@ -546,21 +555,21 @@ where
     /// Returns `true` if the map contains a value for the specified key.
     pub fn contains_key<Q>(&self, key: &Q, guard: &Guard) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.get(key, guard).is_some()
     }
 
     /// Returns an entry with the specified `key`.
-    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>>
+    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
         let n = self.search_bound(Bound::Included(key), false, guard)?;
-        if !n.key.equivalent(key) {
+        if !self.comparator.equivalent(&n.key, key) {
             return None;
         }
 
@@ -578,9 +587,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -599,9 +608,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -614,7 +623,7 @@ where
     }
 
     /// Finds an entry with the specified key, or inserts a new `key`-`value` pair if none exist.
-    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| false, guard)
     }
 
@@ -626,7 +635,7 @@ where
     /// discarded. If closure is modifying some other state (such as shared counters or shared
     /// objects), it may lead to <u>undesired behaviour</u> such as counters being changed without
     /// result of closure inserted
-    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -634,7 +643,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V> {
+    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V, C> {
         self.check_guard(guard);
         Iter {
             parent: self,
@@ -645,7 +654,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn ref_iter(&self) -> RefIter<'_, K, V> {
+    pub fn ref_iter(&self) -> RefIter<'_, K, V, C> {
         RefIter {
             parent: self,
             head: None,
@@ -658,9 +667,9 @@ where
         &'a self,
         range: R,
         guard: &'g Guard,
-    ) -> Range<'a, 'g, Q, R, K, V>
+    ) -> Range<'a, 'g, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -677,9 +686,9 @@ where
 
     /// Returns an iterator over a subset of entries in the skip list.
     #[allow(clippy::needless_lifetimes)]
-    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V>
+    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -825,7 +834,7 @@ where
         guard: &'a Guard,
     ) -> Option<NodeRef<'a, K, V>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -887,11 +896,11 @@ where
                         // bound, we return the last node before the condition became true. For the
                         // lower bound, we return the first node after the condition became true.
                         if upper_bound {
-                            if !below_upper_bound(&bound, &c.key) {
+                            if !below_upper_bound(&self.comparator, &bound, &c.key) {
                                 break;
                             }
                             result = Some(c);
-                        } else if above_lower_bound(&bound, &c.key) {
+                        } else if above_lower_bound(&self.comparator, &bound, &c.key) {
                             result = Some(c);
                             break;
                         }
@@ -910,7 +919,7 @@ where
     /// Searches for a key in the skip list and returns a list of all adjacent nodes.
     fn search_position<'a, Q>(&'a self, key: &Q, guard: &'a Guard) -> Position<'a, K, V>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -971,7 +980,7 @@ where
 
                         // If `curr` contains a key that is greater than or equal to `key`, we're
                         // done with this level.
-                        match c.key.compare(key) {
+                        match self.comparator.compare(&c.key, key) {
                             cmp::Ordering::Greater => break,
                             cmp::Ordering::Equal => {
                                 result.found = Some(c);
@@ -1004,7 +1013,7 @@ where
         value: F,
         replace: CompareF,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
         CompareF: Fn(&V) -> bool,
@@ -1155,7 +1164,10 @@ where
                     // the tower without breaking any invariants. Note that building higher levels
                     // is completely optional. Only the lowest level really matters, and all the
                     // higher levels are there just to make searching faster.
-                    if succ.as_ref().map(|s| &s.key) == Some(&n.key) {
+                    if succ
+                        .as_ref()
+                        .is_some_and(|s| self.comparator.equivalent(&s.key, &n.key))
+                    {
                         search = self.search_position(&n.key, guard);
                         continue;
                     }
@@ -1218,16 +1230,17 @@ where
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the skip list and returns the new entry.
     ///
     /// If there is an existing entry with this key, it will be removed before inserting the new
     /// one.
-    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| true, guard)
     }
 
@@ -1242,7 +1255,7 @@ where
         value: V,
         compare_fn: F,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -1250,9 +1263,9 @@ where
     }
 
     /// Removes an entry with the specified `key` from the map and returns it.
-    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -1320,7 +1333,7 @@ where
     }
 
     /// Removes an entry from the front of the skip list.
-    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.front(guard)?;
@@ -1335,7 +1348,7 @@ where
     }
 
     /// Removes an entry from the back of the skip list.
-    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.back(guard)?;
@@ -1393,7 +1406,7 @@ where
     }
 }
 
-impl<K, V> Drop for SkipList<K, V> {
+impl<K, V, C> Drop for SkipList<K, V, C> {
     fn drop(&mut self) {
         unsafe {
             let mut node = NodeRef::from_shared(
@@ -1419,9 +1432,10 @@ impl<K, V> Drop for SkipList<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipList<K, V>
+impl<K, V, C> fmt::Debug for SkipList<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
+    C: Comparator<K>,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -1429,11 +1443,11 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipList<K, V> {
+impl<K, V, C> IntoIterator for SkipList<K, V, C> {
     type Item = (K, V);
-    type IntoIter = IntoIter<K, V>;
+    type IntoIter = IntoIter<K, V, C>;
 
-    fn into_iter(self) -> IntoIter<K, V> {
+    fn into_iter(self) -> IntoIter<K, V, C> {
         unsafe {
             // Load the front node.
             //
@@ -1454,6 +1468,7 @@ impl<K, V> IntoIterator for SkipList<K, V> {
 
             IntoIter {
                 node: front as *mut Node<K, V>,
+                _marker: PhantomData,
             }
         }
     }
@@ -1464,13 +1479,13 @@ impl<K, V> IntoIterator for SkipList<K, V> {
 /// The lifetimes of the key and value are the same as that of the `Guard`
 /// used when creating the `Entry` (`'g`). This lifetime is also constrained to
 /// not outlive the `SkipList`.
-pub struct Entry<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Entry<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'g, K, V>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Entry<'a, 'g, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1487,7 +1502,7 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1496,14 +1511,15 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     ///
     /// This method may return `None` if the reference count is already 0 and
     /// the node has been queued for deletion.
-    pub fn pin(&self) -> Option<RefEntry<'a, K, V>> {
+    pub fn pin(&self) -> Option<RefEntry<'a, K, V, C>> {
         unsafe { RefEntry::try_acquire(self.parent, self.node) }
     }
 }
 
-impl<K, V> Entry<'_, '_, K, V>
+impl<K, V, C> Entry<'_, '_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1526,7 +1542,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, '_, K, V> {
+impl<K, V, C> Clone for Entry<'_, '_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             parent: self.parent,
@@ -1536,7 +1552,7 @@ impl<K, V> Clone for Entry<'_, '_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1549,9 +1565,9 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K, V> Entry<'a, 'g, K, V>
+impl<'a: 'g, 'g, K, V, C> Entry<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self) -> bool {
@@ -1565,7 +1581,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self.parent.next_node(
             self.node.as_tower(),
             Bound::Excluded(&self.node.key),
@@ -1590,7 +1606,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self
             .parent
             .search_bound(Bound::Excluded(&self.node.key), true, self.guard)?;
@@ -1606,12 +1622,12 @@ where
 ///
 /// You *must* call `release` to free this type, otherwise the node will be
 /// leaked. This is because releasing the entry requires a `Guard`.
-pub struct RefEntry<'a, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct RefEntry<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'a, K, V>,
 }
 
-impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefEntry<'a, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1628,7 +1644,7 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1650,9 +1666,9 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     /// Tries to create a new `RefEntry` by incrementing the reference count of
     /// a node.
     unsafe fn try_acquire(
-        parent: &'a SkipList<K, V>,
+        parent: &'a SkipList<K, V, C>,
         node: NodeRef<'_, K, V>,
-    ) -> Option<RefEntry<'a, K, V>> {
+    ) -> Option<RefEntry<'a, K, V, C>> {
         if unsafe { node.try_increment() } {
             Some(RefEntry {
                 parent,
@@ -1667,9 +1683,10 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 }
 
-impl<K, V> RefEntry<'_, K, V>
+impl<K, V, C> RefEntry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1694,7 +1711,7 @@ where
     }
 }
 
-impl<K, V> Clone for RefEntry<'_, K, V> {
+impl<K, V, C> Clone for RefEntry<'_, K, V, C> {
     fn clone(&self) -> Self {
         unsafe {
             // Incrementing will always succeed since we're already holding a reference to the node.
@@ -1707,7 +1724,7 @@ impl<K, V> Clone for RefEntry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for RefEntry<'_, K, V>
+impl<K, V, C> fmt::Debug for RefEntry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1720,9 +1737,9 @@ where
     }
 }
 
-impl<'a, K, V> RefEntry<'a, K, V>
+impl<'a, K, V, C> RefEntry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self, guard: &Guard) -> bool {
@@ -1736,7 +1753,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1763,7 +1780,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1780,20 +1797,20 @@ where
 }
 
 /// An iterator over the entries of a `SkipList`.
-pub struct Iter<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Iter<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Iterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Iterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1804,7 +1821,7 @@ where
             }
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1817,11 +1834,11 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> DoubleEndedIterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> DoubleEndedIterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -1831,7 +1848,7 @@ where
                 .search_bound::<K>(Bound::Unbounded, true, self.guard),
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1844,7 +1861,7 @@ where
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Iter<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1858,13 +1875,13 @@ where
 }
 
 /// An iterator over reference-counted entries of a `SkipList`.
-pub struct RefIter<'a, K, V> {
-    parent: &'a SkipList<K, V>,
-    head: Option<RefEntry<'a, K, V>>,
-    tail: Option<RefEntry<'a, K, V>>,
+pub struct RefIter<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
+    head: Option<RefEntry<'a, K, V, C>>,
+    tail: Option<RefEntry<'a, K, V, C>>,
 }
 
-impl<K, V> fmt::Debug for RefIter<'_, K, V>
+impl<K, V, C> fmt::Debug for RefIter<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1883,12 +1900,12 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V>
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match &self.head {
             Some(e) => e.next(guard),
@@ -1896,7 +1913,9 @@ where
         };
         match (&next_head, &self.tail) {
             // The next key is larger than the latest tail key we observed with this iterator.
-            (Some(ref next), Some(t)) if next.key() >= t.key() => {
+            (Some(ref next), Some(t))
+                if self.parent.comparator.compare(next.key(), t.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1915,7 +1934,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match &self.tail {
             Some(e) => e.prev(guard),
@@ -1923,7 +1942,9 @@ where
         };
         match (&self.head, &next_tail) {
             // The prev key is smaller than the latest head key we observed with this iterator.
-            (Some(h), Some(next)) if h.key() >= next.key() => {
+            (Some(h), Some(next))
+                if self.parent.comparator.compare(h.key(), next.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1942,7 +1963,7 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C> {
     /// Decrements the reference count of `RefEntry` owned by the iterator.
     pub fn drop_impl(&mut self, guard: &Guard) {
         self.parent.check_guard(guard);
@@ -1956,13 +1977,13 @@ impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipList`.
-pub struct Range<'a: 'g, 'g, Q, R, K, V>
+pub struct Range<'a: 'g, 'g, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     range: R,
@@ -1970,15 +1991,15 @@ where
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> Iterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> Iterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1991,14 +2012,14 @@ where
             match self.tail {
                 Some(t) => {
                     let bound = Bound::Excluded(&t.as_ref().key);
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2013,13 +2034,13 @@ where
     }
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -2032,14 +2053,14 @@ where
             match self.head {
                 Some(h) => {
                     let bound = Bound::Excluded(&h.as_ref().key);
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2054,9 +2075,10 @@ where
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, '_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, '_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2071,38 +2093,39 @@ where
 }
 
 /// An iterator over reference-counted subset of entries of a `SkipList`.
-pub struct RefRange<'a, Q, R, K, V>
+pub struct RefRange<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
-    pub(crate) head: Option<RefEntry<'a, K, V>>,
-    pub(crate) tail: Option<RefEntry<'a, K, V>>,
+    parent: &'a SkipList<K, V, C>,
+    pub(crate) head: Option<RefEntry<'a, K, V, C>>,
+    pub(crate) tail: Option<RefEntry<'a, K, V, C>>,
     pub(crate) range: R,
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-unsafe impl<Q, R, K, V> Send for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K: Send + Sync, V: Send + Sync, C: Sync> Send for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
-    R: RangeBounds<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
+    R: RangeBounds<Q> + Send,
     Q: ?Sized,
 {
 }
 
-unsafe impl<Q, R, K, V> Sync for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K: Send + Sync, V: Send + Sync, C: Sync> Sync for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
-    R: RangeBounds<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
+    R: RangeBounds<Q> + Sync,
     Q: ?Sized,
 {
 }
 
-impl<Q, R, K, V> fmt::Debug for RefRange<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2116,14 +2139,14 @@ where
     }
 }
 
-impl<'a, Q, R, K: 'a, V: 'a> RefRange<'a, Q, R, K, V>
+impl<'a, Q, R, K: 'a, V: 'a, C> RefRange<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match self.head {
             Some(ref e) => e.next(guard),
@@ -2134,7 +2157,7 @@ where
             match self.tail {
                 Some(ref t) => {
                     let bound = Bound::Excluded(t.key());
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2150,7 +2173,7 @@ where
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2171,7 +2194,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match self.tail {
             Some(ref e) => e.prev(guard),
@@ -2182,7 +2205,7 @@ where
             match self.head {
                 Some(ref h) => {
                     let bound = Bound::Excluded(h.key());
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2198,7 +2221,7 @@ where
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2231,14 +2254,15 @@ where
 }
 
 /// An owning iterator over the entries of a `SkipList`.
-pub struct IntoIter<K, V> {
+pub struct IntoIter<K, V, C = BasicComparator> {
+    _marker: PhantomData<C>,
     /// The current node.
     ///
     /// All preceding nods have already been destroyed.
     node: *mut Node<K, V>,
 }
 
-impl<K, V> Drop for IntoIter<K, V> {
+impl<K, V, C> Drop for IntoIter<K, V, C> {
     fn drop(&mut self) {
         // Iterate through the whole chain and destroy every node.
         while let Some(node) = NonNull::new(self.node) {
@@ -2260,7 +2284,7 @@ impl<K, V> Drop for IntoIter<K, V> {
     }
 }
 
-impl<K, V> Iterator for IntoIter<K, V> {
+impl<K, V, C> Iterator for IntoIter<K, V, C> {
     type Item = (K, V);
 
     fn next(&mut self) -> Option<(K, V)> {
@@ -2299,7 +2323,7 @@ impl<K, V> Iterator for IntoIter<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for IntoIter<K, V> {
+impl<K, V, C> fmt::Debug for IntoIter<K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("IntoIter { .. }")
     }
@@ -2307,9 +2331,9 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 
 /// Helper function to retry an operation until pinning succeeds or `None` is
 /// returned.
-pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V>(mut f: F) -> Option<RefEntry<'a, K, V>>
+pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V, C>(mut f: F) -> Option<RefEntry<'a, K, V, C>>
 where
-    F: FnMut() -> Option<Entry<'a, 'g, K, V>>,
+    F: FnMut() -> Option<Entry<'a, 'g, K, V, C>>,
 {
     loop {
         if let Some(e) = f()?.pin() {
@@ -2319,27 +2343,27 @@ where
 }
 
 /// Helper function to check if a value is above a lower bound
-fn above_lower_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn above_lower_bound<V, T, C>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_ge(),
-        Bound::Excluded(key) => other.compare(key).is_gt(),
+        Bound::Included(key) => comparator.compare(other, key).is_ge(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_gt(),
     }
 }
 
 /// Helper function to check if a value is below an upper bound
-fn below_upper_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn below_upper_bound<V, T, C>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_le(),
-        Bound::Excluded(key) => other.compare(key).is_lt(),
+        Bound::Included(key) => comparator.compare(other, key).is_le(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_lt(),
     }
 }
diff --git a/crossbeam-skiplist/src/comparator.rs b/crossbeam-skiplist/src/comparator.rs
new file mode 100644
index 0000000..3f36d38
--- /dev/null
+++ b/crossbeam-skiplist/src/comparator.rs
@@ -0,0 +1,52 @@
+//! Runtime key comparison for skip lists.
+
+use crate::equivalent::{Comparable, Equivalent};
+use core::cmp::Ordering;
+
+/// Tests whether stored and query keys are equivalent.
+/// Equivalence must agree with equality under the comparator's ordering.
+pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
+    /// Returns whether the keys are equivalent.
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
+}
+
+/// Orders stored and query keys consistently with the stored-key ordering.
+/// The ordering must be a total order and remain stable while keys are stored.
+pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
+    /// Returns the ordering of the keys.
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
+}
+
+/// Uses the key type's existing equivalence and ordering.
+#[derive(Clone, Copy, Debug, Default)]
+pub struct BasicComparator;
+
+impl<L: ?Sized + Equivalent<R>, R: ?Sized> Equivalator<L, R> for BasicComparator {
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
+        lhs.equivalent(rhs)
+    }
+}
+
+impl<L: ?Sized + Comparable<R>, R: ?Sized> Comparator<L, R> for BasicComparator {
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
+        lhs.compare(rhs)
+    }
+}
+
+impl<L: ?Sized, R: ?Sized, F> Equivalator<L, R> for F
+where
+    F: Fn(&L, &R) -> Ordering,
+{
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
+        self(lhs, rhs).is_eq()
+    }
+}
+
+impl<L: ?Sized, R: ?Sized, F> Comparator<L, R> for F
+where
+    F: Fn(&L, &R) -> Ordering,
+{
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
+        self(lhs, rhs)
+    }
+}
diff --git a/crossbeam-skiplist/src/lib.rs b/crossbeam-skiplist/src/lib.rs
index 5ff8e74..252c0aa 100644
--- a/crossbeam-skiplist/src/lib.rs
+++ b/crossbeam-skiplist/src/lib.rs
@@ -266,3 +266,5 @@ pub mod set;
 pub use crate::{map::SkipMap, set::SkipSet};
 
 pub mod equivalent;
+
+pub mod comparator;
diff --git a/crossbeam-skiplist/src/map.rs b/crossbeam-skiplist/src/map.rs
index c7c5408..20c4faa 100644
--- a/crossbeam-skiplist/src/map.rs
+++ b/crossbeam-skiplist/src/map.rs
@@ -11,7 +11,7 @@ use crossbeam_epoch as epoch;
 
 use crate::{
     base::{self, try_pin_loop},
-    equivalent::Comparable,
+    comparator::{BasicComparator, Comparator},
 };
 
 /// An ordered map based on a lock-free skip list.
@@ -20,8 +20,8 @@ use crate::{
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeMap`]: std::collections::BTreeMap
-pub struct SkipMap<K, V> {
-    inner: base::SkipList<K, V>,
+pub struct SkipMap<K, V, C = BasicComparator> {
+    inner: base::SkipList<K, V, C>,
 }
 
 impl<K, V> SkipMap<K, V> {
@@ -39,6 +39,15 @@ impl<K, V> SkipMap<K, V> {
             inner: base::SkipList::new(epoch::default_collector().clone()),
         }
     }
+}
+
+impl<K, V, C> SkipMap<K, V, C> {
+    /// Returns an empty map with the given comparator.
+    pub fn with_comparator(comparator: C) -> Self {
+        Self {
+            inner: base::SkipList::with_comparator(epoch::default_collector().clone(), comparator),
+        }
+    }
 
     /// Returns `true` if the map is empty.
     ///
@@ -80,9 +89,9 @@ impl<K, V> SkipMap<K, V> {
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -99,7 +108,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.front().unwrap().value(), "five");
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.front(guard)).map(Entry::new)
     }
@@ -119,7 +128,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.back().unwrap().value(), "six");
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.back(guard)).map(Entry::new)
     }
@@ -138,7 +147,7 @@ where
     /// ```
     pub fn contains_key<Q>(&self, key: &Q) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -160,9 +169,9 @@ where
     /// numbers.insert("six", 6);
     /// assert_eq!(*numbers.get("six").unwrap().value(), 6);
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -195,9 +204,9 @@ where
     /// let greater_than_thirteen = numbers.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -227,9 +236,9 @@ where
     /// let less_than_six = numbers.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -253,7 +262,7 @@ where
     /// let jobs_age = ages.get_or_insert("Steve Jobs", -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.get_or_insert(key, value, guard))
     }
@@ -283,7 +292,7 @@ where
     /// let jobs_age = ages.get_or_insert_with("Steve Jobs", || -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -313,7 +322,7 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn iter(&self) -> Iter<'_, K, V> {
+    pub fn iter(&self) -> Iter<'_, K, V, C> {
         Iter {
             inner: self.inner.ref_iter(),
         }
@@ -340,10 +349,10 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V, C>
     where
         R: RangeBounds<Q>,
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         Range {
@@ -352,9 +361,10 @@ where
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the map and returns the new entry.
@@ -374,7 +384,7 @@ where
     ///
     /// assert_eq!(*map.get("key").unwrap().value(), "value");
     /// ```
-    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.insert(key, value, guard))
     }
@@ -401,7 +411,7 @@ where
     /// map.compare_insert("absent_key", 0, |_| false);
     /// assert_eq!(*map.get("absent_key").unwrap().value(), 0);
     /// ```
-    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V>
+    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -427,9 +437,9 @@ where
     /// map.insert("key", "value");
     /// assert_eq!(*map.remove("key").unwrap().value(), "value");
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -458,7 +468,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_front(guard).map(Entry::new)
     }
@@ -485,7 +495,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_back(guard).map(Entry::new)
     }
@@ -515,9 +525,10 @@ impl<K, V> Default for SkipMap<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipMap<K, V>
+impl<K, V, C> fmt::Debug for SkipMap<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    K: fmt::Debug,
+    C: Comparator<K>,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -525,25 +536,25 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipMap<K, V> {
+impl<K, V, C> IntoIterator for SkipMap<K, V, C> {
     type Item = (K, V);
-    type IntoIter = IntoIter<K, V>;
+    type IntoIter = IntoIter<K, V, C>;
 
-    fn into_iter(self) -> IntoIter<K, V> {
+    fn into_iter(self) -> IntoIter<K, V, C> {
         IntoIter {
             inner: self.inner.into_iter(),
         }
     }
 }
 
-impl<'a, K, V> IntoIterator for &'a SkipMap<K, V>
+impl<'a, K, V, C> IntoIterator for &'a SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, K, V>;
-    type IntoIter = Iter<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
+    type IntoIter = Iter<'a, K, V, C>;
 
-    fn into_iter(self) -> Iter<'a, K, V> {
+    fn into_iter(self) -> Iter<'a, K, V, C> {
         self.iter()
     }
 }
@@ -565,12 +576,12 @@ where
 }
 
 /// A reference-counted entry in a map.
-pub struct Entry<'a, K, V> {
-    inner: ManuallyDrop<base::RefEntry<'a, K, V>>,
+pub struct Entry<'a, K, V, C = BasicComparator> {
+    inner: ManuallyDrop<base::RefEntry<'a, K, V, C>>,
 }
 
-impl<'a, K, V> Entry<'a, K, V> {
-    fn new(inner: base::RefEntry<'a, K, V>) -> Self {
+impl<'a, K, V, C> Entry<'a, K, V, C> {
+    fn new(inner: base::RefEntry<'a, K, V, C>) -> Self {
         Self {
             inner: ManuallyDrop::new(inner),
         }
@@ -592,7 +603,7 @@ impl<'a, K, V> Entry<'a, K, V> {
     }
 }
 
-impl<K, V> Drop for Entry<'_, K, V> {
+impl<K, V, C> Drop for Entry<'_, K, V, C> {
     fn drop(&mut self) {
         unsafe {
             ManuallyDrop::into_inner(ptr::read(&self.inner)).release_with_pin(epoch::pin);
@@ -600,9 +611,9 @@ impl<K, V> Drop for Entry<'_, K, V> {
     }
 }
 
-impl<'a, K, V> Entry<'a, K, V>
+impl<'a, K, V, C> Entry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the map.
     pub fn move_next(&mut self) -> bool {
@@ -617,21 +628,22 @@ where
     }
 
     /// Returns the next entry in the map.
-    pub fn next(&self) -> Option<Entry<'a, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 
     /// Returns the previous entry in the map.
-    pub fn prev(&self) -> Option<Entry<'a, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.prev(guard).map(Entry::new)
     }
 }
 
-impl<K, V> Entry<'_, K, V>
+impl<K, V, C> Entry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    K: Send + 'static,
+    C: Comparator<K>,
     V: Send + 'static,
 {
     /// Removes the entry from the map.
@@ -643,7 +655,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, K, V> {
+impl<K, V, C> Clone for Entry<'_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -651,7 +663,7 @@ impl<K, V> Clone for Entry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -665,11 +677,11 @@ where
 }
 
 /// An owning iterator over the entries of a `SkipMap`.
-pub struct IntoIter<K, V> {
-    inner: base::IntoIter<K, V>,
+pub struct IntoIter<K, V, C = BasicComparator> {
+    inner: base::IntoIter<K, V, C>,
 }
 
-impl<K, V> Iterator for IntoIter<K, V> {
+impl<K, V, C> Iterator for IntoIter<K, V, C> {
     type Item = (K, V);
 
     fn next(&mut self) -> Option<(K, V)> {
@@ -677,46 +689,46 @@ impl<K, V> Iterator for IntoIter<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for IntoIter<K, V> {
+impl<K, V, C> fmt::Debug for IntoIter<K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("IntoIter { .. }")
     }
 }
 
 /// An iterator over the entries of a `SkipMap`.
-pub struct Iter<'a, K, V> {
-    inner: base::RefIter<'a, K, V>,
+pub struct Iter<'a, K, V, C = BasicComparator> {
+    inner: base::RefIter<'a, K, V, C>,
 }
 
-impl<'a, K, V> Iterator for Iter<'a, K, V>
+impl<'a, K, V, C> Iterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, K, V> DoubleEndedIterator for Iter<'a, K, V>
+impl<'a, K, V, C> DoubleEndedIterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, K, V> {
+impl<K, V, C> fmt::Debug for Iter<'_, K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
-impl<K, V> Drop for Iter<'_, K, V> {
+impl<K, V, C> Drop for Iter<'_, K, V, C> {
     fn drop(&mut self) {
         let guard = &epoch::pin();
         self.inner.drop_impl(guard);
@@ -724,44 +736,45 @@ impl<K, V> Drop for Iter<'_, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipMap`.
-pub struct Range<'a, Q, R, K, V>
+pub struct Range<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    pub(crate) inner: base::RefRange<'a, Q, R, K, V>,
+    pub(crate) inner: base::RefRange<'a, Q, R, K, V, C>,
 }
 
-impl<'a, Q, R, K, V> Iterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> Iterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, Q, R, K, V> DoubleEndedIterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> DoubleEndedIterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    K: fmt::Debug,
+    C: Comparator<K> + Comparator<K, Q>,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -775,9 +788,9 @@ where
     }
 }
 
-impl<Q, R, K, V> Drop for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> Drop for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/src/set.rs b/crossbeam-skiplist/src/set.rs
index 4e91f6c..dff0033 100644
--- a/crossbeam-skiplist/src/set.rs
+++ b/crossbeam-skiplist/src/set.rs
@@ -5,7 +5,10 @@ use core::{
     ops::{Bound, Deref, RangeBounds},
 };
 
-use crate::{equivalent::Comparable, map};
+use crate::{
+    comparator::{BasicComparator, Comparator},
+    map,
+};
 
 /// A set based on a lock-free skip list.
 ///
@@ -13,8 +16,8 @@ use crate::{equivalent::Comparable, map};
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeSet`]: std::collections::BTreeSet
-pub struct SkipSet<T> {
-    inner: map::SkipMap<T, ()>,
+pub struct SkipSet<T, C = BasicComparator> {
+    inner: map::SkipMap<T, (), C>,
 }
 
 impl<T> SkipSet<T> {
@@ -32,6 +35,15 @@ impl<T> SkipSet<T> {
             inner: map::SkipMap::new(),
         }
     }
+}
+
+impl<T, C> SkipSet<T, C> {
+    /// Returns an empty set with the given comparator.
+    pub fn with_comparator(comparator: C) -> Self {
+        Self {
+            inner: map::SkipMap::with_comparator(comparator),
+        }
+    }
 
     /// Returns `true` if the set is empty.
     ///
@@ -71,9 +83,9 @@ impl<T> SkipSet<T> {
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -88,7 +100,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.front().unwrap(), 1);
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, T>> {
+    pub fn front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.front().map(Entry::new)
     }
 
@@ -105,7 +117,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.back().unwrap(), 2);
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, T>> {
+    pub fn back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.back().map(Entry::new)
     }
 
@@ -122,7 +134,7 @@ where
     /// ```
     pub fn contains<Q>(&self, key: &Q) -> bool
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.contains_key(key)
@@ -139,9 +151,9 @@ where
     /// assert_eq!(*set.get(&3).unwrap(), 3);
     /// assert!(set.get(&4).is_none());
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.get(key).map(Entry::new)
@@ -171,9 +183,9 @@ where
     /// let greater_than_thirteen = set.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.lower_bound(bound).map(Entry::new)
@@ -200,9 +212,9 @@ where
     /// let less_than_six = set.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.upper_bound(bound).map(Entry::new)
@@ -219,7 +231,7 @@ where
     /// let entry = set.get_or_insert(2);
     /// assert_eq!(*entry, 2);
     /// ```
-    pub fn get_or_insert(&self, key: T) -> Entry<'_, T> {
+    pub fn get_or_insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.get_or_insert(key, ()))
     }
 
@@ -241,7 +253,7 @@ where
     /// assert_eq!(*set_iter.next().unwrap(), 12);
     /// assert!(set_iter.next().is_none());
     /// ```
-    pub fn iter(&self) -> Iter<'_, T> {
+    pub fn iter(&self) -> Iter<'_, T, C> {
         Iter {
             inner: self.inner.iter(),
         }
@@ -264,10 +276,10 @@ where
     /// assert_eq!(*set_range.next().unwrap(), 7);
     /// assert!(set_range.next().is_none());
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T, C>
     where
         R: RangeBounds<Q>,
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         Range {
@@ -276,9 +288,10 @@ where
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T>,
 {
     /// Inserts a `key`-`value` pair into the set and returns the new entry.
     ///
@@ -294,7 +307,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.get(&2).unwrap(), 2);
     /// ```
-    pub fn insert(&self, key: T) -> Entry<'_, T> {
+    pub fn insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.insert(key, ()))
     }
 
@@ -313,9 +326,9 @@ where
     /// assert_eq!(*set.remove(&2).unwrap(), 2);
     /// assert!(set.remove(&2).is_none());
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.remove(key).map(Entry::new)
@@ -342,7 +355,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_front().map(Entry::new)
     }
 
@@ -367,7 +380,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_back().map(Entry::new)
     }
 
@@ -396,34 +409,35 @@ impl<T> Default for SkipSet<T> {
     }
 }
 
-impl<T> fmt::Debug for SkipSet<T>
+impl<T, C> fmt::Debug for SkipSet<T, C>
 where
-    T: Ord + fmt::Debug,
+    T: fmt::Debug,
+    C: Comparator<T>,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("SkipSet { .. }")
     }
 }
 
-impl<T> IntoIterator for SkipSet<T> {
+impl<T, C> IntoIterator for SkipSet<T, C> {
     type Item = T;
-    type IntoIter = IntoIter<T>;
+    type IntoIter = IntoIter<T, C>;
 
-    fn into_iter(self) -> IntoIter<T> {
+    fn into_iter(self) -> IntoIter<T, C> {
         IntoIter {
             inner: self.inner.into_iter(),
         }
     }
 }
 
-impl<'a, T> IntoIterator for &'a SkipSet<T>
+impl<'a, T, C> IntoIterator for &'a SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    type Item = Entry<'a, T>;
-    type IntoIter = Iter<'a, T>;
+    type Item = Entry<'a, T, C>;
+    type IntoIter = Iter<'a, T, C>;
 
-    fn into_iter(self) -> Iter<'a, T> {
+    fn into_iter(self) -> Iter<'a, T, C> {
         self.iter()
     }
 }
@@ -445,12 +459,12 @@ where
 }
 
 /// A reference-counted entry in a set.
-pub struct Entry<'a, T> {
-    inner: map::Entry<'a, T, ()>,
+pub struct Entry<'a, T, C = BasicComparator> {
+    inner: map::Entry<'a, T, (), C>,
 }
 
-impl<'a, T> Entry<'a, T> {
-    fn new(inner: map::Entry<'a, T, ()>) -> Self {
+impl<'a, T, C> Entry<'a, T, C> {
+    fn new(inner: map::Entry<'a, T, (), C>) -> Self {
         Self { inner }
     }
 
@@ -465,9 +479,9 @@ impl<'a, T> Entry<'a, T> {
     }
 }
 
-impl<'a, T> Entry<'a, T>
+impl<'a, T, C> Entry<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
     /// Moves to the next entry in the set.
     pub fn move_next(&mut self) -> bool {
@@ -480,19 +494,20 @@ where
     }
 
     /// Returns the next entry in the set.
-    pub fn next(&self) -> Option<Entry<'a, T>> {
+    pub fn next(&self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 
     /// Returns the previous entry in the set.
-    pub fn prev(&self) -> Option<Entry<'a, T>> {
+    pub fn prev(&self) -> Option<Entry<'a, T, C>> {
         self.inner.prev().map(Entry::new)
     }
 }
 
-impl<T> Entry<'_, T>
+impl<T, C> Entry<'_, T, C>
 where
-    T: Ord + Send + 'static,
+    T: Send + 'static,
+    C: Comparator<T>,
 {
     /// Removes the entry from the set.
     ///
@@ -502,7 +517,7 @@ where
     }
 }
 
-impl<T> Clone for Entry<'_, T> {
+impl<T, C> Clone for Entry<'_, T, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -510,7 +525,7 @@ impl<T> Clone for Entry<'_, T> {
     }
 }
 
-impl<T> fmt::Debug for Entry<'_, T>
+impl<T, C> fmt::Debug for Entry<'_, T, C>
 where
     T: fmt::Debug,
 {
@@ -521,7 +536,7 @@ where
     }
 }
 
-impl<T> Deref for Entry<'_, T> {
+impl<T, C> Deref for Entry<'_, T, C> {
     type Target = T;
 
     fn deref(&self) -> &Self::Target {
@@ -530,11 +545,11 @@ impl<T> Deref for Entry<'_, T> {
 }
 
 /// An owning iterator over the entries of a `SkipSet`.
-pub struct IntoIter<T> {
-    inner: map::IntoIter<T, ()>,
+pub struct IntoIter<T, C = BasicComparator> {
+    inner: map::IntoIter<T, (), C>,
 }
 
-impl<T> Iterator for IntoIter<T> {
+impl<T, C> Iterator for IntoIter<T, C> {
     type Item = T;
 
     fn next(&mut self) -> Option<T> {
@@ -542,80 +557,81 @@ impl<T> Iterator for IntoIter<T> {
     }
 }
 
-impl<T> fmt::Debug for IntoIter<T> {
+impl<T, C> fmt::Debug for IntoIter<T, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("IntoIter { .. }")
     }
 }
 
 /// An iterator over the entries of a `SkipSet`.
-pub struct Iter<'a, T> {
-    inner: map::Iter<'a, T, ()>,
+pub struct Iter<'a, T, C = BasicComparator> {
+    inner: map::Iter<'a, T, (), C>,
 }
 
-impl<'a, T> Iterator for Iter<'a, T>
+impl<'a, T, C> Iterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, T> DoubleEndedIterator for Iter<'a, T>
+impl<'a, T, C> DoubleEndedIterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<T> fmt::Debug for Iter<'_, T> {
+impl<T, C> fmt::Debug for Iter<'_, T, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
 /// An iterator over a subset of entries of a `SkipSet`.
-pub struct Range<'a, Q, R, T>
+pub struct Range<'a, Q, R, T, C = BasicComparator>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    inner: map::Range<'a, Q, R, T, ()>,
+    inner: map::Range<'a, Q, R, T, (), C>,
 }
 
-impl<'a, Q, R, T> Iterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> Iterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, Q, R, T> DoubleEndedIterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> DoubleEndedIterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<Q, R, T> fmt::Debug for Range<'_, Q, R, T>
+impl<Q, R, T, C> fmt::Debug for Range<'_, Q, R, T, C>
 where
-    T: Ord + Comparable<Q> + fmt::Debug,
+    T: fmt::Debug,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
 {
diff --git a/crossbeam-skiplist/tests/base.rs b/crossbeam-skiplist/tests/base.rs
index def945f..14cdb5d 100644
--- a/crossbeam-skiplist/tests/base.rs
+++ b/crossbeam-skiplist/tests/base.rs
@@ -1021,3 +1021,52 @@ fn remove_race() {
 
     assert_eq!(*total_removed.get_mut(), KEY_RANGE);
 }
+
+/// Checks guarded and reference-counted iteration with a custom comparator.
+#[test]
+fn runtime_comparator() {
+    let list = SkipList::with_comparator(epoch::default_collector().clone(), |a: &i32, b: &i32| {
+        b.cmp(a)
+    });
+    let guard = &epoch::pin();
+    assert!(list.get(&0, guard).is_none());
+    for key in 0..5 {
+        list.insert(key, key, guard).release(guard);
+    }
+    let mut iter = list.iter(guard);
+    assert_eq!(iter.next().unwrap().key(), &4);
+    assert_eq!(iter.next_back().unwrap().key(), &0);
+    assert_eq!(iter.map(|e| *e.key()).collect::<Vec<_>>(), [3, 2, 1]);
+    let mut range = list.range(3..=1, guard);
+    assert_eq!(range.next().unwrap().key(), &3);
+    assert_eq!(range.next_back().unwrap().key(), &1);
+    assert_eq!(range.next().unwrap().key(), &2);
+    assert!(range.next_back().is_none());
+    let mut range = list.ref_range(3..=1);
+    assert_eq!(
+        range.next(guard).map(|e| {
+            let k = *e.key();
+            e.release(guard);
+            k
+        }),
+        Some(3)
+    );
+    assert_eq!(
+        range.next_back(guard).map(|e| {
+            let k = *e.key();
+            e.release(guard);
+            k
+        }),
+        Some(1)
+    );
+    range.drop_impl(guard);
+    let entry = list.get(&2, guard).unwrap();
+    assert_eq!(entry.next().unwrap().key(), &1);
+    assert_eq!(entry.prev().unwrap().key(), &3);
+    assert!(entry.remove());
+    assert!(list.get(&2, guard).is_none());
+    assert_eq!(
+        list.into_iter().map(|(k, _)| k).collect::<Vec<_>>(),
+        [4, 3, 1, 0]
+    );
+}
diff --git a/crossbeam-skiplist/tests/map.rs b/crossbeam-skiplist/tests/map.rs
index 2fa8c2b..6eebc51 100644
--- a/crossbeam-skiplist/tests/map.rs
+++ b/crossbeam-skiplist/tests/map.rs
@@ -962,3 +962,112 @@ fn issue_1178() {
         map.insert(k, v);
     }
 }
+
+/// Checks runtime case sensitivity and borrowed queries across map operations.
+#[test]
+fn runtime_comparator() {
+    use crossbeam_skiplist::comparator::{Comparator, Equivalator};
+    use std::cmp::Ordering;
+
+    struct CaseComparator(bool);
+
+    impl<Q: ?Sized + AsRef<str>> Equivalator<String, Q> for CaseComparator {
+        fn equivalent(&self, lhs: &String, rhs: &Q) -> bool {
+            self.compare(lhs, rhs).is_eq()
+        }
+    }
+
+    impl<Q: ?Sized + AsRef<str>> Comparator<String, Q> for CaseComparator {
+        fn compare(&self, lhs: &String, rhs: &Q) -> Ordering {
+            if self.0 {
+                lhs.as_str().cmp(rhs.as_ref())
+            } else {
+                lhs.to_lowercase().cmp(&rhs.as_ref().to_lowercase())
+            }
+        }
+    }
+
+    for sensitive in [false, true] {
+        let map = SkipMap::<String, u32, _>::with_comparator(CaseComparator(sensitive));
+        assert!(map.get("abc").is_none());
+        assert!(
+            map.range::<str, _>((Bound::Unbounded, Bound::Included("z")))
+                .next()
+                .is_none()
+        );
+        map.insert("abc".into(), 1);
+        map.insert("ABC".into(), 2);
+        assert_eq!(map.len(), if sensitive { 2 } else { 1 });
+        assert_eq!(
+            map.get("aBc").map(|e| *e.value()),
+            if sensitive { None } else { Some(2) }
+        );
+        if sensitive {
+            continue;
+        }
+        assert!(map.contains_key("AbC"));
+        assert_eq!(*map.get_or_insert("AbC".into(), 3).value(), 2);
+        assert_eq!(
+            *map.get_or_insert_with("aBC".into(), || panic!()).value(),
+            2
+        );
+        map.compare_insert("Abc".into(), 4, |v| *v == 2);
+        map.insert("def".into(), 5);
+        map.insert("ghi".into(), 6);
+        assert_eq!(
+            map.lower_bound(Bound::Excluded("ABC")).unwrap().key(),
+            "def"
+        );
+        assert_eq!(
+            map.upper_bound(Bound::Included("DEF")).unwrap().key(),
+            "def"
+        );
+        assert!(map.lower_bound(Bound::Included("zzz")).is_none());
+        assert!(map.upper_bound(Bound::Excluded("aaa")).is_none());
+        let mut range = map.range::<str, _>((Bound::Included("ABC"), Bound::Excluded("GHI")));
+        assert_eq!(*range.next().unwrap().value(), 4);
+        assert_eq!(*range.next_back().unwrap().value(), 5);
+        assert!(range.next().is_none());
+        let mut entry = map.front().unwrap();
+        assert!(entry.move_next());
+        assert_eq!(entry.key(), "def");
+        assert!(entry.move_prev());
+        assert_eq!(entry.next().unwrap().prev().unwrap().key(), "Abc");
+        let keys: Vec<String> = map.iter().rev().map(|e| e.key().clone()).collect();
+        assert_eq!(keys, ["ghi", "def", "Abc"]);
+        assert_eq!(*map.remove("aBC").unwrap().value(), 4);
+        assert!(map.front().unwrap().remove());
+        assert_eq!(map.pop_back().unwrap().key(), "ghi");
+        assert!(map.is_empty());
+        map.insert("".into(), 0);
+        assert!(map.get("").is_some());
+        map.clear();
+        assert!(map.is_empty());
+    }
+}
+
+/// Checks boxed comparison closures and keys without Ord.
+#[test]
+fn boxed_comparator() {
+    struct Key(i32);
+    let compare: Box<dyn Fn(&Key, &Key) -> std::cmp::Ordering> = Box::new(|a, b| b.0.cmp(&a.0));
+    let map = SkipMap::with_comparator(compare);
+    for key in 0..5 {
+        map.insert(Key(key), key);
+    }
+    let mut iter = map.iter();
+    assert_eq!(iter.next().unwrap().key().0, 4);
+    assert_eq!(iter.next_back().unwrap().key().0, 0);
+    assert_eq!(iter.count(), 3);
+    assert_eq!(
+        map.range(Key(3)..Key(1))
+            .map(|e| e.key().0)
+            .collect::<Vec<_>>(),
+        [3, 2]
+    );
+    assert_eq!(map.remove(&Key(2)).unwrap().key().0, 2);
+    assert_eq!(
+        map.into_iter().map(|(k, _)| k.0).collect::<Vec<_>>(),
+        [4, 3, 1, 0]
+    );
+}
diff --git a/crossbeam-skiplist/tests/set.rs b/crossbeam-skiplist/tests/set.rs
index e439bf0..5de31b6 100644
--- a/crossbeam-skiplist/tests/set.rs
+++ b/crossbeam-skiplist/tests/set.rs
@@ -717,3 +717,37 @@ fn concurrent_insert_get_same_key() {
     }
     handle.join().unwrap()
 }
+
+/// Checks custom ordering throughout set operations.
+#[test]
+fn runtime_comparator() {
+    let set = SkipSet::with_comparator(|a: &i32, b: &i32| b.cmp(a));
+    assert!(set.get(&0).is_none());
+    for key in 0..5 {
+        set.insert(key);
+    }
+    assert_eq!(set.get_or_insert(3).value(), &3);
+    assert_eq!(set.len(), 5);
+    assert!(set.contains(&2));
+    assert_eq!(*set.lower_bound(Bound::Excluded(&3)).unwrap(), 2);
+    assert_eq!(*set.upper_bound(Bound::Excluded(&3)).unwrap(), 4);
+    let mut range = set.range(4..=1);
+    assert_eq!(*range.next().unwrap(), 4);
+    assert_eq!(*range.next_back().unwrap(), 1);
+    assert_eq!(range.map(|e| *e).collect::<Vec<_>>(), [3, 2]);
+    let mut entry = set.front().unwrap();
+    assert!(entry.move_next());
+    assert_eq!(*entry, 3);
+    assert!(entry.move_prev());
+    assert_eq!(*entry.next().unwrap().prev().unwrap(), 4);
+    assert!(entry.remove());
+    drop(entry);
+    assert_eq!(*set.remove(&2).unwrap(), 2);
+    assert_eq!(*set.pop_back().unwrap(), 0);
+    assert_eq!(*set.pop_front().unwrap(), 3);
+    assert_eq!(set.iter().rev().map(|e| *e).collect::<Vec<_>>(), [1]);
+    set.clear();
+    assert!(set.is_empty());
+    set.insert(7);
+    assert_eq!(set.into_iter().collect::<Vec<_>>(), [7]);
+}
```

</details>

<details><summary>reply</summary>

I’ll trace the ordering code and public types, add comparator support, then test runtime ordering and borrowed-key lookups.


The ordering checks live in the shared skip-list code, including the checks that stop forward and reverse iterators. I’m routing those through the comparator and keeping `new()` tied to `BasicComparator` for compatibility.


The focused tests pass for case-insensitive `String`/`str` lookups, duplicate-key replacement, reverse ordering, boxed closures, and keys without `Ord`. The `alloc`-only build also passes. I’m checking the full crate test suite and documentation examples now.


Implemented runtime comparators for `SkipMap`, `SkipSet`, and `base::SkipList`, including entries, iterators, and ranges. Existing constructors retain their default behavior. Boxed comparison closures and heterogeneous lookups are supported.

Validation passed: 87 integration tests, 40 doctests, and the `alloc`-only build.

No dependencies or unrelated features added. Full workspace tests were not run.

</details>

### codex, all: pass

Files: [crossbeam-skiplist/src/base.rs](../all/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/base.rs), [crossbeam-skiplist/src/comparator.rs](../all/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/comparator.rs), [crossbeam-skiplist/src/lib.rs](../all/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/lib.rs), [crossbeam-skiplist/src/map.rs](../all/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/map.rs), [crossbeam-skiplist/src/set.rs](../all/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/src/set.rs), [crossbeam-skiplist/tests/base.rs](../all/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/tests/base.rs), [crossbeam-skiplist/tests/map.rs](../all/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/tests/map.rs), [crossbeam-skiplist/tests/set.rs](../all/codex/rust-crossbeam-skiplist-comparator-1/files/crossbeam-skiplist/tests/set.rs)

<details><summary>diff</summary>

```diff
diff --git a/crossbeam-skiplist/src/base.rs b/crossbeam-skiplist/src/base.rs
index a73ee8a..0379b46 100644
--- a/crossbeam-skiplist/src/base.rs
+++ b/crossbeam-skiplist/src/base.rs
@@ -15,7 +15,7 @@ use core::{
 use crossbeam_epoch::{self as epoch, Atomic, Collector, Guard, Shared};
 use crossbeam_utils::CachePadded;
 
-use super::equivalent::Comparable;
+use super::comparator::{BasicComparator, Comparator};
 use crate::alloc_helper::Global;
 
 /// Number of bits needed to store height.
@@ -304,7 +304,7 @@ impl<'a, K, V> NodeRef<'a, K, V> {
     /// Decrements the reference count of a node, pinning the thread and destroying the node
     /// if the count become zero.
     #[inline]
-    unsafe fn decrement_with_pin<F>(self, parent: &SkipList<K, V>, pin: F)
+    unsafe fn decrement_with_pin<F, C>(self, parent: &SkipList<K, V, C>, pin: F)
     where
         F: FnOnce() -> Guard,
     {
@@ -463,26 +463,29 @@ struct HotData {
 // As a further future optimization, if `!mem::needs_drop::<K>() && !mem::needs_drop::<V>()`
 // (neither key nor the value have destructors), there's no point in creating a new local
 // collector, so we should simply use the global one.
-pub struct SkipList<K, V> {
+pub struct SkipList<K, V, C = BasicComparator> {
     /// The head of the skip list (just a dummy node, not a real entry).
     head: Head<K, V>,
 
     /// The `Collector` associated with this skip list.
     collector: Collector,
 
+    comparator: C,
+
     /// Hot data associated with the skip list, stored in a dedicated cache line.
     hot_data: CachePadded<HotData>,
 }
 
-unsafe impl<K: Send + Sync, V: Send + Sync> Send for SkipList<K, V> {}
-unsafe impl<K: Send + Sync, V: Send + Sync> Sync for SkipList<K, V> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Send> Send for SkipList<K, V, C> {}
+unsafe impl<K: Send + Sync, V: Send + Sync, C: Sync> Sync for SkipList<K, V, C> {}
 
-impl<K, V> SkipList<K, V> {
-    /// Returns a new, empty skip list.
-    pub fn new(collector: Collector) -> Self {
+impl<K, V, C> SkipList<K, V, C> {
+    /// Returns an empty skip list using the supplied comparator.
+    pub fn with_comparator(collector: Collector, comparator: C) -> Self {
         Self {
             head: Head::new(),
             collector,
+            comparator,
             hot_data: CachePadded::new(HotData {
                 seed: AtomicUsize::new(1),
                 len: AtomicUsize::new(0),
@@ -517,12 +520,12 @@ impl<K, V> SkipList<K, V> {
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Returns the entry with the smallest key.
-    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn front<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.next_node(self.head.as_tower(), Bound::Unbounded, guard)?;
         Some(Entry {
@@ -533,7 +536,7 @@ where
     }
 
     /// Returns the entry with the largest key.
-    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn back<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>> {
         self.check_guard(guard);
         let n = self.search_bound::<K>(Bound::Unbounded, true, guard)?;
         Some(Entry {
@@ -546,21 +549,21 @@ where
     /// Returns `true` if the map contains a value for the specified key.
     pub fn contains_key<Q>(&self, key: &Q, guard: &Guard) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.get(key, guard).is_some()
     }
 
     /// Returns an entry with the specified `key`.
-    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V>>
+    pub fn get<'a: 'g, 'g, Q>(&'a self, key: &Q, guard: &'g Guard) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
         let n = self.search_bound(Bound::Included(key), false, guard)?;
-        if !n.key.equivalent(key) {
+        if !self.comparator.equivalent(&n.key, key) {
             return None;
         }
 
@@ -578,9 +581,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -599,9 +602,9 @@ where
         &'a self,
         bound: Bound<&Q>,
         guard: &'g Guard,
-    ) -> Option<Entry<'a, 'g, K, V>>
+    ) -> Option<Entry<'a, 'g, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -614,7 +617,7 @@ where
     }
 
     /// Finds an entry with the specified key, or inserts a new `key`-`value` pair if none exist.
-    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| false, guard)
     }
 
@@ -626,7 +629,7 @@ where
     /// discarded. If closure is modifying some other state (such as shared counters or shared
     /// objects), it may lead to <u>undesired behaviour</u> such as counters being changed without
     /// result of closure inserted
-    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value: F, guard: &Guard) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -634,7 +637,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V> {
+    pub fn iter<'a: 'g, 'g>(&'a self, guard: &'g Guard) -> Iter<'a, 'g, K, V, C> {
         self.check_guard(guard);
         Iter {
             parent: self,
@@ -645,7 +648,7 @@ where
     }
 
     /// Returns an iterator over all entries in the skip list.
-    pub fn ref_iter(&self) -> RefIter<'_, K, V> {
+    pub fn ref_iter(&self) -> RefIter<'_, K, V, C> {
         RefIter {
             parent: self,
             head: None,
@@ -658,9 +661,9 @@ where
         &'a self,
         range: R,
         guard: &'g Guard,
-    ) -> Range<'a, 'g, Q, R, K, V>
+    ) -> Range<'a, 'g, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -677,9 +680,9 @@ where
 
     /// Returns an iterator over a subset of entries in the skip list.
     #[allow(clippy::needless_lifetimes)]
-    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V>
+    pub fn ref_range<'a, Q, R>(&'a self, range: R) -> RefRange<'a, Q, R, K, V, C>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         R: RangeBounds<Q>,
         Q: ?Sized,
     {
@@ -825,7 +828,7 @@ where
         guard: &'a Guard,
     ) -> Option<NodeRef<'a, K, V>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -887,11 +890,11 @@ where
                         // bound, we return the last node before the condition became true. For the
                         // lower bound, we return the first node after the condition became true.
                         if upper_bound {
-                            if !below_upper_bound(&bound, &c.key) {
+                            if !below_upper_bound(&self.comparator, &bound, &c.key) {
                                 break;
                             }
                             result = Some(c);
-                        } else if above_lower_bound(&bound, &c.key) {
+                        } else if above_lower_bound(&self.comparator, &bound, &c.key) {
                             result = Some(c);
                             break;
                         }
@@ -910,7 +913,7 @@ where
     /// Searches for a key in the skip list and returns a list of all adjacent nodes.
     fn search_position<'a, Q>(&'a self, key: &Q, guard: &'a Guard) -> Position<'a, K, V>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         unsafe {
@@ -971,7 +974,7 @@ where
 
                         // If `curr` contains a key that is greater than or equal to `key`, we're
                         // done with this level.
-                        match c.key.compare(key) {
+                        match self.comparator.compare(&c.key, key) {
                             cmp::Ordering::Greater => break,
                             cmp::Ordering::Equal => {
                                 result.found = Some(c);
@@ -1004,7 +1007,7 @@ where
         value: F,
         replace: CompareF,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: FnOnce() -> V,
         CompareF: Fn(&V) -> bool,
@@ -1155,7 +1158,10 @@ where
                     // the tower without breaking any invariants. Note that building higher levels
                     // is completely optional. Only the lowest level really matters, and all the
                     // higher levels are there just to make searching faster.
-                    if succ.as_ref().map(|s| &s.key) == Some(&n.key) {
+                    if succ
+                        .as_ref()
+                        .map_or(false, |s| self.comparator.equivalent(&s.key, &n.key))
+                    {
                         search = self.search_position(&n.key, guard);
                         continue;
                     }
@@ -1218,16 +1224,17 @@ where
     }
 }
 
-impl<K, V> SkipList<K, V>
+impl<K, V, C> SkipList<K, V, C>
 where
-    K: Ord + Send + 'static,
+    C: Comparator<K>,
+    K: Send + 'static,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the skip list and returns the new entry.
     ///
     /// If there is an existing entry with this key, it will be removed before inserting the new
     /// one.
-    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V, guard: &Guard) -> RefEntry<'_, K, V, C> {
         self.insert_internal(key, || value, |_| true, guard)
     }
 
@@ -1242,7 +1249,7 @@ where
         value: V,
         compare_fn: F,
         guard: &Guard,
-    ) -> RefEntry<'_, K, V>
+    ) -> RefEntry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -1250,9 +1257,9 @@ where
     }
 
     /// Removes an entry with the specified `key` from the map and returns it.
-    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q, guard: &Guard) -> Option<RefEntry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         self.check_guard(guard);
@@ -1320,7 +1327,7 @@ where
     }
 
     /// Removes an entry from the front of the skip list.
-    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_front(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.front(guard)?;
@@ -1335,7 +1342,7 @@ where
     }
 
     /// Removes an entry from the back of the skip list.
-    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V>> {
+    pub fn pop_back(&self, guard: &Guard) -> Option<RefEntry<'_, K, V, C>> {
         self.check_guard(guard);
         loop {
             let e = self.back(guard)?;
@@ -1393,7 +1400,7 @@ where
     }
 }
 
-impl<K, V> Drop for SkipList<K, V> {
+impl<K, V, C> Drop for SkipList<K, V, C> {
     fn drop(&mut self) {
         unsafe {
             let mut node = NodeRef::from_shared(
@@ -1419,9 +1426,10 @@ impl<K, V> Drop for SkipList<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipList<K, V>
+impl<K, V, C> fmt::Debug for SkipList<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    C: Comparator<K>,
+    K: fmt::Debug,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -1429,11 +1437,11 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipList<K, V> {
+impl<K, V, C> IntoIterator for SkipList<K, V, C> {
     type Item = (K, V);
-    type IntoIter = IntoIter<K, V>;
+    type IntoIter = IntoIter<K, V, C>;
 
-    fn into_iter(self) -> IntoIter<K, V> {
+    fn into_iter(self) -> IntoIter<K, V, C> {
         unsafe {
             // Load the front node.
             //
@@ -1454,6 +1462,7 @@ impl<K, V> IntoIterator for SkipList<K, V> {
 
             IntoIter {
                 node: front as *mut Node<K, V>,
+                _marker: PhantomData,
             }
         }
     }
@@ -1464,13 +1473,13 @@ impl<K, V> IntoIterator for SkipList<K, V> {
 /// The lifetimes of the key and value are the same as that of the `Guard`
 /// used when creating the `Entry` (`'g`). This lifetime is also constrained to
 /// not outlive the `SkipList`.
-pub struct Entry<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Entry<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'g, K, V>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Entry<'a, 'g, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1487,7 +1496,7 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1496,14 +1505,15 @@ impl<'a: 'g, 'g, K: 'a, V: 'a> Entry<'a, 'g, K, V> {
     ///
     /// This method may return `None` if the reference count is already 0 and
     /// the node has been queued for deletion.
-    pub fn pin(&self) -> Option<RefEntry<'a, K, V>> {
+    pub fn pin(&self) -> Option<RefEntry<'a, K, V, C>> {
         unsafe { RefEntry::try_acquire(self.parent, self.node) }
     }
 }
 
-impl<K, V> Entry<'_, '_, K, V>
+impl<K, V, C> Entry<'_, '_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    C: Comparator<K>,
+    K: Send + 'static,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1526,7 +1536,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, '_, K, V> {
+impl<K, V, C> Clone for Entry<'_, '_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             parent: self.parent,
@@ -1536,7 +1546,7 @@ impl<K, V> Clone for Entry<'_, '_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1549,9 +1559,9 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K, V> Entry<'a, 'g, K, V>
+impl<'a: 'g, 'g, K, V, C> Entry<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self) -> bool {
@@ -1565,7 +1575,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self.parent.next_node(
             self.node.as_tower(),
             Bound::Excluded(&self.node.key),
@@ -1590,7 +1600,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, 'g, K, V, C>> {
         let n = self
             .parent
             .search_bound(Bound::Excluded(&self.node.key), true, self.guard)?;
@@ -1606,12 +1616,12 @@ where
 ///
 /// You *must* call `release` to free this type, otherwise the node will be
 /// leaked. This is because releasing the entry requires a `Guard`.
-pub struct RefEntry<'a, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct RefEntry<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     node: NodeRef<'a, K, V>,
 }
 
-impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefEntry<'a, K, V, C> {
     /// Returns `true` if the entry is removed from the skip list.
     pub fn is_removed(&self) -> bool {
         self.node.is_removed()
@@ -1628,7 +1638,7 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 
     /// Returns a reference to the parent `SkipList`
-    pub fn skiplist(&self) -> &'a SkipList<K, V> {
+    pub fn skiplist(&self) -> &'a SkipList<K, V, C> {
         self.parent
     }
 
@@ -1650,9 +1660,9 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     /// Tries to create a new `RefEntry` by incrementing the reference count of
     /// a node.
     unsafe fn try_acquire(
-        parent: &'a SkipList<K, V>,
+        parent: &'a SkipList<K, V, C>,
         node: NodeRef<'_, K, V>,
-    ) -> Option<RefEntry<'a, K, V>> {
+    ) -> Option<RefEntry<'a, K, V, C>> {
         if unsafe { node.try_increment() } {
             Some(RefEntry {
                 parent,
@@ -1667,9 +1677,10 @@ impl<'a, K: 'a, V: 'a> RefEntry<'a, K, V> {
     }
 }
 
-impl<K, V> RefEntry<'_, K, V>
+impl<K, V, C> RefEntry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    C: Comparator<K>,
+    K: Send + 'static,
     V: Send + 'static,
 {
     /// Removes the entry from the skip list.
@@ -1694,7 +1705,7 @@ where
     }
 }
 
-impl<K, V> Clone for RefEntry<'_, K, V> {
+impl<K, V, C> Clone for RefEntry<'_, K, V, C> {
     fn clone(&self) -> Self {
         unsafe {
             // Incrementing will always succeed since we're already holding a reference to the node.
@@ -1707,7 +1718,7 @@ impl<K, V> Clone for RefEntry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for RefEntry<'_, K, V>
+impl<K, V, C> fmt::Debug for RefEntry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1720,9 +1731,9 @@ where
     }
 }
 
-impl<'a, K, V> RefEntry<'a, K, V>
+impl<'a, K, V, C> RefEntry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the skip list.
     pub fn move_next(&mut self, guard: &Guard) -> bool {
@@ -1736,7 +1747,7 @@ where
     }
 
     /// Returns the next entry in the skip list.
-    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1763,7 +1774,7 @@ where
     }
 
     /// Returns the previous entry in the skip list.
-    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn prev(&self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         unsafe {
             let mut n = self.node;
@@ -1780,20 +1791,20 @@ where
 }
 
 /// An iterator over the entries of a `SkipList`.
-pub struct Iter<'a: 'g, 'g, K, V> {
-    parent: &'a SkipList<K, V>,
+pub struct Iter<'a: 'g, 'g, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     guard: &'g Guard,
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> Iterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> Iterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1804,7 +1815,7 @@ where
             }
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1817,11 +1828,11 @@ where
     }
 }
 
-impl<'a: 'g, 'g, K: 'a, V: 'a> DoubleEndedIterator for Iter<'a, 'g, K, V>
+impl<'a: 'g, 'g, K: 'a, V: 'a, C> DoubleEndedIterator for Iter<'a, 'g, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -1831,7 +1842,7 @@ where
                 .search_bound::<K>(Bound::Unbounded, true, self.guard),
         };
         if let (Some(h), Some(t)) = (self.head, self.tail) {
-            if h.key >= t.key {
+            if self.parent.comparator.compare(&h.key, &t.key).is_ge() {
                 self.head = None;
                 self.tail = None;
             }
@@ -1844,7 +1855,7 @@ where
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, '_, K, V>
+impl<K, V, C> fmt::Debug for Iter<'_, '_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1858,13 +1869,13 @@ where
 }
 
 /// An iterator over reference-counted entries of a `SkipList`.
-pub struct RefIter<'a, K, V> {
-    parent: &'a SkipList<K, V>,
-    head: Option<RefEntry<'a, K, V>>,
-    tail: Option<RefEntry<'a, K, V>>,
+pub struct RefIter<'a, K, V, C = BasicComparator> {
+    parent: &'a SkipList<K, V, C>,
+    head: Option<RefEntry<'a, K, V, C>>,
+    tail: Option<RefEntry<'a, K, V, C>>,
 }
 
-impl<K, V> fmt::Debug for RefIter<'_, K, V>
+impl<K, V, C> fmt::Debug for RefIter<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -1883,12 +1894,12 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V>
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match &self.head {
             Some(e) => e.next(guard),
@@ -1896,7 +1907,9 @@ where
         };
         match (&next_head, &self.tail) {
             // The next key is larger than the latest tail key we observed with this iterator.
-            (Some(ref next), Some(t)) if next.key() >= t.key() => {
+            (Some(ref next), Some(t))
+                if self.parent.comparator.compare(next.key(), t.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1915,7 +1928,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match &self.tail {
             Some(e) => e.prev(guard),
@@ -1923,7 +1936,9 @@ where
         };
         match (&self.head, &next_tail) {
             // The prev key is smaller than the latest head key we observed with this iterator.
-            (Some(h), Some(next)) if h.key() >= next.key() => {
+            (Some(h), Some(next))
+                if self.parent.comparator.compare(h.key(), next.key()).is_ge() =>
+            {
                 unsafe {
                     next.node.decrement(guard);
                 }
@@ -1942,7 +1957,7 @@ where
     }
 }
 
-impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
+impl<'a, K: 'a, V: 'a, C> RefIter<'a, K, V, C> {
     /// Decrements the reference count of `RefEntry` owned by the iterator.
     pub fn drop_impl(&mut self, guard: &Guard) {
         self.parent.check_guard(guard);
@@ -1956,13 +1971,13 @@ impl<'a, K: 'a, V: 'a> RefIter<'a, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipList`.
-pub struct Range<'a: 'g, 'g, Q, R, K, V>
+pub struct Range<'a: 'g, 'g, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
+    parent: &'a SkipList<K, V, C>,
     head: Option<NodeRef<'g, K, V>>,
     tail: Option<NodeRef<'g, K, V>>,
     range: R,
@@ -1970,15 +1985,15 @@ where
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> Iterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> Iterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, 'g, K, V>;
+    type Item = Entry<'a, 'g, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.head = match self.head {
             Some(n) => self
                 .parent
@@ -1991,14 +2006,14 @@ where
             match self.tail {
                 Some(t) => {
                     let bound = Bound::Excluded(&t.as_ref().key);
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if !below_upper_bound(&bound, &h.key) {
+                    if !below_upper_bound(&self.parent.comparator, &bound, &h.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2013,13 +2028,13 @@ where
     }
 }
 
-impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V>
+impl<'a: 'g, 'g, Q, R, K: 'a, V: 'a, C> DoubleEndedIterator for Range<'a, 'g, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, 'g, K, V, C>> {
         self.tail = match self.tail {
             Some(n) => self
                 .parent
@@ -2032,14 +2047,14 @@ where
             match self.head {
                 Some(h) => {
                     let bound = Bound::Excluded(&h.as_ref().key);
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if !above_lower_bound(&bound, &t.key) {
+                    if !above_lower_bound(&self.parent.comparator, &bound, &t.key) {
                         self.head = None;
                         self.tail = None;
                     }
@@ -2054,9 +2069,10 @@ where
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, '_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, '_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
+    K: fmt::Debug,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2071,38 +2087,39 @@ where
 }
 
 /// An iterator over reference-counted subset of entries of a `SkipList`.
-pub struct RefRange<'a, Q, R, K, V>
+pub struct RefRange<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    parent: &'a SkipList<K, V>,
-    pub(crate) head: Option<RefEntry<'a, K, V>>,
-    pub(crate) tail: Option<RefEntry<'a, K, V>>,
+    parent: &'a SkipList<K, V, C>,
+    pub(crate) head: Option<RefEntry<'a, K, V, C>>,
+    pub(crate) tail: Option<RefEntry<'a, K, V, C>>,
     pub(crate) range: R,
     _marker: PhantomData<fn() -> Q>, // covariant over `Q`
 }
 
-unsafe impl<Q, R, K, V> Send for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C: Sync> Send for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-unsafe impl<Q, R, K, V> Sync for RefRange<'_, Q, R, K, V>
+unsafe impl<Q, R, K, V, C: Sync> Sync for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
 }
 
-impl<Q, R, K, V> fmt::Debug for RefRange<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for RefRange<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
+    K: fmt::Debug,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -2116,14 +2133,14 @@ where
     }
 }
 
-impl<'a, Q, R, K: 'a, V: 'a> RefRange<'a, Q, R, K, V>
+impl<'a, Q, R, K: 'a, V: 'a, C> RefRange<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
     /// Advances the iterator and returns the next value.
-    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_head = match self.head {
             Some(ref e) => e.next(guard),
@@ -2134,7 +2151,7 @@ where
             match self.tail {
                 Some(ref t) => {
                     let bound = Bound::Excluded(t.key());
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2150,7 +2167,7 @@ where
                 }
                 None => {
                     let bound = self.range.end_bound();
-                    if below_upper_bound(&bound, h.key()) {
+                    if below_upper_bound(&self.parent.comparator, &bound, h.key()) {
                         if let Some(e) = mem::replace(&mut self.head, next_head.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2171,7 +2188,7 @@ where
     }
 
     /// Removes and returns an element from the end of the iterator.
-    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V>> {
+    pub fn next_back(&mut self, guard: &Guard) -> Option<RefEntry<'a, K, V, C>> {
         self.parent.check_guard(guard);
         let next_tail = match self.tail {
             Some(ref e) => e.prev(guard),
@@ -2182,7 +2199,7 @@ where
             match self.head {
                 Some(ref h) => {
                     let bound = Bound::Excluded(h.key());
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2198,7 +2215,7 @@ where
                 }
                 None => {
                     let bound = self.range.start_bound();
-                    if above_lower_bound(&bound, t.key()) {
+                    if above_lower_bound(&self.parent.comparator, &bound, t.key()) {
                         if let Some(e) = mem::replace(&mut self.tail, next_tail.clone()) {
                             unsafe {
                                 e.node.decrement(guard);
@@ -2231,14 +2248,15 @@ where
 }
 
 /// An owning iterator over the entries of a `SkipList`.
-pub struct IntoIter<K, V> {
+pub struct IntoIter<K, V, C = BasicComparator> {
     /// The current node.
     ///
     /// All preceding nods have already been destroyed.
     node: *mut Node<K, V>,
+    _marker: PhantomData<C>,
 }
 
-impl<K, V> Drop for IntoIter<K, V> {
+impl<K, V, C> Drop for IntoIter<K, V, C> {
     fn drop(&mut self) {
         // Iterate through the whole chain and destroy every node.
         while let Some(node) = NonNull::new(self.node) {
@@ -2260,7 +2278,7 @@ impl<K, V> Drop for IntoIter<K, V> {
     }
 }
 
-impl<K, V> Iterator for IntoIter<K, V> {
+impl<K, V, C> Iterator for IntoIter<K, V, C> {
     type Item = (K, V);
 
     fn next(&mut self) -> Option<(K, V)> {
@@ -2299,7 +2317,7 @@ impl<K, V> Iterator for IntoIter<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for IntoIter<K, V> {
+impl<K, V, C> fmt::Debug for IntoIter<K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("IntoIter { .. }")
     }
@@ -2307,9 +2325,9 @@ impl<K, V> fmt::Debug for IntoIter<K, V> {
 
 /// Helper function to retry an operation until pinning succeeds or `None` is
 /// returned.
-pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V>(mut f: F) -> Option<RefEntry<'a, K, V>>
+pub(crate) fn try_pin_loop<'a: 'g, 'g, F, K, V, C>(mut f: F) -> Option<RefEntry<'a, K, V, C>>
 where
-    F: FnMut() -> Option<Entry<'a, 'g, K, V>>,
+    F: FnMut() -> Option<Entry<'a, 'g, K, V, C>>,
 {
     loop {
         if let Some(e) = f()?.pin() {
@@ -2319,27 +2337,34 @@ where
 }
 
 /// Helper function to check if a value is above a lower bound
-fn above_lower_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn above_lower_bound<V, T, C>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_ge(),
-        Bound::Excluded(key) => other.compare(key).is_gt(),
+        Bound::Included(key) => comparator.compare(other, key).is_ge(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_gt(),
     }
 }
 
 /// Helper function to check if a value is below an upper bound
-fn below_upper_bound<V, T>(bound: &Bound<&T>, other: &V) -> bool
+fn below_upper_bound<V, T, C>(comparator: &C, bound: &Bound<&T>, other: &V) -> bool
 where
     T: ?Sized,
-    V: Comparable<T>,
+    C: Comparator<V, T>,
 {
     match *bound {
         Bound::Unbounded => true,
-        Bound::Included(key) => other.compare(key).is_le(),
-        Bound::Excluded(key) => other.compare(key).is_lt(),
+        Bound::Included(key) => comparator.compare(other, key).is_le(),
+        Bound::Excluded(key) => comparator.compare(other, key).is_lt(),
+    }
+}
+
+impl<K, V> SkipList<K, V> {
+    /// Returns a new, empty skip list with the usual key ordering.
+    pub fn new(collector: Collector) -> Self {
+        Self::with_comparator(collector, BasicComparator)
     }
 }
diff --git a/crossbeam-skiplist/src/comparator.rs b/crossbeam-skiplist/src/comparator.rs
new file mode 100644
index 0000000..ce68cc0
--- /dev/null
+++ b/crossbeam-skiplist/src/comparator.rs
@@ -0,0 +1,60 @@
+//! Runtime key comparison for ordered collections.
+//!
+//! Comparison closures, including boxed closures, implement these traits.
+
+use crate::equivalent::{Comparable, Equivalent};
+use core::cmp::Ordering;
+
+/// Tests whether two keys represent the same entry.
+/// Equivalence must agree with the comparator's ordering.
+pub trait Equivalator<L: ?Sized, R: ?Sized = L> {
+    /// Returns whether the keys are equivalent.
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool;
+}
+
+/// Orders keys consistently throughout a collection's lifetime.
+/// Implementations must define a total order, including for borrowed queries.
+pub trait Comparator<L: ?Sized, R: ?Sized = L>: Equivalator<L, R> {
+    /// Returns the ordering of the keys.
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering;
+}
+
+/// The usual ordering provided by `Equivalent` and `Comparable`.
+#[derive(Clone, Copy, Debug, Default)]
+pub struct BasicComparator;
+
+impl<L: ?Sized, R: ?Sized> Equivalator<L, R> for BasicComparator
+where
+    L: Equivalent<R>,
+{
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
+        lhs.equivalent(rhs)
+    }
+}
+
+impl<L: ?Sized, R: ?Sized> Comparator<L, R> for BasicComparator
+where
+    L: Comparable<R>,
+{
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
+        lhs.compare(rhs)
+    }
+}
+
+impl<L: ?Sized, R: ?Sized, F> Equivalator<L, R> for F
+where
+    F: Fn(&L, &R) -> Ordering,
+{
+    fn equivalent(&self, lhs: &L, rhs: &R) -> bool {
+        self(lhs, rhs).is_eq()
+    }
+}
+
+impl<L: ?Sized, R: ?Sized, F> Comparator<L, R> for F
+where
+    F: Fn(&L, &R) -> Ordering,
+{
+    fn compare(&self, lhs: &L, rhs: &R) -> Ordering {
+        self(lhs, rhs)
+    }
+}
diff --git a/crossbeam-skiplist/src/lib.rs b/crossbeam-skiplist/src/lib.rs
index 5ff8e74..252c0aa 100644
--- a/crossbeam-skiplist/src/lib.rs
+++ b/crossbeam-skiplist/src/lib.rs
@@ -266,3 +266,5 @@ pub mod set;
 pub use crate::{map::SkipMap, set::SkipSet};
 
 pub mod equivalent;
+
+pub mod comparator;
diff --git a/crossbeam-skiplist/src/map.rs b/crossbeam-skiplist/src/map.rs
index c7c5408..378252d 100644
--- a/crossbeam-skiplist/src/map.rs
+++ b/crossbeam-skiplist/src/map.rs
@@ -11,7 +11,7 @@ use crossbeam_epoch as epoch;
 
 use crate::{
     base::{self, try_pin_loop},
-    equivalent::Comparable,
+    comparator::{BasicComparator, Comparator},
 };
 
 /// An ordered map based on a lock-free skip list.
@@ -20,23 +20,15 @@ use crate::{
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeMap`]: std::collections::BTreeMap
-pub struct SkipMap<K, V> {
-    inner: base::SkipList<K, V>,
+pub struct SkipMap<K, V, C = BasicComparator> {
+    inner: base::SkipList<K, V, C>,
 }
 
-impl<K, V> SkipMap<K, V> {
-    /// Returns a new, empty map.
-    ///
-    /// # Example
-    ///
-    /// ```
-    /// use crossbeam_skiplist::SkipMap;
-    ///
-    /// let map: SkipMap<i32, &str> = SkipMap::new();
-    /// ```
-    pub fn new() -> Self {
+impl<K, V, C> SkipMap<K, V, C> {
+    /// Returns an empty collection using the supplied comparator.
+    pub fn with_comparator(comparator: C) -> Self {
         Self {
-            inner: base::SkipList::new(epoch::default_collector().clone()),
+            inner: base::SkipList::with_comparator(epoch::default_collector().clone(), comparator),
         }
     }
 
@@ -80,9 +72,9 @@ impl<K, V> SkipMap<K, V> {
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -99,7 +91,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.front().unwrap().value(), "five");
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.front(guard)).map(Entry::new)
     }
@@ -119,7 +111,7 @@ where
     /// numbers.insert(6, "six");
     /// assert_eq!(*numbers.back().unwrap().value(), "six");
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         try_pin_loop(|| self.inner.back(guard)).map(Entry::new)
     }
@@ -138,7 +130,7 @@ where
     /// ```
     pub fn contains_key<Q>(&self, key: &Q) -> bool
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -160,9 +152,9 @@ where
     /// numbers.insert("six", 6);
     /// assert_eq!(*numbers.get("six").unwrap().value(), 6);
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -195,9 +187,9 @@ where
     /// let greater_than_thirteen = numbers.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -227,9 +219,9 @@ where
     /// let less_than_six = numbers.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -253,7 +245,7 @@ where
     /// let jobs_age = ages.get_or_insert("Steve Jobs", -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn get_or_insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.get_or_insert(key, value, guard))
     }
@@ -283,7 +275,7 @@ where
     /// let jobs_age = ages.get_or_insert_with("Steve Jobs", || -1);
     /// assert_eq!(*jobs_age.value(), 65);
     /// ```
-    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V>
+    pub fn get_or_insert_with<F>(&self, key: K, value_fn: F) -> Entry<'_, K, V, C>
     where
         F: FnOnce() -> V,
     {
@@ -313,7 +305,7 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn iter(&self) -> Iter<'_, K, V> {
+    pub fn iter(&self) -> Iter<'_, K, V, C> {
         Iter {
             inner: self.inner.ref_iter(),
         }
@@ -340,10 +332,10 @@ where
     ///     println!("{} is {}", number, number_str);
     /// }
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, K, V, C>
     where
         R: RangeBounds<Q>,
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         Range {
@@ -352,9 +344,10 @@ where
     }
 }
 
-impl<K, V> SkipMap<K, V>
+impl<K, V, C> SkipMap<K, V, C>
 where
-    K: Ord + Send + 'static,
+    C: Comparator<K>,
+    K: Send + 'static,
     V: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the map and returns the new entry.
@@ -374,7 +367,7 @@ where
     ///
     /// assert_eq!(*map.get("key").unwrap().value(), "value");
     /// ```
-    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V> {
+    pub fn insert(&self, key: K, value: V) -> Entry<'_, K, V, C> {
         let guard = &epoch::pin();
         Entry::new(self.inner.insert(key, value, guard))
     }
@@ -401,7 +394,7 @@ where
     /// map.compare_insert("absent_key", 0, |_| false);
     /// assert_eq!(*map.get("absent_key").unwrap().value(), 0);
     /// ```
-    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V>
+    pub fn compare_insert<F>(&self, key: K, value: V, compare_fn: F) -> Entry<'_, K, V, C>
     where
         F: Fn(&V) -> bool,
     {
@@ -427,9 +420,9 @@ where
     /// map.insert("key", "value");
     /// assert_eq!(*map.remove("key").unwrap().value(), "value");
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, K, V, C>>
     where
-        K: Comparable<Q>,
+        C: Comparator<K, Q>,
         Q: ?Sized,
     {
         let guard = &epoch::pin();
@@ -458,7 +451,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_front(guard).map(Entry::new)
     }
@@ -485,7 +478,7 @@ where
     /// // All entries have been removed now.
     /// assert!(numbers.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, K, V>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.pop_back(guard).map(Entry::new)
     }
@@ -515,9 +508,10 @@ impl<K, V> Default for SkipMap<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for SkipMap<K, V>
+impl<K, V, C> fmt::Debug for SkipMap<K, V, C>
 where
-    K: Ord + fmt::Debug,
+    C: Comparator<K>,
+    K: fmt::Debug,
     V: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
@@ -525,25 +519,25 @@ where
     }
 }
 
-impl<K, V> IntoIterator for SkipMap<K, V> {
+impl<K, V, C> IntoIterator for SkipMap<K, V, C> {
     type Item = (K, V);
-    type IntoIter = IntoIter<K, V>;
+    type IntoIter = IntoIter<K, V, C>;
 
-    fn into_iter(self) -> IntoIter<K, V> {
+    fn into_iter(self) -> IntoIter<K, V, C> {
         IntoIter {
             inner: self.inner.into_iter(),
         }
     }
 }
 
-impl<'a, K, V> IntoIterator for &'a SkipMap<K, V>
+impl<'a, K, V, C> IntoIterator for &'a SkipMap<K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, K, V>;
-    type IntoIter = Iter<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
+    type IntoIter = Iter<'a, K, V, C>;
 
-    fn into_iter(self) -> Iter<'a, K, V> {
+    fn into_iter(self) -> Iter<'a, K, V, C> {
         self.iter()
     }
 }
@@ -565,12 +559,12 @@ where
 }
 
 /// A reference-counted entry in a map.
-pub struct Entry<'a, K, V> {
-    inner: ManuallyDrop<base::RefEntry<'a, K, V>>,
+pub struct Entry<'a, K, V, C = BasicComparator> {
+    inner: ManuallyDrop<base::RefEntry<'a, K, V, C>>,
 }
 
-impl<'a, K, V> Entry<'a, K, V> {
-    fn new(inner: base::RefEntry<'a, K, V>) -> Self {
+impl<'a, K, V, C> Entry<'a, K, V, C> {
+    fn new(inner: base::RefEntry<'a, K, V, C>) -> Self {
         Self {
             inner: ManuallyDrop::new(inner),
         }
@@ -592,7 +586,7 @@ impl<'a, K, V> Entry<'a, K, V> {
     }
 }
 
-impl<K, V> Drop for Entry<'_, K, V> {
+impl<K, V, C> Drop for Entry<'_, K, V, C> {
     fn drop(&mut self) {
         unsafe {
             ManuallyDrop::into_inner(ptr::read(&self.inner)).release_with_pin(epoch::pin);
@@ -600,9 +594,9 @@ impl<K, V> Drop for Entry<'_, K, V> {
     }
 }
 
-impl<'a, K, V> Entry<'a, K, V>
+impl<'a, K, V, C> Entry<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
     /// Moves to the next entry in the map.
     pub fn move_next(&mut self) -> bool {
@@ -617,21 +611,22 @@ where
     }
 
     /// Returns the next entry in the map.
-    pub fn next(&self) -> Option<Entry<'a, K, V>> {
+    pub fn next(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 
     /// Returns the previous entry in the map.
-    pub fn prev(&self) -> Option<Entry<'a, K, V>> {
+    pub fn prev(&self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.prev(guard).map(Entry::new)
     }
 }
 
-impl<K, V> Entry<'_, K, V>
+impl<K, V, C> Entry<'_, K, V, C>
 where
-    K: Ord + Send + 'static,
+    C: Comparator<K>,
+    K: Send + 'static,
     V: Send + 'static,
 {
     /// Removes the entry from the map.
@@ -643,7 +638,7 @@ where
     }
 }
 
-impl<K, V> Clone for Entry<'_, K, V> {
+impl<K, V, C> Clone for Entry<'_, K, V, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -651,7 +646,7 @@ impl<K, V> Clone for Entry<'_, K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for Entry<'_, K, V>
+impl<K, V, C> fmt::Debug for Entry<'_, K, V, C>
 where
     K: fmt::Debug,
     V: fmt::Debug,
@@ -665,11 +660,11 @@ where
 }
 
 /// An owning iterator over the entries of a `SkipMap`.
-pub struct IntoIter<K, V> {
-    inner: base::IntoIter<K, V>,
+pub struct IntoIter<K, V, C = BasicComparator> {
+    inner: base::IntoIter<K, V, C>,
 }
 
-impl<K, V> Iterator for IntoIter<K, V> {
+impl<K, V, C> Iterator for IntoIter<K, V, C> {
     type Item = (K, V);
 
     fn next(&mut self) -> Option<(K, V)> {
@@ -677,46 +672,46 @@ impl<K, V> Iterator for IntoIter<K, V> {
     }
 }
 
-impl<K, V> fmt::Debug for IntoIter<K, V> {
+impl<K, V, C> fmt::Debug for IntoIter<K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("IntoIter { .. }")
     }
 }
 
 /// An iterator over the entries of a `SkipMap`.
-pub struct Iter<'a, K, V> {
-    inner: base::RefIter<'a, K, V>,
+pub struct Iter<'a, K, V, C = BasicComparator> {
+    inner: base::RefIter<'a, K, V, C>,
 }
 
-impl<'a, K, V> Iterator for Iter<'a, K, V>
+impl<'a, K, V, C> Iterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, K, V> DoubleEndedIterator for Iter<'a, K, V>
+impl<'a, K, V, C> DoubleEndedIterator for Iter<'a, K, V, C>
 where
-    K: Ord,
+    C: Comparator<K>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<K, V> fmt::Debug for Iter<'_, K, V> {
+impl<K, V, C> fmt::Debug for Iter<'_, K, V, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
-impl<K, V> Drop for Iter<'_, K, V> {
+impl<K, V, C> Drop for Iter<'_, K, V, C> {
     fn drop(&mut self) {
         let guard = &epoch::pin();
         self.inner.drop_impl(guard);
@@ -724,44 +719,45 @@ impl<K, V> Drop for Iter<'_, K, V> {
 }
 
 /// An iterator over a subset of entries of a `SkipMap`.
-pub struct Range<'a, Q, R, K, V>
+pub struct Range<'a, Q, R, K, V, C = BasicComparator>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    pub(crate) inner: base::RefRange<'a, Q, R, K, V>,
+    pub(crate) inner: base::RefRange<'a, Q, R, K, V, C>,
 }
 
-impl<'a, Q, R, K, V> Iterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> Iterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, K, V>;
+    type Item = Entry<'a, K, V, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next(guard).map(Entry::new)
     }
 }
 
-impl<'a, Q, R, K, V> DoubleEndedIterator for Range<'a, Q, R, K, V>
+impl<'a, Q, R, K, V, C> DoubleEndedIterator for Range<'a, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, K, V>> {
+    fn next_back(&mut self) -> Option<Entry<'a, K, V, C>> {
         let guard = &epoch::pin();
         self.inner.next_back(guard).map(Entry::new)
     }
 }
 
-impl<Q, R, K, V> fmt::Debug for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> fmt::Debug for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + fmt::Debug + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
+    K: fmt::Debug,
     V: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
@@ -775,9 +771,9 @@ where
     }
 }
 
-impl<Q, R, K, V> Drop for Range<'_, Q, R, K, V>
+impl<Q, R, K, V, C> Drop for Range<'_, Q, R, K, V, C>
 where
-    K: Ord + Comparable<Q>,
+    C: Comparator<K> + Comparator<K, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
@@ -786,3 +782,20 @@ where
         self.inner.drop_impl(guard);
     }
 }
+
+impl<K, V> SkipMap<K, V> {
+    /// Returns a new, empty map.
+    ///
+    /// # Example
+    ///
+    /// ```
+    /// use crossbeam_skiplist::SkipMap;
+    ///
+    /// let map: SkipMap<i32, &str> = SkipMap::new();
+    /// ```
+    pub fn new() -> Self {
+        Self {
+            inner: base::SkipList::new(epoch::default_collector().clone()),
+        }
+    }
+}
diff --git a/crossbeam-skiplist/src/set.rs b/crossbeam-skiplist/src/set.rs
index 4e91f6c..5a42ea8 100644
--- a/crossbeam-skiplist/src/set.rs
+++ b/crossbeam-skiplist/src/set.rs
@@ -5,7 +5,10 @@ use core::{
     ops::{Bound, Deref, RangeBounds},
 };
 
-use crate::{equivalent::Comparable, map};
+use crate::{
+    comparator::{BasicComparator, Comparator},
+    map,
+};
 
 /// A set based on a lock-free skip list.
 ///
@@ -13,23 +16,15 @@ use crate::{equivalent::Comparable, map};
 /// concurrent access across multiple threads.
 ///
 /// [`BTreeSet`]: std::collections::BTreeSet
-pub struct SkipSet<T> {
-    inner: map::SkipMap<T, ()>,
+pub struct SkipSet<T, C = BasicComparator> {
+    inner: map::SkipMap<T, (), C>,
 }
 
-impl<T> SkipSet<T> {
-    /// Returns a new, empty set.
-    ///
-    /// # Example
-    ///
-    /// ```
-    /// use crossbeam_skiplist::SkipSet;
-    ///
-    /// let set: SkipSet<i32> = SkipSet::new();
-    /// ```
-    pub fn new() -> Self {
+impl<T, C> SkipSet<T, C> {
+    /// Returns an empty collection using the supplied comparator.
+    pub fn with_comparator(comparator: C) -> Self {
         Self {
-            inner: map::SkipMap::new(),
+            inner: map::SkipMap::with_comparator(comparator),
         }
     }
 
@@ -71,9 +66,9 @@ impl<T> SkipSet<T> {
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
     /// Returns the entry with the smallest key.
     ///
@@ -88,7 +83,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.front().unwrap(), 1);
     /// ```
-    pub fn front(&self) -> Option<Entry<'_, T>> {
+    pub fn front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.front().map(Entry::new)
     }
 
@@ -105,7 +100,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.back().unwrap(), 2);
     /// ```
-    pub fn back(&self) -> Option<Entry<'_, T>> {
+    pub fn back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.back().map(Entry::new)
     }
 
@@ -122,7 +117,7 @@ where
     /// ```
     pub fn contains<Q>(&self, key: &Q) -> bool
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.contains_key(key)
@@ -139,9 +134,9 @@ where
     /// assert_eq!(*set.get(&3).unwrap(), 3);
     /// assert!(set.get(&4).is_none());
     /// ```
-    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn get<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.get(key).map(Entry::new)
@@ -171,9 +166,9 @@ where
     /// let greater_than_thirteen = set.lower_bound(Excluded(&13));
     /// assert!(greater_than_thirteen.is_none());
     /// ```
-    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn lower_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.lower_bound(bound).map(Entry::new)
@@ -200,9 +195,9 @@ where
     /// let less_than_six = set.upper_bound(Excluded(&6));
     /// assert!(less_than_six.is_none());
     /// ```
-    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T>>
+    pub fn upper_bound<'a, Q>(&'a self, bound: Bound<&Q>) -> Option<Entry<'a, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.upper_bound(bound).map(Entry::new)
@@ -219,7 +214,7 @@ where
     /// let entry = set.get_or_insert(2);
     /// assert_eq!(*entry, 2);
     /// ```
-    pub fn get_or_insert(&self, key: T) -> Entry<'_, T> {
+    pub fn get_or_insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.get_or_insert(key, ()))
     }
 
@@ -241,7 +236,7 @@ where
     /// assert_eq!(*set_iter.next().unwrap(), 12);
     /// assert!(set_iter.next().is_none());
     /// ```
-    pub fn iter(&self) -> Iter<'_, T> {
+    pub fn iter(&self) -> Iter<'_, T, C> {
         Iter {
             inner: self.inner.iter(),
         }
@@ -264,10 +259,10 @@ where
     /// assert_eq!(*set_range.next().unwrap(), 7);
     /// assert!(set_range.next().is_none());
     /// ```
-    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T>
+    pub fn range<Q, R>(&self, range: R) -> Range<'_, Q, R, T, C>
     where
         R: RangeBounds<Q>,
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         Range {
@@ -276,9 +271,10 @@ where
     }
 }
 
-impl<T> SkipSet<T>
+impl<T, C> SkipSet<T, C>
 where
-    T: Ord + Send + 'static,
+    C: Comparator<T>,
+    T: Send + 'static,
 {
     /// Inserts a `key`-`value` pair into the set and returns the new entry.
     ///
@@ -294,7 +290,7 @@ where
     /// set.insert(2);
     /// assert_eq!(*set.get(&2).unwrap(), 2);
     /// ```
-    pub fn insert(&self, key: T) -> Entry<'_, T> {
+    pub fn insert(&self, key: T) -> Entry<'_, T, C> {
         Entry::new(self.inner.insert(key, ()))
     }
 
@@ -313,9 +309,9 @@ where
     /// assert_eq!(*set.remove(&2).unwrap(), 2);
     /// assert!(set.remove(&2).is_none());
     /// ```
-    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T>>
+    pub fn remove<Q>(&self, key: &Q) -> Option<Entry<'_, T, C>>
     where
-        T: Comparable<Q>,
+        C: Comparator<T, Q>,
         Q: ?Sized,
     {
         self.inner.remove(key).map(Entry::new)
@@ -342,7 +338,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_front(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_front(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_front().map(Entry::new)
     }
 
@@ -367,7 +363,7 @@ where
     /// // All entries have been removed now.
     /// assert!(set.is_empty());
     /// ```
-    pub fn pop_back(&self) -> Option<Entry<'_, T>> {
+    pub fn pop_back(&self) -> Option<Entry<'_, T, C>> {
         self.inner.pop_back().map(Entry::new)
     }
 
@@ -396,34 +392,35 @@ impl<T> Default for SkipSet<T> {
     }
 }
 
-impl<T> fmt::Debug for SkipSet<T>
+impl<T, C> fmt::Debug for SkipSet<T, C>
 where
-    T: Ord + fmt::Debug,
+    C: Comparator<T>,
+    T: fmt::Debug,
 {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("SkipSet { .. }")
     }
 }
 
-impl<T> IntoIterator for SkipSet<T> {
+impl<T, C> IntoIterator for SkipSet<T, C> {
     type Item = T;
-    type IntoIter = IntoIter<T>;
+    type IntoIter = IntoIter<T, C>;
 
-    fn into_iter(self) -> IntoIter<T> {
+    fn into_iter(self) -> IntoIter<T, C> {
         IntoIter {
             inner: self.inner.into_iter(),
         }
     }
 }
 
-impl<'a, T> IntoIterator for &'a SkipSet<T>
+impl<'a, T, C> IntoIterator for &'a SkipSet<T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    type Item = Entry<'a, T>;
-    type IntoIter = Iter<'a, T>;
+    type Item = Entry<'a, T, C>;
+    type IntoIter = Iter<'a, T, C>;
 
-    fn into_iter(self) -> Iter<'a, T> {
+    fn into_iter(self) -> Iter<'a, T, C> {
         self.iter()
     }
 }
@@ -445,12 +442,12 @@ where
 }
 
 /// A reference-counted entry in a set.
-pub struct Entry<'a, T> {
-    inner: map::Entry<'a, T, ()>,
+pub struct Entry<'a, T, C = BasicComparator> {
+    inner: map::Entry<'a, T, (), C>,
 }
 
-impl<'a, T> Entry<'a, T> {
-    fn new(inner: map::Entry<'a, T, ()>) -> Self {
+impl<'a, T, C> Entry<'a, T, C> {
+    fn new(inner: map::Entry<'a, T, (), C>) -> Self {
         Self { inner }
     }
 
@@ -465,9 +462,9 @@ impl<'a, T> Entry<'a, T> {
     }
 }
 
-impl<'a, T> Entry<'a, T>
+impl<'a, T, C> Entry<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
     /// Moves to the next entry in the set.
     pub fn move_next(&mut self) -> bool {
@@ -480,19 +477,20 @@ where
     }
 
     /// Returns the next entry in the set.
-    pub fn next(&self) -> Option<Entry<'a, T>> {
+    pub fn next(&self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 
     /// Returns the previous entry in the set.
-    pub fn prev(&self) -> Option<Entry<'a, T>> {
+    pub fn prev(&self) -> Option<Entry<'a, T, C>> {
         self.inner.prev().map(Entry::new)
     }
 }
 
-impl<T> Entry<'_, T>
+impl<T, C> Entry<'_, T, C>
 where
-    T: Ord + Send + 'static,
+    C: Comparator<T>,
+    T: Send + 'static,
 {
     /// Removes the entry from the set.
     ///
@@ -502,7 +500,7 @@ where
     }
 }
 
-impl<T> Clone for Entry<'_, T> {
+impl<T, C> Clone for Entry<'_, T, C> {
     fn clone(&self) -> Self {
         Self {
             inner: self.inner.clone(),
@@ -510,7 +508,7 @@ impl<T> Clone for Entry<'_, T> {
     }
 }
 
-impl<T> fmt::Debug for Entry<'_, T>
+impl<T, C> fmt::Debug for Entry<'_, T, C>
 where
     T: fmt::Debug,
 {
@@ -521,7 +519,7 @@ where
     }
 }
 
-impl<T> Deref for Entry<'_, T> {
+impl<T, C> Deref for Entry<'_, T, C> {
     type Target = T;
 
     fn deref(&self) -> &Self::Target {
@@ -530,11 +528,11 @@ impl<T> Deref for Entry<'_, T> {
 }
 
 /// An owning iterator over the entries of a `SkipSet`.
-pub struct IntoIter<T> {
-    inner: map::IntoIter<T, ()>,
+pub struct IntoIter<T, C = BasicComparator> {
+    inner: map::IntoIter<T, (), C>,
 }
 
-impl<T> Iterator for IntoIter<T> {
+impl<T, C> Iterator for IntoIter<T, C> {
     type Item = T;
 
     fn next(&mut self) -> Option<T> {
@@ -542,80 +540,81 @@ impl<T> Iterator for IntoIter<T> {
     }
 }
 
-impl<T> fmt::Debug for IntoIter<T> {
+impl<T, C> fmt::Debug for IntoIter<T, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("IntoIter { .. }")
     }
 }
 
 /// An iterator over the entries of a `SkipSet`.
-pub struct Iter<'a, T> {
-    inner: map::Iter<'a, T, ()>,
+pub struct Iter<'a, T, C = BasicComparator> {
+    inner: map::Iter<'a, T, (), C>,
 }
 
-impl<'a, T> Iterator for Iter<'a, T>
+impl<'a, T, C> Iterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, T> DoubleEndedIterator for Iter<'a, T>
+impl<'a, T, C> DoubleEndedIterator for Iter<'a, T, C>
 where
-    T: Ord,
+    C: Comparator<T>,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<T> fmt::Debug for Iter<'_, T> {
+impl<T, C> fmt::Debug for Iter<'_, T, C> {
     fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
         f.pad("Iter { .. }")
     }
 }
 
 /// An iterator over a subset of entries of a `SkipSet`.
-pub struct Range<'a, Q, R, T>
+pub struct Range<'a, Q, R, T, C = BasicComparator>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    inner: map::Range<'a, Q, R, T, ()>,
+    inner: map::Range<'a, Q, R, T, (), C>,
 }
 
-impl<'a, Q, R, T> Iterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> Iterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    type Item = Entry<'a, T>;
+    type Item = Entry<'a, T, C>;
 
-    fn next(&mut self) -> Option<Entry<'a, T>> {
+    fn next(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next().map(Entry::new)
     }
 }
 
-impl<'a, Q, R, T> DoubleEndedIterator for Range<'a, Q, R, T>
+impl<'a, Q, R, T, C> DoubleEndedIterator for Range<'a, Q, R, T, C>
 where
-    T: Ord + Comparable<Q>,
+    C: Comparator<T> + Comparator<T, Q>,
     R: RangeBounds<Q>,
     Q: ?Sized,
 {
-    fn next_back(&mut self) -> Option<Entry<'a, T>> {
+    fn next_back(&mut self) -> Option<Entry<'a, T, C>> {
         self.inner.next_back().map(Entry::new)
     }
 }
 
-impl<Q, R, T> fmt::Debug for Range<'_, Q, R, T>
+impl<Q, R, T, C> fmt::Debug for Range<'_, Q, R, T, C>
 where
-    T: Ord + Comparable<Q> + fmt::Debug,
+    C: Comparator<T> + Comparator<T, Q>,
+    T: fmt::Debug,
     R: RangeBounds<Q> + fmt::Debug,
     Q: ?Sized,
 {
@@ -627,3 +626,20 @@ where
             .finish()
     }
 }
+
+impl<T> SkipSet<T> {
+    /// Returns a new, empty set.
+    ///
+    /// # Example
+    ///
+    /// ```
+    /// use crossbeam_skiplist::SkipSet;
+    ///
+    /// let set: SkipSet<i32> = SkipSet::new();
+    /// ```
+    pub fn new() -> Self {
+        Self {
+            inner: map::SkipMap::new(),
+        }
+    }
+}
diff --git a/crossbeam-skiplist/tests/base.rs b/crossbeam-skiplist/tests/base.rs
index def945f..bc66cc8 100644
--- a/crossbeam-skiplist/tests/base.rs
+++ b/crossbeam-skiplist/tests/base.rs
@@ -1021,3 +1021,33 @@ fn remove_race() {
 
     assert_eq!(*total_removed.get_mut(), KEY_RANGE);
 }
+
+#[test]
+fn runtime_comparator() {
+    use std::ops::Bound::{Excluded, Included};
+    let collector = epoch::Collector::new();
+    let handle = collector.register();
+    let guard = &handle.pin();
+    let list = SkipList::with_comparator(collector, |lhs: &i32, rhs: &i32| rhs.cmp(lhs));
+    assert!(list.get(&2, guard).is_none());
+    for key in [1, 3, 2] {
+        list.insert(key, key, guard).release(guard);
+    }
+    assert_eq!(list.get(&2, guard).unwrap().value(), &2);
+    assert_eq!(
+        list.iter(guard).map(|e| *e.key()).collect::<Vec<_>>(),
+        [3, 2, 1]
+    );
+    let mut iter = list.iter(guard);
+    assert_eq!(*iter.next().unwrap().key(), 3);
+    assert_eq!(*iter.next_back().unwrap().key(), 1);
+    assert_eq!(*iter.next().unwrap().key(), 2);
+    assert!(iter.next_back().is_none());
+    let mut range = list.range((Included(3), Excluded(1)), guard);
+    assert_eq!(*range.next().unwrap().key(), 3);
+    assert_eq!(*range.next_back().unwrap().key(), 2);
+    assert!(range.next().is_none());
+    list.remove(&2, guard).unwrap().release(guard);
+    assert!(!list.contains_key(&2, guard));
+    assert_eq!(list.into_iter().collect::<Vec<_>>(), [(3, 3), (1, 1)]);
+}
diff --git a/crossbeam-skiplist/tests/map.rs b/crossbeam-skiplist/tests/map.rs
index 2fa8c2b..caea068 100644
--- a/crossbeam-skiplist/tests/map.rs
+++ b/crossbeam-skiplist/tests/map.rs
@@ -962,3 +962,85 @@ fn issue_1178() {
         map.insert(k, v);
     }
 }
+
+#[test]
+fn runtime_comparator() {
+    use crossbeam_skiplist::comparator::{Comparator, Equivalator};
+    use std::cmp::Ordering;
+    use std::ops::Bound::{Excluded, Included};
+
+    struct Case(bool);
+
+    impl<R: AsRef<str> + ?Sized> Equivalator<String, R> for Case {
+        fn equivalent(&self, lhs: &String, rhs: &R) -> bool {
+            self.compare(lhs, rhs).is_eq()
+        }
+    }
+
+    impl<R: AsRef<str> + ?Sized> Comparator<String, R> for Case {
+        fn compare(&self, lhs: &String, rhs: &R) -> Ordering {
+            if self.0 {
+                lhs.to_lowercase().cmp(&rhs.as_ref().to_lowercase())
+            } else {
+                lhs.as_str().cmp(rhs.as_ref())
+            }
+        }
+    }
+
+    for insensitive in [false, true] {
+        let map = SkipMap::with_comparator(Case(insensitive));
+        assert!(map.get("aBc").is_none());
+        assert!(
+            map.range::<str, _>((Included("a"), Included("z")))
+                .next()
+                .is_none()
+        );
+        map.insert("abc".to_owned(), 1);
+        map.insert("ABC".to_owned(), 2);
+        assert_eq!(map.len(), if insensitive { 1 } else { 2 });
+        assert_eq!(map.get("aBc").map(|e| *e.value()), insensitive.then_some(2));
+        if !insensitive {
+            assert_eq!(*map.get("abc").unwrap().value(), 1);
+            continue;
+        }
+        assert_eq!(*map.get_or_insert("AbC".to_owned(), 3).value(), 2);
+        assert_eq!(*map.get_or_insert_with("aBC".to_owned(), || 4).value(), 2);
+        map.compare_insert("abc".to_owned(), 5, |v| *v == 2);
+        map.insert("DEF".to_owned(), 6);
+        map.insert("ghi".to_owned(), 7);
+        assert!(map.contains_key("dEf"));
+        assert_eq!(map.lower_bound(Excluded("ABC")).unwrap().key(), "DEF");
+        assert_eq!(map.upper_bound(Included("def")).unwrap().key(), "DEF");
+        let mut iter = map.iter();
+        assert_eq!(iter.next().unwrap().key(), "abc");
+        assert_eq!(iter.next_back().unwrap().key(), "ghi");
+        assert_eq!(iter.next().unwrap().key(), "DEF");
+        assert!(iter.next_back().is_none());
+        let mut range = map.range::<str, _>((Excluded("ABC"), Included("GHI")));
+        assert_eq!(range.next_back().unwrap().key(), "ghi");
+        assert_eq!(range.next().unwrap().key(), "DEF");
+        assert!(range.next().is_none());
+        let mut entry = map.front().unwrap();
+        assert!(entry.move_next());
+        assert_eq!(entry.key(), "DEF");
+        assert_eq!(entry.prev().unwrap().key(), "abc");
+        assert_eq!(entry.next().unwrap().key(), "ghi");
+        assert!(entry.move_prev());
+        assert!(entry.remove());
+        assert!(entry.is_removed());
+        assert_eq!(*map.remove("def").unwrap().value(), 6);
+        assert_eq!(map.pop_back().unwrap().key(), "ghi");
+        assert!(map.pop_front().is_none());
+    }
+}
+
+#[test]
+fn boxed_comparison_closure() {
+    use std::cmp::Ordering;
+    let compare: Box<dyn Fn(&String, &String) -> Ordering> = Box::new(|lhs, rhs| rhs.cmp(lhs));
+    let map = SkipMap::with_comparator(compare);
+    map.insert("a".to_owned(), 1);
+    map.insert("b".to_owned(), 2);
+    assert_eq!(map.iter().map(|e| *e.value()).collect::<Vec<_>>(), [2, 1]);
+    assert_eq!(map.into_iter().map(|(_, v)| v).collect::<Vec<_>>(), [2, 1]);
+}
diff --git a/crossbeam-skiplist/tests/set.rs b/crossbeam-skiplist/tests/set.rs
index e439bf0..caa4af7 100644
--- a/crossbeam-skiplist/tests/set.rs
+++ b/crossbeam-skiplist/tests/set.rs
@@ -717,3 +717,29 @@ fn concurrent_insert_get_same_key() {
     }
     handle.join().unwrap()
 }
+
+#[test]
+fn runtime_comparator_without_ord() {
+    struct Key(i32);
+    let set = SkipSet::with_comparator(|lhs: &Key, rhs: &Key| rhs.0.cmp(&lhs.0));
+    assert!(set.is_empty());
+    set.insert(Key(1));
+    set.insert(Key(3));
+    set.insert(Key(2));
+    set.insert(Key(2));
+    assert_eq!(set.len(), 3);
+    assert!(set.contains(&Key(2)));
+    assert_eq!(
+        set.iter().map(|e| e.value().0).collect::<Vec<_>>(),
+        [3, 2, 1]
+    );
+    assert_eq!(
+        set.range(Key(3)..Key(1))
+            .map(|e| e.value().0)
+            .collect::<Vec<_>>(),
+        [3, 2]
+    );
+    assert_eq!(set.remove(&Key(2)).unwrap().value().0, 2);
+    assert_eq!(set.pop_front().unwrap().value().0, 3);
+    assert_eq!(set.into_iter().map(|k| k.0).collect::<Vec<_>>(), [1]);
+}
```

</details>

<details><summary>reply</summary>

Done.
Added runtime comparators, boxed closures, borrowed queries, default ordering compatibility. All 127 skiplist tests passed; no_std checked. Workspace tests not run.

</details>
