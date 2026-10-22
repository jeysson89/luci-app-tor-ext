'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require tor-ext/common as TX';

var callLogs = rpc.declare({ object: 'tor-ext', method: 'logs', params: ['source', 'lines'] });

return view.extend({
	load: function() {
		return callLogs('file', 200);
	},

	render: function(res) {
		var self = this;
		this.source = E('select', { 'class': 'cbi-input-select' }, [
			E('option', { 'value': 'file' }, 'Tor (/var/log/tor.log)'),
			E('option', { 'value': 'syslog' }, 'Системный лог (tor)'),
			E('option', { 'value': 'ext' }, 'Системный лог (tor-ext)')
		]);
		this.lines = TX.input('200', { 'class': 'cbi-input-text tx-input' });
		this.auto = E('input', { 'type': 'checkbox', 'checked': '' });
		this.out = E('pre', { 'class': 'tx-log', 'id': 'tx-logout' }, res.content || '(пусто)');
		this.timer = null;

		var stop = function() {
			if (self.timer) { clearInterval(self.timer); self.timer = null; }
		};
		var start = function() {
			stop();
			self.timer = setInterval(function() { self.refresh(); }, 5000);
		};
		this.auto.addEventListener('change', function() {
			self.auto.checked ? start() : stop();
		});

		var page = E('div', { 'class': 'tx-page' }, [
			TX.style(),
			E('h2', {}, 'Логи Tor'),
			E('div', { 'class': 'tx-muted' }, 'Журнал Tor в реальном времени. Автообновление раз в 5 секунд.'),
			TX.card('Журнал', [
				E('div', { 'class': 'tx-row' }, [
					this.source,
					E('span', { 'class': 'tx-muted' }, 'строк:'),
					this.lines,
					E('label', { 'class': 'tx-check' }, [this.auto, E('span', {}, 'Автообновление')]),
					TX.btn('Обновить', 'action', function() { return self.refresh(); }),
					TX.btn('Скачать', 'action', function() { return self.download(); })
				]),
				this.out
			])
		]);

		return page;
	},

	refresh: function() {
		var self = this;
		return callLogs(this.source.value, +this.lines.value || 200).then(function(res) {
			dom.content(document.getElementById('tx-logout'), res.content || '(пусто)');
			var el = document.getElementById('tx-logout');
			if (el) el.scrollTop = el.scrollHeight;
		}).catch(TX.rpcError);
	},

	download: function() {
		var text = document.getElementById('tx-logout').textContent || '';
		var blob = new Blob([text], { type: 'text/plain' });
		var a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = 'tor-' + this.source.value + '.log';
		a.click();
		setTimeout(function() { URL.revokeObjectURL(a.href); }, 2000);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
