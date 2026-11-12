/**
 * PROTOTYPE BACKEND - Sinhala voice + AI summary test
 * Paste this whole file into a Google Apps Script project (script.google.com).
 *
 * Script Properties to set (Project Settings > Script properties):
 *   GEMINI_API_KEY   your key from https://aistudio.google.com/apikey
 *   PROTO_PASSCODE   any passphrase you invent (stops strangers using your key)
 *   GEMINI_MODEL     (optional) e.g. gemini-2.5-flash. Use the current Flash model
 *                    shown in Google AI Studio if this one is retired.
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';
const DEFAULT_MODEL = 'gemini-2.5-flash';

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
  const model = props.getProperty('GEMINI_MODEL') || DEFAULT_MODEL;
  const payload = {
    systemInstruction: { parts: [{ text: systemText }] },
    contents: [{ role: 'user', parts: parts }],
    generationConfig: { temperature: 0.2, responseMimeType: 'application/json' }
  };
  const res = UrlFetchApp.fetch(GEMINI_BASE + model + ':generateContent', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': key },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code !== 200) throw new Error('Gemini error ' + code + ': ' + text.slice(0, 400));
  const out = JSON.parse(text);
  const cand = out.candidates && out.candidates[0];
  const joined = cand && cand.content && cand.content.parts
    ? cand.content.parts.map(function (p) { return p.text || ''; }).join('')
    : '';
  if (!joined) throw new Error('Empty response from Gemini');
  return JSON.parse(joined);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
