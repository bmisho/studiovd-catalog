#!/usr/bin/env bash
# Signs <dist>/index.json the way StudioVD verifies it: a prehashed minisign signature whose
# trusted comment is the one tools/build-index.mjs wrote, then checks it with <public key>.
# The secret key and its password come from the environment (the publish workflow's secrets).
#
#   MINISIGN_SECRET_KEY=... MINISIGN_PASSWORD=... tools/sign.sh keys/active.pub [dist]
set -euo pipefail
pub="$1"
dist="${2:-dist}"
: "${MINISIGN_SECRET_KEY:?the MINISIGN_SECRET_KEY secret is not set}"
: "${MINISIGN_PASSWORD:?the MINISIGN_PASSWORD secret is not set}"

key="$(mktemp)" # mode 600, removed on exit
trap 'rm -f "$key"' EXIT
secret="$(printf '%s\n' "$MINISIGN_SECRET_KEY" | tr -d '\r')"
# A secret pasted without the key file's first line still works.
case "$secret" in
  "untrusted comment:"*) printf '%s\n' "$secret" >"$key" ;;
  *) printf 'untrusted comment: minisign encrypted secret key\n%s\n' "$secret" >"$key" ;;
esac

password="$(printf '%s' "$MINISIGN_PASSWORD" | tr -d '\r\n')"
printf '%s\n' "$password" |
  minisign -S -s "$key" -m "$dist/index.json" -t "$(cat "$dist/trusted-comment.txt")"
minisign -Vm "$dist/index.json" -p "$pub"
node "$(dirname "$0")/check-signature.mjs" "$dist/index.json.minisig" "$dist/trusted-comment.txt"
