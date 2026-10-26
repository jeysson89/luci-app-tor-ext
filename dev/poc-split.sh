#!/bin/sh
# PoC: server=/domain/ lines via conf-dir + parallel-ish resolution via Tor DNS
CONFDIR=$(grep -m1 '^conf-dir=' /var/etc/dnsmasq.conf.cfg* 2>/dev/null | sed 's/conf-dir=//')
echo "confdir: $CONFDIR"

cat > "$CONFDIR/tor-ext-test.conf" <<'EOF'
server=/youtube.com/127.0.0.1#9053
server=/googlevideo.com/127.0.0.1#9053
EOF
/etc/init.d/dnsmasq restart
sleep 3

echo
echo "== resolve youtube.com via router dnsmasq (must go through Tor)"
nslookup -timeout=8 youtube.com 127.0.0.1 2>&1 | grep -E 'Address|Name' | head -6

echo
echo "== resolution speed via Tor DNS directly"
time nslookup -timeout=8 www.youtube.com 127.0.0.1:9053 >/dev/null 2>&1

echo
echo "== parallel resolution (3 domains x 3 jobs)"
mkdir -p /tmp/poc-res
rm -f /tmp/poc-res/out.*
for d in youtube.com googletagservices.com ytimg.com; do :; done
for i in 1 2 3; do
(
  for d in $(sed -n "$(( (i-1)*10+1 ))p;$(( i*10 ))p" /dev/null); do :; done
) >/dev/null 2>&1 &
done
domains="/tmp/poc-domains"
printf 'youtube.com\nggpht.com\ngg.google.com\ngoogleapis.com\ncommondatastorage.googleapis.com\nstorage.googleapis.com\nytimg.com\ngvt1.com\nplaceholder=http-test\n' > "$domains"
i=0
parts=$(awk "NR%3==1{print}" "$domains")
for p in 1 2 3; do
(
  awk "NR%3==$p" "$domains" | while IFS= read -r d; do
    case "$d" in placeholder*) continue ;; esac
    ips=$(nslookup -timeout=6 "$d" 127.0.0.1:9053 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | grep -v '127.0.0.1' | tr '\n' ' ')
    echo "$d -> $ips"
  done
) > /tmp/poc-res/out.$p 2>&1 &
done
wait
cat /tmp/poc-res/out.* | sort

rm -f "$CONFDIR/tor-ext-test.conf"
/etc/init.d/dnsmasq restart
sleep 2
echo
echo "== cleanup done"
