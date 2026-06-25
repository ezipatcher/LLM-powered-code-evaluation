/* =====================================================================
   CodeLens AI — script.js
   Prompt pipeline: evaluates code for correctness, style, efficiency
   Features: exponential backoff on 429 · sequential request queue
   ===================================================================== */
// ─── State ─────────────────────────────────────────────────────────────
let lastResult = null;
let lastCode   = '';
// ─── Rate-Limiter & Backoff Config ─────────────────────────────────────
const BACKOFF_CONFIG = {
  maxRetries:      3,        // max attempts after first failure
  baseDelayMs:     2000,     // starting backoff (ms)
  maxDelayMs:      60000,    // cap per wait (ms)
  jitterFactor:    0.25,     // ±25% random jitter to avoid thundering herd
  interRequestMs:  4500,     // minimum gap between sequential requests (ms)
};
// Tracks the timestamp of the last completed request to enforce inter-request gap
let lastRequestAt = 0;
// Sequential queue — prevents concurrent Gemini calls
let requestQueue = Promise.resolve();
/**
 * sleep(ms) — returns a Promise that resolves after `ms` milliseconds.
 * Also updates the loading-state subtitle with a live countdown.
 */
function sleep(ms, reason = '') {
  return new Promise(resolve => {
    const subtitle = document.getElementById('loading-subtitle');
    if (!ms || ms <= 0) { resolve(); return; }
    let remaining = Math.ceil(ms / 1000);
    if (subtitle) subtitle.textContent = reason ? `${reason} — retrying in ${remaining}s…` : '';
    const tick = setInterval(() => {
      remaining--;
      if (subtitle) subtitle.textContent = reason ? `${reason} — retrying in ${remaining}s…` : '';
      if (remaining <= 0) clearInterval(tick);
    }, 1000);
    setTimeout(() => {
      clearInterval(tick);
      if (subtitle) subtitle.textContent = '';
      resolve();
    }, ms);
  });
}
/**
 * computeBackoffDelay(attempt) — exponential backoff with jitter.
 * attempt: 0-indexed retry attempt number.
 */
function computeBackoffDelay(attempt) {
  const base    = BACKOFF_CONFIG.baseDelayMs * Math.pow(2, attempt);   // 2s, 4s, 8s…
  const capped  = Math.min(base, BACKOFF_CONFIG.maxDelayMs);            // never > 60s
  const jitter  = capped * BACKOFF_CONFIG.jitterFactor * (Math.random() * 2 - 1); // ±25%
  return Math.round(capped + jitter);
}
/**
 * fetchWithBackoff(url, options) — wraps fetch() with:
 *   • Retry-After header awareness on 429
 *   • Exponential backoff with jitter for transient errors
 *   • Max retries cap (BACKOFF_CONFIG.maxRetries)
 */
async function fetchWithBackoff(url, options) {
  let attempt = 0;
  while (true) {
    try {
      const response = await fetch(url, options);
      // ── 429 Too Many Requests ───────────────────────────────────────
      if (response.status === 429) {
        if (attempt >= BACKOFF_CONFIG.maxRetries) {
          const err = await response.json().catch(() => ({}));
          throw new Error(
            err?.error?.message ||
            `Rate limit exceeded after ${BACKOFF_CONFIG.maxRetries} retries. Please wait and try again.`
          );
        }
        // Honour Retry-After header if present (value is seconds)
        const retryAfterHeader = response.headers.get('Retry-After');
        let waitMs;
        if (retryAfterHeader) {
          const seconds = parseInt(retryAfterHeader, 10);
          waitMs = isNaN(seconds) ? computeBackoffDelay(attempt) : seconds * 1000;
          console.warn(`[CodeLens] 429 — Retry-After header says ${seconds}s. Waiting…`);
        } else {
          waitMs = computeBackoffDelay(attempt);
          console.warn(`[CodeLens] 429 — No Retry-After header. Backoff: ${waitMs}ms (attempt ${attempt + 1})`);
        }
        updateRetryBadge(attempt + 1, BACKOFF_CONFIG.maxRetries, waitMs);
        await sleep(waitMs, `Rate limited (429)`);
        attempt++;
        continue; // retry
      }
      // ── Other non-OK responses (not retryable) ──────────────────────
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      return response; // success
    } catch (err) {
      // Network-level errors (offline, DNS failure) — retry with backoff
      if (err.name === 'TypeError' && attempt < BACKOFF_CONFIG.maxRetries) {
        const waitMs = computeBackoffDelay(attempt);
        console.warn(`[CodeLens] Network error — retrying in ${waitMs}ms (attempt ${attempt + 1})`, err);
        updateRetryBadge(attempt + 1, BACKOFF_CONFIG.maxRetries, waitMs);
        await sleep(waitMs, 'Network error');
        attempt++;
        continue;
      }
      throw err; // non-retryable or max retries hit
    }
  }
}
/**
 * enqueueRequest(fn) — runs fn() sequentially after any pending request,
 * enforcing a minimum inter-request gap of interRequestMs.
 */
