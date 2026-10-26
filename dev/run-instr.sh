#!/bin/sh
base64 -d /tmp/mod-run.b64 > /tmp/mod-run.js 2>/dev/null || openssl base64 -d -in /tmp/mod-run.b64 -out /tmp/mod-run.js
echo "lines: $(wc -l < /tmp/mod-run.js)"
echo "== run"
ucode /tmp/mod-run.js 2>&1 | head -40
rm -f /tmp/mod-run.js /tmp/mod-run.b64
