Fix targets missing component after padding modifier; check parser and regression tests.


Done.
Trailing padding modifiers return errors at missing component’s byte index. Borrowed and owned parsers covered; 53 strftime tests passed.
