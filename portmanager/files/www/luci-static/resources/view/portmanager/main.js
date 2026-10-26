'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require poll';

var REFRESH_INTERVAL = 5;

/* прямой RPC-вызов через fetch.
 * sessionid берётся из L.env.sessionid в момент вызова (после логина уже актуален). */
function rpcCall(object, method, params)
{
    var sid = L.env.sessionid ?? '';
    var msg = {
        jsonrpc: '2.0',
        id: 1,
        method: 'call',
        params: [sid, object, method, params || {}]
    };

    return fetch(L.env.ubuspath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(msg)
    }).then(function(res) {
        return res.json();
    }).then(function(json) {
        if (json && json.error)
            throw new Error(json.error.message || 'RPC error');
        var result = (json && json.result) ? json.result : null;
        if (!Array.isArray(result))
            throw new Error('Некорректный ответ RPC');
        if (result[0] !== 0)
            throw new Error('Ошибка ubus ' + result[0] + ': ' + (result[1] || ''));
        return (result.length > 1) ? result[1] : result[0];
    });
}

var callList = function() { return rpcCall('portmanager', 'list', {}); };
var callSet = function(port, enabled) {
    return rpcCall('portmanager', 'setEnabled', { port: port, enabled: enabled });
};
var callFlushMac = function(what) {
    return rpcCall('portmanager', 'flushMac', { what: what });
};
var callDelMac = function(mac, port) {
    return rpcCall('portmanager', 'deleteMac', { mac: mac, port: port });
};
var callTorch = function() { return rpcCall('portmanager', 'torch', {}); };

function mono(text)
{
	return E('span', { 'class': 'cbi-value-mono' }, text || '—');
}

function badge(text, color)
{
	return E('span', {
		'style': 'display:inline-block;padding:1px 7px;border-radius:3px;font-size:90%;color:#fff;background:' + color
	}, text);
}

function roleName(p)
{
	var r = p.role || '';

	if (r == 'lan') return 'LAN';
	if (r == 'wan') return 'WAN';
	if (r == '') return '';
	return r;
}

function statusCell(p)
{
	if (!p.enabled)
		return E('span', {}, [ badge('выключен', '#c62828'), ' ', E('small', {}, 'отключён в конфигурации') ]);

	if (p.carrier)
		return E('span', {}, [ badge('подключено', '#2e7d32'), ' ', E('small', {}, p.operstate || '') ]);

	return E('span', {}, [ badge('нет линка', '#ef6c00'), ' ', E('small', {}, p.operstate || '') ]);
}

function clientsOf(clients, port)
{
	var out = [];

	for (var mac in clients) {
		var c = clients[mac];
		if (c.port == port)
			out.push(c);
	}

	out.sort(function(a, b) {
		if (a.ip == b.ip)
			return a.mac < b.mac ? -1 : 1;
		return a.ip < b.ip ? -1 : 1;
	});

	return out;
}

function clientsTable(list, p, deletable)
{
	if (!list.length)
		return E('div', { 'class': 'cbi-value-description' },
			'Устройств за этим портом не обнаружено.' +
			(p.type == 'ethernet' ? ' MAC-адреса появляются после обмена трафиком с устройством.' : ''));

	var rows = list.map(function(c) {
		var src = [];
		if ((c.sources || []).indexOf('dhcp') > -1) src.push('DHCP');
		if ((c.sources || []).indexOf('arp') > -1) src.push('ARP');
		if ((c.sources || []).indexOf('fdb') > -1) src.push('FDB');

		var cells = [
			E('td', {}, mono(c.mac)),
			E('td', {}, mono(c.ip || '—')),
			E('td', {}, c.hostname || '—'),
			E('td', {}, src.join(', ')),
		];

		if (deletable) {
			cells.push(E('td', { 'style': 'text-align:center' }, [
				E('button', {
					'class': 'cbi-button cbi-button-neutral',
					'click': (function(mac, port) { return function() { return self.delMac(mac, port); }; })(c.mac, c.port || p.name),
					'style': 'font-size:80%;padding:2px 6px'
				}, 'Удалить')
			]));
		}

		return E('tr', { 'class': 'cbi-section-table-row' }, cells);
	});

	return E('table', { 'class': 'table cbi-section-table cbi-section-table-generic' }, [
		E('tr', { 'class': 'table-titles' }, [
			E('th', { 'class': 'cbi-section-table-header' }, 'MAC-адрес'),
			E('th', { 'class': 'cbi-section-table-header' }, 'IP-адрес'),
			E('th', { 'class': 'cbi-section-table-header' }, 'Имя устройства'),
			E('th', { 'class': 'cbi-section-table-header' }, 'Источник'),
			deletable ? E('th', { 'class': 'cbi-section-table-header' }, '') : ''
		])
	].concat(rows));
}

