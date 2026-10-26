#!/bin/sh
echo "== uci split.lists"
uci -q get tor_ext.split.lists
echo
echo "== full save path timing (fetch-all skipped stamps + apply)"
time /usr/libexec/tor-ext/lists fetch-all
time /usr/libexec/tor-ext/lists apply
echo
echo "== status"
/usr/libexec/tor-ext/lists status
