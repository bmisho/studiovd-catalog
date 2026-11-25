import assert from "node:assert/strict"
import { test } from "node:test"
import { mergePacks } from "./merge-packs.mjs"

const sha = (c) => c.repeat(64)
const pack = (s, url) => ({ url, sha256: s, bytes: 1, uncompressedBytes: 1, entries: 1 })
const comp = (id, p, t) => ({ id, version: "1.0.0", pack: p, thumbnail: { pack: t, path: "x", sha256: sha("f") } })

test("a rebuild replaces the packs of the same names and what pointed at them", () => {
  const recorded = {
    packs: { [sha("a")]: pack(sha("a"), "packs-1/leds.stvdpack"), [sha("b")]: pack(sha("b"), "packs-1/leds.previews.zip"), [sha("c")]: pack(sha("c"), "packs-1/other.stvdpack") },
    components: [comp("official/led", sha("a"), sha("b")), comp("official/other", sha("c"), sha("c"))],
    bundles: [{ id: "leds", pack: sha("a") }, { id: "other", pack: sha("c") }],
    previewPacks: { electronics: sha("b") },
    generatorPresets: [],
  }
  const built = {
    packs: { [sha("d")]: pack(sha("d"), "packs-2/leds.stvdpack"), [sha("e")]: pack(sha("e"), "packs-2/leds.previews.zip") },
    components: [comp("official/led", sha("d"), sha("e"))],
    bundles: [{ id: "leds", pack: sha("d") }],
    previewPacks: { electronics: sha("e") },
  }
  const m = mergePacks(recorded, built)
  assert.deepEqual(Object.keys(m.packs).sort(), [sha("c"), sha("d"), sha("e")])
  assert.deepEqual(m.components.map((c) => [c.id, c.pack]), [["official/other", sha("c")], ["official/led", sha("d")]])
  assert.deepEqual(m.bundles.map((b) => b.id), ["other", "leds"])
  assert.deepEqual(m.previewPacks, { electronics: sha("e") })
})
