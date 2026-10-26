#!/bin/sh
rm -rf /tmp/luci-modulecache/* 2>/dev/null
rm -f /tmp/ucodecache* 2>/dev/null
/etc/init.d/rpcd restart
sleep 3
/etc/init.d/uhttpd restart 2>/dev/null
echo "rpcd restarted"
command -v ubus >/dev/null && ubus call service list '{ "name": "rpcd" }' >/dev/null 2>&1 && echo "rpcd alive"
