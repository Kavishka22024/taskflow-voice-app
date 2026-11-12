/**
 * Code.gs - web entry points of the Task App backend (Google Apps Script).
 *
 * The frontend (GitHub Pages) calls this web app with:
 *   POST  Content-Type: text/plain   body: JSON {action, token, ...params}
 * (text/plain avoids the browser CORS pre-flight request that Apps Script cannot answer.)
 *
 * All real logic is in Core.gs. Google-specific parts (Sheets, Drive, Gemini) are in Adapters.gs.
 * One-time setup and maintenance helpers are in Setup.gs.
 */

function doGet() {
  return json_({ ok: true, message: 'Task App backend is running' });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, code: 'VALIDATION', error: 'Bad request' });
  }
  return json_(getCore_().handle(req));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// One Core per execution. `overrides` lets Setup.gs build an isolated test environment.
let CORE_CACHE_ = null;
function getCore_(overrides) {
  if (overrides) return createCore(makeEnv_(overrides));
  if (!CORE_CACHE_) CORE_CACHE_ = createCore(makeEnv_({}));
  return CORE_CACHE_;
}
