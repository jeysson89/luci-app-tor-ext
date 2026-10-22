'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require tor-ext/common as TX';

var callGet = rpc.declare({ object: 'tor-ext', method: 'bridgesGet' });
var callSave = rpc.declare({ object: 'tor-ext', method: 'bridgesSave', params: ['bridges', 'restart', 'revision', 'force'] });
var callTestAll = rpc.declare({ object: 'tor-ext', method: 'bridgesTest', params: ['bridges'] });
var callTestOne = rpc.declare({ object: 'tor-ext', method: 'bridgeTestStart', params: ['type', 'line'] });
var callTestStatus = rpc.declare({ object: 'tor-ext', method: 'bridgesTestStatus' });

/* Fields of every transport type. The line is assembled as
 * "<type> <address> <fingerprint> <extra>" */
var TYPES = {
	obfs4: {
		label: 'obfs4',
		hint: 'Подключение через obfs4proxy, маскирует трафик под случайный поток.',
		fields: [
			{ name: 'addr', label: 'Адрес (ip:port)', width: '160px' },
			{ name: 'fp', label: 'Отпечаток (40 hex)', width: '260px' },
			{ name: 'extra', label: 'Параметры (cert=…, iat-mode=0)', width: '260px' }
		]
	},
	snowflake: {
		label: 'snowflake',
		hint: 'Прокси через WebRTC браузера, хорошо работает в странах с блокировками.',
		fields: [
			{ name: 'addr', label: 'Адрес (ip:port)', width: '150px' },
			{ name: 'fp', label: 'Отпечаток (40 hex)', width: '250px' },
			{ name: 'extra', label: 'Параметры (url=…, ice=…)', width: '280px' }
		]
	},
	meek: {
		label: 'meek_lite',
		hint: 'Доменное сокрытие (fronting), маскирует трафик под HTTPS-запрос.',
		fields: [
			{ name: 'addr', label: 'Адрес (ip:port)', width: '150px' },
			{ name: 'fp', label: 'Отпечаток (40 hex)', width: '250px' },
			{ name: 'extra', label: 'Параметры (url=…)', width: '280px' }
		]
	},
	webtunnel: {
		label: 'webtunnel',
		hint: 'Прокси через облако (HTTPS-туннель), актуально для жёсткой цензуры.',
		fields: [
			{ name: 'addr', label: 'Адрес ([ipv6]:port)', width: '190px' },
			{ name: 'fp', label: 'Отпечаток (40 hex)', width: '250px' },
			{ name: 'extra', label: 'Параметры (url=…)', width: '280px' }
		]
	},
	vanilla: {
		label: 'Обычный мост',
		hint: 'Мост без дополнительного транспорта (требует IP-адрес моста).',
		fields: [
			{ name: 'addr', label: 'Адрес (ip:port)', width: '150px' },
			{ name: 'fp', label: 'Отпечаток (40 hex)', width: '250px' },
			{ name: 'extra', label: 'Параметры', width: '280px' }
		]
	}
};

function fingerprintOf(line) {
	var m = (line || '').match(/\b([0-9A-Fa-f]{40})\b/);
	return m ? m[1].toUpperCase() : '';
}

/* Split a bridge line into the editable fields */
function splitLine(type, line) {
	var v = (line || '').trim();
	var parts = v.split(/\s+/);
	var res = { addr: '', fp: '', extra: '' };

	if (type === 'vanilla') {
		res.addr = parts[0] || '';
		res.fp = parts[1] || '';
		res.extra = parts.slice(2).join(' ');
	}
	else {
		res.addr = parts[1] || '';
		res.fp = parts[2] || '';
		res.extra = parts.slice(3).join(' ');
	}
	return res;
}

