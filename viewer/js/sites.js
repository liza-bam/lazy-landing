/* ============================================================
   SITES — the list, and the only thing that reads sites.json.

   The viewer and the admin page both come through here so there is
   one definition of what a site row is and one place that decides a
   row is malformed. A row the file cannot vouch for is DROPPED, not
   patched: a viewer entry that frames nothing is worse than an
   entry that is absent, because the visitor clicks it.
   ============================================================ */
(function (global) {
  'use strict';

  var FILE = './sites.json';

  /* A row is a site when it can name itself and point somewhere. `note` and
     `hidden` are optional — a list that has never been through the admin page
     has neither. Anything else on the row is kept as-is: the file is yours,
     and this module is not the authority on what else may live in it. */
  function normalise(row) {
    if (!row || typeof row !== 'object') return null;
    var id = typeof row.id === 'string' ? row.id.trim() : '';
    var url = typeof row.url === 'string' ? row.url.trim() : '';
    if (!id || !url) return null;
    var name = typeof row.name === 'string' && row.name.trim() ? row.name.trim() : id;
    return {
      id: id,
      name: name,
      url: url,
      note: typeof row.note === 'string' ? row.note : '',
      /* The site's header colour, so the handset's status bar can be painted the same
         and the two read as one strip. It cannot be read from the site itself: the
         sites send no CORS header, so a fetch from here is blocked, and an iframe from
         another origin cannot be inspected. So it is stated, once, per site. */
      headerColor: typeof row.headerColor === 'string' ? row.headerColor.trim() : '',
      hidden: row.hidden === true
    };
  }

  function normaliseList(raw) {
    if (!Array.isArray(raw)) return [];
    var out = [], seen = {};
    for (var i = 0; i < raw.length; i++) {
      var row = normalise(raw[i]);
      if (!row) continue;
      /* Two rows under one id would make ?site= ambiguous and give prev/next two
         places to land. First one wins; the later one is a duplicate, not a site. */
      if (seen[row.id]) continue;
      seen[row.id] = true;
      out.push(row);
    }
    return out;
  }

  /* Reads the committed file. Rejects loudly — every caller renders the failure
     rather than an empty list, because "no sites" and "the list did not load"
     look identical on screen and are completely different problems. */
  function load() {
    return fetch(FILE, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('sites.json — HTTP ' + res.status);
      return res.json();
    }).then(normaliseList);
  }

  global.LVSites = {
    load: load,
    normalise: normalise,
    normaliseList: normaliseList,
    visible: function (list) { return list.filter(function (s) { return !s.hidden; }); }
  };
})(window);
