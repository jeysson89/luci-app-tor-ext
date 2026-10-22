'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require poll';
'require tor-ext/common as TX';

var callStatus = rpc.declare({
	object: 'tor-ext',
	method: 'status'
});

var callAction = rpc.declare({
	object: 'tor-ext',
	method: 'action',
	params: ['cmd']
});

var callCheckIp = rpc.declare({
	object: 'tor-ext',
	method: 'checkIp',
	params: ['force']
});

function badgeFor(svc) {
	if (svc && svc.running)
		return TX.badge('Tor работает', 'tx-ok');
	return TX.badge('Tor остановлен', 'tx-err');
}

function guardsTable(guards) {
	if (!guards || !guards.length)
		return E('p', { 'class': 'tx-muted' }, 'Мосты ещё не используются (нет установленных guard-соединений).');

	return E('table', { 'class': 'tx-table' }, [
		E('tr', {}, [E('th', {}, 'Мост'), E('th', {}, 'Состояние'), E('th', {}, 'Отпечаток')])
	].concat(guards.map(function(g) {
		return E('tr', {}, [
			E('td', {}, g.name || '(без имени)'),
			E('td', {}, g.state === 'up' ? TX.badge('подключён', 'tx-ok') : TX.badge(g.state || '—', 'tx-warn')),
			E('td', { 'class': 'tx-mono' }, g.fp || '—')
		]);
	})));
}

