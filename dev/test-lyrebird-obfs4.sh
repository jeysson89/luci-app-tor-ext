#!/bin/sh
B1='obfs4 86.119.0.151:25262 CDA13CF52FFF3A70AEFB3A793B16DC2A63406531 cert=veuTKH5BmSqP3Lbashf8DiprMXxenwTryXRVNKMqMJ+vL2lyC3rzQQQlVwaGgjv6UUU/QA iat-mode=0'
B2='obfs4 185.177.207.216:11216 E71628480D83354D3AC73BC4F1B1684F1E7BC57B cert=YJm9yg+8IrX+RSUdXcLDc1gCM6IikHhOSuEGLIB/Gc2w5ANMrXU1PVcRKPz816uphwn4Zw iat-mode=1'

echo "== save the bridges through the app (lyrebird plugin line)"
ubus call tor-ext bridgesSave "{\"bridges\":[{\"type\":\"obfs4\",\"line\":\"$B1\"},{\"type\":\"obfs4\",\"line\":\"$B2\"}],\"restart\":true}" | head -c 250
echo
echo "== torrc plugin lines"
grep -nE 'ClientTransportPlugin|^Bridge' /etc/tor/torrc
echo
echo "== wait for the bootstrap"
i=0
while [ $i -lt 12 ]; do
	sleep 5
	i=$((i+1))
	pct=$(ubus call tor-ext status | jsonfilter -e '@.bootstrap.percent' 2>/dev/null)
	echo "t=$((i*5))s bootstrap=$pct%"
	[ "$pct" = "100" ] && break
done
echo "== tor log (transport)"
grep -aiE 'pluggable|transport|bootstrap 100' /var/log/tor.log | tail -6
