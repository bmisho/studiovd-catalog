import assert from "node:assert/strict"
import { test } from "node:test"
import { footprintModels, rawUrl } from "./kicad-sources.mjs"

test("raw URLs at the pinned tag, every segment encoded, no other paths", () => {
  assert.equal(
    rawUrl("10.0.7", "kicad-footprints/TerminalBlock_Phoenix.pretty/TerminalBlock_Phoenix_MKDS-1,5-2.kicad_mod"),
    "https://gitlab.com/kicad/libraries/kicad-footprints/-/raw/10.0.7/TerminalBlock_Phoenix.pretty/TerminalBlock_Phoenix_MKDS-1%2C5-2.kicad_mod"
  )
  for (const bad of ["kicad-footprints/../x", "other/x.step", "kicad-packages3D/a/b/c.step", "kicad-packages3D/a b"])
    assert.throws(() => rawUrl("10.0.7", bad), bad)
})

test("the models a footprint places", () => {
  const fp = '(footprint "x" (model "${KICAD10_3DMODEL_DIR}/A.3dshapes/a.step" (offset (xyz 0 0 0))) (model "${KICAD10_3DMODEL_DIR}/A.3dshapes/b.step"))'
  assert.deepEqual(footprintModels(fp), ["A.3dshapes/a.step", "A.3dshapes/b.step"])
})
