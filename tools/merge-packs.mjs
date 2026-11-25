// Records a pack build in catalog/packs.json (PLAN 14.8): the builder's published.json says
// which packs it made (`<tag>/<name>.stvdpack`, `<tag>/<name>.previews.zip`) and what they
// hold. Packs of the same names from earlier builds, and the components, bundles and preview
// entries that pointed at them, are replaced; everything else stays.
//
//   node tools/merge-packs.mjs dist/packs/published.json
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("..", import.meta.url))
const fileName = (url) => url.slice(url.lastIndexOf("/") + 1)

/** `recorded` with `built` merged in, as a new object. */
export function mergePacks(recorded, built) {
  const names = new Set(Object.values(built.packs).map((p) => fileName(p.url)))
  const stale = new Set(
    Object.entries(recorded.packs)
      .filter(([, p]) => names.has(fileName(p.url)))
      .map(([sha]) => sha)
  )
  const keep = (sha) => !stale.has(sha)
  const ids = new Set(built.components.map((c) => `${c.id}@${c.version}`))
  const packs = Object.fromEntries(Object.entries(recorded.packs).filter(([sha]) => keep(sha)))
  Object.assign(packs, built.packs)
  return {
    packs,
    components: [
      ...recorded.components.filter(
        (c) => keep(c.pack) && keep(c.thumbnail.pack) && !ids.has(`${c.id}@${c.version}`)
      ),
      ...built.components,
    ],
    bundles: [
      ...recorded.bundles.filter((b) => keep(b.pack) && !built.bundles.some((n) => n.id === b.id)),
      ...built.bundles,
    ],
    previewPacks: {
      ...Object.fromEntries(Object.entries(recorded.previewPacks).filter(([, sha]) => keep(sha))),
      ...built.previewPacks,
    },
    generatorPresets: recorded.generatorPresets.filter((g) => keep(g.pack)),
  }
}

function main() {
  const [published] = process.argv.slice(2)
  if (!published) throw new Error("usage: node tools/merge-packs.mjs <published.json>")
  const path = join(root, "catalog/packs.json")
  const merged = mergePacks(
    JSON.parse(readFileSync(path, "utf8")),
    JSON.parse(readFileSync(published, "utf8"))
  )
  writeFileSync(path, `${JSON.stringify(merged, null, 2)}\n`)
  console.log(`${path}: ${Object.keys(merged.packs).length} packs, ${merged.components.length} components`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
