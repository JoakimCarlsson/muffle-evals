#![allow(unsafe_code)]

use super::{Bucket, IndexMapCore};
use crate::util::simplify_range;

use core::ops::RangeBounds;

impl<K, V> IndexMapCore<K, V> {
    #[track_caller]
    pub(crate) fn extract<R>(&mut self, range: R) -> ExtractCore<'_, K, V>
    where
        R: RangeBounds<usize>,
    {
        let range = simplify_range(range, self.entries.len());

        // SAFETY: We must have consistent lengths to start, so that's a hard assertion.
        // Then the worst `set_len` can do is leak items if `ExtractCore` doesn't drop.
        assert_eq!(self.entries.len(), self.indices.len());
        unsafe {
            self.entries.set_len(range.start);
        }
        ExtractCore {
            map: self,
            new_len: range.start,
            current: range.start,
            end: range.end,
        }
    }
}

pub(crate) struct ExtractCore<'a, K, V> {
    map: &'a mut IndexMapCore<K, V>,
    /// Length of the kept prefix; entries in `new_len..current` are moved-from.
    new_len: usize,
    /// Next entry to test.
    current: usize,
    end: usize,
}

impl<K, V> Drop for ExtractCore<'_, K, V> {
    fn drop(&mut self) {
        let old_len = self.map.indices.len();
        let ptr = self.map.entries.as_mut_ptr();

        // SAFETY: `new_len <= current <= old_len <= capacity`, entries in
        // `current..old_len` are still initialized, and `new_len` is the
        // vec's current length, so the moved range ends up contiguous.
        unsafe {
            if self.new_len != self.current {
                let tail = old_len - self.current;
                ptr.add(self.current).copy_to(ptr.add(self.new_len), tail);
            }
            self.map
                .entries
                .set_len(self.new_len + old_len - self.current);
        }

        if self.new_len != self.current {
            self.map.rebuild_hash_table();
        }
    }
}

impl<K, V> ExtractCore<'_, K, V> {
    pub(crate) fn extract_if<F>(&mut self, mut pred: F) -> Option<Bucket<K, V>>
    where
        F: FnMut(&mut Bucket<K, V>) -> bool,
    {
        debug_assert!(self.end <= self.map.indices.len());
        let ptr = self.map.entries.as_mut_ptr();

        while self.current < self.end {
            // SAFETY: `current < end <= old_len`, so the entry is initialized.
            // If `pred` panics, `current` is not advanced and Drop keeps it.
            let item = unsafe { &mut *ptr.add(self.current) };
            if pred(item) {
                self.current += 1;
                // SAFETY: the entry is now moved-from and never touched again.
                return Some(unsafe { (item as *mut Bucket<K, V>).read() });
            }
            if self.new_len != self.current {
                // SAFETY: `new_len` is a moved-from slot below `current`.
                unsafe {
                    (item as *mut Bucket<K, V>).copy_to_nonoverlapping(ptr.add(self.new_len), 1);
                }
            }
            self.new_len += 1;
            self.current += 1;
        }
        None
    }

    pub(crate) fn remaining(&self) -> usize {
        self.end - self.current
    }
}
