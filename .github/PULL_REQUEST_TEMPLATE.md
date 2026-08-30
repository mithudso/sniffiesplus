## Summary

<!-- One or two sentences. -->

## What changed

<!-- Which part: the userscript .txt, lib/, tests, docs? If a selector or
     endpoint changed, cite the docs/sniffies-dom-and-api.md entry that
     backs it — or add one. -->

## Testing done

<!-- Which of these ran, and the result: -->

- [ ] `npm run check` (lint + `npm test` + `npm run test:lib` + `npm run build:check`)
- [ ] Manually verified on sniffies.com, if the change touches DOM/network/UI behavior

## Version bump (if the userscript version changed — all 4, none are auto-synced)

- [ ] Filename (`...-<version>.txt`)
- [ ] `// @version` header (line 4)
- [ ] `// @last-change` header date (line 5)
- [ ] Final `logInfo("Sniffies soft filter loaded (vX.Y.Z)")` call

## Docs

- [ ] Docs updated if behavior changed (in-file README block, `docs/`, or `lib/README.md`)
- [ ] `dist/` regenerated via `npm run build:lib` if `lib/` changed (never hand-edited)
