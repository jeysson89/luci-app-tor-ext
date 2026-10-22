'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require tor-ext/common as TX';

var callGet = rpc.declare({ object: 'tor-ext', method: 'torrcGet' });
var callVerify = rpc.declare({ object: 'tor-ext', method: 'torrcVerify', params: ['content'] });
var callSave = rpc.declare({ object: 'tor-ext', method: 'torrcSave', params: ['content', 'restart'] });
var callBackups = rpc.declare({ object: 'tor-ext', method: 'backups' });
var callRestore = rpc.declare({ object: 'tor-ext', method: 'backupRestore', params: ['name'] });
var callDelete = rpc.declare({ object: 'tor-ext', method: 'backupDelete', params: ['name', 'all'] });
var callKeep = rpc.declare({ object: 'tor-ext', method: 'backupKeepSet', params: ['keep'] });

return view.extend({
	load: function() {
		return Promise.all([callGet(), callBackups()]);
	},

	render: function(data) {
		var self = this;
		var st = data[0];
		var backups = (data[1] && data[1].backups) || [];
		this.st = st;

		this.area = E('textarea', { 'class': 'tx-code', 'rows': 28, 'spellcheck': 'false' }, st.content || '');

		this.backupTable = E('tbody', {});
		this.keepInput = TX.input('20', { 'class': 'cbi-input-text tx-input' });

		this.fillBackups(backups);

		this.verifyBox = E('div', { 'class': 'tx-muted' }, 'Проверка выполняется через tor --verify-config, файл на диске не меняется.');

		var page = E('div', { 'class': 'tx-page' }, [
			TX.style(),
			E('h2', {}, 'Конфигурация Tor'),
			E('div', { 'class': 'tx-muted' }, [
				'Файл: ', E('b', {}, st.path || '/etc/tor/torrc'),
				' · размер: ' + (st.size || 0) + ' Б',
				' · изменён: ' + TX.fmtTime(st.mtime)
			]),

			TX.card('torrc', [
				E('div', { 'class': 'tx-muted' }, 'Все директивы Tor. Перед сохранением создаётся резервная копия, конфигурация проверяется, затем Tor перезапускается (если выбрано).'),
				this.area,
				E('div', { 'class': 'tx-row' }, [
					TX.btn('Проверить', 'action', function() { return self.verify(); }),
					TX.btn('Сохранить и перезапустить', 'action important', function() { return self.save(true); }),
					TX.btn('Сохранить без перезапуска', 'action', function() { return self.save(false); }),
					TX.btn('Обновить с диска', 'reset', function() { return self.reload(); })
				]),
				E('div', { 'id': 'tx-verify' }, this.verifyBox)
			]),

			TX.card('Резервные копии', [
				E('div', { 'class': 'tx-row' }, [
					E('span', { 'class': 'tx-muted' }, 'Хранить последних копий:'),
					this.keepInput,
					TX.btn('Сохранить', 'action', function() { return self.saveKeep(); }),
					TX.btn('Удалить все копии', 'reset', function() { return self.deleteAll(); })
				]),
				E('table', { 'class': 'tx-table' }, [
					E('thead', {}, [E('tr', {}, [E('th', {}, 'Файл'), E('th', {}, 'Дата'), E('th', {}, 'Размер'), E('th', {}, '')])]),
					this.backupTable
				]),
				E('div', { 'class': 'tx-muted' }, 'Копии лежат в /etc/tor/backups. При сохранении torc создаётся новая копия, а старые выходят за лимит — удаляются.')
			])
		]);

		return page;
	},

	fillBackups: function(backups) {
		var self = this;
		dom.content(this.backupTable, []);

		if (!backups || !backups.length) {
			this.backupTable.appendChild(E('tr', {}, [E('td', { 'colspan': '4', 'class': 'tx-muted' }, 'Резервных копий пока нет.')]));
			return;
		}

		backups.forEach(function(b) {
			self.backupTable.appendChild(E('tr', {}, [
				E('td', { 'class': 'tx-mono' }, b.name),
				E('td', {}, TX.fmtTime(b.mtime)),
				E('td', {}, TX.fmtBytes(b.size)),
				E('td', {}, [
					TX.btn('Восстановить', 'action', function() { return self.restore(b.name); }),
					TX.btn('Удалить', 'reset', function() { return self.remove(b.name); })
				])
			]));
		});
	},

	reloadBackups: function() {
		var self = this;
		return callBackups().then(function(res) {
			self.fillBackups(res.backups || []);
		}).catch(TX.rpcError);
	},

	remove: function(name) {
		var self = this;
		if (!confirm('Удалить резервную копию ' + name + '?'))
			return;
		return callDelete(name, false).then(function(res) {
			TX.notify(res.message || (res.ok ? 'Удалено' : 'Ошибка'), res.ok ? 'success' : 'danger');
			return self.reloadBackups();
		}).catch(TX.rpcError);
	},

	deleteAll: function() {
		var self = this;
		if (!confirm('Удалить все резервные копии torrc?'))
			return;
		return callDelete('', true).then(function(res) {
			TX.notify(res.message || (res.ok ? 'Удалено' : 'Ошибка'), res.ok ? 'success' : 'danger');
			return self.reloadBackups();
		}).catch(TX.rpcError);
	},

	saveKeep: function() {
		var self = this;
		return callKeep(+this.keepInput.value || 20).then(function(res) {
			TX.notify(res.message || (res.ok ? 'Сохранено' : 'Ошибка'), res.ok ? 'success' : 'danger');
			return self.reloadBackups();
		}).catch(TX.rpcError);
	},

	verify: function() {
		var self = this;
		return callVerify(this.area.value).then(function(res) {
			var node = document.getElementById('tx-verify');
			var text = (res.message || '').trim();
			dom.content(node, E('pre', { 'class': 'tx-mono', 'style': 'color:' + (res.ok ? '#2e7d32' : '#c62828') }, text || (res.ok ? 'Конфигурация корректна' : 'Ошибка')));
			TX.notify(res.ok ? 'Конфигурация корректна' : 'Ошибка в конфигурации', res.ok ? 'success' : 'danger');
		}).catch(TX.rpcError);
	},

	save: function(restart) {
		var self = this;
		return callSave(this.area.value, restart).then(function(res) {
			TX.notify(res.message || (res.ok ? 'Сохранено' : 'Ошибка'), res.ok ? 'success' : 'danger');
			if (res.ok)
				return self.reload();
		}).catch(TX.rpcError);
	},

	reload: function() {
		var self = this;
		return callGet().then(function(st) {
			self.st = st;
			self.area.value = st.content || '';
			TX.notify('Загружено с диска', 'info');
		}).catch(TX.rpcError);
	},

	restore: function(name) {
		var self = this;
		if (!name) {
			TX.notify('Нет резервных копий', 'warning');
			return;
		}
		if (!confirm('Восстановить ' + name + '? Текущий torrc будет перезаписан.'))
			return;
		return callRestore(name).then(function(res) {
			TX.notify(res.message || (res.ok ? 'Восстановлено' : 'Ошибка'), res.ok ? 'success' : 'danger');
			return self.reload();
		}).catch(TX.rpcError);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
