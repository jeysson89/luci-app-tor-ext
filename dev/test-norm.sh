#!/bin/sh
echo "== sh -n"
for f in /usr/libexec/tor-ext/lists /usr/libexec/tor-ext/apply-proxy /usr/libexec/tor-ext/migrate /etc/init.d/tor-ext; do
	sh -n "$f" 2>&1 && echo "ok: $f" || echo "FAIL: $f"
done

echo
echo "== ucode"
ucode -c /usr/share/rpcd/ucode/tor-ext 2>&1 && echo "ok: ucode syntax" || echo "FAIL: ucode"

echo
echo "== merge test"
/usr/libexec/tor-ext/lists merge
echo "domains=$(cat /tmp/tor-ext/split-domains.count) subnets=$(cat /tmp/tor-ext/split-subnets.count)"
head -5 /tmp/tor-ext/split-domains.lst
