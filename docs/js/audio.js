/* audio.js - voice recording, conversion for the AI, and playback. */
(function (w) {
  'use strict';

  const MAX_SECONDS = 120;

  function pickMime() {
    if (!w.MediaRecorder) return '';
    const list = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
    for (let i = 0; i < list.length; i++) if (MediaRecorder.isTypeSupported(list[i])) return list[i];
    return '';
  }

  function supported() { return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && w.MediaRecorder); }

  /** Starts recording. Returns {stop(), cancel(), done: Promise<{blob, secs}|null>}. Rejects with a friendly Error. */
  async function start(onTick) {
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) {
      const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
      throw new Error(denied ? 'Microphone access is blocked. Allow the microphone for this site in your browser settings, then try again.' : 'No microphone was found on this device.');
    }
    const mime = pickMime();
    const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    const chunks = [], startedAt = Date.now();
    let cancelled = false, resolveDone;
    const done = new Promise(function (res) { resolveDone = res; });
    const tick = setInterval(function () {
      const s = (Date.now() - startedAt) / 1000;
      if (onTick) onTick(s);
      if (s >= MAX_SECONDS && rec.state !== 'inactive') rec.stop();
    }, 250);
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = function () {
      clearInterval(tick);
      stream.getTracks().forEach(function (t) { t.stop(); });
      resolveDone(cancelled ? null : { blob: new Blob(chunks, { type: rec.mimeType || mime || 'audio/webm' }), secs: (Date.now() - startedAt) / 1000 });
    };
    rec.start();
    return {
      done: done,
      stop: function () { if (rec.state !== 'inactive') rec.stop(); return done; },
      cancel: function () { cancelled = true; if (rec.state !== 'inactive') rec.stop(); return done; }
    };
  }

  function toBase64(blob) {
    return new Promise(function (res, rej) {
      const r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { rej(r.error); };
      r.readAsDataURL(blob);
    });
  }

  // 16 kHz mono WAV: a format Gemini accepts on every phone and browser.
  async function toWav(blob) {
    const buf = await blob.arrayBuffer();
    const Ctx = w.AudioContext || w.webkitAudioContext;
    const ctx = new Ctx();
    try {
      const decoded = await new Promise(function (res, rej) { ctx.decodeAudioData(buf, res, rej); });
      const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * 16000)), 16000);
      const src = off.createBufferSource();
      src.buffer = decoded; src.connect(off.destination); src.start();
      return encodeWav((await off.startRendering()).getChannelData(0), 16000);
    } finally { ctx.close(); }
  }
  function encodeWav(samples, rate) {
    const ab = new ArrayBuffer(44 + samples.length * 2), v = new DataView(ab);
    const str = function (o, s) { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    str(36, 'data'); v.setUint32(40, samples.length * 2, true);
    for (let i = 0, o = 44; i < samples.length; i++, o += 2) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Blob([ab], { type: 'audio/wav' });
  }

  /** Everything the backend needs for one voice message. */
  async function prepare(blob, secs) {
    let wavB64 = '';
    try { wavB64 = await toBase64(await toWav(blob)); } catch (e) { /* backend falls back to the original audio */ }
    return { audioB64: await toBase64(blob), wavB64: wavB64, mime: blob.type || 'audio/webm', secs: Math.round(secs) };
  }

  /* ---------- playback ---------- */
  const urlCache = {};
  async function urlFor(key, fetcher) {
    if (urlCache[key]) return urlCache[key];
    const a = await fetcher();
    const bin = atob(a.b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return (urlCache[key] = URL.createObjectURL(new Blob([bytes], { type: a.mime || 'audio/webm' })));
  }

  w.Audio2 = { MAX_SECONDS: MAX_SECONDS, supported: supported, start: start, prepare: prepare, urlFor: urlFor };
})(window);
