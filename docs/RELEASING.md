# Releasing

Prompt Editor follows Semantic Versioning. Stable tags use `vMAJOR.MINOR.PATCH`; prereleases may use a suffix such as `v0.2.0-rc.1`.

## Required GitHub Secrets

Configure these Actions secrets before publishing:

- `MACOS_CERTIFICATE_P12_BASE64`: base64-encoded Developer ID Application certificate and private key
- `MACOS_CERTIFICATE_PASSWORD`: PKCS#12 password
- `MACOS_KEYCHAIN_PASSWORD`: temporary CI keychain password
- `MACOS_SIGNING_IDENTITY`: exact `Developer ID Application: ...` identity
- `APPLE_ID`: notarization Apple ID
- `APPLE_TEAM_ID`: Apple Developer team ID
- `APPLE_APP_PASSWORD`: app-specific password

Do not commit certificates, passwords, API keys, keychains, or notarization profiles. Local maintainers may create a `notarytool` keychain profile and set `APPLE_NOTARY_PROFILE` plus `MACOS_SIGNING_IDENTITY`.

## Release Checklist

1. Update the version in `editor/package.json`, `core/Cargo.toml`, and `macos/PromptEditor/Info.plist`. Regenerate affected lockfiles.
2. Move relevant `CHANGELOG.md` entries from Unreleased into a dated version section.
3. Verify locally:

   ```bash
   ./scripts/check-version.sh 0.1.0
   make verify
   make package-macos VERSION=0.1.0
   cd build/release && shasum -a 256 -c *.sha256
   ```

4. Commit the release preparation with `chore(release): prepare 0.1.0`.
5. Create and push an annotated tag:

   ```bash
   git tag -a v0.1.0 -m "Prompt Editor 0.1.0"
   git push origin v0.1.0
   ```

6. Watch the Release workflow. It retests, builds Universal 2, imports the certificate into a temporary keychain, signs, notarizes, staples, checksums, and creates the GitHub Release.
7. Download the published artifacts and verify `codesign --verify --deep --strict`, `spctl --assess --type execute`, architectures, checksums, and a clean-machine launch.

The workflow deliberately fails when signing or notarization secrets are missing. Official releases must not silently fall back to unsigned artifacts.

## Rollback

Do not move an existing tag. If artifacts are invalid, mark the GitHub Release as a draft or delete the release assets, document the incident, and publish a new patch version. Revert the faulty code with `git revert`, run the full checklist, and tag the corrected commit. Users can reinstall the last known-good signed release; local data formats must remain backward compatible or include a tested migration.

GitHub Actions provides native failure notifications to repository watchers. The success summary includes the release URL; organization-specific chat or email notifications can be added later.
