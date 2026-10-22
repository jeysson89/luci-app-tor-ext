'use strict';
'require view';
'require rpc';
'require ui';
'require tor-ext/common as TX';

var callGet = rpc.declare({ object: 'tor-ext', method: 'settingsGet' });
var callSave = rpc.declare({
	object: 'tor-ext', method: 'settingsSave',
	params: ['watchdog_enabled', 'auto_restart', 'notify_enabled', 'telegram_token', 'telegram_chat', 'webhook']
});
var callTest = rpc.declare({ object: 'tor-ext', method: 'settingsTest' });

return view.extend({
	load: function() {
		return callGet();
	},

	render: function(st) {
		var self = this;
		this.wd = E('input', { 'type': 'checkbox', 'checked': st.watchdog_enabled ? '' : null });
		this.ar = E('input', { 'type': 'checkbox', 'checked': st.auto_restart ? '' : null });
		this.ne = E('input', { 'type': 'checkbox', 'checked': st.notify_enabled ? '' : null });
		this.token = TX.input(st.telegram_token || '', { 'class': 'cbi-input-text tx-wide', 'placeholder': '123456789:AA...' });
		this.chat = TX.input(st.telegram_chat || '', { 'class': 'cbi-input-text', 'placeholder': '-1001234567890' });
		this.webhook = TX.input(st.webhook || '', { 'class': 'cbi-input-text tx-wide', 'placeholder': 'https://example.com/hook' });

		return E('div', { 'class': 'tx-page' }, [
			TX.style(),
			E('h2', {}, 'Мониторинг и уведомления'),

			TX.card('Сторожевой таймер (watchdog)', [
				E('label', { 'class': 'tx-check' }, [this.wd, E('span', {}, 'Проверять Tor каждые 5 минут (cron)')]),
				E('label', { 'class': 'tx-check' }, [this.ar, E('span', {}, 'Перезапускать Tor после двух неудачных проверок подряд')]),
				E('div', { 'class': 'tx-muted' }, 'Проверяется процесс Tor и процент bootstrap. События пишутся в syslog с тегом tor-ext.')
			]),

			TX.card('Уведомления', [
				E('label', { 'class': 'tx-check' }, [this.ne, E('span', {}, 'Отправлять уведомления при сбоях и восстановлении')]),
				E('div', { 'class': 'tx-row' }, [E('label', {}, 'Telegram token'), this.token]),
				E('div', { 'class': 'tx-row' }, [E('label', {}, 'Telegram chat_id'), this.chat]),
				E('div', { 'class': 'tx-row' }, [E('label', {}, 'Webhook (POST text=...)'), this.webhook]),
				E('div', { 'class': 'tx-muted' }, 'Telegram работает напрямую (может быть недоступен у некоторых провайдеров). Webhook — любой HTTP-эндпоинт.'),
				E('div', { 'class': 'tx-row' }, [
					TX.btn('Сохранить', 'action important', function() { return self.save(); }),
					TX.btn('Отправить тест', 'action', function() { return self.test(); })
				])
			])
		]);
	},

	save: function() {
		return callSave(this.wd.checked, this.ar.checked, this.ne.checked, this.token.value, this.chat.value, this.webhook.value).then(function(res) {
			TX.notify(res.message || (res.ok ? 'Сохранено' : 'Ошибка'), res.ok ? 'success' : 'danger');
		}).catch(TX.rpcError);
	},

	test: function() {
		return callTest().then(function(res) {
			TX.notify(res.message || 'Отправлено', 'info');
		}).catch(TX.rpcError);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
