#!/bin/sh
B1='obfs4 86.119.0.151:25262 CDA13CF52FFF3A70AEFB3A793B16DC2A63406531 cert=veuTKH5BmSqP3Lbashf8DiprMXxenwTryXRVNKMqMJ+vL2lyC3rzQQQlVwaGgjv6UUU/QA iat-mode=0'
B2='obfs4 185.177.207.216:11216 E71628480D83354D3AC73BC4F1B1684F1E7BC57B cert=YJm9yg+8IrX+RSUdXcLDc1gCM6IikHhOSuEGLIB/Gc2w5ANMrXU1PVcRKPz816uphwn4Zw iat-mode=1'

echo "== revision of the current file"
REV=$(ubus call tor-ext bridgesGet | jsonfilter -e '@.revision')
echo "revision: $REV"

echo
echo "== simulate a manual edit of the torrc"
printf '\n# ручная правка пользователя\n' >> /etc/tor/torrc
NEWREV=$(ubus call tor-ext bridgesGet | jsonfilter -e '@.revision')
echo "new revision: $NEWREV"

echo
echo "== save with the stale revision (must be a conflict)"
ubus call tor-ext bridgesSave "{\"bridges\":[{\"type\":\"obfs4\",\"line\":\"$B1\"},{\"type\":\"obfs4\",\"line\":\"$B2\"}],\"restart\":false,\"revision\":\"$REV\",\"force\":false}"
echo
echo "== save with the actual revision (must succeed)"
ubus call tor-ext bridgesSave "{\"bridges\":[{\"type\":\"obfs4\",\"line\":\"$B1\"},{\"type\":\"obfs4\",\"line\":\"$B2\"}],\"restart\":false,\"revision\":\"$NEWREV\",\"force\":false}" | head -c 200
echo
echo "== the torrc after the save"
grep -nE '^#|^Bridge|ClientTransportPlugin' /etc/tor/torrc
