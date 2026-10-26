#!/bin/sh
# restore split state after the last config overwrite and apply end-to-end
uci set tor_ext.split.enabled='1'
uci set tor_ext.split.client='192.168.1.133'
uci add_list tor_ext.split.lists='youtube'
uci commit tor_ext
/usr/libexec/tor-ext/apply-proxy apply
sleep 2
/usr/libexec/tor-ext/lists status
grep -c 'server=' "$CONFDIR/tor-ext-split.conf" 2>/dev/null || true
CONFDIR=$(cat /var/etc/dnsmasq.conf.* 2>/dev/null | grep -m1 '^conf-dir=' | cut -d= -f2)
echo "dnsconf lines: $(wc -l < "$CONFDIR/tor-ext-split.conf" 2>/dev/null)"
nft list set inet tor_ext split_dsts4 2>/dev/null | grep -cE '([0-9]{1,3}\.){3}[0-9]{1,3}'
