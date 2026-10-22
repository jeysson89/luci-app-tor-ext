#!/bin/sh
echo "== install the final package"
apk add --allow-untrusted /tmp/luci-app-tor-ext-1.0.0-r1.apk 2>&1 | tail -3
rm -f /tmp/*.apk
apk list --installed 2>/dev/null | grep tor-ext
echo
echo "== state"
ubus call tor-ext status | jsonfilter -e '@.service.running' -e '@.bootstrap.percent' -e '@.ip.ip' -e '@.ip.tor' 2>/dev/null
ubus call tor-ext bridgesGet | jsonfilter -e '@.bridges[*].type' -e '@.revision' 2>/dev/null
echo
echo "== disk"
df -h /overlay | tail -1
echo
echo "== the torrc"
grep -nE '^(Bridge|ClientTransportPlugin|UseBridges)' /etc/tor/torrc
