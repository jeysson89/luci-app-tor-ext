#!/bin/sh
. /usr/libexec/tor-ext/lib.sh
cat > /tmp/split-save.json <<'EOF'
{
  "enabled": true,
  "mode": "proxy",
  "scope": "clients",
  "clients": ["192.168.1.133"],
  "lists": ["youtube"],
  "custom_domains": [],
  "custom_subnets": [],
  "block_quic": true,
  "block_dot": true,
  "interval": "6h"
}
EOF
TOKEN=$(cat /var/run/rpcd.session 2>/dev/null || true)
ubus call tor-ext splitSave "$(cat /tmp/split-save.json)" 2>&1 | head -20
echo "rc=$?"
echo
echo "== after: uci"
uci -q show tor_ext.split | head -12
