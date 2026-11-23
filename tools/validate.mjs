// Checks an index the way StudioVD does before it trusts one: the JSON Schema copy of the app's
// CatalogIndexSchema (schema/catalog-index.schema.json, generated in the app repo from
// src/core/schema/component/catalogIndex.ts) plus the cross-references its superRefine adds,
// which JSON Schema cannot express.
import { readFileSync } from "node:fs"
import Ajv2020 from "ajv/dist/2020.js"

const schemaPath = new URL("../schema/catalog-index.schema.json", import.meta.url)
const ajv = new Ajv2020({ allErrors: true, strict: false })
const schemaCheck = ajv.compile(JSON.parse(readFileSync(schemaPath, "utf8")))

/** Every reason StudioVD would refuse `index`; empty when it would accept it. */
export function problems(index) {
  const out = []
  if (!schemaCheck(index))
    for (const e of schemaCheck.errors ?? []) out.push(`${e.instancePath || "/"} ${e.message}`)
  if (out.length > 0) return out // the cross-checks below assume the shape is right

  const listed = (pack) => Object.hasOwn(index.packs, pack)
  for (const [id, entry] of Object.entries(index.packs))
    if (entry.sha256 !== id) out.push(`/packs/${id}/sha256 is not its key`)
  const seen = new Set()
  index.components.forEach((c, i) => {
    const at = `${c.id}@${c.version}`
    if (seen.has(at)) out.push(`/components/${i} ${at} is listed twice`)
    seen.add(at)
    if (!listed(c.pack)) out.push(`/components/${i}/pack is not a listed pack`)
    if (!listed(c.thumbnail.pack)) out.push(`/components/${i}/thumbnail/pack is not a listed pack`)
  })
  index.bundles.forEach((b, i) => {
    if (!listed(b.pack)) out.push(`/bundles/${i}/pack is not a listed pack`)
    b.components.forEach((c, j) => {
      if (!seen.has(`${c.id}@${c.version}`)) out.push(`/bundles/${i}/components/${j} is not listed`)
    })
  })
  for (const [path, id] of Object.entries(index.previewPacks))
    if (!listed(id)) out.push(`/previewPacks/${path} is not a listed pack`)
  index.generatorPresets.forEach((g, i) => {
    if (!listed(g.pack)) out.push(`/generatorPresets/${i}/pack is not a listed pack`)
  })
  if (Date.parse(index.expiresAt) <= Date.parse(index.generatedAt))
    out.push("/expiresAt must be after generatedAt")
  return out
}
