#!/bin/sh
MEEK='meek_lite 192.0.2.20:80 url=https://1603026938.rsc.cdn77.org front=www.phpmyadmin.net utls=HelloRandomizedALPN'

echo "== start meek_lite bridge test"
ubus call tor-ext bridgeTestStart "{\"type\":\"meek\",\"line\":\"$MEEK\"}" | head -c 200
echo
i=0
while [ $i -lt 22 ]; do
	sleep 5
	i=$((i+1))
	st=$(ubus call tor-ext bridgesTestStatus | jsonfilter -e '@.status' 2>/dev/null)
	pct=$(ubus call tor-ext bridgesTestStatus | jsonfilter -e '@.percent' 2>/dev/null)
	echo "t=$((i*5))s $st $pct%"
	[ "$st" = "done" ] && break
done
echo "== result"
ubus call tor-ext bridgesTestStatus | jsonfilter -e '@.percent' -e '@.phase' 2>/dev/null
echo "== transport output"
tail -5 /tmp/tor-ext/test/err.log 2>/dev/null
