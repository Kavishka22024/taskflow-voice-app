/**
 * PROTOTYPE BACKEND - Sinhala voice + AI summary test
 * Paste this whole file into a Google Apps Script project (script.google.com).
 *
 * Script Properties to set (Project Settings > Script properties):
 *   GEMINI_API_KEY   your key from https://aistudio.google.com/apikey
 *   PROTO_PASSCODE   any passphrase you invent (stops strangers using your key)
 *   GEMINI_MODEL     (optional) force one model name, e.g. gemini-3.5-flash.
 *                    Leave unset to use DEFAULT_MODEL with the fallbacks below.
 *
 * If AI calls start failing, run listModels() from the editor to see which
 * models your key can use, then update DEFAULT_MODEL / FALLBACK_MODELS.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
// Preferred model. (Google's "gemini-flash-latest" alias is kept as a last fallback.)
const DEFAULT_MODEL = 'gemini-3.5-flash';
// Tried in order if the main model is busy (429/500/503) or unavailable (404).
const FALLBACK_MODELS = ['gemini-3.1-flash-lite', 'gemini-flash-latest'];
const MAX_AI_SECONDS = 90; // stop trying more models after this long

function doGet() {
  return json_({ ok: true, message: 'Task app prototype backend is running' });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const expected = PropertiesService.getScriptProperties().getProperty('PROTO_PASSCODE');
    if (!expected || body.passcode !== expected) {
      return json_({ ok: false, error: 'Wrong passcode' });
    }
    if (body.action === 'transcribe') {
      return json_({ ok: true, data: transcribe_(body.audioBase64, body.mimeType || 'audio/wav') });
    }
    if (body.action === 'summarize') {
      return json_({ ok: true, data: summarize_(body.messages || []) });
    }
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/* ---------- AI jobs ---------- */

function transcribe_(audioBase64, mimeType) {
  if (!audioBase64) throw new Error('No audio received');
  const system =
    'You are a transcription assistant inside a company task-management app in Sri Lanka. ' +
    'The audio is a short voice message about a work task. It may be Sinhala, English, Tamil, or a mix. ' +
    'Transcribe exactly what is said, in the language spoken. Write Sinhala in Sinhala script and keep English words in English. ' +
    'Do not add, guess or invent anything. Mark unclear parts as [unclear]. ' +
    'Return JSON: {"transcript": string, "language": string, "english_translation": string}.';
  const parts = [
    { inlineData: { mimeType: mimeType, data: audioBase64 } },
    { text: 'Transcribe this voice message.' }
  ];
  return callGemini_(system, parts);
}

function summarize_(messages) {
  if (!messages.length) throw new Error('No messages to summarize');
  const system =
    'You summarize ONE work task conversation between a manager and the people assigned to it. ' +
    'Use ONLY the conversation provided. Never use outside knowledge and never answer anything unrelated to this task. ' +
    'If something is not mentioned, say "Not mentioned". Do not invent progress, dates or names. ' +
    'Return JSON: {"summary_en": string (2-4 sentences), "summary_si": string (same summary in Sinhala), ' +
    '"progress_note": string (what has been done so far), "blockers": string[], "next_steps": string[]}.';
  const lines = messages.map(function (m) {
    return '[' + (m.time || '') + '] ' + m.sender + ' (' + m.type + '): ' + m.text;
  }).join('\n');
  return callGemini_(system, [{ text: 'Task conversation:\n' + lines }]);
}

function callGemini_(systemText, parts) {
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY is not set in Script properties');
  const payload = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: parts }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
  };
  const models = [props.getProperty('GEMINI_MODEL') || DEFAULT_MODEL].concat(FALLBACK_MODELS);
  const started = Date.now();
  let lastError = 'No model was tried';

  for (let i = 0; i < models.length; i++) {
    for (let attempt = 1; attempt <= 1; attempt++) {
      if (Date.now() - started > MAX_AI_SECONDS * 1000) throw new Error(lastError);
      const res = UrlFetchApp.fetch(GEMINI_BASE + models[i] + ':generateContent', {
        method: 'post',
        contentType: 'application/json',
        headers: { 'x-goog-api-key': key },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      const code = res.getResponseCode();
      const text = res.getContentText();
      if (code === 200) return parseGeminiJson_(text);
      lastError = 'Gemini error ' + code + ' (' + models[i] + '): ' + text.slice(0, 300);
      if (code === 400 || code === 401 || code === 403) throw new Error(lastError); // our request/key is wrong
      if (code === 404) break;                    // model retired/unknown: go to the next model
      if (attempt < 2) Utilities.sleep(2000);     // (only reached if attempts per model is raised above 1)
    }
  }
  throw new Error(lastError);
}

function parseGeminiJson_(text) {
  const out = JSON.parse(text);
  const cand = out.candidates && out.candidates[0];
  const joined = cand && cand.content && cand.content.parts
    ? cand.content.parts.map(function (p) { return p.text || ''; }).join('')
    : '';
  if (!joined) throw new Error('Empty response from Gemini');
  return JSON.parse(joined);
}

/* ---------- Maintenance helpers (run from the Apps Script editor) ---------- */

// Check that the key and models work. Result appears in the Execution log.
function selfTest() {
  const out = summarize_([
    { sender: 'Manager', type: 'text', text: 'Please finish the report today.', time: '09:00' },
    { sender: 'Worker', type: 'text', text: 'Half done, will finish by 4pm.', time: '11:00' }
  ]);
  Logger.log(JSON.stringify(out));
}

// List the models this API key can use (look for names containing "flash").
function listModels() {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const res = UrlFetchApp.fetch(GEMINI_BASE.replace(/models\/$/, 'models') + '?pageSize=200', {
    headers: { 'x-goog-api-key': key },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('ListModels error ' + res.getResponseCode());
  const names = JSON.parse(res.getContentText()).models
    .filter(function (x) { return (x.supportedGenerationMethods || []).indexOf('generateContent') >= 0; })
    .map(function (x) { return x.name.replace('models/', ''); });
  Logger.log(names.join('\n'));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
