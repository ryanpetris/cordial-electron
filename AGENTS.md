# Cordial Electron agent instructions

## Updating protocol bindings

The main Cordial repository owns the protocol schemas and release compatibility
checks. This repository commits generated TypeScript and shared wire fixtures.
Do not edit generated bindings or downloaded fixtures by hand.

When a task requires updated bindings:

1. Run `make deps` to install the pinned generation tools.
2. Run `python3 tools/update_protocol.py` to use the latest published GitHub
   release. If the task specifies a release, pass its tag, for example
   `python3 tools/update_protocol.py v0.10.4`.
3. Review `desktop/packages/protocol/source.json` for the selected tag, source
   archive URL, and checksum. Review the generated diff for protocol changes
   that require client or UI changes within the task's scope.
4. Run `make check build web`. The tests use local fixtures and must not fetch
   Cordial or require a checkout of its repository.
5. Commit `desktop/packages/protocol/src/gen/`,
   `desktop/packages/protocol/src/current.ts`,
   `desktop/packages/protocol/test/fixtures/`, and
   `desktop/packages/protocol/source.json` together with any required client
   changes. Run the review skill before handing back a nontrivial change.

The updater downloads a GitHub source tar archive, extracts the generation inputs
temporarily, and verifies upstream schema fingerprints. If generation or
validation fails, investigate the failure; do not alter recorded fingerprints to
make the update pass. Keep Cordial downloads confined to the explicit update
command. Do not add downloads to builds, tests, dependency installation, or CI.
