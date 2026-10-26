#!/bin/sh
uci set tor_ext.split.enabled='1'
uci set tor_ext.split.client='192.168.1.133'
uci add_list tor_ext.split.lists='youtube'
uci commit tor_ext
/usr/libexec/tor-ext/apply-proxy generate
echo "== split rules:"
grep -E 'split' /tmp/tor-ext-proxy.nft
nft -c -f /tmp/tor-ext-proxy.nft && echo "check ok" || echo "CHECK FAIL"
nft -f /tmp/tor-ext-proxy.nft && echo "applied"
echo "== set client:"
nft list set inet tor_ext split_clients 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}'
echo "== set dsts count:"
nft list set inet tor_ext split_dsts4 2>/dev/null | grep -cE '([0-9]{1,3}\.){3}[0-9]{1,3}'
