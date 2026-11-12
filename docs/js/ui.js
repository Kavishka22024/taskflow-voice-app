/* ui.js - tiny DOM helpers. Never uses innerHTML, so user text can never become markup. */
(function (w) {
  'use strict';

  const PROPS = { value: 1, checked: 1, disabled: 1, selected: 1, hidden: 1, readOnly: 1 };

  function h(tag, attrs) {
    const el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) return;
        if (k === 'class') el.className = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (PROPS[k]) el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      });
    }
    for (let i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, kid) {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) kid.forEach(function (k) { append(el, k); });
    else if (kid instanceof Node) el.appendChild(kid);
    else el.appendChild(document.createTextNode(String(kid)));
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  /* ---------- formatting ---------- */
  function date(ms) { return ms ? new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''; }
  function time(ms) { return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  function dateTime(ms) { return ms ? date(ms) + ', ' + time(ms) : ''; }
  function dayLabel(ms) {
    const d = new Date(ms), t = new Date();
    const sameDay = function (a, b) { return a.toDateString() === b.toDateString(); };
    const y = new Date(t); y.setDate(t.getDate() - 1);
    return sameDay(d, t) ? 'Today' : sameDay(d, y) ? 'Yesterday' : date(ms);
  }
  function ago(ms) {
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago';
    return date(ms);
  }
  function duration(secs) { secs = Math.round(secs || 0); return Math.floor(secs / 60) + ':' + ('0' + (secs % 60)).slice(-2); }
  function dueInfo(dueDate, status) {
    if (!dueDate) return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const parts = dueDate.split('-'), d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    const days = Math.round((d - today) / 86400000);
    const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    if (status === 'pending') return { text: 'Due ' + label, cls: '' };
    if (days < 0) return { text: 'Overdue ' + label, cls: 'bad' };
    if (days === 0) return { text: 'Due today', cls: 'warn' };
    if (days === 1) return { text: 'Due tomorrow', cls: 'warn' };
    return { text: 'Due ' + label, cls: '' };
  }

  /* ---------- toast ---------- */
  let toastTimer = null;
  function toast(message, kind) {
    let box = document.getElementById('toast');
    if (!box) { box = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(box); }
    box.className = 'show ' + (kind || '');
    box.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.className = ''; }, kind === 'bad' ? 6000 : 3000);
  }

  /* ---------- modal ---------- */
  // actions: [{label, kind:'primary'|'danger'|'', onClick: fn(close) -> may return a Promise; keep open if it returns false}]
  function modal(opts) {
    const overlay = h('div', { class: 'overlay' });
    let closed = false;
    const close = function () {
      if (closed) return; closed = true;
      document.removeEventListener('keydown', onKey);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (opts.onClose) opts.onClose();
    };
    const onKey = function (e) { if (e.key === 'Escape') close(); };
    const buttons = (opts.actions || []).map(function (a) {
      const btn = h('button', { type: 'button', class: 'btn ' + (a.kind || '') }, a.label);
      btn.addEventListener('click', async function () {
        if (!a.onClick) return close();
        btn.disabled = true;
        try { const r = await a.onClick(close); if (r !== false) close(); } finally { btn.disabled = false; }
      });
      return btn;
    });
    const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title },
      h('h2', null, opts.title), h('div', { class: 'modal-body' }, opts.body), h('div', { class: 'modal-actions' }, buttons));
    overlay.appendChild(box);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay && !opts.sticky) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    const first = box.querySelector('input,textarea,select');
    if (first) setTimeout(function () { first.focus(); }, 30);
    return { close: close, box: box };
  }
  function confirmBox(title, message, okLabel, kind) {
    return new Promise(function (resolve) {
      let answered = false;
      const answer = function (v) { if (!answered) { answered = true; resolve(v); } };
      modal({
        title: title, body: h('p', null, message), onClose: function () { answer(false); },
        actions: [
          { label: 'Cancel', onClick: function () { answer(false); } },
          { label: okLabel || 'OK', kind: kind || 'primary', onClick: function () { answer(true); } }
        ]
      });
    });
  }

  /* ---------- small widgets ---------- */
  function progressBar(pct, status) {
    return h('div', { class: 'bar ' + (status || ''), role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct },
      h('div', { class: 'bar-fill', style: 'width:' + Math.max(0, Math.min(100, pct)) + '%' }));
  }
  function chip(text, cls) { return h('span', { class: 'chip ' + (cls || '') }, text); }
  function initials(name) { return String(name || '?').split(/\s+/).slice(0, 2).map(function (p) { return p.charAt(0); }).join('').toUpperCase(); }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return false; });
    return Promise.resolve(false);
  }

  w.h = h;
  w.UI = { h: h, clear: clear, date: date, time: time, dateTime: dateTime, dayLabel: dayLabel, ago: ago, duration: duration, dueInfo: dueInfo, toast: toast, modal: modal, confirm: confirmBox, progressBar: progressBar, chip: chip, initials: initials, copyText: copyText };
})(window);