function enqueueRequest(fn) {
  requestQueue = requestQueue.then(async () => {
    const now     = Date.now();
    const elapsed = now - lastRequestAt;
    const gap     = BACKOFF_CONFIG.interRequestMs - elapsed;
    if (lastRequestAt > 0 && gap > 0) {
      console.info(`[CodeLens] Inter-request cooldown: waiting ${gap}ms before next call…`);
      await sleep(gap, 'Cooldown between requests');
    }
    try {
      return await fn();
    } finally {
      lastRequestAt = Date.now();
    }
  });
  return requestQueue;
}
// ─── Examples ──────────────────────────────────────────────────────────
const EXAMPLES = {
  bubble: {
  // Animate loading steps
  animateLoadingSteps();
  // Wrap the actual API call inside enqueueRequest to enforce sequential
  // access and inter-request cooldowns across rapid user submissions.
  try {
    const prompt = buildPrompt(code, lang, problem);
    await enqueueRequest(async () => {
      const prompt = buildPrompt(code, lang, problem);
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
          }
        })
      }
    );
      // fetchWithBackoff handles 429 retries + network error retries
      const response = await fetchWithBackoff(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1024,
            }
          })
        }
      );
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${response.status}: ${response.statusText}`);
    }
      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const data = await response.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      // Parse JSON from response
      const result = parseEvalResult(rawText);
      lastResult = result;
    // Parse JSON from response
    const result = parseEvalResult(rawText);
    lastResult = result;
      // Show results
      renderResult(result, lang);
    // Show results
    renderResult(result, lang);
      // Clear retry badge on success
      updateRetryBadge(0, 0, 0);
    });
  } catch (err) {
    console.error('Evaluation error:', err);
  showState('error');
}
// ─── Retry Badge ────────────────────────────────────────────────────────
/**
 * updateRetryBadge(attempt, max, waitMs)
 * Shows or hides the retry indicator in the loading panel.
 * Called by fetchWithBackoff so the user can see what's happening.
 */
function updateRetryBadge(attempt, max, waitMs) {
  let badge = document.getElementById('retry-badge');
  if (attempt === 0) {
    if (badge) badge.remove();
    return;
  }
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'retry-badge';
    badge.style.cssText = [
      'margin-top:12px', 'padding:8px 16px', 'border-radius:8px',
      'background:rgba(245,158,11,0.12)', 'border:1px solid rgba(245,158,11,0.3)',
      'color:#f59e0b', 'font-size:0.78rem', 'font-weight:600',
      'display:flex', 'align-items:center', 'gap:8px',
      'font-family:inherit', 'text-align:center'
    ].join(';');
    const loadingState = document.getElementById('loading-state');
    if (loadingState) loadingState.appendChild(badge);
  }
  const secs = Math.ceil(waitMs / 1000);
  badge.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    429 Rate limited — retry ${attempt}/${max} · waiting ${secs}s`;
}
// ─── Loading Step Animation ─────────────────────────────────────────────
let stepTimers = [];
function animateLoadingSteps() {
function clearLoadingSteps() {
  stepTimers.forEach(clearTimeout);
  stepTimers = [];
  updateRetryBadge(0, 0, 0); // clear retry badge on success/cancel
}
// ─── Editor Utilities ───────────────────────────────────────────────────
const codeInput    = document.getElementById('code-input');
const lineNumbers  = document.getElementById('line-numbers');
const charCount    = document.getElementById('char-count');
const lineCount    = document.getElementById('line-count');
const langSelect   = document.getElementById('lang-select');
const langBadge    = document.getElementById('lang-badge');
function updateEditorMeta() {
  const text  = codeInput.value;
  const lines = text.split('\n');
  const count = lines.length;
  charCount.textContent = `${text.length.toLocaleString()} character${text.length !== 1 ? 's' : ''}`;
  lineCount.textContent = `${count} line${count !== 1 ? 's' : ''}`;
  lineNumbers.textContent = Array.from({ length: count }, (_, i) => i + 1).join('\n');
}
codeInput.addEventListener('input', updateEditorMeta);
codeInput.addEventListener('scroll', () => {
  lineNumbers.scrollTop = codeInput.scrollTop;
});
// Tab key support
codeInput.addEventListener('keydown', e => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = codeInput.selectionStart;
    const end   = codeInput.selectionEnd;
    codeInput.value = codeInput.value.slice(0, start) + '  ' + codeInput.value.slice(end);
    codeInput.selectionStart = codeInput.selectionEnd = start + 2;
    updateEditorMeta();
  }
  // Ctrl+Enter to evaluate
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    evaluateCode();
  }
});
// Language badge
langSelect.addEventListener('change', () => {
  langBadge.textContent = langSelect.options[langSelect.selectedIndex].text;
});
function clearCode() {
  codeInput.value = '';
  updateEditorMeta();
  showState('empty');
}
async function pasteCode() {
  try {
    const text = await navigator.clipboard.readText();
    codeInput.value = text;
    updateEditorMeta();
  } catch (_) {
    codeInput.focus();
  }
}
// ─── Key Visibility Toggle ──────────────────────────────────────────────
function toggleKeyVisibility() {
  const input = document.getElementById('api-key-input');
  const icon  = document.getElementById('eye-icon');
  if (input.type === 'password') {
    input.type = 'text';
    icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`;
  } else {
    input.type = 'password';
    icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
  }
}
// ─── Copy JSON ──────────────────────────────────────────────────────────
function copyJSON() {
  if (!lastResult) return;
  const btn = document.getElementById('copy-json-btn');
  navigator.clipboard.writeText(JSON.stringify(lastResult, null, 2)).then(() => {
    btn.textContent = '✓ Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
      btn.classList.remove('copied');
    }, 2000);
  });
}
// ─── Retry ──────────────────────────────────────────────────────────────
function retryEvaluation() {
  if (lastCode) {
    codeInput.value = lastCode;
    updateEditorMeta();
    showState('empty');
  } else {
    showState('empty');
  }
}
// ─── Load Example ───────────────────────────────────────────────────────
function loadExample(key) {
  const ex = EXAMPLES[key];
  if (!ex) return;
  // Set language
  langSelect.value = ex.lang;
  langBadge.textContent = langSelect.options[langSelect.selectedIndex].text;
  // Set problem
  document.getElementById('problem-desc').value = ex.problem;
  // Set code with smooth effect
  codeInput.value = '';
  updateEditorMeta();
  let i = 0;
  const text = ex.code;
  const speed = Math.max(5, Math.floor(800 / text.length));
  function typeNext() {
    if (i < text.length) {
      codeInput.value += text[i++];
      updateEditorMeta();
      setTimeout(typeNext, speed);
    }
  }
  typeNext();
  // Reset results
  showState('empty');
  // Scroll to editor
  codeInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
// ─── Init ────────────────────────────────────────────────────────────────
updateEditorMeta();
// Persist API key in sessionStorage for convenience
const savedKey = sessionStorage.getItem('codeLensApiKey');
if (savedKey) document.getElementById('api-key-input').value = savedKey;
document.getElementById('api-key-input').addEventListener('input', e => {
  sessionStorage.setItem('codeLensApiKey', e.target.value);
});
