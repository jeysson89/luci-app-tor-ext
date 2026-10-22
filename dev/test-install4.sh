#!/bin/sh
echo "== reinstall the package (post-install must run)"
apk del luci-app-tor-ext 2>&1 | tail -2
apk add --allow-untrusted /tmp/luci-app-tor-ext-1.0.0-r1.apk 2>&1 | tail -6
echo
echo "== migration results"
echo -n "cron entry: "; grep -c 'tor-ext/watchdog' /etc/crontabs/root 2>/dev/null
echo -n "service enabled: "; ls /etc/rc.d/ | grep -c 'S.*tor-ext'
echo -n "torrc ControlPort: "; grep -c '^ControlPort 127.0.0.1' /etc/tor/torrc
echo -n "torrc User: "; grep -c '^User tor' /etc/tor/torrc
echo -n "migrate script: "; ls -la /usr/libexec/tor-ext/migrate | awk '{print $1, $5}'
echo
echo "== app works"
ubus call tor-ext status | head -c 200
echo
echo "== package scripts"
apk adbdump /tmp/luci-app-tor-ext-1.0.0-r1.apk 2>/dev/null | grep -A 6 "scripts:"
