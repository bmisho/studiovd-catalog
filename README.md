# StudioVD catalog

The official component catalog of [StudioVD](https://github.com/bmisho/StudioVD): a signed
`index.json` and the content packs it lists, published as GitHub releases of this repository.
StudioVD downloads them only when the user asks (Refresh, Download) and trusts nothing it
fetches until a compiled-in minisign key has verified the index and SHA-256 has checked
every pack. This repository's hosts are untrusted; the signature is what counts.

## Where StudioVD looks

- Index: `https://github.com/bmisho/studiovd-catalog/releases/latest/download/index.json`
  and `index.json.minisig`, from the release marked **latest** (a `catalog-<sequence>` release).
- Packs: `https://github.com/bmisho/studiovd-catalog/releases/download/<tag>/<file>`, from
  their own releases, **never** marked latest.

## Keys

| Key | Id | Where |
|---|---|---|
| Active | `A26FD5C302F7F8FB` | `keys/active.pub`; secret key in the `catalog-publish` environment |
| Backup | `97EEE73CB6AC658E` | `keys/backup.pub`; secret key offline, only for a key compromise |

Both public keys are compiled into StudioVD (`src-tauri/src/library/online/source.rs`).
Rotation and compromise procedures: `docs/catalog-signing.md` in the app repository.

## Publishing

`catalog/catalog.json` holds the settings (validity, minimum app version, categories,
notices, revocations); `catalog/packs.json` records the packs already released and what they
hold. The **Publish catalog** workflow (run it from the Actions tab; it also runs monthly so
the index never expires):

1. takes the next sequence (one above the highest `catalog-N` release);
2. builds `dist/index.json` with `tools/build-index.mjs`, refusing anything StudioVD would
   refuse (`schema/catalog-index.schema.json` plus the app's cross-reference rules);
3. signs it with the active key: prehashed, trusted comment
   `studiovd-catalog catalog=official sequence=N schema=1` (`tools/sign.sh`);
4. releases `catalog-N` as latest and fetches it back to check what StudioVD will get.

It needs two secrets in the `catalog-publish` environment (Settings › Environments):

- `MINISIGN_SECRET_KEY`: the whole text of `studiovd-catalog-active.key`;
- `MINISIGN_PASSWORD`: its password.

`schema/catalog-index.schema.json` is generated in the app repository
(`docs/formats/catalog-index.schema.json`, kept equal to the app's zod schema by a test);
copy it here whenever it changes there.

## Content

Packs are built from KiCad's libraries (PLAN 14.7, 14.8) by StudioVD's own builder
(`tools/packs` in the app repository; `docs/catalog-content.md` there explains each step):

- `content/kicad/packs/*.json`: what each pack holds, per component the KiCad footprint
  and model, names, pin names, the schematic block, and every stated value with its source;
- `content/kicad/lock.json`: the KiCad tag and the SHA-256 of every file the recipes need
  (`node tools/kicad-sources.mjs lock` after editing a recipe; the build refuses any file
  that differs);
- `catalog/app.json`: the StudioVD commit whose builder and install check a build uses.

The **Build packs** workflow (Actions tab) fetches the pinned files, builds the packs,
installs every one with StudioVD's own install code, releases them as `packs-N`, records
them in `catalog/packs.json` and starts **Publish catalog**.

Official content must be CC0-1.0, CC-BY-3.0, CC-BY-4.0, CC-BY-SA-4.0 (± KiCad libraries
exception), MIT, BSD-2/3-Clause or Apache-2.0, carry its licence, source at a pinned revision
and modifications, and never comes from McMaster-Carr, TraceParts, GrabCAD or 3D
ContentCentral. KiCad's libraries are CC-BY-SA-4.0 with the KiCad libraries exception; each
component carries that licence, KiCad's credits and its STEP file's own header.

## Checks

`npm test` runs the tools' tests. The **Check** workflow runs them on every push, builds an
index from `catalog/` and signs it with a throwaway key exactly as the publish workflow does.
