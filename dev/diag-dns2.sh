#!/bin/sh
echo "== generated dnsmasq config: conf-dir and servers"
grep -nE 'conf-dir|--server|^server' /var/etc/dnsmasq.conf.cfg* 2>/dev/null | head -10
ls -la /tmp/dnsmasq.d 2>/dev/null

echo
echo "== nslookup with port"
nslookup -timeout=6 youtube.com 127.0.0.1#9053 2>&1 | head -8
echo "rc=$?"

echo
echo "== nslookup with colon port"
nslookup -timeout=6 youtube.com 127.0.0.1:9053 2>&1 | head -4

echo
echo "== tor-resolve"
command -v tor-resolve || ls /usr/bin/tor-resolve 2>/dev/null || echo "no tor-resolve"

echo
echo "== who listens on 127.0.0.42:53"
netstat -lnpu 2>/dev/null | grep 127.0.0.42 | head -4
netstat -lnpu 2>/dev/null | grep -E '0.0.0.0:9053|127.0.0.1:9053' | head -3

echo
echo "== sing-box dns config"
grep -A4 '"address"' /etc/sing-box/config.json 2>/dev/null | head -20

echo
echo "== cron entries"
cat /etc/crontabs/root

echo
echo "== busybox xargs -P?"
xargs -P 2 echo test 2>&1 | head -1 || true
seq 1 4 | xargs -P 2 -I{} sh -c 'echo {}' 2>&1 | sort | tr '\n' ' '
echo
echo "== timeout cmd"
command -v timeout && echo yes || echo no
