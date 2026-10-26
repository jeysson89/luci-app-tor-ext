'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require poll';
'require tor-ext/common as TX';

var callGet = rpc.declare({ object: 'tor-ext', method: 'splitGet' });
var callSave = rpc.declare({
	object: 'tor-ext', method: 'splitSave',
	params: ['enabled', 'mode', 'scope', 'clients', 'full_clients', 'lists', 'custom_domains', 'custom_subnets', 'block_quic', 'block_dot', 'interval']
});
var callUpdate = rpc.declare({ object: 'tor-ext', method: 'splitUpdate' });
var callResolve = rpc.declare({ object: 'tor-ext', method: 'splitResolve' });
var callLeases = rpc.declare({ object: 'luci-rpc', method: 'getDHCPLeases' });

var INTERV = [['1h', 'каждый час'], ['6h', 'каждые 6 часов'], ['12h', 'каждые 12 часов'], ['24h', 'каждые сутки']];

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
		var s = data[0];
		var leases = data[1] || [];
		this.state = s;

		this.enabled = E('input', { 'type': 'checkbox', 'checked': s.enabled ? '' : null, 'change': function(ev) { self.toggle(ev.target.checked); } });
		this.stateLabel = E('span', {}, s.enabled ? 'Раздельное туннелирование включено' : 'Раздельное туннелирование выключено');

		this.scope = E('select', { 'class': 'cbi-input-select', 'change': function() { self.renderDeviceList(); } }, [
			E('option', { 'value': 'clients', 'selected': s.scope !== 'all' ? '' : null }, 'Только выбранные устройства'),
			E('option', { 'value': 'all', 'selected': s.scope === 'all' ? '' : null }, 'Все устройства LAN')
		]);

		this.interval = E('select', { 'class': 'cbi-input-select' }, INTERV.map(function(o) {
			return E('option', { 'value': o[0], 'selected': s.interval === o[0] ? '' : null }, o[1]);
		}));

		this.opt = {};
		[['block_quic', 'Блокировать QUIC (UDP 443) к сайтам из списков', s.block_quic],
		 ['block_dot', 'Блокировать DNS-over-TLS (853)', s.block_dot]].forEach(function(o) {
			self.opt[o[0]] = E('input', { 'type': 'checkbox', 'checked': o[2] ? '' : null });
		});

		this.customDomains = E('textarea', { 'class': 'tx-code', 'rows': 4, 'spellcheck': 'false', 'placeholder': 'example.com\nsecond.example.org', 'style': 'min-height:96px' }, (s.custom_domains || []).join('\n'));
		this.customSubnets = E('textarea', { 'class': 'tx-code', 'rows': 4, 'spellcheck': 'false', 'placeholder': '103.21.244.0/22\n52.5.0.0/16', 'style': 'min-height:96px' }, (s.custom_subnets || []).join('\n'));

		this.listBox = E('div', {}, this.renderLists(s));
		this.counterBox = E('div', { 'id': 'tx-split-counters' }, this.renderCounters(s));

		/* devices: mode selection (split/full) from DHCP leases + manual add */
		this.leases = leases;
		this.manualClients = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': '192.168.1.100', 'style': 'width:160px' });
		this.manualMode = E('select', { 'class': 'cbi-input-select', 'style': 'width:190px' }, [
			E('option', { 'value': 'split' }, 'Раздельно'),
			E('option', { 'value': 'full' }, 'Весь трафик')
		]);
		this.deviceBox = E('div', {});

		var page = E('div', { 'class': 'tx-page' }, [
			TX.style(),
			E('h2', {}, 'Раздельное туннелирование'),
			E('div', { 'class': 'tx-muted' },
				'Трафик выбранных доменов и подсетей идёт через Tor, остальное — напрямую. ' +
				'Списки — зеркало itdoginfo/allow-domains (те же, что использует podkop); домены списков резолвятся через Tor, их IP-адреса заворачиваются в Tor правилами nftables.'),

			TX.card('Состояние', [
				E('div', { 'class': 'tx-row', 'style': 'justify-content:space-between' }, [
					E('label', { 'style': 'margin:0;font-weight:bold' }, [this.enabled, this.stateLabel]),
					this.counterBox
				]),
				E('div', { 'class': 'tx-muted' },
					'DNS списков: ', s.dnsmasq_conf ? 'обслуживается dnsmasq' : 'отключён',
					' · nftables: ', s.nft_table ? 'таблица загружена' : 'таблица отсутствует',
					s.resolving ? ' · идёт разрешение доменов…' : '')
			]),

			TX.card('Устройства', [
				E('div', { 'class': 'tx-row' }, [E('label', {}, 'Кому применять'), this.scope]),
				E('div', { 'class': 'tx-muted' },
					'«Раздельно» — через Tor идут только домены и подсети из списков. ' +
					'«Весь трафик» — через Tor идёт всё, кроме локальной сети (killswitch: при остановке Tor интернет у устройства блокируется).'),
				this.deviceBox,
				E('div', { 'class': 'tx-row', 'style': 'margin-top:8px' }, [
					E('label', { 'class': 'tx-muted', 'style': 'margin:0' }, 'Добавить вручную:'),
					this.manualClients,
					this.manualMode,
					TX.btn('Добавить', 'action', function() { return self.addManual(); })
				])
			]),

			TX.card('Списки', [this.listBox]),
			TX.card('Свои цели', [
				E('div', { 'class': 'tx-row', 'style': 'align-items:flex-start' }, [
					E('div', { 'style': 'flex:1;min-width:260px' }, [E('b', {}, 'Домены'), E('br'), this.customDomains]),
					E('div', { 'style': 'flex:1;min-width:260px' }, [E('b', {}, 'Подсети / IP'), E('br'), this.customSubnets])
				])
			]),

			TX.card('Обновление и параметры', [
				E('div', { 'class': 'tx-row' }, [E('label', {}, 'Автообновление списков'), this.interval]),
				E('label', { 'class': 'tx-check' }, [this.opt.block_quic, 'Блокировать QUIC (UDP 443) к сайтам из списков']),
				E('label', { 'class': 'tx-check' }, [this.opt.block_dot, 'Блокировать DNS-over-TLS (853)']),
				E('div', { 'class': 'tx-row', 'style': 'margin-top:10px' }, [
					TX.btn('Применить', 'action important', function() { return self.save(); }),
					TX.btn('Обновить списки с GitHub', 'action', function() { return self.update(); }),
					TX.btn('Разрешить домены сейчас', 'action', function() { return self.resolve(); })
				]),
				E('div', { 'class': 'tx-muted' }, 'Списки при обновлении сначала скачиваются через Tor (socks5), при неудаче — напрямую.')
			])
		]);

		this.toggle(s.enabled);
		this.renderDeviceList();
		return page;
	},

	renderCounters: function(s) {
		var c = s.counts || {};
		return E('span', { 'class': 'tx-muted' },
			'доменов: ' + (c.domains || 0) +
			' · подсетей: ' + (c.subnets || 0) +
			' · IP в наборе: ' + (c.resolved || 0) +
			' · разрешено: ' + (c.resolved_at ? TX.fmtTime(c.resolved_at) : '—'));
	},

	renderLists: function(s) {
		var self = this;
		var groups = {}, order = [];
		var cat = s.catalog || [];

		for (var i = 0; i < cat.length; i++) {
			var e = cat[i];
			var g = e.group || 'Прочее';
			if (!groups[g]) {
				groups[g] = [];
				order.push(g);
			}
			groups[g].push(e);
		}
		if (!order.length)
			return [E('p', { 'class': 'tx-muted' }, 'Каталог списков недоступен.')];

		var boxes = {};
		this.listBoxes = boxes;

		var weight = { 'Россия': 0, 'Сервисы': 1, 'Категории': 2, 'Подсети': 3 };
		order.sort(function(a, b) { return (weight[a] != null ? weight[a] : 9) - (weight[b] != null ? weight[b] : 9); });

		var out = [];
		for (var gi = 0; gi < order.length; gi++) {
			var name = order[gi];
			out.push(E('div', { 'style': 'margin-top:10px;font-weight:bold' }, name));
			for (var k = 0; k < groups[name].length; k++) {
				var it = groups[name][k];
				var meta = [];
				if (it.subnets_of) meta.push('включая подсети');
				if (it.downloaded) meta.push('скачан ' + TX.fmtTime(it.downloaded_at));
				else meta.push('не скачан');
				var cb = E('input', { 'type': 'checkbox', 'checked': it.enabled ? '' : null, 'data-id': it.id });
				boxes[it.id] = cb;
				out.push(E('label', { 'class': 'tx-check', 'style': 'display:flex;margin:4px 0;align-items:flex-start' }, [
					cb,
					E('span', {}, [
						E('b', {}, it.title || it.id),
						E('span', { 'class': 'tx-muted' }, '  (' + (it.remote || 0) + ') · ' + meta.join(', ')),
						it.desc ? E('div', { 'class': 'tx-muted', 'style': 'font-weight:normal' }, it.desc) : ''
					])
				]));
			}
		}
		return out;
	},

	renderDeviceList: function() {
		var self = this;
		if (this.scope.value === 'all') {
			dom.content(this.deviceBox, [
				E('div', { 'class': 'tx-muted' }, 'Правила применяются ко всем устройствам LAN.')
			]);
			return;
		}

		var leaseIPs = {};
		(this.leases || []).forEach(function(l) { leaseIPs[self.leaseIP(l)] = true; });

		var rows = [];
		(this.leases || []).slice(0, 60).forEach(function(l) {
			rows.push(self.deviceRow(self.leaseIP(l), l.hostname || l.macaddr || ''));
		});

		/* manual entries that are not in the leases */
		var seen = {}, extras = [];
		((this.state && this.state.clients) || []).forEach(function(ip) {
			if (!leaseIPs[ip] && !seen[ip]) { seen[ip] = 1; extras.push(ip); }
		});
		((this.state && this.state.full_clients) || []).forEach(function(ip) {
			if (!leaseIPs[ip] && !seen[ip]) { seen[ip] = 1; extras.push(ip); }
		});
		extras.forEach(function(ip) {
			rows.push(self.deviceRow(ip, 'добавлено вручную'));
		});

		if (!rows.length)
			rows.push(E('div', { 'class': 'tx-muted' }, 'Аренды DHCP не найдены — добавьте IP вручную.'));
		dom.content(this.deviceBox, rows);
	},

	leaseIP: function(l) {
		return l.ipaddr || l.ip || '';
	},

	deviceRow: function(ip, host) {
		var self = this;
		var sel = E('select', { 'class': 'cbi-input-select', 'style': 'width:220px' }, [
			E('option', { 'value': '' }, '— без Tor —'),
			E('option', { 'value': 'split' }, 'Раздельно (списки)'),
			E('option', { 'value': 'full' }, 'Весь трафик через Tor')
		]);
		sel.value = this.deviceMode(ip);
		sel.addEventListener('change', function() {
			self.setDeviceMode(ip, sel.value);
		});
		return E('div', { 'class': 'tx-row', 'style': 'margin:4px 0;justify-content:space-between;align-items:center' }, [
			E('span', {}, [E('b', {}, ip), host ? E('span', { 'class': 'tx-muted' }, '  ' + host) : '']),
			sel
		]);
	},

	deviceMode: function(ip) {
		var sc = (this.state && this.state.clients) || [];
		if (sc.indexOf(ip) >= 0)
			return 'split';
		var fc = (this.state && this.state.full_clients) || [];
		if (fc.indexOf(ip) >= 0)
			return 'full';
		return '';
	},

	setDeviceMode: function(ip, mode) {
		var sc = ((this.state && this.state.clients) || []).slice()
			.filter(function(x) { return x !== ip; });
		var fc = ((this.state && this.state.full_clients) || []).slice()
			.filter(function(x) { return x !== ip; });
		if (mode === 'split')
			sc.push(ip);
		if (mode === 'full')
			fc.push(ip);
		this.state.clients = sc;
		this.state.full_clients = fc;
	},

	addManual: function() {
		var ip = String(this.manualClients.value || '').trim();
		if (!ip) return;
		if (!/^([0-9]{1,3}\.){3}[0-9]{1,3}(\/[0-9]{1,2})?$/.test(ip)) {
			TX.notify('Неверный IP или подсеть: ' + ip, 'danger');
			return;
		}
		this.setDeviceMode(ip, this.manualMode.value);
		this.manualClients.value = '';
		this.renderDeviceList();
	},

	toggle: function(on) {
		for (var id in (this.listBoxes || {}))
			this.listBoxes[id].disabled = !on;
		this.scope.disabled = !on;
		if (this.stateLabel)
			this.stateLabel.textContent = on ? 'Раздельное туннелирование включено' : 'Раздельное туннелирование выключено';
	},

	values: function() {
		var lists = [];
		for (var id in (this.listBoxes || {}))
			if (this.listBoxes[id].checked)
				lists.push(id);
		return {
			enabled: this.enabled.checked,
			mode: 'proxy',
			scope: this.scope.value,
			clients: (this.state && this.state.clients) || [],
			full_clients: (this.state && this.state.full_clients) || [],
			lists: lists,
			custom_domains: this.customDomains.value.split('\n').map(function(s) { return s.trim(); }).filter(function(s) { return s.length; }),
			custom_subnets: this.customSubnets.value.split('\n').map(function(s) { return s.trim(); }).filter(function(s) { return s.length; }),
			block_quic: this.opt.block_quic.checked,
			block_dot: this.opt.block_dot.checked,
			interval: this.interval.value
		};
	},

	save: function() {
		var self = this;
		var v = this.values();
		return callSave(v.enabled, v.mode, v.scope, v.clients, v.full_clients, v.lists, v.custom_domains, v.custom_subnets, v.block_quic, v.block_dot, v.interval).then(function(res) {
			TX.notify(res.message || (res.ok ? 'Применено' : 'Ошибка'), res.ok ? 'success' : 'danger');
			if (res.state) {
				self.state = res.state;
				dom.content(self.counterBox, self.renderCounters(res.state));
				self.renderDeviceList();
			}
		}).catch(TX.rpcError);
	},

	update: function() {
		var self = this;
		return callUpdate().then(function(res) {
			TX.notify(res.message || 'Обновление запущено', 'success');
			poll.add(function() {
				return callGet().then(function(st) {
					dom.content(self.counterBox, self.renderCounters(st));
					return false;
				});
			}, 8);
		}).catch(TX.rpcError);
	},

	resolve: function() {
		var self = this;
		return callResolve().then(function(res) {
			TX.notify(res.message || 'Разрешение запущено', 'success');
			poll.add(function() {
				return callGet().then(function(st) {
					dom.content(self.counterBox, self.renderCounters(st));
					return false;
				});
			}, 8);
		}).catch(TX.rpcError);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
