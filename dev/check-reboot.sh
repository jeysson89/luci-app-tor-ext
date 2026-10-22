#!/bin/sh
echo "== uptime"
cat /proc/uptime
echo
echo "== services"
ubus call service list '{"name":"tor"}' 2>/dev/null | grep -E '"running"|"pid"' | head -4
echo
echo "== tor status"
ubus call tor-ext status | jsonfilter -e '@.service.running' -e '@.bootstrap.percent' -e '@.version' 2>/dev/null
echo
echo "== proxy rules"
nft list table inet tor_ext 2>&1 | head -14
echo
echo "== cron"
grep -c 'tor-ext/watchdog' /etc/crontabs/root 2>/dev/null
echo
echo "== uci config"
uci show tor_ext.proxy | head -12
echo
echo "== ip check"
ubus call tor-ext checkIp '{"force":true}' | jsonfilter -e '@.ip' -e '@.tor' -e '@.ok' 2>/dev/null
