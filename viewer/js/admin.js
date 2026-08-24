/* ============================================================
   ADMIN — the working copy of sites.json.

   Two documents are in play and the difference matters: what is in the
   REPO (sites.json, what every visitor sees) and what is in this
   BROWSER (the draft, what you are in the middle of). This page edits
   the second and can only hand you the first — a static page cannot
   write the repo. So every button here is honest about which one it
   touches, and the bar always says whether the two have diverged.
   ============================================================ */
(function (global) {
  'use strict';

  var KEY = 'lv-site-viewer-draft-v1';
  var rows = [];      // the draft
  var errors = {};    // id -> message, from the last validate()

  var $ = function (id) { return document.getElementById(id); };

  /* ---- the draft ---- */

  function saveDraft() {
    try { global.localStorage.setItem(KEY, JSON.stringify(rows)); } catch (e) {}
    render();
  }
  function readDraft() {
    try {
      var raw = global.localStorage.getItem(KEY);
      if (!raw) return null;
      var list = LVSites.normaliseList(JSON.parse(raw));
      return list.length ? list : null;
    } catch (e) { return null; }
  }

  /* ---- ids ----
     Derived from the host's first label, because that is what the site IS —
     capecod.lazy.vacations is `capecod`. Derived once, at creation: the id is in
     the viewer's URL, so changing it later would break a link someone already has. */
  function idFromUrl(url) {
    var host;
    try { host = new URL(url).hostname; } catch (e) { return ''; }
    var first = host.split('.')[0] || '';
    return first.toLowerCase().replace(/[^a-z0-9-]/g, '');
  }
  function uniqueId(base) {
    var id = base || 'site', n = 2;
    var taken = {};
    rows.forEach(function (r) { taken[r.id] = true; });
    while (taken[id]) { id = (base || 'site') + '-' + n; n++; }
    return id;
  }

  /* ---- validation — reported, never enforced by refusing to type ----
     A half-typed URL is a normal state to be in; it is only a problem at the
     moment you export. So the row says what is wrong and the export button is
     what stops. */
  function validate() {
    errors = {};
    var seen = {};
    rows.forEach(function (r) {
      if (!r.name.trim()) errors[r.id] = 'Needs a name.';
      var u = null;
      try { u = new URL(r.url); } catch (e) {}
      if (!r.url.trim()) errors[r.id] = 'Needs a URL.';
      else if (!u) errors[r.id] = 'That is not a URL.';
      else if (u.protocol !== 'https:') errors[r.id] = 'Must be https.';
      if (r.headerColor && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(r.headerColor)) errors[r.id] = 'Header colour must be a hex like #00ad4b.';
      if (seen[r.id]) errors[r.id] = 'Two rows share this id.';
      seen[r.id] = true;
    });
    return Object.keys(errors).length === 0;
  }

  /* ---- actions ---- */

  function add() {
    rows.push({ id: uniqueId('site'), name: '', url: '', note: '', headerColor: '', hidden: false });
    saveDraft();
  }
  function remove(id) {
    rows = rows.filter(function (r) { return r.id !== id; });
    saveDraft();
  }
  function move(id, delta) {
    var i = rows.findIndex(function (r) { return r.id === id; });
    var j = i + delta;
    if (i === -1 || j < 0 || j >= rows.length) return;
    var tmp = rows[i]; rows[i] = rows[j]; rows[j] = tmp;
    saveDraft();
  }
  function toggleHidden(id) {
    rows.forEach(function (r) { if (r.id === id) r.hidden = !r.hidden; });
    saveDraft();
  }
  function edit(id, field, value) {
    rows.forEach(function (r) {
      if (r.id !== id) return;
      r[field] = value;
      /* A row that has never had a URL has a placeholder id; the moment it gets a
         real address, the id becomes the one the URL implies. After that it is
         fixed — see idFromUrl. */
      if (field === 'url' && /^site(-\d+)?$/.test(r.id)) {
        var derived = idFromUrl(value);
        if (derived) r.id = uniqueId(derived);
      }
    });
    saveDraft();
  }

  function revert() {
    LVSites.load().then(function (list) {
      rows = list;
      try { global.localStorage.removeItem(KEY); } catch (e) {}
      render();
    }).catch(function (err) {
      global.alert('Could not read sites.json — ' + err.message);
    });
  }

  function json() { return JSON.stringify(rows, null, 2) + '\n'; }

  function download() {
    if (!validate()) { render(); global.alert('Fix the rows marked in coral first.'); return; }
    var blob = new Blob([json()], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sites.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function copy() {
    if (!validate()) { render(); global.alert('Fix the rows marked in coral first.'); return; }
    var btn = $('lv-copy');
    var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy JSON'; }, 1500); };
    if (global.navigator.clipboard) {
      global.navigator.clipboard.writeText(json()).then(done, function () { global.alert('Clipboard refused — use Download instead.'); });
    } else {
      global.alert('Clipboard refused — use Download instead.');
    }
  }

  /* ---- rendering ---- */

  function field(label, value, id, key, span) {
    var wrap = document.createElement('label');
    wrap.className = 'lv-label' + (span ? ' lv-span' : '');
    var txt = document.createElement('span');
    txt.textContent = label;
    var input = document.createElement('input');
    input.className = 'la-input';
    input.value = value;
    input.placeholder = key === 'url' ? 'https://example.lazy.vacations/'
                      : key === 'headerColor' ? '#00ad4b' : '';
    input.oninput = function () { edit(id, key, input.value); };
    wrap.appendChild(txt);
    wrap.appendChild(input);
    return wrap;
  }

  function render() {
    validate();
    var list = $('lv-list');
    list.innerHTML = '';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = 'var(--la-s2)';

    rows.forEach(function (r, i) {
      var card = document.createElement('div');
      card.className = 'lv-card';
      card.setAttribute('data-hidden', String(r.hidden));

      var fields = document.createElement('div');
      fields.className = 'lv-card__fields';
      fields.appendChild(field('Name', r.name, r.id, 'name'));
      fields.appendChild(field('URL', r.url, r.id, 'url'));
      /* The viewer has no dropdown any more, so the note has nowhere to render: it is
         your own shorthand for which site is which while you work on this list. */
      /* The colour the handset's status bar takes, so it continues the site's own
         header instead of sitting on it as a white strip. Read off the site's theme
         (--header); left empty the strip falls back to paper. */
      fields.appendChild(field('Header colour — the status bar in the phone view', r.headerColor, r.id, 'headerColor'));
      fields.appendChild(field('Note — your own reference, not shown in the viewer', r.note, r.id, 'note', true));

      var meta = document.createElement('span');
      meta.className = 'lv-label lv-span';
      meta.textContent = 'id: ' + r.id + (r.hidden ? ' — hidden from the viewer' : '');
      fields.appendChild(meta);

      if (errors[r.id]) {
        var err = document.createElement('span');
        err.className = 'lv-label lv-err lv-span';
        err.textContent = errors[r.id];
        fields.appendChild(err);
      }

      var acts = document.createElement('div');
      acts.className = 'lv-card__acts';
      acts.appendChild(button('↑', 'Move up', function () { move(r.id, -1); }, i === 0));
      acts.appendChild(button('↓', 'Move down', function () { move(r.id, 1); }, i === rows.length - 1));
      acts.appendChild(button(r.hidden ? EYE_OFF : EYE, r.hidden ? 'Show in the viewer' : 'Hide from the viewer', function () { toggleHidden(r.id); }, false));
      acts.appendChild(button('✕', 'Remove', function () { remove(r.id); }, false));

      card.appendChild(fields);
      card.appendChild(acts);
      list.appendChild(card);
    });

    var draft = !!readDraft();
    $('lv-state').textContent = draft
      ? 'Unsaved draft in this browser — download it and commit to publish.'
      : 'Matches the committed sites.json.';
  }

  /* The builder's own eye, and the same eye struck through. A box glyph said nothing
     about which state it meant — an eye is the mark the product already uses for
     "this is what gets seen". */
  var EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
  var EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle><path d="M3 3l18 18"></path></svg>';

  function button(glyph, label, onclick, disabled) {
    var b = document.createElement('button');
    b.className = 'la-btn la-btn--icon';
    if (glyph.charAt(0) === '<') b.innerHTML = glyph; else b.textContent = glyph;
    b.title = label;
    b.setAttribute('aria-label', label);
    b.disabled = !!disabled;
    b.onclick = onclick;
    return b;
  }

  /* ---- boot ---- */

  function boot() {
    fetch('./logo.svg').then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (svg) { if (svg) $('lv-logo').innerHTML = svg; })
      .catch(function () {});

    /* The draft wins when there is one — it is the newer of the two, and losing an
       hour of typing to a page refresh is the failure this file exists to prevent. */
    var draft = readDraft();
    LVSites.load().then(function (list) {
      rows = draft || list;
      render();
    }).catch(function (err) {
      rows = draft || [];
      render();
      $('lv-state').textContent = 'Could not read sites.json (' + err.message + ').';
    });
  }

  global.LVAdmin = { add: add, revert: revert, download: download, copy: copy };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