function torchCell(f)
{
	var dir = f.direction || '—';
	var color = '#666';

	if (dir == 'от роутера' || dir == 'к роутеру') color = '#2e7d32';
	else if (dir == 'скачивание' || dir == 'загрузка') color = '#1565c0';

	var b = (f.bytes / 1024 / 1024).toFixed(2);

	return E('tr', { 'class': 'cbi-section-table-row' }, [
		E('td', {}, mono(f.proto.toUpperCase())),
		E('td', {}, mono(f.state)),
		E('td', {}, [ mono(f.src), ':', mono(f.sport) ]),
		E('td', {}, [ mono(f.dst), ':', mono(f.dport) ]),
		E('td', {}, badge(dir, color)),
		E('td', {}, b + ' МБ'),
		E('td', {}, mono(f.packets)),
		E('td', {}, [ mono(f.src_name || f.src_port || '—'), ' → ', mono(f.dst_name || f.dst_port || '—') ]),
	]);
}

return view.extend({
	load: function() {
		return callList();
	},

	render: function(data) {
		var self = this;

		this.portsBox = E('div', { 'class': 'cbi-section' });
		this.unknownBox = E('div', { 'class': 'cbi-section' });
		this.summary = E('div', { 'class': 'cbi-section-descr' });

		this.torchBox = E('div', { 'class': 'cbi-section' });
		this.torchTable = E('div', {});
		this.torchEmpty = E('div', { 'class': 'cbi-value-description' }, 'Нет активных соединений.');
		this.torchData = null;
		this.torchPort = '';
		this.torchDev = '';
		this.torchClients = {};

		this.torchPortSel = E('select', {
			'style': 'margin-left:4px',
			'change': function(ev) {
				self.torchPort = ev.target.value;
				self.renderTorchRows();
			}
		}, [ E('option', { 'value': '' }, 'Все порты') ]);

		this.torchDevSel = E('select', {
			'style': 'margin-left:4px',
			'change': function(ev) {
				self.torchDev = ev.target.value;
				self.renderTorchRows();
			}
		}, [ E('option', { 'value': '' }, 'Все устройства') ]);

		var page = E('div', {}, [
			E('h2', {}, 'Управление портами'),
			E('div', { 'class': 'cbi-section-descr' },
				'Включение и отключение портов, список MAC-адресов устройств за каждым портом и мониторинг трафика (Torch).'),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-descr' }, [
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'click': function() { return self.refresh(); }
					}, 'Обновить'),
					' ',
					E('small', {}, 'автообновление каждые ' + REFRESH_INTERVAL + ' с')
				]),
				this.portsBox
			]),
			this.unknownBox,

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, 'MAC-адреса (очистка таблицы пересылки)'),
				E('div', { 'class': 'cbi-section-descr' },
					'Удаление записи заставляет устройство повторить ARP-запрос, после чего порт определится заново.'),
				E('div', { 'class': 'cbi-section-actions' }, [
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'click': function() { return self.flushMac('fdb'); }
					}, 'Очистить всю таблицу MAC'),
					' ',
					E('button', {
						'class': 'cbi-button cbi-button-neutral',
						'click': function() { return self.flushMac('arp'); }
					}, 'Очистить ARP-кэш')
				]),
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, 'Torch — активные соединения'),
				E('div', { 'class': 'cbi-section-descr' },
					'Кто с кем обменивается трафиком прямо сейчас (данные conntrack).'),
				E('div', { 'class': 'cbi-section-actions' }, [
					E('label', { 'class': 'cbi-checkbox' }, [
						'Порт: ', this.torchPortSel, ' '
					]),
					E('label', { 'class': 'cbi-checkbox' }, [
						'Устройство: ', this.torchDevSel, ' '
					]),
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'click': function() { return self.refreshTorch(); }
					}, 'Обновить')
				]),
				this.torchTable,
				this.torchEmpty
			]),

			this.summary
		]);

		self.update(data);
		self.refreshTorch();

		poll.add(L.bind(self.refresh, self), REFRESH_INTERVAL);

		return page;
	},

	refresh: function() {
		var self = this;

		return callList().then(function(data) {
			self.update(data);
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, 'Ошибка обновления: ' + (err && err.message ? err.message : err)), 'danger');
		});
	},

	refreshTorch: function() {
		var self = this;

		return callTorch().then(function(data) {
			self.renderTorch(data);
		}).catch(function(err) {
			var msg = 'Ошибка Torch: ' + (err && err.message ? err.message : err);
			ui.addNotification(null, E('p', {}, msg), 'danger');
			dom.content(self.torchEmpty, E('div', { 'class': 'alert-message danger' }, msg));
		});
	},

	renderTorch: function(data) {
		if (data == null || !data.ok)
			return;

		this.torchData = data;
		this.renderTorchRows();
	},

	renderTorchRows: function() {
		var self = this;
		var data = this.torchData;

		if (data == null)
			return;

		var flows = data.flows || [];

		/* фильтр по выбранному порту */
		if (this.torchPort) {
			var filtered = [];

			for (var k = 0; k < flows.length; k++) {
				if (flows[k].src_port == this.torchPort || flows[k].dst_port == this.torchPort)
					filtered.push(flows[k]);
			}

			flows = filtered;
		}

		/* фильтр по выбранному устройству (IP или MAC) */
		if (this.torchDev) {
			var dev = this.torchClients[this.torchDev] || null;
			var dip = dev ? (dev.ip || '') : '';
			var selected = [];

			for (var m = 0; m < flows.length; m++) {
				var fl = flows[m];

				if ((dip && (fl.src == dip || fl.dst == dip)) ||
				    fl.src_name == this.torchDev ||
				    fl.dst_name == this.torchDev)
					selected.push(fl);
			}

			flows = selected;
		}

		if (flows.length == 0) {
			var msg = this.torchPort ? ('Для порта ' + this.torchPort) : 'Нет активных соединений';
			if (this.torchDev && this.torchClients[this.torchDev]) {
				var dcl = this.torchClients[this.torchDev];
				msg = 'Для устройства ' + (dcl.hostname || dcl.ip || this.torchDev) + ' активных соединений не найдено';
				if (this.torchPort)
					msg += ' (порт ' + this.torchPort + ')';
			}
			dom.content(this.torchTable, []);
			dom.content(this.torchEmpty, E('div', { 'class': 'cbi-value-description' }, msg + '.'));
			return;
		}

		dom.content(this.torchEmpty, []);

		var rows = [];

		for (var i = 0; i < flows.length; i++) {
			try {
				rows.push(torchCell(flows[i]));
			}
			catch (rowErr) {
				rows.push(E('tr', {}, [
					E('td', {}, '—'),
					E('td', {}, '—'),
					E('td', {}, mono(flows[i].src)),
					E('td', {}, mono(flows[i].dst)),
					E('td', {}, '—'),
					E('td', {}, '—'),
					E('td', {}, '—'),
					E('td', {}, E('span', { 'style': 'color:#c62828' },
						'Ошибка строки: ' + (rowErr && rowErr.message ? rowErr.message : rowErr)))
				]));
			}
		}

		var total = 0;
		for (var j = 0; j < flows.length; j++)
			total += flows[j].bytes;

		var b = (total / 1024 / 1024).toFixed(2);

		dom.content(this.torchTable, [
			E('table', { 'class': 'table cbi-section-table cbi-section-table-generic' }, [
				E('tr', { 'class': 'table-titles' }, [
					E('th', { 'class': 'cbi-section-table-header' }, 'Протокол'),
					E('th', { 'class': 'cbi-section-table-header' }, 'Состояние'),
					E('th', { 'class': 'cbi-section-table-header' }, 'Источник'),
					E('th', { 'class': 'cbi-section-table-header' }, 'Назначение'),
					E('th', { 'class': 'cbi-section-table-header' }, 'Направление'),
					E('th', { 'class': 'cbi-section-table-header' }, 'Трафик'),
					E('th', { 'class': 'cbi-section-table-header' }, 'Пакетов'),
					E('th', { 'class': 'cbi-section-table-header' }, 'Порт → порт')
				])
			].concat(rows)),
			E('div', { 'class': 'cbi-value-description', 'style': 'margin-top:6px' },
				'Всего соединений: ' + flows.length + ', суммарный трафик в таблице: ' + b + ' МБ.')
		]);
	},

	update: function(data) {
		var self = this;

		if (data == null)
			return;

		var ports = data.ports || [];
		var clients = data.clients || {};

		this.torchClients = clients;

		/* обновляем список портов в фильтре Torch (сохраняя текущий выбор) */
		if (this.torchPortSel) {
			var prev = this.torchPort;
			var opts = [ E('option', { 'value': '' }, 'Все порты') ];

			for (var pi = 0; pi < ports.length; pi++) {
				var op = E('option', { 'value': ports[pi].name },
					ports[pi].name + (ports[pi].role ? ' (' + ports[pi].role.toUpperCase() + ')' : ''));
				if (ports[pi].name == prev)
					op.setAttribute('selected', 'selected');
				opts.push(op);
			}

			dom.content(this.torchPortSel, opts);
		}

		/* обновляем список устройств в фильтре Torch (сохраняя текущий выбор) */
		if (this.torchDevSel) {
			var prevDev = this.torchDev;
			var dopts = [ E('option', { 'value': '' }, 'Все устройства') ];

			var macs = [];
			for (var cm in clients)
				macs.push(cm);

			macs.sort(function(a, b) {
				var ha = clients[a].hostname || clients[a].ip || a;
				var hb = clients[b].hostname || clients[b].ip || b;
				return ha < hb ? -1 : 1;
			});

			for (var di = 0; di < macs.length; di++) {
				var c = clients[macs[di]];
				var label = c.hostname || macs[di];
				if (c.ip && c.hostname)
					label += ' (' + c.ip + ')';
				var dop = E('option', { 'value': macs[di] }, label);
				if (macs[di] == prevDev)
					dop.setAttribute('selected', 'selected');
				dopts.push(dop);
			}

			dom.content(this.torchDevSel, dopts);
		}

		var body = [
			E('tr', { 'class': 'table-titles' }, [
				E('th', { 'class': 'cbi-section-table-header' }, 'Порт'),
				E('th', { 'class': 'cbi-section-table-header' }, 'Назначение'),
				E('th', { 'class': 'cbi-section-table-header' }, 'Тип'),
				E('th', { 'class': 'cbi-section-table-header' }, 'Состояние'),
				E('th', { 'class': 'cbi-section-table-header' }, 'Скорость'),
				E('th', { 'class': 'cbi-section-table-header' }, 'MAC порта'),
				E('th', { 'class': 'cbi-section-table-header' }, 'Включён'),
				E('th', { 'class': 'cbi-section-table-header' }, 'Устройства')
			])
		];

		ports.forEach(function(p) {
			var list = clientsOf(clients, p.name);

			var detail = E('tr', { 'class': 'cbi-section-table-row', 'style': 'display:none' }, [
				E('td', { 'colspan': '9' }, [
					E('h4', {}, 'Устройства за портом ' + p.name),
					clientsTable(list, p, true)
				])
			]);

			var toggle = E('input', { 'type': 'checkbox' });
			if (p.enabled)
				toggle.setAttribute('checked', 'checked');
			if (!p.managed)
				toggle.setAttribute('disabled', 'disabled');

			toggle.addEventListener('change', function() {
				var want = toggle.checked;

				if (!want) {
					toggle.checked = p.enabled;
					self.confirmDisable(p, function() { return self.applyToggle(p, want, toggle); });
					return;
				}

				self.applyToggle(p, want, toggle);
			});

			var showBtn = E('button', {
				'class': 'cbi-button cbi-button-neutral',
				'click': function() {
					if (detail.style.display == 'none')
						detail.style.display = '';
					else
						detail.style.display = 'none';
				}
			}, 'MAC-адреса (' + list.length + ')');

			body.push(E('tr', { 'class': 'cbi-section-table-row' }, [
				E('td', {}, [ E('b', {}, p.name), ' ', E('small', {}, p.master ? '(' + p.master + ')' : '') ]),
				E('td', {}, roleName(p) || '—'),
				E('td', {}, p.type == 'wifi' ? ('Wi-Fi' + (p.ssid ? ' ' + p.ssid : '')) : 'Ethernet'),
				E('td', {}, statusCell(p)),
				E('td', {}, p.speed ? (p.speed + ' Мбит/с' + (p.duplex ? ' / ' + p.duplex : '')) : '—'),
				E('td', {}, mono(p.mac)),
				E('td', {}, E('label', { 'class': 'cbi-checkbox' }, [ toggle ])),
				E('td', {}, showBtn)
			]));

			body.push(detail);
		});

		dom.content(self.portsBox, E('table', { 'class': 'table cbi-section-table cbi-section-table-generic' }, body));

		var total = 0;
		for (var mac in clients)
			total++;

		var unknown = [];

		for (var mac in clients) {
			if (!clients[mac].port)
				unknown.push(clients[mac]);
		}

		unknown.sort(function(a, b) {
			return a.ip < b.ip ? -1 : 1;
		});

		if (unknown.length) {
			dom.content(self.unknownBox, [
				E('h3', {}, 'Устройства без определённого порта (' + unknown.length + ')'),
				E('div', { 'class': 'cbi-section-descr' },
					'Эти устройства видны в арендах DHCP или ARP, но мост уже не хранит их в таблице пересылки.'),
				clientsTable(unknown, { type: 'ethernet' }, true)
			]);
		}
		else {
			dom.content(self.unknownBox, []);
		}

		dom.content(self.summary, E('span', {},
			'Всего обнаружено устройств в сети: ' + total + '. Данные MAC-адресов берутся из таблицы пересылки моста (bridge FDB), ARP-таблицы и аренд DHCP.'));
	},

	confirmDisable: function(p, onOk) {
		var extra = '';

		if (p.role == 'wan')
			extra = ' Интернет на роутере будет отключён.';
		else if (p.type == 'wifi')
			extra = ' Wi-Fi точка доступа перестанет раздавать сеть.';

		ui.showModal('Отключить порт ' + p.name + '?', [
			E('p', {}, 'Порт ' + p.name + ' будет отключён до перезагрузки роутера.' +
				' Если вы подключены к роутеру через этот порт, связь оборвётся.' + extra),
			E('div', { 'class': 'cbi-section-actions' }, [
				E('button', {
					'class': 'cbi-button cbi-button-neutral',
					'click': function() { ui.hideModal(); }
				}, 'Отмена'),
				' ',
				E('button', {
					'class': 'cbi-button cbi-button-action important',
					'click': function() { ui.hideModal(); onOk(); }
				}, 'Отключить')
			])
		]);
	},

	applyToggle: function(p, want, toggle) {
		var self = this;

		toggle.disabled = true;

		return callSet(p.name, want).then(function(res) {
			if (res && res.ok)
				ui.addNotification(null, E('p', {}, res.message || 'Готово.'), 'info');
			else
				ui.addNotification(null, E('p', {}, (res && res.message) ? res.message : 'Не удалось изменить состояние порта.'), 'danger');

			return self.refresh();
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, 'Ошибка: ' + (err && err.message ? err.message : err)), 'danger');
		}).then(function() {
			toggle.disabled = false;
		});
	},

	flushMac: function(what) {
		var self = this;

		return callFlushMac(what).then(function(res) {
			if (res && res.ok) {
				ui.addNotification(null, E('p', {}, res.message || 'Готово.'), 'info');
				self.refresh();
			}
			else
				ui.addNotification(null, E('p', {}, (res && res.message) ? res.message : 'Не удалось очистить таблицу.'), 'danger');
		}).catch(function(err) {
			ui.addNotification(null, E('p', {}, 'Ошибка: ' + (err && err.message ? err.message : err)), 'danger');
		});
	},

	delMac: function(mac, port) {
		var self = this;

		ui.showModal('Удалить запись MAC?', [
			E('p', {}, 'Удалить запись ' + mac + (port ? ' (порт ' + port + ')' : '') + ' из таблицы пересылки?'),
			E('div', { 'class': 'cbi-section-actions' }, [
				E('button', {
					'class': 'cbi-button cbi-button-neutral',
					'click': function() { ui.hideModal(); }
				}, 'Отмена'),
				' ',
				E('button', {
					'class': 'cbi-button cbi-button-action',
					'click': function() {
						ui.hideModal();
						return callDelMac(mac, port).then(function(res) {
							if (res && res.ok) {
								ui.addNotification(null, E('p', {}, res.message || 'Запись удалена.'), 'info');
								self.refresh();
							}
							else
								ui.addNotification(null, E('p', {}, (res && res.message) ? res.message : 'Не удалось удалить запись.'), 'danger');
						}).catch(function(err) {
							ui.addNotification(null, E('p', {}, 'Ошибка: ' + (err && err.message ? err.message : err)), 'danger');
						});
					}
				}, 'Удалить')
			])
		]);
	}
});
