#!/bin/sh
echo "== start bridge test"
ubus call tor-ext bridgesTest '{"mode":"obfs4","bridges":["obfs4 86.119.0.151:25262 CDA13CF52FFF3A70AEFB3A793B16DC2A63406531 cert=veuTKH5BmSqP3Lbashf8DiprMXxenwTryXRVNKMqMJ+vL2lyC3rzQQQlVwaGgjv6UUU/QA iat-mode=0","obfs4 185.177.207.216:11216 E71628480D83354D3AC73BC4F1B1684F1E7BC57B cert=YJm9yg+8IrX+RSUdXcLDc1gCM6IikHhOSuEGLIB/Gc2w5ANMrXU1PVcRKPz816uphwn4Zw iat-mode=1"],"extra":""}'
echo
i=0
while [ $i -lt 28 ]; do
	sleep 5
	i=$((i+1))
	st=$(ubus call tor-ext bridgesTestStatus | jsonfilter -e '@.status' 2>/dev/null)
	pct=$(ubus call tor-ext bridgesTestStatus | jsonfilter -e '@.percent' 2>/dev/null)
	echo "t=$((i*5))s status=$st percent=$pct"
	[ "$st" = "done" ] && break
done
echo "== final"
ubus call tor-ext bridgesTestStatus | head -c 1500
echo
echo "== test log tail"
tail -12 /tmp/tor-ext/test/log 2>/dev/null
