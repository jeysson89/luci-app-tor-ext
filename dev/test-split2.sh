#!/bin/sh
echo "== merge"
/usr/libexec/tor-ext/lists merge
echo "domains=$(cat /tmp/tor-ext/split-domains.count) subnets=$(cat /tmp/tor-ext/split-subnets.count)"
head -4 /tmp/tor-ext/split-domains.lst

echo
echo "== enable + dnsconf"
uci set tor_ext.split.enabled='1'
uci commit tor_ext
/usr/libexec/tor-ext/lists dnsconf
sleep 8

CONFDIR=$(cat /var/etc/dnsmasq.conf.* 2>/dev/null | grep -m1 '^conf-dir=' | cut -d= -f2)
echo "conf lines: $(wc -l < "$CONFDIR/tor-ext-split.conf" 2>/dev/null)"
head -2 "$CONFDIR/tor-ext-split.conf"

echo
echo "== resolve (via Tor DNS)"
time /usr/libexec/tor-ext/lists resolve
echo "resolved IPs: $(wc -l < /tmp/tor-ext/split-resolved.lst)"
head -5 /tmp/tor-ext/split-resolved.lst

echo
echo "== apply-proxy (creates table) + fill"
sh /usr/libexec/tor-ext/apply-proxy generate >/dev/null 2>&1
nft -f /tmp/tor-ext-proxy.nft 2>/dev/null
/usr/libexec/tor-ext/lists fill
nft list set inet tor_ext split_dsts4 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}(/\[[0-9]+\])?' | head -3
echo "set lines: $(nft list set inet tor_ext split_dsts4 2>/dev/null | grep -cE '([0-9]{1,3}\.){3}[0-9]{1,3}')"

echo
echo "== split rules present"
grep -E 'split' /tmp/tor-ext-proxy.nft 2>/dev/null | head -8

echo
echo "== DNS check via router"
nslookup -timeout=10 youtube.com 127.0.0.1 2>&1 | grep -E 'Name|Address' | head -4

echo
echo "== status"
/usr/libexec/tor-ext/lists status
