#!/bin/sh
echo "== lists dir"
ls -la /etc/tor-ext/lists/
echo
echo "== manual fetch of youtube"
curl -s -m 60 --socks5-hostname 127.0.0.1:9050 -o /tmp/t1.lst https://raw.githubusercontent.com/jeysson89/luci-app-tor-ext/main/lists/youtube.lst; echo "socks rc=$?"
wc -l /tmp/t1.lst 2>/dev/null
head -3 /tmp/t1.lst
echo
echo "== tab row"
awk -F'\t' -v id=youtube '$1==id{print "[" $2 "][" $3 "][" $4 "]"}' /usr/share/tor-ext/list-files.tab
echo
echo "== tab_lookup via helper"
. /usr/libexec/tor-ext/lib.sh
echo "row: $(awk -F'\t' -v id=youtube '$1 == id { print $2 "@" $3 "@" $4; exit }' /usr/share/tor-ext/list-files.tab)"
echo
echo "== direct fetch"
curl -s -m 60 -o /tmp/t2.lst https://raw.githubusercontent.com/jeysson89/luci-app-tor-ext/main/lists/youtube.lst; echo "direct rc=$?"
wc -l /tmp/t2.lst 2>/dev/null
