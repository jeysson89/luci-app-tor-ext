#!/bin/sh
echo "== portsGet"
ubus call tor-ext portsGet | head -c 800
echo
echo "== proxyPreview"
ubus call tor-ext proxyPreview | head -c 400
echo
echo "== logs"
ubus call tor-ext logs '{"source":"file","lines":5}' | tail -c 300
echo
echo "== settingsGet"
ubus call tor-ext settingsGet
echo
echo "== torrcVerify bad"
ubus call tor-ext torrcVerify '{"content":"SocksPort abc\nBogusOption 1\n"}'
echo
echo "== torrcVerify good"
ubus call tor-ext torrcVerify '{"content":"SocksPort 9050\n"}'
echo
echo "== torrcGet"
ubus call tor-ext torrcGet | head -c 200
echo
echo "== proxySave"
ubus call tor-ext proxySave '{"enabled":true,"mode":"clients","clients":["192.168.1.222"],"redirect_dns":true,"redirect_tcp":true,"killswitch":true,"block_ipv6":false,"block_quic":true,"block_dot":true,"router_traffic":false}' | head -c 700
echo
echo "== nft"
nft list table inet tor_ext 2>&1 | head -40
echo "== uci"
uci show tor_ext
