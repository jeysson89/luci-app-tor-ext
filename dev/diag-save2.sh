#!/bin/sh
cp /usr/share/rpcd/ucode/tor-ext /tmp/mod.js
grep -v "^return { 'tor-ext': exported };$" /tmp/mod.js > /tmp/mod-run.js
cat >> /tmp/mod-run.js <<'EOF'

const args = {
	enabled: true, mode: 'proxy', scope: 'clients',
	clients: ['192.168.1.133'], lists: ['youtube'],
	custom_domains: [], custom_subnets: [],
	block_quic: true, block_dot: true, interval: '6h'
};
print('--- direct call to methods.splitSave\n');
try {
	const res = methods.splitSave.call({ args });
	print('RESULT ok=' + (res && res.ok) + ' msg=' + (res && res.message) + '\n');
} catch (e) {
	print('CAUGHT: ' + e + '\n');
	print('TYPE: ' + type(e) + '\n');
	if (e && e.stack) print('STACK: ' + e.stack + '\n');
}
EOF
echo "== run"
ucode /tmp/mod-run.js 2>&1 | head -60
rm -f /tmp/mod.js /tmp/mod-run.js
