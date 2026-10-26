#!/bin/sh
# restore the state that the user had configured in the UI
uci set tor_ext.split.enabled='1'
uci set tor_ext.split.parameter='' 2>/dev/null
uci -q delete tor_ext.split.client
uci -q delete tor_ext.split.lists
uci add_list tor_ext.split.client='192.168.1.133'
uci add_list tor_ext.split.client='192.168.1.124'
uci add_list tor_ext.split.lists='youtube'
uci add_list tor_ext.split.lists='meta'
uci add_list tor_ext.split.lists='discord'
uci add_list tor_ext.split.lists='telegram'
uci set tor_ext.proxy.client='192.168.1.107'
uci set tor_ext.proxy.enabled='1'
uci commit tor_ext

echo "== timing of the full save path"
time /usr/libexec/tor-ext/lists fetch-all
time /usr/libexec/tor-ext/lists apply
time /usr/libexec/tor-ext/apply-proxy apply 2>&1 | tail -1
sleep 4
/usr/libexec/tor-ext/lists status
