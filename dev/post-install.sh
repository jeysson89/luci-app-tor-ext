#!/bin/sh
# post-install hook of luci-app-tor-ext
[ -x /usr/libexec/tor-ext/migrate ] && /usr/libexec/tor-ext/migrate

# reload rpcd so that the new ubus object and ACLs are available
/etc/init.d/rpcd restart 2>/dev/null

# drop the cached luci menu
rm -f /tmp/luci-indexcache* /tmp/luci-modulecache 2>/dev/null

exit 0
