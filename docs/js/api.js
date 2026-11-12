/* api.js - talks to the Apps Script backend (or the in-browser demo backend). */
(function (w) {
  'use strict';

  const TOKEN_KEY = 'taskapp.token';
  const cfg = w.APP_CONFIG || {};
  const demo = !!cfg.demo || /[?&]demo=1\b/.test(location.search);

  function load(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function save(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* storage blocked */ } }

  const Api = {
    demo: demo,
    token: load(demo ? 'taskapp.demo.token' : TOKEN_KEY),
    configured: demo || !!cfg.backendUrl,
    onAuthLost: function () {},

    setToken: function (t) { Api.token = t || ''; save(demo ? 'taskapp.demo.token' : TOKEN_KEY, Api.token); },

    /**
     * Resolves with the data, or rejects with Error (e.code = backend code, e.network = true if unreachable).
     * opts.timeout (ms) - voice uploads and AI calls can take a while.
     */
    call: async function (action, params, opts) {
      opts = opts || {};
      const req = Object.assign({ action: action, token: Api.token || undefined }, params || {});
      let res;
      if (demo) {
        await new Promise(function (r) { setTimeout(r, 120); });
        res = w.DemoBackend.handle(JSON.parse(JSON.stringify(req)));
      } else {
        const ctl = new AbortController();
        const timer = setTimeout(function () { ctl.abort(); }, opts.timeout || 60000);
        try {
          const r = await fetch(cfg.backendUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(req), signal: ctl.signal });
          res = await r.json();
        } catch (e) {
          const err = new Error(e.name === 'AbortError' ? 'The server took too long to answer. Please try again.' : 'Could not reach the server. Check your internet connection and try again.');
          err.network = true; throw err;
        } finally { clearTimeout(timer); }
      }
      if (!res || !res.ok) {
        const err = new Error((res && res.error) || 'Unknown error');
        err.code = res && res.code;
        if (err.code === 'AUTH' && action !== 'login' && Api.token) { Api.setToken(''); Api.onAuthLost(err.message); }
        throw err;
      }
      return res.data;
    }
  };
  w.Api = Api;
})(window);
