#!/bin/sh
echo "== dnsmasq version/features"
dnsmasq -v

echo
echo "== nftset support"
dnsmasq --help 2>/dev/null | grep -iE 'nftset|ipset' || echo "not shown in help"

echo
echo "== current dnsmasq uci"
uci -q show dhcp.@dnsmasq[0]

echo
echo "== generated dnsmasq config (head)"
ls /var/etc/dnsmasq.conf* 2>/dev/null
head -5 /var/etc/dnsmasq.conf.cfg* 2>/dev/null || head -5 /var/etc/dnsmasq.conf 2>/dev/null

echo
echo "== init script conf options"
grep -nE 'confdir|conf-dir|confdir|addnmov|addnhosts' /etc/init.d/dnsmasq | head -20

echo
echo "== sing-box / podkop"
apk list --installed 2>/dev/null | grep -iE 'sing-box|podkop'
ps | grep -v grep | grep -E 'sing-box' | head -3 || echo "(no sing-box process)"
nft list tables 2>/dev/null

echo
echo "== list format samples"
echo "-- Russia/inside-raw.lst (first 5):"
curl -s -m 30 https://raw.githubusercontent.com/itdoginfo/allow-domains/main/Russia/inside-raw.lst | head -5
echo "-- Categories/geoblock.lst (first 5):"
curl -s -m 30 https://raw.githubusercontent.com/itdoginfo/allow-domains/main/Categories/geoblock.lst | head -5
echo "-- Subnets/IPv4/meta.lst (first 5):"
curl -s -m 30 https://raw.githubusercontent.com/itdoginfo/allow-domains/main/Subnets/IPv4/meta.lst | head -5
echo "-- Services/youtube.lst (first 5):"
curl -s -m 30 https://raw.githubusercontent.com/itdoginfo/allow-domains/main/Services/youtube.lst | head -5
