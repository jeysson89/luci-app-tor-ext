'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require tor-ext/common as TX';

var callGet = rpc.declare({ object: 'tor-ext', method: 'proxyGet' });
var callSave = rpc.declare({
	object: 'tor-ext', method: 'proxySave',
	params: ['enabled', 'mode', 'clients', 'redirect_dns', 'redirect_tcp', 'killswitch', 'block_ipv6', 'block_quic', 'block_dot', 'router_traffic']
});
var callPreview = rpc.declare({ object: 'tor-ext', method: 'proxyPreview' });
var callLeases = rpc.declare({ object: 'luci-rpc', method: 'getDHCPLeases' });

return view.extend({
	load: function() {
		return Promise.all([
			callGet(),
			callLeases().then(function(res) {
				return (res && res.dhcp_leases) ? res.dhcp_leases : [];
			}).catch(function() { return []; })
		]);
	},

	render: function(data) {
		var self = this;
		var p = data[0];
		var leases = data[1] || [];
		this.state = p;

		this.enabled = E('input', { 'type': 'checkbox', 'checked': p.enabled ? '' : null, 'change': function(ev) { self.toggle(ev.target.checked); } });
		this.stateLabel = E('span', {}, p.enabled ? 'Прозрачное проксирование включено' : 'Прозрачное проксирование выключено');
		this.mode = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': 'clients', 'selected': p.mode === 'clients' ? '' : null }, 'Только выбранные устройства'),
			E('option', { 'value': 'all', 'selected': p.mode === 'all' ? '' : null }, 'Все устройства LAN')
		]);

		this.clients = E('textarea', { 'class': 'tx-code', 'rows': 7, 'spellcheck': 'false', 'placeholder': '192.168.1.100\n192.168.1.101' }, (p.clients || []).join('\n'));

		this.opt = {};
		[['redirect_dns', 'Перенаправлять DNS (53) в Tor', p.redirect_dns],
		 ['redirect_tcp', 'Перенаправлять TCP в TransPort', p.redirect_tcp],
		 ['killswitch', 'Kill switch: блокировать прямой трафик клиентов', p.killswitch],
		 ['block_ipv6', 'Блокировать IPv6 для LAN (предотвращение утечек)', p.block_ipv6],
		 ['block_quic', 'Блокировать QUIC (UDP 443)', p.block_quic],
		 ['block_dot', 'Блокировать DNS-over-TLS (853)', p.block_dot],
		 ['router_traffic', 'Заворачивать трафик самого роутера (осторожно)', p.router_traffic]
		].forEach(function(o) {
			self.opt[o[0]] = E('input', { 'type': 'checkbox', 'checked': o[2] ? '' : null });
		});

		this.counterBox = E('div', { 'id': 'tx-counters' }, this.renderCounters(p));
		this.leaseBox = E('div', { 'class': 'tx-grid' }, leases.length ? leases.slice(0, 40).map(function(l) {
			var ip = l.ipaddr || l.ip || '';
			var mac = l.macaddr || l.mac || '';
			return E('div', { 'class': 'tx-row', 'style': 'margin:0;gap:6px;justify-content:space-between' }, [
				E('span', {}, [E('b', {}, ip || '?'), E('span', { 'class': 'tx-muted' }, ' ' + (l.hostname || mac || ''))]),
				TX.btn('Добавить', 'action', function() {
					var v = self.clients.value.split('\n').map(function(s) { return s.trim(); }).filter(function(s) { return s.length; });
					if (ip && v.indexOf(ip) < 0) v.push(ip);
					self.clients.value = v.join('\n');
				})
			]);
		}) : E('p', { 'class': 'tx-muted' }, 'Аренды DHCP не найдены.'));

		var page = E('div', { 'class': 'tx-page' }, [
			TX.style(),
			E('h2', {}, 'Прозрачное проксирование'),
			E('div', { 'class': 'tx-muted' }, 'Трафик выбранных устройств перенаправляется в Tor через nftables (таблица inet tor_ext).'),

			TX.card('Состояние', [
				E('div', { 'class': 'tx-row', 'style': 'justify-content:space-between' }, [
					E('label', { 'class': 'tx-check', 'style': 'margin:0;font-weight:bold' }, [this.enabled, this.stateLabel]),
					this.counterBox
				]),
				E('div', { 'class': 'tx-muted' }, p.applied ? ('Правила применены ' + TX.fmtTime(p.applied_at)) : 'Правила не применены')
			]),

			TX.card('Клиенты', [
				E('div', { 'class': 'tx-row' }, [E('label', {}, 'Режим'), this.mode]),
				E('div', { 'class': 'tx-muted' }, 'IP-адреса или подсети, по одному в строке.'),
				this.clients,
				E('details', {}, [
					E('summary', { 'class': 'tx-muted' }, 'Выбрать из аренд DHCP'),
					this.leaseBox
				])
			]),

			TX.card('Правила', [
				E('label', { 'class': 'tx-check' }, [this.opt.redirect_dns, E('span', {}, 'Перенаправлять DNS (53) в Tor')]),
				E('label', { 'class': 'tx-check' }, [this.opt.redirect_tcp, E('span', {}, 'Перенаправлять TCP в TransPort')]),
				E('label', { 'class': 'tx-check' }, [this.opt.killswitch, E('span', {}, 'Kill switch: блокировать прямой трафик клиентов')]),
				E('label', { 'class': 'tx-check' }, [this.opt.block_ipv6, E('span', {}, 'Блокировать IPv6 для LAN (предотвращение утечек)')]),
				E('label', { 'class': 'tx-check' }, [this.opt.block_quic, E('span', {}, 'Блокировать QUIC (UDP 443)')]),
				E('label', { 'class': 'tx-check' }, [this.opt.block_dot, E('span', {}, 'Блокировать DNS-over-TLS (853)')]),
				E('label', { 'class': 'tx-check' }, [this.opt.router_traffic, E('span', {}, 'Заворачивать трафик самого роутера (осторожно)')]),
				E('div', { 'class': 'tx-row' }, [
					TX.btn('Применить', 'action important', function() { return self.save(); }),
					TX.btn('Показать правила nftables', 'action', function() { return self.preview(); })
				])
			])
		]);

		this.toggle(p.enabled);
		return page;
	},

	renderCounters: function(p) {
		return E('span', { 'class': 'tx-muted' }, 'пакетов: ' + (p.packets || 0) + ' · ' + TX.fmtBytes(p.bytes || 0));
	},

	toggle: function(on) {
		this.clients.disabled = !on;
		this.clients.style.opacity = on ? 1 : 0.5;
		if (this.stateLabel)
			this.stateLabel.textContent = on ? 'Прозрачное проксирование включено' : 'Прозрачное проксирование выключено';
	},

	values: function() {
		var self = this;
		return {
			enabled: this.enabled.checked,
			mode: this.mode.value,
			clients: this.clients.value.split('\n').map(function(s) { return s.trim(); }).filter(function(s) { return s.length; }),
			redirect_dns: this.opt.redirect_dns.checked,
			redirect_tcp: this.opt.redirect_tcp.checked,
			killswitch: this.opt.killswitch.checked,
			block_ipv6: this.opt.block_ipv6.checked,
			block_quic: this.opt.block_quic.checked,
			block_dot: this.opt.block_dot.checked,
			router_traffic: this.opt.router_traffic.checked
		};
	},

	save: function() {
		var self = this;
		var v = this.values();
		if (v.enabled && v.mode === 'clients' && !v.clients.length) {
			TX.notify('Добавьте хотя бы один IP клиента или выберите режим "Все устройства LAN"', 'warning');
			return;
		}
		return callSave(v.enabled, v.mode, v.clients, v.redirect_dns, v.redirect_tcp, v.killswitch, v.block_ipv6, v.block_quic, v.block_dot, v.router_traffic).then(function(res) {
			TX.notify(res.message || (res.ok ? 'Применено' : 'Ошибка'), res.ok ? 'success' : 'danger');
			if (res.state) {
				dom.content(self.counterBox, self.renderCounters(res.state));
				self.state = res.state;
			}
		}).catch(TX.rpcError);
	},

	preview: function() {
		return callPreview().then(function(res) {
			ui.showModal('Правила nftables', [
				E('pre', { 'class': 'tx-log', 'style': 'max-height:60vh' }, res.rules || '(пусто)'),
				E('div', { 'class': 'right' }, [E('button', { 'class': 'btn', 'click': ui.hideModal }, 'Закрыть')])
			]);
		}).catch(TX.rpcError);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
