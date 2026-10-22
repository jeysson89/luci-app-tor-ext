'use strict';
'require baseclass';
'require ui';
'require dom';

/*
 * Shared UI helpers for luci-app-tor-ext.
 * The module returns a class (LuCI requires a constructor), the helpers are
 * used as static helpers: TX.fmtBytes(...), TX.card(...), ...
 */
var TX = baseclass.extend({

	style: function() {
		return E('style', {}, [
			'.tx-page{max-width:1100px}',
			'.tx-card{background:var(--background-color-medium,#fff);border:1px solid rgba(0,0,0,.1);border-radius:6px;padding:12px 14px;margin-bottom:14px}',
			'.tx-card h3{margin:0 0 10px 0;font-size:105%;font-weight:bold}',
			'.tx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}',
			'.tx-kpi{padding:10px 12px;border-radius:6px;background:rgba(127,127,127,.07)}',
			'.tx-kpi .k{font-size:85%;opacity:.75;margin-bottom:4px}',
			'.tx-kpi .v{font-size:130%;font-weight:bold;word-break:break-all}',
			'.tx-badge{display:inline-block;padding:2px 9px;border-radius:11px;font-size:88%;font-weight:bold;color:#fff;background:#7a7a7a}',
			'.tx-ok{background:#2e7d32}.tx-warn{background:#ef6c00}.tx-err{background:#c62828}.tx-idle{background:#607d8b}',
			'.tx-bar{height:10px;background:rgba(127,127,127,.2);border-radius:5px;overflow:hidden;margin:6px 0}',
			'.tx-bar > div{height:100%;background:#2e7d32;transition:width .4s}',
			'.tx-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:8px 0}',
			'.tx-row > label{min-width:150px}',
			'.tx-mono{font-family:monospace;font-size:90%;white-space:pre-wrap;word-break:break-all}',
			'.tx-log{max-height:420px;overflow:auto;background:#111;color:#d8d8d8;padding:10px;border-radius:5px;font-family:monospace;font-size:85%;white-space:pre-wrap}',
			'.tx-table{width:100%;border-collapse:collapse}',
			'.tx-table th,.tx-table td{text-align:left;padding:5px 8px;border-bottom:1px solid rgba(127,127,127,.25);vertical-align:top}',
			'.tx-muted{opacity:.65;font-size:90%}',
			'.tx-check{display:flex;align-items:center;gap:7px;margin:4px 0}',
			'.tx-input{max-width:120px}',
			'.tx-wide{width:100%;box-sizing:border-box}',
			'.tx-bridge-row{border:1px solid rgba(127,127,127,.25);border-radius:5px;padding:8px;margin:6px 0;display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between}',
			'.tx-bridge-row .tx-row{flex:1 1 auto}',
			'textarea.tx-code{width:100%;box-sizing:border-box;font-family:monospace;font-size:85%;min-height:340px}'
		].join('\n'));
	},

	fmtBytes: function(n) {
		n = +n || 0;
		var units = ['Б', 'КиБ', 'МиБ', 'ГиБ', 'ТиБ'];
		var i = 0;
		while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
		return (i ? n.toFixed(1) : n) + ' ' + units[i];
	},

	fmtUptime: function(sec) {
		sec = +sec || 0;
		if (!sec) return '—';
		var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
		if (d) return d + ' д ' + h + ' ч';
		if (h) return h + ' ч ' + m + ' мин';
		return m + ' мин';
	},

	fmtTime: function(sec) {
		if (!sec) return '—';
		var d = new Date(sec * 1000);
		var p = function(x) { return (x < 10 ? '0' : '') + x; };
		return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
	},

	badge: function(text, kind) {
		return E('span', { 'class': 'tx-badge ' + (kind || '') }, text);
	},

	card: function(title, children, extra) {
		var head = [E('h3', {}, title)];
		if (extra) head.push(extra);
		return E('div', { 'class': 'tx-card' }, [
			E('div', { 'class': 'tx-row', 'style': 'justify-content:space-between;margin:0 0 6px 0' }, head)
		].concat(children || []));
	},

	kpi: function(label, value, id) {
		return E('div', { 'class': 'tx-kpi' }, [
			E('div', { 'class': 'k' }, label),
			E('div', { 'class': 'v', 'id': id || null }, value)
		]);
	},

	btn: function(label, style, handler, attrs) {
		return E('button', Object.assign({
			'class': 'cbi-button cbi-button-' + (style || 'action'),
			'click': handler
		}, attrs || {}), label);
	},

	checkbox: function(label, checked, handler) {
		var input = E('input', { 'type': 'checkbox', 'checked': checked ? '' : null, 'change': handler });
		return E('label', { 'class': 'tx-check' }, [input, E('span', {}, label)]);
	},

	input: function(value, attrs) {
		return E('input', Object.assign({ 'type': 'text', 'value': value ?? '', 'class': 'cbi-input-text' }, attrs || {}));
	},

	notify: function(msg, kind) {
		ui.addNotification(null, E('p', {}, msg), kind || 'info');
	},

	rpcError: function(e) {
		TX.notify(e && e.message ? e.message : String(e), 'danger');
	},

	trafficChart: function() {
		var samples = [];
		var NS = 'http://www.w3.org/2000/svg';
		var W = 600, H = 140, PAD = 6;

		var svg = document.createElementNS(NS, 'svg');
		svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
		svg.setAttribute('style', 'width:100%;height:' + H + 'px;background:rgba(127,127,127,.06);border-radius:5px');

		var area = document.createElementNS(NS, 'polygon');
		area.setAttribute('fill', 'rgba(46,125,50,.18)');
		svg.appendChild(area);

		var grid = document.createElementNS(NS, 'line');
		grid.setAttribute('x1', 0); grid.setAttribute('x2', W);
		grid.setAttribute('y1', H - 22); grid.setAttribute('y2', H - 22);
		grid.setAttribute('stroke', 'rgba(127,127,127,.35)');
		grid.setAttribute('stroke-dasharray', '3 3');
		svg.appendChild(grid);

		var peakLine = document.createElementNS(NS, 'line');
		peakLine.setAttribute('stroke', '#ef6c00');
		peakLine.setAttribute('stroke-width', '1');
		peakLine.setAttribute('stroke-dasharray', '4 3');
		peakLine.setAttribute('y1', PAD); peakLine.setAttribute('y2', H - 22);
		peakLine.setAttribute('opacity', '0');
		svg.appendChild(peakLine);

		var peakDot = document.createElementNS(NS, 'circle');
		peakDot.setAttribute('r', '4');
		peakDot.setAttribute('fill', '#ef6c00');
		peakDot.setAttribute('opacity', '0');
		svg.appendChild(peakDot);

		var peakText = document.createElementNS(NS, 'text');
		peakText.setAttribute('fill', '#ef6c00');
		peakText.setAttribute('font-size', '11');
		peakText.setAttribute('opacity', '0');
		svg.appendChild(peakText);

		var line = document.createElementNS(NS, 'polyline');
		line.setAttribute('fill', 'none');
		line.setAttribute('stroke', '#2e7d32');
		line.setAttribute('stroke-width', '2');
		svg.appendChild(line);

		var node = E('div', { 'class': 'tx-card' }, [
			E('div', { 'class': 'tx-row', 'style': 'justify-content:space-between;margin:0 0 4px 0' }, [
				E('h3', { 'style': 'margin:0' }, 'Трафик через Tor'),
				E('span', { 'class': 'tx-muted' }, 'Скорость (КиБ/с), обновление каждые 5 секунд')
			]),
			svg
		]);

		function peak() {
			var best = null;
			for (var i = 0; i < samples.length; i++) {
				if (!best || samples[i].v > best.v)
					best = samples[i];
			}
			return best;
		}

		function redraw() {
			var max = 1, i, x, y;
			for (i = 0; i < samples.length; i++)
				if (samples[i].v > max) max = samples[i].v;

			var pts = [], poly = [];
			for (i = 0; i < samples.length; i++) {
				x = samples.length > 1 ? i * W / (samples.length - 1) : 0;
				y = (H - 22) - (samples[i].v / max) * (H - 22 - PAD);
				pts.push(x.toFixed(1) + ',' + y.toFixed(1));
				poly.push(x.toFixed(1) + ',' + y.toFixed(1));
			}
			line.setAttribute('points', pts.join(' '));
			if (poly.length) {
				poly.push((W).toFixed(1) + ',' + (H - 22));
				poly.push('0,' + (H - 22));
				area.setAttribute('points', poly.join(' '));
			}
			else
				area.setAttribute('points', '');

			var best = peak();
			if (best && samples.length > 1) {
				var bi = samples.indexOf(best);
				var bx = bi * W / (samples.length - 1);
				var by = (H - 22) - (best.v / max) * (H - 22 - PAD);
				peakLine.setAttribute('x1', bx); peakLine.setAttribute('x2', bx);
				peakLine.setAttribute('opacity', '1');
				peakDot.setAttribute('cx', bx); peakDot.setAttribute('cy', by);
				peakDot.setAttribute('opacity', '1');
				peakText.setAttribute('x', Math.min(W - 90, bx + 6));
				peakText.setAttribute('y', Math.max(12, by - 6));
				peakText.textContent = 'пик ' + TX.fmtKib(best.v);
				peakText.setAttribute('opacity', '1');
			}
			else {
				peakLine.setAttribute('opacity', '0');
				peakDot.setAttribute('opacity', '0');
				peakText.setAttribute('opacity', '0');
			}
		}

		node.push = function(read, written) {
			var now = Date.now();
			if (node._last) {
				var dt = (now - node._last.t) / 1000;
				if (dt > 0) {
					samples.push({
						t: now,
						rx: Math.max(0, (read - node._last.r) / dt),
						tx: Math.max(0, (written - node._last.w) / dt),
						v: Math.max(0, (read - node._last.r) / dt) + Math.max(0, (written - node._last.w) / dt)
					});
					if (samples.length > 60) samples.shift();
				}
			}
			node._last = { t: now, r: read, w: written };
			redraw();
		};

		/* aggregated statistics for the summary table */
		node.stats = function() {
			var cur = 0, max = 0, sum = 0, best = null;
			for (var i = 0; i < samples.length; i++) {
				if (samples[i].v > max) { max = samples[i].v; best = samples[i]; }
				sum += samples[i].v;
			}
			if (samples.length) cur = samples[samples.length - 1].v;
			return {
				current: cur,
				max: max,
				avg: samples.length ? sum / samples.length : 0,
				peak: best,
				count: samples.length,
				rx: node._last ? node._last.r : 0,
				tx: node._last ? node._last.w : 0
			};
		};

		return node;
	},

	fmtKib: function(v) {
		v = +v || 0;
		if (v >= 1024 * 1024) return (v / 1024 / 1024).toFixed(2) + ' МиБ/с';
		return (v / 1024).toFixed(1) + ' КиБ/с';
	},

});

return TX;
