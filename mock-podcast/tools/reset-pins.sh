#!/usr/bin/env bash
# Puts the stand back to its default state: no profile has a PIN.
#
# Goes through the running server rather than deleting data/pins.json, because
# the server holds the pins in memory and rewrites that file on its next write —
# deleting it would last only until the next event.
#
# Each PIN is removed with the code the store currently holds, which is the same
# path the app takes: verify, then disable. A profile with no PIN is skipped.
set -euo pipefail

HOST="${MOCK_HOST:-http://localhost:3000}"
DATA="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/data"

send() {
  curl -s -o /dev/null -w "%{http_code}" -X POST "$HOST/cloud-events" \
    -H 'Authorization: Bearer local' -H 'Content-Type: application/json' -d "$1"
}

python3 -c "
import json, io, os

titles = {}
feed = '$DATA/viewer-profiles.json'
if os.path.exists(feed):
    titles = {e['id']: e['title'] for e in json.load(io.open(feed, encoding='utf-8'))['entry']}

store = '$DATA/pins.json'
pins = json.load(io.open(store, encoding='utf-8')) if os.path.exists(store) else []
for r in pins:
    print(r['profile'], r['pinCode'], titles.get(r['profile'], r['profile']))
" | while read -r id pin title; do
  code=$(send "{\"specversion\":\"1.0\",\"type\":\"com.applicaster.pin.change.v1\",\"source\":\"reset-pins\",\"id\":\"disable\",\"data\":{\"step\":\"disable\",\"profile\":\"$id\",\"current_pin_code\":\"$pin\"}}")
  printf '  %-22s PIN removed  %s\n' "$title" "$code"
done

remaining=$(python3 -c "
import json, io, os
p = '$DATA/pins.json'
print(len(json.load(io.open(p, encoding='utf-8'))) if os.path.exists(p) else 0)
")
echo "  profiles still holding a PIN: $remaining"
