I’ll check both iterators, fix how their forward and reverse ends share a range, and add regression tests for reversed windows.

Both reverse methods currently move the forward cursor backward, so they don’t consume the same range. I’ll track the remaining length so both ends meet correctly, while preserving the dates produced by forward iteration. I’ll also update the documentation’s reverse examples to use bounded windows.

Fixed both iterators so forward and reverse iteration consume the same range, with accurate remaining lengths and consistent exhaustion.

Added regression tests for your example, mixed forward/reverse calls, and date boundaries. Updated the documentation while preserving existing forward endpoint behavior.

Validation passed: 292 unit tests, both iterator documentation examples, and a build without default features.
