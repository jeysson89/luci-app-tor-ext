#!/bin/sh
SF='snowflake 192.0.2.3:80 2B280B23E1107BB62ABFC40DDCC8824814F80A72 fingerprint=2B280B23E1107BB62ABFC40DDCC8824814F80A72 url=https://1098762253.rsc.cdn77.org/ fronts=app.datapacket.com,www.datapacket.com ice=stun:stun.epygi.com:3478,stun:stun.uls.co.za:3478,stun:stun.voipgate.com:3478,stun:stun.mixvoip.com:3478,stun:stun.telnyx.com:3478,stun:stun.hot-chilli.net:3478,stun:stun.fitauto.ru:3478,stun:stun.m-online.net:3478 utls-imitate=hellorandomizedalpn'

echo "== start snowflake bridge test"
ubus call tor-ext bridgeTestStart "{\"type\":\"snowflake\",\"line\":\"$SF\"}"
echo
i=0
while [ $i -lt 20 ]; do
	sleep 5
	i=$((i+1))
	st=$(ubus call tor-ext bridgesTestStatus | jsonfilter -e '@.status' 2>/dev/null)
	pct=$(ubus call tor-ext bridgesTestStatus | jsonfilter -e '@.percent' 2>/dev/null)
	echo "t=$((i*5))s $st $pct%"
	[ "$st" = "done" ] && break
done
echo "== snowflake client process"
ps w | grep '[s]nowflake' | head -3
echo "== test log (snowflake lines)"
grep -aiE 'snowflake|pluggable|transport|error|warn' /tmp/tor-ext/test/log 2>/dev/null | tail -12
