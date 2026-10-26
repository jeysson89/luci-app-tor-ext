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
	params: ['enabled', 'mode', 'scope', 'clients', 'lists', 'custom_domains', 'custom_subnets', 'block_quic', 'block_dot', 'interval']
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

		this.mode = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': 'proxy', 'selected': s.mode !== 'direct' ? '' : null }, 'Только адреса из списков — через Tor'),
			E('option', { 'value': 'direct', 'selected': s.mode === 'direct' ? '' : null }, 'Из списков — напрямую (исключения из полного туннеля)')
		]);

		this.scope = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': 'clients', 'selected': s.scope !== 'all' ? '' : null }, 'Только выбранные устройства'),
			E('option', { 'value': 'all', 'selected': s.scope === 'all' ? '' : null }, 'Все устройства LAN')
		]);

		this.clients = E('textarea', { 'class': 'tx-code', 'rows': 5, 'spellcheck': 'false', 'placeholder': '192.168.1.100\n192.168.1.101', 'style': 'min-height:120px' }, (s.clients || []).join('\n'));

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

		this.listBox = E('div', {}, this.renderLists(s, leases));
		this.counterBox = E('div', { 'id': 'tx-split-counters' }, this.renderCounters(s));
		this.leaseBox = E('div', { 'class': 'tx-grid' }, leases.length ? leases.slice(0, 40).map(function(l) {
			var ip = l.ipaddr || l.ip || '';
			return E('div', { 'class': 'tx-row', 'style': 'margin:0;gap:6px;justify-content:space-between' }, [
				E('span', {}, [E('b', {}, ip || '?'), E('span', { 'class': 'tx-muted' }, ' ' + (l.hostname || ''))]),
				TX.btn('Добавить', 'action', function() {
					var v = self.clients.value.split('\n').map(function(x) { return x.trim(); }).filter(function(x) { return x.length; });
					if (ip && v.indexOf(ip) < 0) v.push(ip);
					self.clients.value = v.join('\n');
				})
			]);
		}) : E('p', { 'class': 'tx-muted' }, 'Аренды DHCP не найдены.'));

		var page = E('div', { 'class': 'tx-page' }, [
			TX.style(),
			E('h2', {}, 'Раздельное туннелирование'),
			E('div', { 'class': 'tx-muted' },
				'Трафик только для выбранных доменов и подсетей. Списки — зеркало itdoginfo/allow-domains (используются podkop), файлы хранятся в репозитории приложения. Домены списков резолвятся через Tor, их IP-адреса заворачиваются в TransPort через nftables.'),

			TX.card('Состояние', [
				E('div', { 'class': 'tx-row', 'style': 'justify-content:space-between' }, [
					E('label', { 'class': 'tx-check', 'style': 'margin:0;font-weight:bold' }, [this.enabled, this.stateLabel]),
					this.counterBox
				]),
				E('div', { 'class': 'tx-muted' }, s.dnsmasq_conf ? 'DNS списков обслуживается dnsmasq' : 'DNS списков отключён', E('span', {}, ' · '), 'nftables: ', s.nft_table ? 'таблица загружена' : 'таблица отсутствует', s.resolving ? ' · идёт разрешение доменов…' : '')
			]),

			TX.card('Как заворачивать трафик', [
				E('div', { 'class': 'tx-row' }, [E('label', {}, 'Режим'), this.mode]),
				E('div', { 'class': 'tx-muted' },
					'«Через Tor» — сайты из списков идут через Tor, остальное напрямую (работает и без полного проксирования). ' +
					'«Напрямую» — полный туннель из раздела «Проксирование» не касается адресов из списков (российские банки, почта и т.п. идут напрямую).')
			]),

			TX.card('Устройства', [
				E('div', { 'class': 'tx-row' }, [E('label', {}, 'Кому применять'), this.scope]),
				E('div', { 'class': 'tx-muted' }, 'IP-адреса или подсети, по одному в строке. Для режима «напрямую» устройства настраиваются в разделе «Проксирование».'),
				this.clients,
				E('details', {}, [
					E('summary', { 'class': 'tx-muted' }, 'Выбрать из аренд DHCP'),
					this.leaseBox
				])
			]),

			TX.card('Списки', [this.listBox]),
			TX.card('Свои цели', [
				E('div', { 'class': 'tx-row' }, [
					E('div', { 'style': 'flex:1;min-width:260px' }, [E('b', {}, 'Домены'), this.customDomains]),
					E('div', { 'style': 'flex:1;min-width:260px' }, [E('b', {}, 'Подсети / IP'), this.customSubnets])
				])
			]),

			TX.card('Обновление', [
				E('div', { 'class': 'tx-row' }, [E('label', {}, 'Автообновление'), this.interval]),
				E('div', { 'class': 'tx-row' }, [
					TX.btn('Применить', 'action important', function() { return self.save(); }),
					TX.btn('Обновить списки с GitHub', 'action', function() { return self.update(); }),
					TX.btn('Разрешить домены сейчас', 'action', function() { return self.resolve(); })
				]),
				E('div', { 'class': 'tx-muted' }, 'Списки при обновлении сначала скачиваются через Tor (socks5), при неудаче — напрямую.')
			])
		]);

		this.toggle(s.enabled);
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
		var groups = {};
		var order = [];
		var cat = s.catalog || [];

		for (var i = 0; i < cat.length; i++) {
			var e = cat[i];
			if (!groups[e.group]) {
				groups[e.group] = [];
				order.push(e.group);
			}
			groups[e.group].push(e);
		}
		if (!order.length)
			return [E('p', { 'class': 'tx-muted' }, 'Каталог списков недоступен.')];

		var boxes = {};
		this.listBoxes = boxes;

		order.sort(function(a, b) {
			var w = { 'Россия': 0, 'Сервисы': 1, 'Категории': 2, 'Подсети': 3 };
			return (w[a] ?? 9) - (w[b] ?? 9);
		});

		var out = [];
		for (var g = 0; g < order.length; g++) {
			var name = order[g];
			out.push(E('div', { 'class': 'tx-muted', 'style': 'margin-top:8px;font-weight:bold' }, name));
			for (var k = 0; k < groups[name].length; k++) {
				var e = groups[name][k];
				var meta = [];
				if (e.subnets_of) meta.push('включая подсети');
				if (e.downloaded) meta.push('файл от ' + TX.fmtTime(e.downloaded_at));
				else meta.push('не скачан');
				var cb = E('input', { 'type': 'checkbox', 'checked': e.enabled ? '' : null, 'data-id': e.id });
				boxes[e.id] = cb;
				out.push(E('label', { 'class': 'tx-check' }, [
					cb,
					E('span', {}, [E('b', {}, e.title), E('span', { 'class': 'tx-muted' }, '  (' + e.remote + ') · ' + meta.join(', '))])
				]));
				if (e.desc)
					out.push(E('div', { 'class': 'tx-muted', 'style': 'margin-left:24px;margin-top:-2px' }, e.desc));
			}
		}
		return out;
	},

	toggle: function(on) {
		this.clients.disabled = !on;
		this.clients.style.opacity = on ? 1 : 0.5;
		for (var id in (this.listBoxes || {}))
			this.listBoxes[id].disabled = !on;
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
			mode: this.mode.value,
			scope: this.scope.value,
			clients: this.clients.value.split('\n').map(function(s) { return s.trim(); }).filter(function(s) { return s.length; }),
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
		return callSave(v.enabled, v.mode, v.scope, v.clients, v.lists, v.custom_domains, v.custom_subnets, v.block_quic, v.block_dot, v.interval).then(function(res) {
			TX.notify(res.message || (res.ok ? 'Применено' : 'Ошибка'), res.ok ? 'success' : 'danger');
			if (res.state) {
				self.state = res.state;
				dom.content(self.counterBox, self.renderCounters(res.state));
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
