#!/bin/sh
echo "== the app after the scripted install"
ubus list | grep tor-ext
ubus call tor-ext status | jsonfilter -e '@.service.running' -e '@.bootstrap.percent' -e '@.ip.ip' 2>/dev/null
echo
echo "== the services"
/etc/init.d/tor-ext enabled && echo "tor-ext enabled" || echo "tor-ext NOT enabled"
/etc/init.d/tor enabled && echo "tor enabled" || echo "tor NOT enabled"
echo
echo "== the proxy rules (if enabled)"
nft list table inet tor_ext 2>&1 | head -4
uci show tor_ext.proxy | head -3
echo
echo "== the cron entry"
grep -c 'tor-ext/watchdog' /etc/crontabs/root
