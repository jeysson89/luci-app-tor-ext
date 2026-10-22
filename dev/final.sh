#!/bin/sh
echo "== FINAL STATE =="
echo "-- package"
apk list --installed 2>/dev/null | grep -E 'luci-app-tor-ext|^tor-|conntrack-'
echo
echo "-- the app"
ubus call tor-ext status | jsonfilter -e 'running=@.service.running' -e 'bootstrap=@.bootstrap.percent' -e 'version=@.version' -e 'ip=@.ip.ip' -e 'tor=@.ip.tor' 2>/dev/null
echo
echo "-- transports"
ubus call tor-ext bridgesGet | jsonfilter -e '@.transports[*].key' -e '@.transports[*].installed' 2>/dev/null | paste - - 2>/dev/null
echo
echo "-- bridges in torrc"
grep -cE '^Bridge ' /etc/tor/torrc
echo
echo "-- services"
/etc/init.d/tor-ext enabled && echo "tor-ext: enabled"
/etc/init.d/tor enabled && echo "tor: enabled"
echo
echo "-- disk"
df -h /overlay | tail -1
echo
echo "-- backups"
ubus call tor-ext backups | jsonfilter -e 'keep=@.keep' -e 'count=@.backups[*].name' 2>/dev/null | head -3
