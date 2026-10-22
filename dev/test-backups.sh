#!/bin/sh
echo "== the current backups"
ls -la /etc/tor/backups/ 2>&1 | tail -5
ubus call tor-ext backups | head -c 400
echo
echo
echo "== set the limit to 2"
ubus call tor-ext backupKeepSet '{"keep":2}'
ls /etc/tor/backups/ | wc -l
echo
echo "== delete all"
ubus call tor-ext backupDelete '{"name":"","all":true}'
ls -la /etc/tor/backups/ 2>&1 | tail -3
echo
echo "== set the limit back to 20"
ubus call tor-ext backupKeepSet '{"keep":20}'
echo
echo "== uci"
uci show tor_ext.backup
