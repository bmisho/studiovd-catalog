// Builds the catalog index StudioVD downloads (index.json) for one sequence, from what this
// repository records: catalog/catalog.json (settings, categories, notices, revocations) and
// catalog/packs.json (the packs already published as releases and what they hold). It refuses
// to write an index the app would refuse, and writes the trusted comment the signature binds.
//
//   node tools/build-index.mjs --sequence 7 --key keys/active.pub --out dist/index.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { parseArgs } from "node:util"
import { fileURLToPath } from "node:url"
import { problems } from "./validate.mjs"

const DAY_MS = 86_400_000
const root = fileURLToPath(new URL("..", import.meta.url))
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"))

/** The minisign key id (16 hex digits, as minisign prints it) of a public key file's text. */
export function keyId(pubFileText) {
  const line = pubFileText.split(/\r?\n/).find((l) => l.startsWith("RW"))
  const bytes = Buffer.from(line ?? "", "base64")
  if (bytes.length !== 42 || bytes.toString("latin1", 0, 2) !== "Ed")
    throw new Error("not a minisign public key")
  return bytes.readBigUInt64LE(2).toString(16).toUpperCase().padStart(16, "0")
}

/** An ISO UTC time without milliseconds (the app accepts both; whole seconds read better). */
const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z")

/** The index for `sequence`, or throws with every reason the app would refuse it. */
export function buildIndex({ settings, published, sequence, keyId: signingKeyId, nowMs }) {
  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error("bad sequence")
  const index = {
    format: "studiovd-catalog",
    schemaVersion: 1,
    catalogId: settings.catalogId,
    sequence,
    generatedAt: iso(nowMs),
    expiresAt: iso(nowMs + settings.validDays * DAY_MS),
    minAppVersion: settings.minAppVersion,
    signingKeyId,
    mirrors: settings.mirrors,
    categories: settings.categories,
    components: published.components,
    packs: published.packs,
    bundles: published.bundles,
    previewPacks: published.previewPacks,
    generatorPresets: published.generatorPresets,
    revoked: settings.revoked,
    notices: settings.notices,
  }
  const refused = problems(index)
  if (refused.length > 0) throw new Error(`StudioVD would refuse this index:\n${refused.join("\n")}`)
  return index
}

/** The trusted comment the signature must carry (checked by the app against the index). */
export const trustedComment = (index) =>
  `studiovd-catalog catalog=${index.catalogId} sequence=${index.sequence} schema=${index.schemaVersion}`

function main() {
  const { values } = parseArgs({
    options: {
      sequence: { type: "string" },
      key: { type: "string", default: "keys/active.pub" },
      out: { type: "string", default: "dist/index.json" },
      now: { type: "string" },
    },
  })
  const index = buildIndex({
    settings: readJson(join(root, "catalog/catalog.json")),
    published: readJson(join(root, "catalog/packs.json")),
    sequence: Number(values.sequence),
    keyId: keyId(readFileSync(values.key, "utf8")),
    nowMs: values.now ? Date.parse(values.now) : Date.now(),
  })
  mkdirSync(dirname(values.out), { recursive: true })
  writeFileSync(values.out, `${JSON.stringify(index, null, 2)}\n`)
  writeFileSync(join(dirname(values.out), "trusted-comment.txt"), trustedComment(index))
  console.log(`${values.out}: sequence ${index.sequence}, expires ${index.expiresAt}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
