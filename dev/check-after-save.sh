#!/bin/sh
echo "== uci"
uci -q show tor_ext.split
echo
echo "== lists helper status"
/usr/libexec/tor-ext/lists status
echo
echo "== dnsconf"
CONFDIR=$(cat /var/etc/dnsmasq.conf.* 2>/dev/null | grep -m1 '^conf-dir=' | cut -d= -f2)
echo "lines: $(wc -l < "$CONFDIR/tor-ext-split.conf" 2>/dev/null)"
echo
echo "== nft"
nft list set inet tor_ext split_dsts4 2>/dev/null | grep -cE '([0-9]{1,3}\.){3}[0-9]{1,3}'
nft list set inet tor_ext split_clients 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}'
echo
echo "== logs"
logread -e tor-ext | tail -6
