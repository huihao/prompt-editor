# Continuous Integration and Delivery

`CI` runs on every push and pull request.

| Job | Runner | Stages | Outputs |
| --- | --- | --- | --- |
| Rust and editor quality | Ubuntu | rustfmt, Clippy, strict TypeScript, Rust/editor tests, production editor build, LCOV coverage | Combined coverage artifact |
| macOS Apple Silicon | macOS 14 | all deterministic tests, Swift tests, Universal 2 build, architecture verification | Universal app bundle |

`Release` runs for tags matching `v*`. It checks version consistency, repeats tests, builds both macOS architectures, requires Developer ID credentials, notarizes the DMG, generates SHA-256 files, and publishes every artifact with generated release notes.

Reproduce the primary gates locally:

```bash
make lint
make test
make coverage
make macos
```

GitHub-hosted runners are the clean-environment authority. Windows and Linux GUI builds are not release gates while those ports remain experimental. Workflow permissions are read-only by default; only the release workflow receives `contents: write` for GitHub Release publication.

Failed runs appear in the Actions UI and use GitHub's normal notification settings. Successful releases write the artifact URL to the workflow summary.
