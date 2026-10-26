#!/bin/sh
echo "== sh -n"
for f in /usr/libexec/tor-ext/lists /usr/libexec/tor-ext/apply-proxy /usr/libexec/tor-ext/migrate /etc/init.d/tor-ext; do
	if sh -n "$f" 2>&1; then echo "ok: $f"; else echo "FAIL: $f"; fi
done

echo
echo "== ucode compile"
ucode -l rpcd 2>/dev/null >/dev/null || true
if command -v ucode >/dev/null; then
	ucode -S -e 2>/dev/null <<'EOF' || true
EOF
	ucode -c /usr/share/rpcd/ucode/tor-ext 2>&1 && echo "ok: ucode syntax" || echo "FAIL: ucode"
fi

echo
echo "== files present"
ls /usr/share/tor-ext/
wc -l /usr/share/tor-ext/list-files.tab
