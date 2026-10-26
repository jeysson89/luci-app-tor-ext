#!/bin/sh
uci -q set tor_ext.split.client='192.168.1.133'
uci -q commit tor_ext
/usr/libexec/tor-ext/apply-proxy generate
echo "== split lines in rules:"
grep -nE 'split' /tmp/tor-ext-proxy.nft
echo
echo "== validate and apply"
nft -c -f /tmp/tor-ext-proxy.nft && echo "nft check ok"
nft -f /tmp/tor-ext-proxy.nft && echo "nft applied"
uci -q delete tor_ext.split.client
uci -q commit tor_ext
nft list set inet tor_ext split_clients 2>/dev/null | head -5
