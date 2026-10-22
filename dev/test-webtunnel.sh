#!/bin/sh
WT='webtunnel [2001:db8:df91:d45f:47f9:2d09:3a9a:7c22]:443 A633EAF9A7DC0E715183359C38E4DAE4515D1EF7 url=https://nothing.localenby.is/'

echo "== webtunnel test (the built-in bridges are IPv6 only)"
ubus call tor-ext bridgeTestStart "{\"type\":\"webtunnel\",\"line\":\"$WT\"}" | head -c 200
echo
i=0
while [ $i -lt 12 ]; do
	sleep 5
	i=$((i+1))
	st=$(ubus call tor-ext bridgesTestStatus | jsonfilter -e '@.status' 2>/dev/null)
	pct=$(ubus call tor-ext bridgesTestStatus | jsonfilter -e '@.percent' 2>/dev/null)
	echo "t=$((i*5))s $st $pct%"
	[ "$st" = "done" ] && break
done
echo
echo "== the transport log"
ubus call tor-ext bridgesTestStatus | jsonfilter -e '@.err' 2>/dev/null | head -12