return view.extend({
	load: function() {
		return callGet();
	},

	render: function(st) {
		var self = this;
		this.types = st.transports || [];
		this.sections = {};
		this.testState = {};
		this.revision = st.revision || '';

		var page = E('div', { 'class': 'tx-page' }, [
			TX.style(),
			E('h2', {}, 'Мосты Tor'),
			E('div', { 'class': 'tx-muted' },
				'Мосты группируются по типу транспорта. В каждом разделе кнопка «+» добавляет новый мост, ' +
				'«Проверить» запускает изолированную проверку только этого моста. Все изменения применяются кнопкой «Сохранить».'),
			E('div', { 'class': 'tx-muted', 'style': 'margin-top:6px' },
				'Раздел «Мосты» работает напрямую со строками Bridge в файле /etc/tor/torrc: ' +
				'при сохранении они перезаписываются целиком, а строки ClientTransportPlugin заменяются ' +
				'на выбранный транспорт. Если torrc правили вручную, сначала нажмите «Обновить из файла» — ' +
				'иначе приложение предупредит о конфликте и не станет ничего затирать.'),
			E('div', { 'class': 'tx-row' }, [
				TX.btn('Сохранить и перезапустить', 'action important', function() { return self.save(true); }),
				TX.btn('Сохранить без перезапуска', 'action', function() { return self.save(false); }),
				TX.btn('Обновить из файла', 'action', function() { return self.reload(); }),
				TX.btn('Проверить все мосты', 'action', function() { return self.testAll(); }),
				TX.btn('Удалить все мосты', 'reset', function() { return self.removeAll(); })
			])
		]);

		this.types.forEach(function(t) {
			page.appendChild(self.renderSection(t));
		});

		this.resultBox = E('div', { 'class': 'tx-card' }, [
			E('h3', {}, 'Результат проверки'),
			E('div', { 'class': 'tx-muted' }, 'Здесь появляется вывод последней проверки моста.')
		]);
		page.appendChild(this.resultBox);

		/* show the bridges that are already configured in torrc */
		(st.bridges || []).forEach(function(b) {
			var key = self.sections[b.type] ? b.type : 'vanilla';
			var values = splitLine(key, b.line);
			self.sections[key].rows.push({
				id: key + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
				values: values
			});
		});

		Object.keys(this.sections).forEach(function(key) { self._refreshSection(key); });

		return page;
	},

	renderSection: function(t) {
		var self = this;
		var def = TYPES[t.key] || TYPES.vanilla;

		this.sections[t.key] = { transport: t, rows: [] };

		var listBox = E('div', { 'class': 'tx-section-list' });
		var addBtn = TX.btn('+ Добавить мост', 'action', function() { return self.addRow(t.key); });

		var hint = '';
		if (!t.installed) {
			var pkgs = {
				snowflake: 'нужен lyrebird (obfs4/snowflake/meek/webtunnel) либо snowflake-client',
				meek: 'нужен lyrebird либо meek-client',
				webtunnel: 'нужен lyrebird либо webtunnel-client',
				obfs4: 'нужен lyrebird либо obfs4proxy',
				vanilla: ''
			};
			hint = pkgs[t.key] ? ('Установка: ' + pkgs[t.key]) : '';
		}

		var head = E('div', { 'class': 'tx-row', 'style': 'justify-content:space-between;margin:0 0 4px 0' }, [
			E('div', { 'class': 'tx-row', 'style': 'margin:0;gap:8px' }, [
				E('b', {}, def.label),
				t.key === 'vanilla'
					? TX.badge('транспорт не нужен', 'tx-idle')
					: (t.installed ? TX.badge('установлен', 'tx-ok') : TX.badge('не установлен', 'tx-err')),
				E('span', { 'class': 'tx-muted tx-mono' }, t.binary || '')
			]),
			addBtn
		]);

		var card = E('div', { 'class': 'tx-card' }, [
			head,
			E('div', { 'class': 'tx-muted', 'style': 'margin-bottom:6px' }, def.hint + (hint ? ' — ' + hint : '')),
			listBox
		]);

		this.sections[t.key]._listBox = listBox;
		return card;
	},

	_refreshSection: function(key) {
		var self = this;
		var sec = this.sections[key];
		if (!sec || !sec._listBox)
			return;

		var box = sec._listBox;
		dom.content(box, []);

		if (!sec.rows.length) {
			box.appendChild(E('div', { 'class': 'tx-muted' }, 'Мосты этого типа не добавлены. Нажмите «+ Добавить мост».'));
			return;
		}

		sec.rows.forEach(function(row, idx) {
			box.appendChild(self.renderRow(key, row, idx));
		});
	},

	renderRow: function(key, row, idx) {
		var self = this;
		var def = TYPES[key] || TYPES.vanilla;
		var inputs = {};

		var fields = E('div', { 'class': 'tx-row', 'style': 'margin:0;gap:8px;align-items:flex-end' },
			def.fields.map(function(f) {
				var input = E('input', {
					'type': 'text',
					'class': 'cbi-input-text',
					'value': row.values[f.name] || '',
					'style': 'width:' + f.width,
					'placeholder': f.name === 'addr' ? '1.2.3.4:443' : (f.name === 'fp' ? 'CDA13CF5…' : '')
				});
				input.addEventListener('input', function(ev) { row.values[f.name] = ev.target.value; });
				inputs[f.name] = input;
				return E('div', {}, [E('div', { 'class': 'tx-muted', 'style': 'margin-bottom:2px' }, f.label), input]);
			}));

		var state = this.testState[row.id] || {};
		var badge = '';
		if (state.status == 'running')
			badge = TX.badge('проверка… ' + (state.percent || 0) + '%', 'tx-warn');
		else if (state.status == 'ok')
			badge = TX.badge('работает (100%)', 'tx-ok');
		else if (state.status == 'fail')
			badge = TX.badge('не работает (' + (state.percent || 0) + '%)', 'tx-err');

		var actions = E('div', { 'class': 'tx-row', 'style': 'margin:0;gap:6px' }, [
			TX.btn('Проверить', 'action', function() { return self.testOne(key, row); }),
			TX.btn('Удалить', 'reset', function() {
				var sec = self.sections[key];
				sec.rows.splice(idx, 1);
				self._refreshSection(key);
			}),
			badge
		]);

		return E('div', { 'class': 'tx-bridge-row' }, [fields, actions]);
	},

	/* --- data handling ------------------------------------------------ */

	addRow: function(key) {
		var sec = this.sections[key];
		var row = {
			id: key + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
			values: { addr: '', fp: '', extra: '' }
		};
		sec.rows.push(row);
		this._refreshSection(key);
	},

	buildLine: function(key, row) {
		var def = TYPES[key] || TYPES.vanilla;
		var v = row.values;
		var parts = [];

		if (key !== 'vanilla')
			parts.push(def.label);
		if (v.addr)
			parts.push(v.addr.trim());
		if (v.fp)
			parts.push(v.fp.trim());
		if (v.extra)
			parts.push(v.extra.trim());

		return parts.join(' ');
	},

	collect: function() {
		var out = [];
		var self = this;
		Object.keys(this.sections).forEach(function(key) {
			self.sections[key].rows.forEach(function(row) {
				var line = self.buildLine(key, row);
				if (line.length)
					out.push({ type: key, line: line });
			});
		});
		return out;
	},

	save: function(restart, force) {
		var self = this;
		var list = this.collect();

		return callSave(list, restart, this.revision, force === true).then(function(res) {
			if (res && res.conflict) {
				if (!confirm(res.message + '\n\nСохранить список из приложения и перезаписать строки Bridge в torrc?'))
					return;
				return self.save(restart, true);
			}

			TX.notify(res.message || (res.ok ? 'Сохранено' : 'Ошибка'), res.ok ? 'success' : 'danger');

			if (res.ok)
				return self.reload();
		}).catch(TX.rpcError);
	},

	/* re-read the bridges from the torrc */
	reload: function() {
		var self = this;
		return callGet().then(function(st) {
			self.revision = st.revision || '';

			Object.keys(self.sections).forEach(function(key) { self.sections[key].rows = []; });

			(st.bridges || []).forEach(function(b) {
				var key = self.sections[b.type] ? b.type : 'vanilla';
				var values = splitLine(key, b.line);
				self.sections[key].rows.push({
					id: key + '-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
					values: values
				});
			});

			Object.keys(self.sections).forEach(function(key) { self._refreshSection(key); });
			TX.notify('Список мостов обновлён из /etc/tor/torrc', 'info');
		}).catch(TX.rpcError);
	},

	removeAll: function() {
		var self = this;
		if (!confirm('Удалить все мосты? Tor будет подключаться напрямую.'))
			return;
		Object.keys(this.sections).forEach(function(key) { self.sections[key].rows = []; });
		Object.keys(this.sections).forEach(function(key) { self._refreshSection(key); });
		return this.save(true);
	},

	/* --- testing ------------------------------------------------------ */

	testOne: function(key, row) {
		var self = this;
		var line = this.buildLine(key, row);

		if (!line.length) {
			TX.notify('Заполните адрес моста', 'warning');
			return;
		}

		this.testState[row.id] = { status: 'running', percent: 0 };
		this._refreshSection(key);

		return callTestOne(key, line).then(function(res) {
			if (!res.ok) {
				self.testState[row.id] = { status: 'fail', percent: 0 };
				self._refreshSection(key);
				TX.notify(res.message || 'Ошибка', 'danger');
				return;
			}
			TX.notify('Проверка моста запущена', 'info');
			self.startPolling(row.id, key);
		}).catch(TX.rpcError);
	},

	testAll: function() {
		var self = this;
		var list = this.collect();

		if (!list.length) {
			TX.notify('Не добавлено ни одного моста', 'warning');
			return;
		}

		return callTestAll(list).then(function(res) {
			if (!res.ok) {
				TX.notify(res.message || 'Ошибка', 'danger');
				return;
			}
			TX.notify(res.message || 'Проверка запущена', 'info');
			self.startPolling(null, null);
		}).catch(TX.rpcError);
	},

	startPolling: function(rowId, key) {
		var self = this;

		if (this.timer) clearInterval(this.timer);

		var tick = function() {
			return callTestStatus().then(function(res) {
				if (rowId) {
					var st = self.testState[rowId] || {};
					st.percent = res.percent;
					st.status = (res.status == 'running') ? 'running' : (res.percent >= 100 ? 'ok' : 'fail');
					self.testState[rowId] = st;
					self._refreshSection(key);
				}

				if (res.status != 'running') {
					clearInterval(self.timer);
					self.timer = null;

					if (self.resultBox)
						dom.content(self.resultBox, self.renderResult(res));

					if (rowId) {
						TX.notify(res.percent >= 100
							? 'Мост работает: bootstrap 100%'
							: 'Мост не работает: bootstrap ' + (res.percent || 0) + '%',
							res.percent >= 100 ? 'success' : 'warning');
					}
					else {
						TX.notify(res.percent >= 100
							? 'Все мосты работают: bootstrap 100%'
							: 'Проверка завершена: bootstrap ' + (res.percent || 0) + '%',
							res.percent >= 100 ? 'success' : 'warning');
					}
				}
			}).catch(function() {
				clearInterval(self.timer);
				self.timer = null;
			});
		};

		tick();
		this.timer = setInterval(tick, 2000);
	},

	renderResult: function(res) {
		var kind = (res.percent >= 100) ? 'tx-ok' : 'tx-err';
		var label = (res.percent >= 100)
			? 'Мост работает: bootstrap 100%'
			: 'Мост не работает: bootstrap ' + (res.percent || 0) + '%';

		return [
			E('div', { 'class': 'tx-row', 'style': 'margin-top:0' }, [
				TX.badge(label, kind),
				E('span', { 'class': 'tx-muted' }, res.phase || ''),
				res.tested ? E('span', { 'class': 'tx-mono tx-muted' }, res.tested) : ''
			]),
			res.log ? E('details', {}, [E('summary', { 'class': 'tx-muted' }, 'Лог Tor'), E('pre', { 'class': 'tx-log' }, res.log)]) : '',
			res.err ? E('details', {}, [E('summary', { 'class': 'tx-muted' }, 'Вывод транспорта'), E('pre', { 'class': 'tx-log' }, res.err)]) : ''
		];
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
