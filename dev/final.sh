#!/bin/sh
echo "== final check =="
ubus call tor-ext status | jsonfilter -e 'tor running=@.service.running' -e 'bootstrap=@.bootstrap.percent' -e 'ip=@.ip.ip' 2>/dev/null
echo
echo "-- devices through Tor"
uci get tor_ext.proxy.client
nft list set inet tor_ext clients 2>/dev/null | grep -A2 elements
echo
echo "-- traffic of the client through tor"
grep -c 'sport=9053' /proc/net/nf_conntrack 2>/dev/null | sed 's/^/dns via tor: /'
grep -c 'sport=9040' /proc/net/nf_conntrack 2>/dev/null | sed 's/^/tcp via tor: /'
echo
echo "-- the app files"
ls /www/luci-static/resources/view/tor-ext/ | tr '\n' ' '
echo
echo
echo "-- the install script"
ls -la /tmp/install.sh