return view.extend({
	load: function() {
		return callStatus();
	},

	render: function(st) {
		this.chart = TX.trafficChart();
		this.statsBox = E('div', { 'class': 'tx-card' }, [
			E('h3', {}, 'Статистика скорости'),
			E('table', { 'class': 'tx-table' }, [
				E('tr', {}, [E('th', {}, 'Показатель'), E('th', {}, 'Значение')]),
				E('tr', {}, [E('td', {}, 'Текущая скорость'), E('td', { 'id': 'tx-st-cur' }, '—')]),
				E('tr', {}, [E('td', {}, 'Максимальная скорость (пик)'), E('td', { 'id': 'tx-st-max' }, '—')]),
				E('tr', {}, [E('td', {}, 'Время пика'), E('td', { 'id': 'tx-st-peak' }, '—')]),
				E('tr', {}, [E('td', {}, 'Средняя скорость'), E('td', { 'id': 'tx-st-avg' }, '—')]),
				E('tr', {}, [E('td', {}, 'Всего принято'), E('td', { 'id': 'tx-st-rx' }, '—')]),
				E('tr', {}, [E('td', {}, 'Всего отправлено'), E('td', { 'id': 'tx-st-tx' }, '—')]),
				E('tr', {}, [E('td', {}, 'Замеров / окно'), E('td', { 'id': 'tx-st-count' }, '—')])
			]),
			E('div', { 'class': 'tx-muted' }, 'Пик выделяется на графике оранжевой точкой и пунктирной линией.')
		]);

		var self = this;
		var page = E('div', { 'class': 'tx-page' }, [
			TX.style(),
			E('h2', {}, 'Tor'),
			E('div', { 'class': 'tx-muted' }, 'Состояние Tor, мосты, порты и прозрачное проксирование.'),

			E('div', { 'class': 'tx-card' }, [
				E('div', { 'class': 'tx-row', 'style': 'justify-content:space-between' }, [
					E('div', { 'id': 'tx-svc-badge' }, badgeFor(st.service)),
					E('div', { 'class': 'tx-row', 'style': 'margin:0;gap:6px' }, [
						TX.btn('Запустить', 'action', function() { return self.doAction('start'); }),
						TX.btn('Остановить', 'reset', function() { return self.doAction('stop'); }),
						TX.btn('Перезапустить', 'action', function() { return self.doAction('restart'); })
					])
				]),
				E('div', { 'class': 'tx-row' }, [
					E('div', { 'style': 'flex:1;min-width:240px' }, [
						E('div', { 'class': 'tx-row', 'style': 'margin:0' }, [
							E('b', {}, 'Bootstrap: '),
							E('span', { 'id': 'tx-boot-pct' }, (st.bootstrap ? st.bootstrap.percent : 0) + '%'),
							E('span', { 'class': 'tx-muted', 'id': 'tx-boot-tag' }, ' ' + (st.bootstrap ? st.bootstrap.tag : ''))
						]),
						E('div', { 'class': 'tx-bar' }, [E('div', { 'id': 'tx-boot-bar', 'style': 'width:' + (st.bootstrap ? st.bootstrap.percent : 0) + '%' })])
					])
				])
			]),

			E('div', { 'class': 'tx-grid' }, [
				TX.kpi('Версия Tor', st.version || '—', 'tx-ver'),
				TX.kpi('Аптайм', TX.fmtUptime(st.uptime), 'tx-uptime'),
				TX.kpi('Цепочки (построено/всего)', (st.circuits ? st.circuits.built : 0) + ' / ' + (st.circuits ? st.circuits.total : 0), 'tx-circ'),
				TX.kpi('Выходной узел', (st.circuits && st.circuits.exit) || '—', 'tx-exit'),
				TX.kpi('Принято', TX.fmtBytes(st.traffic ? st.traffic.read : 0), 'tx-rx'),
				TX.kpi('Отправлено', TX.fmtBytes(st.traffic ? st.traffic.written : 0), 'tx-tx')
			]),

			this.chart,
			this.statsBox,

			E('div', { 'class': 'tx-card' }, [
				E('div', { 'class': 'tx-row', 'style': 'justify-content:space-between' }, [
					E('h3', { 'style': 'margin:0' }, 'Внешний IP через Tor'),
					TX.btn('Проверить', 'action', function() { return self.checkIp(); })
				]),
				E('div', { 'id': 'tx-ip' }, this.renderIp(st.ip))
			]),

			TX.card('Мосты', [
				E('div', { 'class': 'tx-row' }, [
					E('span', {}, 'Режим: '),
					E('b', { 'id': 'tx-bridge-mode' }, this.bridgeModeLabel(st.bridges)),
					E('span', { 'class': 'tx-muted', 'id': 'tx-bridge-count' }, st.bridges ? ' (' + st.bridges.count + ' шт.)' : '')
				]),
				E('div', { 'id': 'tx-guards' }, guardsTable(st.bridges ? st.bridges.guards : []))
			], E('a', { 'class': 'btn cbi-button', 'href': L.url('admin/services/tor-ext/bridges') }, 'Настроить'))
		]);

		if (st.traffic) {
			this.chart.push(st.traffic.read, st.traffic.written);
			this.updateStats();
		}

		poll.add(L.bind(this.refresh, this), 5);
		return page;
	},

	bridgeModeLabel: function(br) {
		if (!br || !br.enabled)
			return 'напрямую (без мостов)';
		var map = {
			obfs4: 'obfs4',
			snowflake: 'snowflake',
			meek: 'meek',
			meek_lite: 'meek_lite',
			webtunnel: 'webtunnel',
			vanilla: 'обычные мосты',
			auto: 'автоматически',
			custom: 'своя конфигурация'
		};
		return map[br.mode] || br.mode;
	},

	renderIp: function(ip) {
		if (!ip)
			return E('span', { 'class': 'tx-muted' }, 'нет данных');
		if (!ip.ok)
			return E('div', {}, [
				TX.badge('нет соединения', 'tx-err'),
				E('span', { 'class': 'tx-muted' }, ' ' + (ip.error || ''))
			]);
		return E('div', { 'class': 'tx-row', 'style': 'margin:0' }, [
			E('span', { 'class': 'tx-badge tx-ok' }, ip.ip),
			ip.tor === true ? TX.badge('Tor подтверждён', 'tx-ok') : (ip.tor === false ? TX.badge('не через Tor', 'tx-err') : ''),
			E('span', { 'class': 'tx-muted' }, 'проверено ' + TX.fmtTime(ip.checked) + ', ' + ip.elapsed + ' с')
		]);
	},

	refresh: function() {
		var self = this;
		return callStatus().then(function(st) {
			var set = function(id, value) {
				var n = document.getElementById(id);
				if (n) n.textContent = value;
			};

			var badge = document.getElementById('tx-svc-badge');
			if (badge) dom.content(badge, badgeFor(st.service));

			set('tx-boot-pct', (st.bootstrap ? st.bootstrap.percent : 0) + '%');
			set('tx-boot-tag', ' ' + (st.bootstrap ? st.bootstrap.tag : ''));
			var bar = document.getElementById('tx-boot-bar');
			if (bar) bar.style.width = (st.bootstrap ? st.bootstrap.percent : 0) + '%';

			set('tx-ver', st.version || '—');
			set('tx-uptime', TX.fmtUptime(st.uptime));
			set('tx-circ', (st.circuits ? st.circuits.built : 0) + ' / ' + (st.circuits ? st.circuits.total : 0));
			set('tx-exit', (st.circuits && st.circuits.exit) || '—');
			set('tx-rx', TX.fmtBytes(st.traffic ? st.traffic.read : 0));
			set('tx-tx', TX.fmtBytes(st.traffic ? st.traffic.written : 0));

			var ip = document.getElementById('tx-ip');
			if (ip) dom.content(ip, self.renderIp(st.ip));

			var g = document.getElementById('tx-guards');
			if (g) dom.content(g, guardsTable(st.bridges ? st.bridges.guards : []));

			set('tx-bridge-mode', self.bridgeModeLabel(st.bridges));
			set('tx-bridge-count', st.bridges ? ' (' + st.bridges.count + ' шт.)' : '');

			if (st.traffic) {
				self.chart.push(st.traffic.read, st.traffic.written);
				self.updateStats();
			}
		}).catch(function() {});
	},

	updateStats: function() {
		var st = this.chart.stats();
		var set = function(id, value) {
			var n = document.getElementById(id);
			if (n) n.textContent = value;
		};

		if (!st.count) {
			['tx-st-cur', 'tx-st-max', 'tx-st-avg', 'tx-st-peak', 'tx-st-count'].forEach(function(id) { set(id, '—'); });
			set('tx-st-rx', TX.fmtBytes(st.rx));
			set('tx-st-tx', TX.fmtBytes(st.tx));
			return;
		}

		set('tx-st-cur', TX.fmtKib(st.current));
		set('tx-st-max', TX.fmtKib(st.max));
		set('tx-st-avg', TX.fmtKib(st.avg));
		set('tx-st-rx', TX.fmtBytes(st.rx));
		set('tx-st-tx', TX.fmtBytes(st.tx));
		set('tx-st-peak', st.peak ? new Date(st.peak.t).toLocaleTimeString('ru-RU') : '—');
		set('tx-st-count', st.count + ' (≈ ' + Math.round(st.count * 5 / 60) + ' мин)');
	},

	doAction: function(cmd) {
		var self = this;
		TX.notify('Выполняется: ' + cmd + '…', 'info');
		return callAction(cmd).then(function(res) {
			TX.notify(res && res.message ? res.message : ('Команда ' + cmd + ' выполнена'), 'success');
			return new Promise(function(resolve) { window.setTimeout(resolve, 2500); });
		}).then(function() {
			return self.refresh();
		}).catch(TX.rpcError);
	},

	checkIp: function() {
		var self = this;
		TX.notify('Проверка внешнего IP через Tor…', 'info');
		return callCheckIp(true).then(function(res) {
			var node = document.getElementById('tx-ip');
			if (node) dom.content(node, self.renderIp(res));
			TX.notify(res.ok ? ('Внешний IP: ' + res.ip) : (res.error || 'Не удалось проверить IP'), res.ok ? 'success' : 'warning');
		}).catch(TX.rpcError);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
