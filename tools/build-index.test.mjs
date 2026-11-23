import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { buildIndex, keyId, trustedComment } from "./build-index.mjs"
import { signatureProblem } from "./check-signature.mjs"
import { problems } from "./validate.mjs"

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8")
const settings = JSON.parse(read("../catalog/catalog.json"))
const published = JSON.parse(read("../catalog/packs.json"))
// The app repo's own valid catalog fixture (src/core/schema/testing/fixtures/library/).
const appFixture = () => JSON.parse(read("./fixtures/app-catalog.valid.json"))
const NOW = Date.parse("2026-11-23T12:00:00Z")

test("key ids are read as minisign prints them", () => {
  assert.equal(keyId(read("../keys/active.pub")), "A26FD5C302F7F8FB")
  assert.equal(keyId(read("../keys/backup.pub")), "97EEE73CB6AC658E")
  assert.throws(() => keyId("untrusted comment: x\nRWQ=\n"), /not a minisign public key/)
})

test("the recorded catalog builds an index the app accepts", () => {
  const index = buildIndex({ settings, published, sequence: 3, keyId: "A26FD5C302F7F8FB", nowMs: NOW })
  assert.deepEqual(problems(index), [])
  assert.equal(index.generatedAt, "2026-11-23T12:00:00Z")
  assert.equal(index.expiresAt, "2027-02-21T12:00:00Z") // 90 days on
  assert.equal(trustedComment(index), "studiovd-catalog catalog=official sequence=3 schema=1")
})

test("the app's valid fixture passes; broken references and fields do not", () => {
  assert.deepEqual(problems(appFixture()), [])

  const unlisted = appFixture()
  unlisted.components[0].pack = "a".repeat(64)
  assert.match(problems(unlisted).join("\n"), /components\/0\/pack is not a listed pack/)

  const twice = appFixture()
  twice.components.push(twice.components[0])
  assert.match(problems(twice).join("\n"), /listed twice/)

  const badId = appFixture()
  badId.catalogId = "Official catalog"
  assert.notDeepEqual(problems(badId), [])

  const extra = appFixture()
  extra.surprise = true // the app's schema is strict
  assert.notDeepEqual(problems(extra), [])

  assert.throws(
    () => buildIndex({ settings: { ...settings, validDays: 0 }, published, sequence: 1, keyId: "A26FD5C302F7F8FB", nowMs: NOW }),
    /expiresAt must be after generatedAt/
  )
})

test("only prehashed signatures with the bound comment pass", () => {
  const sig = (alg) => Buffer.concat([Buffer.from(alg, "latin1"), Buffer.alloc(72)]).toString("base64")
  const file = (alg, comment) => `untrusted comment: x\n${sig(alg)}\ntrusted comment: ${comment}\nAAAA\n`
  const comment = "studiovd-catalog catalog=official sequence=3 schema=1"
  assert.equal(signatureProblem(file("ED", comment), comment), null)
  assert.match(signatureProblem(file("Ed", comment), comment), /not prehashed/)
  assert.match(signatureProblem(file("ED", "sequence=2"), comment), /trusted comment/)
})
