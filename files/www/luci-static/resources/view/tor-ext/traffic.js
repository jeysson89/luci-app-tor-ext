'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require tor-ext/common as TX';

var callTraffic = rpc.declare({ object: 'tor-ext', method: 'trafficGet' });
var callResolve = rpc.declare({ object: 'tor-ext', method: 'trafficResolve', params: ['ip'] });
var callClose = rpc.declare({ object: 'tor-ext', method: 'trafficClose', params: ['client', 'dst', 'dport'] });
var callLeases = rpc.declare({ object: 'luci-rpc', method: 'getDHCPLeases' });

var STATE_LABEL = {
	ESTABLISHED: 'установлено',
	SYN_SENT: 'установление',
	SYN_RECV: 'установление',
	FIN_WAIT: 'закрывается',
	CLOSE_WAIT: 'закрывается',
	LAST_ACK: 'закрывается',
	TIME_WAIT: 'завершено',
	UNREPLIED: 'без ответа',
	'': 'активно'
};

return view.extend({
	load: function() {
		return Promise.all([
			callTraffic(),
			callLeases().then(function(res) { return (res && res.dhcp_leases) ? res.dhcp_leases : []; }).catch(function() { return []; })
		]);
	},

	render: function(data) {
		var self = this;
		this.names = {};
		this.filter = '';
		this.client = '';
		this.leases = data[1] || [];

		this.table = E('tbody', {});
		this.summary = E('div', { 'class': 'tx-muted' }, '');

		/* device selector */
		this.clientSel = E('select', { 'class': 'cbi-input-select', 'change': function(ev) { self.client = ev.target.value; self._fill(self.last); } },
			[E('option', { 'value': '' }, 'Все устройства')].concat(this._clientOptions(data[0])));

		this.activeOnly = E('input', { 'type': 'checkbox', 'checked': '' });
		this.activeOnly.addEventListener('change', function() { self._fill(self.res); });

		this.textFilter = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'style': 'width:200px',
			'placeholder': 'фильтр: ip, порт, домен'
		});
		this.textFilter.addEventListener('input', function(ev) {
			self.filter = ev.target.value.trim().toLowerCase();
			self._fill(self.last);
		});

		var page = E('div', { 'class': 'tx-page' }, [
			TX.style(),
			E('h2', {}, 'Трафик через Tor'),
			E('div', { 'class': 'tx-muted' },
				'Соединения клиентов, обрабатываемые прозрачным проксированием. Источник — таблица conntrack ядра, ' +
				'доменные имена определяются отдельно. Можно выбрать устройство и закрыть все его соединения.'),
			TX.card('Фильтр', [
				E('div', { 'class': 'tx-row' }, [
					E('label', {}, 'Устройство'),
					this.clientSel,
					this.textFilter,
					E('label', { 'class': 'tx-check' }, [this.activeOnly, E('span', {}, 'только активные')]),
					TX.btn('Обновить', 'action', function() { return self.refresh(); }),
					TX.btn('Автообновление', 'action', function() { return self.toggleAuto(); }),
					TX.btn('Закрыть все соединения устройства', 'reset', function() { return self.closeAll(); }),
					this.summary
				])
			]),
			TX.card('Соединения', [
				E('table', { 'class': 'tx-table' }, [
					E('thead', {}, [
						E('tr', {}, [
							E('th', {}, 'Клиент'),
							E('th', {}, 'Протокол'),
							E('th', {}, 'Ресурс (адрес)'),
							E('th', {}, 'Порт'),
							E('th', {}, 'Состояние'),
							E('th', {}, 'Через Tor'),
							E('th', {}, 'Объём'),
							E('th', {}, '')
						])
					]),
					this.table
				])
			])
		]);

		this._fill(data[0]);
		return page;
	},

	_clientOptions: function(res) {
		var self = this;
		var names = {};

		(this.leases || []).forEach(function(l) {
			var ip = l.ipaddr || l.ip;
			if (ip) names[ip] = l.hostname || l.macaddr || l.mac || '';
		});

		var list = [];
		(res.sources || []).forEach(function(s) { list.push(s.ip); });
		(res.clients || []).forEach(function(ip) { if (list.indexOf(ip) < 0) list.push(ip); });
		(this.leases || []).forEach(function(l) {
			var ip = l.ipaddr || l.ip;
			if (ip && list.indexOf(ip) < 0) list.push(ip);
		});

		return list.sort().map(function(ip) {
			return E('option', { 'value': ip }, ip + (names[ip] ? ' (' + names[ip] + ')' : ''));
		});
	},

	_fill: function(res) {
		var self = this;
		var list = (res && res.connections) ? res.connections : (this.last || []);
		this.last = res && res.connections ? res.connections : list;
		this.res = res;

		var filtered = list.filter(function(c) {
			if (self.client && c.src != self.client)
				return false;
			if (self.activeOnly.checked && !c.active)
				return false;
			if (!self.filter)
				return true;
			var name = (self.names[c.dst] || '').toLowerCase();
			return (c.src + ' ' + c.dst + ' ' + c.dport + ' ' + c.proto + ' ' + name).indexOf(self.filter) >= 0;
		});

		/* group the entries by client and destination */
		var groups = [];
		var index = {};

		filtered.forEach(function(c) {
			var key = c.src + '|' + c.dst + '|' + c.dport + '|' + c.proto;
			if (index[key] == null) {
				index[key] = groups.length;
				groups.push({ conn: c, count: 0, packets: 0, bytes: 0, active: c.active });
			}
			var g = groups[index[key]];
			g.count++;
			g.packets += c.packets || 0;
			g.bytes += c.bytes || 0;
			if (c.active) g.active = true;
		});

		groups.sort(function(a, b) {
			if (a.active != b.active) return a.active ? -1 : 1;
			return b.packets - a.packets;
		});

		var rows = groups;

		dom.content(this.table, []);

		if (!rows.length) {
			this.table.appendChild(E('tr', {}, [
				E('td', { 'colspan': '8', 'class': 'tx-muted' },
					res && res.enabled === false
						? 'Прозрачное проксирование выключено — соединения не отслеживаются.'
						: 'Активных соединений нет.')
			]));
		}

		rows.forEach(function(g) {
			var c = g.conn;
			var name = self.names[c.dst];
			var host = E('span', {}, c.dst);
			if (name)
				host.appendChild(E('span', { 'class': 'tx-muted' }, ' (' + name + ')'));

			self.table.appendChild(E('tr', {}, [
				E('td', { 'class': 'tx-mono' }, c.src),
				E('td', {}, (c.proto || '').toUpperCase()),
				E('td', { 'class': 'tx-mono' }, host),
				E('td', { 'class': 'tx-mono' }, (c.dport || '—') + (g.count > 1 ? ' (×' + g.count + ')' : '')),
				E('td', {}, STATE_LABEL[c.state] || c.state || '—'),
				E('td', {}, c.proxied ? TX.badge('да', 'tx-ok') : TX.badge('нет', 'tx-idle')),
				E('td', { 'class': 'tx-muted' }, TX.fmtBytes(g.bytes)),
				E('td', {}, TX.btn('Закрыть', 'reset', function() { return self.closeOne(c); }))
			]));
		});

		var proxied = list.filter(function(c) { return c.proxied; }).length;
		var activeCount = list.filter(function(c) { return c.active; }).length;
		dom.content(this.summary,
			'всего: ' + list.length + ', активных: ' + activeCount + ', через Tor: ' + proxied +
			(self.client ? ', устройство: ' + self.client : ''));

		/* resolve host names for the destinations (limited amount) */
		var ips = [];
		list.forEach(function(c) {
			if (c.dst && ips.indexOf(c.dst) < 0)
				ips.push(c.dst);
		});

		ips.slice(0, 12).forEach(function(ip) {
			if (self.names[ip])
				return;
			callResolve(ip).then(function(r) {
				if (r && r.name) {
					self.names[ip] = r.name;
					self._fill(self.res);
				}
			}).catch(function() {});
		});
	},

	refresh: function() {
		var self = this;
		return callTraffic().then(function(res) {
			self._fill(res);
		}).catch(TX.rpcError);
	},

	toggleAuto: function() {
		var self = this;
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
			TX.notify('Автообновление выключено', 'info');
			return;
		}
		this.timer = setInterval(function() { self.refresh(); }, 5000);
		TX.notify('Автообновление включено (5 секунд)', 'info');
	},

	closeAll: function() {
		var self = this;
		if (!this.client) {
			TX.notify('Выберите устройство в фильтре', 'warning');
			return;
		}
		if (!confirm('Закрыть все соединения устройства ' + this.client + '?'))
			return;

		return callClose(this.client, '', '').then(function(res) {
			TX.notify(res.message || (res.ok ? 'Соединения закрыты' : 'Ошибка'), res.ok ? 'success' : 'danger');
			return self.refresh();
		}).catch(TX.rpcError);
	},

	closeOne: function(c) {
		var self = this;
		return callClose(c.src, c.dst, c.dport).then(function(res) {
			TX.notify(res.message || (res.ok ? 'Соединение закрыто' : 'Ошибка'), res.ok ? 'success' : 'danger');
			return self.refresh();
		}).catch(TX.rpcError);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
