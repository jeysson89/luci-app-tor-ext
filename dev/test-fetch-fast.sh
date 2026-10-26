#!/bin/sh
echo "== sh -n on helper"
sh -n /usr/libexec/tor-ext/lists && echo ok

echo
echo "== fetch parallel test: remove stamps for 'meta' and refetch together with youtube"
rm -f /etc/tor-ext/lists/meta.stamp
time /usr/libexec/tor-ext/lists fetch-all
ls /etc/tor-ext/lists/
echo
echo "== meta downloaded? ($(wc -l < /etc/tor-ext/lists/meta.lst 2>/dev/null) lines)"
 echo
echo "== save timing via ubus (rpcd)"
echo "== warm apply twice to measure the UI latency"
time /usr/libexec/tor-ext/lists apply
