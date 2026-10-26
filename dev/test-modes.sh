#!/bin/sh
echo "== ucode"
ucode -c /usr/share/rpcd/ucode/tor-ext 2>&1 && echo "ok" || echo "FAIL"
echo
echo "== direct splitSave with mixed modes"
cp /usr/share/rpcd/ucode/tor-ext /tmp/mod.js
grep -v "^return { 'tor-ext': exported };$" /tmp/mod.js > /tmp/mod-run.js
cat >> /tmp/mod-run.js <<'EOF'

const args = {
	enabled: true, mode: 'proxy', scope: 'clients',
	clients: ['192.168.1.133'], full_clients: ['192.168.1.124'],
	lists: ['youtube'],
	custom_domains: [], custom_subnets: [],
	block_quic: true, block_dot: true, interval: '6h'
};
const res = methods.splitSave.call({ args });
print('ok=' + res.ok + ' msg=' + res.message + '\n');
const st = exported.splitGet.call({ args: {} });
print('split clients: ' + (st.clients || []).join(',') + '\n');
print('full clients: ' + (st.full_clients || []).join(',') + '\n');
EOF
ucode /tmp/mod-run.js 2>&1 | head -8
rm -f /tmp/mod.js /tmp/mod-run.js
echo
echo "== uci after"
uci -q get tor_ext.split.client
uci -q get tor_ext.proxy.client
uci -q get tor_ext.proxy.enabled
echo
echo "== rules"
/usr/libexec/tor-ext/apply-proxy apply 2>&1
nft list set inet tor_ext split_clients 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}'
nft list set inet tor_ext clients 2>/dev/null | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}'
