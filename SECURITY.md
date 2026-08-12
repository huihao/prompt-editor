# Security Policy

## Supported Versions

Prompt Editor has not published a stable release. Security fixes apply to the latest default-branch revision. macOS is supported; Windows and Linux are experimental and may not receive platform-specific fixes on the same schedule.

## Reporting a Vulnerability

Do not open a public issue for an undisclosed vulnerability.

When hosted on GitHub, use the repository **Security** tab and **Report a vulnerability**. If private vulnerability reporting is unavailable, contact the repository owner privately through the hosting account before sharing details. The project does not currently publish a dedicated security email address.

Include the affected revision/platform, reproduction steps, expected impact, required user interaction, exposed data categories, and a suggested mitigation if available. Use synthetic values; do not send real API keys, signing certificates, prompts, terminal output, or unrelated personal data.

Maintainers should acknowledge a complete report within seven calendar days, provide a status update within fourteen days, and coordinate disclosure after a fix is available. These are response targets, not a warranty.

## Security-Sensitive Areas

Review changes carefully when they affect AI provider keys, WebView HTML/bridges, file access, clipboard/terminal automation, shell startup files, local user content, diagnostic logs, or release signing.

Provider API keys are currently stored in the application's local WebView storage. Treat the local account and application profile as part of the trust boundary; remove saved keys before sharing a profile or diagnostic archive.

## Release Integrity

Official artifacts should include SHA-256 checksum files. Signed releases should pass `codesign` and `spctl`; notarized disk images should carry a stapled Apple ticket. Unsigned development artifacts must be identified as such and must not be redistributed as official releases.
