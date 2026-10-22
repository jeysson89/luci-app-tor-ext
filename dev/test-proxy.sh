#!/bin/sh
echo "== proxySave ON"
ubus call tor-ext proxySave '{"enabled":true,"mode":"clients","clients":["192.168.1.222","10.0.0.0/8"],"redirect_dns":true,"redirect_tcp":true,"killswitch":true,"block_ipv6":false,"block_quic":true,"block_dot":true,"router_traffic":false}' | head -c 900
echo
echo "== uci"
uci show tor_ext.proxy
echo "== nft"
nft list table inet tor_ext 2>&1 | head -40
echo "== counters"
ubus call tor-ext proxyGet | grep -E 'packets|bytes|rules_loaded|applied|enabled'
echo "== proxySave OFF"
ubus call tor-ext proxySave '{"enabled":false,"mode":"clients","clients":["192.168.1.222"],"redirect_dns":true,"redirect_tcp":true,"killswitch":true,"block_ipv6":true,"block_quic":true,"block_dot":true,"router_traffic":false}' | head -c 300
echo
nft list table inet tor_ext 2>&1
echo "== settingsSave"
ubus call tor-ext settingsSave '{"watchdog_enabled":true,"auto_restart":true,"notify_enabled":false,"telegram_token":"","telegram_chat":"","webhook":""}'
uci show tor_ext.watchdog
