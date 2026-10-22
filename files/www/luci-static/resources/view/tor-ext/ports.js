'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require tor-ext/common as TX';

var callGet = rpc.declare({ object: 'tor-ext', method: 'portsGet' });
var callSave = rpc.declare({ object: 'tor-ext', method: 'portsSave', params: ['socks', 'trans', 'dns', 'control', 'lan', 'restart'] });
var callHsAdd = rpc.declare({ object: 'tor-ext', method: 'hsAdd', params: ['name', 'ports', 'restart'] });
var callHsDel = rpc.declare({ object: 'tor-ext', method: 'hsDel', params: ['dir', 'purge'] });

function portOnly(v) {
	v = (v || '').trim();
	var i = v.lastIndexOf(':');
	return i >= 0 ? v.slice(i + 1) : v;
}

function isLan(v) {
	return /^0\.0\.0\.0:/.test((v || '').trim());
}

return view.extend({
	load: function() {
		return callGet();
	},

	render: function(st) {
		var self = this;
		this.st = st;

		this.socks = TX.input(portOnly(st.socks), { 'class': 'cbi-input-text tx-input' });
		this.trans = TX.input(portOnly(st.trans), { 'class': 'cbi-input-text tx-input' });
		this.dns = TX.input(portOnly(st.dns), { 'class': 'cbi-input-text tx-input' });
		this.control = TX.input(portOnly(st.control), { 'class': 'cbi-input-text tx-input' });
		this.lan = E('input', { 'type': 'checkbox', 'checked': (isLan(st.socks) || isLan(st.trans)) ? '' : null });

		this.nameInput = TX.input('', { 'placeholder': 'my-service', 'class': 'cbi-input-text' });
		this.portsArea = E('textarea', { 'class': 'tx-code', 'rows': 4, 'spellcheck': 'false', 'placeholder': '80 127.0.0.1:8080\n22 127.0.0.1:22' });

		this.hsBox = E('div', { 'id': 'tx-hs' }, this.renderServices(st.hidden_services));

		return E('div', { 'class': 'tx-page' }, [
			TX.style(),
			E('h2', {}, 'Порты и скрытые сервисы'),

			TX.card('Порты Tor', [
				E('div', { 'class': 'tx-grid' }, [
					E('div', {}, [E('div', { 'class': 'tx-muted' }, 'SOCKS'), this.socks]),
					E('div', {}, [E('div', { 'class': 'tx-muted' }, 'TransPort'), this.trans]),
					E('div', {}, [E('div', { 'class': 'tx-muted' }, 'DNSPort'), this.dns]),
					E('div', {}, [E('div', { 'class': 'tx-muted' }, 'ControlPort'), this.control])
				]),
				E('label', { 'class': 'tx-check' }, [this.lan, E('span', {}, 'Слушать на 0.0.0.0 (доступно из LAN — менее безопасно)')]),
				E('div', { 'class': 'tx-muted' }, 'После сохранения Tor перезапускается, правила прозрачного прокси применяются к новым портам.'),
				E('div', { 'class': 'tx-row' }, [
					TX.btn('Сохранить порты', 'action important', function() { return self.save(); })
				])
			]),

			TX.card('Скрытые сервисы (.onion)', [
				this.hsBox,
				E('hr'),
				E('div', { 'class': 'tx-row' }, [E('label', {}, 'Имя сервиса'), this.nameInput]),
				E('div', { 'class': 'tx-muted' }, 'Порты: "виртуальный порт [адрес:порт]" — по одному в строке.'),
				this.portsArea,
				E('div', { 'class': 'tx-row' }, [
					TX.btn('Добавить сервис', 'action', function() { return self.add(); })
				]),
				E('div', { 'class': 'tx-muted' }, 'Ключи и hostname хранятся в /var/lib/tor/hs-<имя>. После добавления адрес появится в таблице (может занять несколько секунд).')
			])
		]);
	},

	renderServices: function(list) {
		var self = this;
		if (!list || !list.length)
			return E('p', { 'class': 'tx-muted' }, 'Скрытых сервисов нет.');

		return E('table', { 'class': 'tx-table' }, [
			E('tr', {}, [E('th', {}, 'Адрес'), E('th', {}, 'Порты'), E('th', {}, 'Каталог'), E('th', {}, '')])
		].concat(list.map(function(hs) {
			var copy = function() {
				if (navigator.clipboard && hs.hostname)
					navigator.clipboard.writeText(hs.hostname);
				TX.notify('Скопировано', 'info');
			};
			return E('tr', {}, [
				E('td', { 'class': 'tx-mono' }, hs.hostname ? hs.hostname : (hs.exists ? 'ключи ещё не созданы' : 'каталог отсутствует')),
				E('td', { 'class': 'tx-mono' }, (hs.ports || []).map(function(p) { return p.vport + (p.target ? ' → ' + p.target : ''); }).join(', ')),
				E('td', { 'class': 'tx-mono' }, hs.dir),
				E('td', {}, [
					hs.hostname ? TX.btn('Копировать', 'action', copy) : '',
					TX.btn('Удалить', 'reset', function() {
						if (!confirm('Удалить сервис ' + hs.dir + '?'))
							return;
						return callHsDel(hs.dir, true).then(function(res) {
							TX.notify(res.message || (res.ok ? 'Удалено' : 'Ошибка'), res.ok ? 'success' : 'danger');
							return self.reloadServices();
						}).catch(TX.rpcError);
					})
				])
			]);
		})));
	},

	reloadServices: function() {
		var self = this;
		return callGet().then(function(st) {
			self.st = st;
			dom.content(self.hsBox, self.renderServices(st.hidden_services));
		}).catch(TX.rpcError);
	},

	save: function() {
		var self = this;
		return callSave(this.socks.value, this.trans.value, this.dns.value, this.control.value, this.lan.checked, true).then(function(res) {
			TX.notify(res.message || (res.ok ? 'Сохранено' : 'Ошибка'), res.ok ? 'success' : 'danger');
		}).catch(TX.rpcError);
	},

	add: function() {
		var self = this;
		var ports = [];
		this.portsArea.value.split('\n').forEach(function(line) {
			line = line.trim();
			if (!line) return;
			var parts = line.split(/\s+/);
			ports.push({ vport: parts[0], target: parts[1] || '' });
		});
		if (!this.nameInput.value.trim()) {
			TX.notify('Укажите имя сервиса', 'warning');
			return;
		}
		return callHsAdd(this.nameInput.value.trim(), ports, true).then(function(res) {
			TX.notify(res.message || (res.ok ? 'Добавлено' : 'Ошибка'), res.ok ? 'success' : 'danger');
			if (res.ok) {
				self.nameInput.value = '';
				self.portsArea.value = '';
				return self.reloadServices();
			}
		}).catch(TX.rpcError);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
