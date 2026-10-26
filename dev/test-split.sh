#!/bin/sh
echo "== UCI defaults for split (if absent)"
if [ -z "$(uci -q get tor_ext.split 2>/dev/null)" ]; then
	uci set tor_ext.split='split'
	uci set tor_ext.split.enabled='0'
	uci set tor_ext.split.mode='proxy'
	uci set tor_ext.split.scope='clients'
	uci set tor_ext.split.block_quic='1'
	uci set tor_ext.split.block_dot='1'
	uci set tor_ext.split.interval='6h'
	uci commit tor_ext
	echo "(created)"
fi
uci set tor_ext.split.lists='youtube'
uci set tor_ext.split.enabled='1'
uci commit tor_ext

echo
echo "== fetch-all (downloads youtube + subnets)"
time /usr/libexec/tor-ext/lists fetch-all

echo
echo "== apply (merge + dnsconf + fill)"
/usr/libexec/tor-ext/lists apply
sleep 5

echo
echo "== dnsmasq conf"
CONFDIR=$(cat /var/etc/dnsmasq.conf.* 2>/dev/null | grep -m1 '^conf-dir=' | cut -d= -f2)
head -3 "$CONFDIR/tor-ext-split.conf"

echo
echo "== resolve"
time /usr/libexec/tor-ext/lists resolve

echo
echo "== status"
/usr/libexec/tor-ext/lists status

echo
echo "== nft set size"
nft list set inet tor_ext split_dsts4 > /tmp/set.out 2>/dev/null
grep -c '\.' /tmp/set.out
head -12 /tmp/set.out

echo
echo "== DNS check: youtube via router dnsmasq (should resolve via Tor)"
nslookup -timeout=10 youtube.com 127.0.0.1 2>&1 | grep -E 'Name|Address' | head -6

echo
echo "== rules generation"
/usr/libexec/tor-ext/apply-proxy generate >/dev/null 2>&1
grep -E 'split' /tmp/tor-ext-proxy.nft | head -10
