AoT replacement must keep later dotted keys at top level. Checking replacement and rendering paths.


Shared replacement handles table headers but omits AoT headers. Scope: header condition and regression test; callers, fixtures, config, exports unchanged.


Done.
AoT replacement preserves top-level siblings; regression coverage added. 368 tests passed; TOML conformance tests blocked by missing fixtures.
