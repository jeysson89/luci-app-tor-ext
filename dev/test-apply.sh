#!/bin/sh
setting() { uci set tor_ext.split.enabled='1'; uci set tor_ext.split.client='192.168.1.133'; uci -q add_list tor_ext.split.lists='youtube'; uci commit tor_ext; }
setting
/usr/libexec/tor-ext/apply-proxy apply
echo "== dsts:"
nft list set inet tor_ext split_dsts4 2>/dev/null | grep -cE '([0-9]{1,3}\.){3}[0-9]{1,3}'
echo "== state:"
cat /tmp/tor-ext/proxy.applied
/usr/libexec/tor-ext/apply-proxy clear
nft list tables 2>/dev/null | grep tor_ext || echo "table cleared"
