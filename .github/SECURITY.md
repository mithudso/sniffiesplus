# Security policy

## Reporting

Open a [private security advisory](https://github.com/mithudso/sniffies-soft-filter/security/advisories/new)
rather than a public issue, or contact the maintainer
([@mithudso](https://github.com/mithudso)) directly. This is a personal repo,
so response times are best-effort — but private first, always. Include the
version from the `@version` header and what the script did versus what you
expected.

## Scope

This is a userscript that runs in the userscript sandbox of your own browser
against your own Sniffies session. There is no server, no telemetry, and no
third party — nothing leaves your machine except the requests you would make
anyway (plus Google Drive, only if you manually enable sync).

The things worth reporting:

- **Anything that leaks the Drive OAuth tokens.** They live in Tampermonkey GM
  storage (not `localStorage`) precisely so the page cannot read them; a path
  that exposes them to the page or logs them is a real finding.
- **A weakness in the export encryption.** Export/import supports optional
  passphrase encryption (AES-GCM + PBKDF2). A downgrade, nonce-reuse, or
  key-derivation flaw belongs here.
- **A path that breaks the sandbox boundary.** The script deliberately avoids
  page-context injection (the site ships SES/lockdown); anything that gets
  script content executing in the page realm is a bug.

## Out of scope

Sniffies' own site, API behavior, and rate limits. This project only documents
what it observes.
