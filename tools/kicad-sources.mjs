// The KiCad files the pack recipes need, pinned (PLAN 14.7): one tag of KiCad's libraries,
// and every file's SHA-256 in content/kicad/lock.json. `fetch` downloads exactly those files
// and refuses any that differ; `lock` (re)writes the lock from the recipes, by hand, when the
// recipes or the tag change. Only gitlab.com is contacted, and only for listed paths.
//
//   node tools/kicad-sources.mjs lock
//   node tools/kicad-sources.mjs fetch --out sources
import { createHash } from "node:crypto"
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { parseArgs } from "node:util"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const LOCK = join(root, "content/kicad/lock.json")
const PACKS = join(root, "content/kicad/packs")
const REPOS = { "kicad-packages3D": "kicad-packages3D", "kicad-footprints": "kicad-footprints" }
const SAFE = /^(kicad-packages3D|kicad-footprints)\/[A-Za-z0-9_.,+-]+(\/[A-Za-z0-9_.,+-]+)?$/

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")

/** The raw-file URL of `path` (repo/…) at `tag`, each segment encoded. */
export function rawUrl(tag, path) {
  if (!SAFE.test(path) || path.includes("..")) throw new Error(`refusing path ${path}`)
  const [repo, ...rest] = path.split("/")
  const file = rest.map(encodeURIComponent).join("/")
  return `https://gitlab.com/kicad/libraries/${REPOS[repo]}/-/raw/${encodeURIComponent(tag)}/${file}`
}

async function download(url, { optional = false } = {}) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { redirect: "error" })
    if (res.status === 404 && optional) return null
    if (res.ok) return new Uint8Array(await res.arrayBuffer())
    if (attempt >= 4 || res.status < 500) throw new Error(`${url}: HTTP ${res.status}`)
    await new Promise((r) => setTimeout(r, 2000 * attempt))
  }
}

/** The model paths a footprint places (as KiCad writes them, ${KICADn_3DMODEL_DIR}/…). */
export const footprintModels = (text) =>
  [...text.matchAll(/\(model "\$\{KICAD\d*_3DMODEL_DIR\}\/([^"]+)"/g)].map((m) => m[1])

function recipes() {
  return readdirSync(PACKS)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .flatMap((f) => JSON.parse(readFileSync(join(PACKS, f), "utf8")).components)
}

async function lock() {
  const { tag } = JSON.parse(readFileSync(LOCK, "utf8"))
  const files = {}
  const add = (path, bytes) => (files[path] = sha256(bytes))
  add("kicad-packages3D/LICENSE.md", await download(rawUrl(tag, "kicad-packages3D/LICENSE.md")))
  const folders = new Set()
  for (const r of recipes()) {
    const fpPath = `kicad-footprints/${r.footprint}`
    const fp = await download(rawUrl(tag, fpPath))
    add(fpPath, fp)
    const models = footprintModels(new TextDecoder().decode(fp))
    if (!r.model && models.length !== 1) throw new Error(`${r.id}: name the model (the footprint has ${models.length})`)
    const model = r.model ?? models[0]
    add(`kicad-packages3D/${model}`, await download(rawUrl(tag, `kicad-packages3D/${model}`)))
    folders.add(model.split("/")[0])
  }
  for (const folder of [...folders].sort()) {
    const path = `kicad-packages3D/${folder}/CREDITS.md`
    const credits = await download(rawUrl(tag, path), { optional: true })
    if (credits) add(path, credits)
  }
  const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(LOCK, `${JSON.stringify({ tag, files: sorted }, null, 2)}\n`)
  console.log(`${LOCK}: ${Object.keys(sorted).length} files at ${tag}`)
}

async function fetchAll(out) {
  const { tag, files } = JSON.parse(readFileSync(LOCK, "utf8"))
  for (const [path, want] of Object.entries(files)) {
    const bytes = await download(rawUrl(tag, path))
    const got = sha256(bytes)
    if (got !== want) throw new Error(`${path}: SHA-256 ${got}, the lock says ${want}`)
    mkdirSync(dirname(join(out, path)), { recursive: true })
    writeFileSync(join(out, path), bytes)
  }
  console.log(`${Object.keys(files).length} files at ${tag} → ${out}, all matching the lock`)
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { out: { type: "string", default: "sources" } },
  })
  if (positionals[0] === "lock") return lock()
  if (positionals[0] === "fetch") return fetchAll(values.out)
  throw new Error("usage: node tools/kicad-sources.mjs lock | fetch --out <dir>")
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main()
