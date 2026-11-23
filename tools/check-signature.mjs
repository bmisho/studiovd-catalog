// Checks what `minisign -V` does not: StudioVD accepts only prehashed signatures (algorithm
// "ED"; legacy "Ed" ones are refused) whose trusted comment binds catalog, sequence and schema.
//
//   node tools/check-signature.mjs dist/index.json.minisig dist/trusted-comment.txt
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

/** Why StudioVD would refuse this .minisig text for `comment`, or null if it would not. */
export function signatureProblem(minisigText, comment) {
  const lines = minisigText.split(/\r?\n/)
  const sig = Buffer.from(lines[1] ?? "", "base64")
  if (sig.length !== 74) return "the second line is not a minisign signature"
  if (sig.toString("latin1", 0, 2) !== "ED") return "the signature is not prehashed (use minisign 0.10 or newer)"
  if (lines[2] !== `trusted comment: ${comment}`) return `the trusted comment is not "${comment}"`
  return null
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [sigPath, commentPath] = process.argv.slice(2)
  const problem = signatureProblem(readFileSync(sigPath, "utf8"), readFileSync(commentPath, "utf8"))
  if (problem) {
    console.error(`${sigPath}: ${problem}`)
    process.exit(1)
  }
  console.log(`${sigPath}: prehashed, trusted comment as expected`)
}
