'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require poll';

var callList = rpc.declare({ object: 'portmanager', method: 'list' });
var callSet = rpc.declare({ object: 'portmanager', method: 'setEnabled', params: [ 'port', 'enabled' ] });

var REFRESH_INTERVAL = 5;

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

function clientsTable(list, p)
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

		return E('tr', { 'class': 'cbi-section-table-row' }, [
			E('td', {}, mono(c.mac)),
			E('td', {}, mono(c.ip || '—')),
			E('td', {}, c.hostname || '—'),
			E('td', {}, src.join(', ')),
		]);
	});

	return E('table', { 'class': 'table cbi-section-table cbi-section-table-generic' }, [
		E('tr', { 'class': 'table-titles' }, [
			E('th', { 'class': 'cbi-section-table-header' }, 'MAC-адрес'),
			E('th', { 'class': 'cbi-section-table-header' }, 'IP-адрес'),
			E('th', { 'class': 'cbi-section-table-header' }, 'Имя устройства'),
			E('th', { 'class': 'cbi-section-table-header' }, 'Источник'),
		])
	].concat(rows));
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

		var page = E('div', {}, [
			E('h2', {}, 'Управление портами'),
			E('div', { 'class': 'cbi-section-descr' },
				'Включение и отключение портов, а также список MAC-адресов устройств, подключённых к каждому порту.'),
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
			this.summary
		]);

		self.update(data);

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

	update: function(data) {
		var self = this;

		if (data == null)
			return;

		var ports = data.ports || [];
		var clients = data.clients || {};

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
				E('td', { 'colspan': '8' }, [
					E('h4', {}, 'Устройства за портом ' + p.name),
					clientsTable(list, p)
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

		/* устройства, для которых порт определить не удалось */
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
				clientsTable(unknown, { type: 'ethernet' })
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
	}
});
