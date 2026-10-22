#!/bin/sh
echo "== disk before"
df -h /overlay | tail -1
echo
echo "== remove the packages and files that were installed only for the build"
apk del xz 2>&1 | tail -2
rm -rf /var/cache/apk/* 2>/dev/null
rm -f /tmp/*.apk /tmp/APKINDEX* /tmp/idx-*.txt /tmp/APKINDEX.txt /tmp/ct-before /tmp/ct-after
rm -rf /tmp/lyre /tmp/apkstatic /tmp/lyrebird.apk /tmp/verify-pkg /tmp/pkgroot
rm -f /tmp/sf.log /tmp/sf.out /tmp/sf3.log
echo
echo "== biggest packages"
apk list --installed 2>/dev/null | grep -E '^(tor|obfs4proxy|snowflake-client|conntrack|xz|libcap|libevent)' | head -10
echo
echo "== disk after"
df -h /overlay | tail -1
du -sh /usr/lib/tor /usr/share/tor /usr/bin/obfs4proxy /usr/bin/lyrebird 2>/dev/null
