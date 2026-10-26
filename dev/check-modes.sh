#!/bin/sh
echo "== uci"
echo "split.client=$(uci -q get tor_ext.split.client)"
echo "proxy.client=$(uci -q get tor_ext.proxy.client)"
echo "proxy.enabled=$(uci -q get tor_ext.proxy.enabled)"
echo
echo "== nft sets"
echo "split_clients:"; nft list set inet tor_ext split_clients 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}'
echo "clients(full):"; nft list set inet tor_ext clients 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}'
echo
echo "== prerouting full vs split rules"
/usr/libexec/tor-ext/apply-proxy show 2>/dev/null | grep -E 'redirect|@clients|@split' | head -12
