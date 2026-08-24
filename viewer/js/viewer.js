/* ============================================================
   VIEWER — pick a site, step through them, choose a width.

   The sizing below is the builder's sizeFrame(), moved: same DEVICES
   table, same rule that a fixed-width device renders at its REAL width
   and is scaled down only when the surface is narrower than it, same
   `zoom` (not transform) so the frame keeps its real box. What is gone
   is everything that belonged to the editor — the shell, the panel
   column, the draft. The one thing added is an explicit HEIGHT: the
   editor mounted its own page and could let it grow, and a
   cross-origin iframe cannot be measured, so the frame is given the
   surface's height instead of asking the site for it.
   ============================================================ */
(function (global) {
  'use strict';

  /* The widths are the builder's, unchanged. The HEIGHTS belong to the body around
     them: a phone shell has to be phone-shaped, so the screen is a real handset's
     390x844 and a slate's 834x1112. Desktop has neither — it is "as wide as there is
     room for", which is what a desktop actually is. */
  var DEVICES = [
    { key: 'desktop', label: 'Desktop', width: null,    height: null },
    { key: 'tablet',  label: 'Tablet',  width: '834px', height: '1112px' },
    { key: 'phone',   label: 'Phone',   width: '390px', height: '844px' }
  ];

  var state = {
    sites: [],        // visible sites, in file order — the order ‹ › walks
    id: null,         // which one is framed
    device: 'desktop',
    fit: true
  };

  var $ = function (id) { return document.getElementById(id); };

  /* HOW WIDE THIS BROWSER DRAWS A SCROLLBAR. Measured once, from a throwaway box in
     this document: the framed page is another origin and cannot be asked, but it is
     the same browser with the same setting, so the answer is the same. Zero on the
     platforms that draw scrollbars over the content instead of beside it. */
  var SBW = (function () {
    try {
      var d = document.createElement('div');
      d.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll';
      document.body.appendChild(d);
      var w = d.offsetWidth - d.clientWidth;
      document.body.removeChild(d);
      return w > 0 ? w : 0;
    } catch (e) { return 0; }
  })();

  /* ---- the site being looked at ---- */

  function indexOfId(id) {
    for (var i = 0; i < state.sites.length; i++) if (state.sites[i].id === id) return i;
    return -1;
  }
  function current() {
    var i = indexOfId(state.id);
    return i === -1 ? null : state.sites[i];
  }

  /* ---- URL state — the embed's only way to ask for a particular view ---- */

  function readUrl() {
    var q = new URLSearchParams(global.location.search);
    var d = q.get('device');
    if (d && DEVICES.some(function (x) { return x.key === d; })) state.device = d;
    if (q.get('fit') === '0') state.fit = false;
    return q.get('site');
  }

  /* replaceState, never pushState: stepping through six sites should not bury the
     page the visitor came from under six history entries — and inside an embed
     those entries belong to the host page's Back button. */
  function writeUrl() {
    var q = new URLSearchParams();
    if (state.id) q.set('site', state.id);
    if (state.device !== 'desktop') q.set('device', state.device);
    if (!state.fit) q.set('fit', '0');
    var s = q.toString();
    try {
      global.history.replaceState(null, '', s ? '?' + s : global.location.pathname);
    } catch (e) { /* a sandboxed embed may forbid it; the view still works */ }
  }

  /* ---- rendering ---- */

  function renderName() {
    var site = current();
    $('lv-name').textContent = site ? site.name : 'No sites';
    /* One site is not a walk. The arrows go dead rather than disappearing, so the
       strip does not change shape between a one-site viewer and a six-site one. */
    var only = state.sites.length < 2;
    $('lv-prev').disabled = only;
    $('lv-next').disabled = only;
  }

  function renderControls() {
    /* The switch is ON at real size: what it turns on is 100%, which is the state that
       departs from the default. A switch whose meaning flips with its label is a switch
       nobody can read. */
    $('lv-scale').setAttribute('aria-checked', String(!state.fit));
    DEVICES.forEach(function (d) {
      $('lv-dev-' + d.key).setAttribute('aria-pressed', String(state.device === d.key));
    });
  }

  /* WHICH INK READS ON THIS COLOUR. Relative luminance, the same sum every contrast
     check uses: past the midpoint the strip is light and takes the dark ink, below it
     the strip is dark and takes paper. Derived, so a new header colour never needs a
     second field stating what to write on it. */
  function inkFor(hex) {
    var m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    var h = m[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var c = [0, 2, 4].map(function (i) {
      var v = parseInt(h.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return L > 0.45 ? 'dark' : 'light';
  }

  /* The two true values on the handset's furniture: the visitor's own clock, and the
     address of the site actually in the frame. Everything else there is drawing. */
  function renderHandset() {
    var site = current();

    /* The status strip wears the site's header colour so the two read as one surface.
       Stated per site — see js/sites.js on why it cannot be read from the site. */
    var strip = $('lv-status');
    if (strip) {
      var col = site && site.headerColor ? site.headerColor : '';
      var ink = inkFor(col);
      strip.style.setProperty('--lv-status-bg', col || '');
      strip.style.setProperty('--lv-status-ink', ink === 'light' ? 'var(--la-paper)' : (ink === 'dark' ? 'var(--lv-ink)' : ''));
    }
    var host = $('lv-host');
    if (host) {
      var h = '';
      try { h = new URL(site ? site.url : '').hostname.replace(/^www\./, ''); } catch (e) { h = ''; }
      host.textContent = h;
    }
    var clock = $('lv-time');
    if (clock) {
      var now = new Date();
      var hh = now.getHours() % 12; if (hh === 0) hh = 12;
      clock.textContent = hh + ':' + String(now.getMinutes()).padStart(2, '0');
    }
  }

  function renderFrame() {
    var site = current();
    var frame = $('lv-frame');
    var back = $('lv-bg');
    if (!site) { frame.removeAttribute('src'); if (back) back.removeAttribute('src'); return; }
    if (frame.getAttribute('src') !== site.url) frame.setAttribute('src', site.url);
    frame.setAttribute('title', site.name);

    /* The ground behind the device is the same site again — loaded only when a device
       is on screen, because on desktop nothing shows around the frame and a second copy
       would be a page load nobody ever sees. */
    if (back) {
      if (state.device === 'desktop') back.removeAttribute('src');
      else if (back.getAttribute('src') !== site.url) back.setAttribute('src', site.url);
    }
  }

  /* THE BUILDER'S sizeFrame(), minus the editor — and now sizing a BODY as well as a
     screen. What is unchanged: a fixed-width device renders at its real width and is
     scaled down only when there is not room for it, and the scaling is `zoom`, not
     transform, so the shell keeps its real box.

     The shell is what gets zoomed, so the bezel, the corners and the shadow scale with
     the screen instead of thickening as the phone shrinks. */
  function sizeFrame() {
    var frame = $('lv-frame');
    var surf = $('lv-surf');
    var shell = $('lv-device');
    var screen = $('lv-screen');
    if (!frame || !surf || !shell || !screen) return;
    surf.setAttribute('data-scale', state.fit ? 'fit' : 'full');

    var dev = DEVICES.filter(function (d) { return d.key === state.device; })[0] || DEVICES[0];
    shell.setAttribute('data-device', dev.key);
    surf.setAttribute('data-device', dev.key);

    /* clientWidth/Height still count the air the device stands in, so the room it
       actually has is the surface's CONTENT box. */
    var sp = global.getComputedStyle(surf);
    var padX = (parseFloat(sp.paddingLeft) || 0) + (parseFloat(sp.paddingRight) || 0);
    var padY = (parseFloat(sp.paddingTop) || 0) + (parseFloat(sp.paddingBottom) || 0);
    var avail = Math.max(0, (surf.clientWidth || 0) - padX);
    var availH = Math.max(0, (surf.clientHeight || 0) - padY);
    var width, height, f;

    if (dev.width) {
      /* A handset or a slate: a real screen, in a body. Both dimensions are fixed, so
         the fit factor is whichever of the two runs out of room first — a phone that
         fits the width and is cut off at the ankles is not a phone. */
      width = parseInt(dev.width, 10) || 834;
      height = parseInt(dev.height, 10) || 1112;
      var bezel = parseFloat(global.getComputedStyle(shell).paddingTop) || 0;
      var bodyW = width + bezel * 2, bodyH = height + bezel * 2;
      f = state.fit && avail && availH ? Math.min(1, avail / bodyW, availH / bodyH) : 1;
    } else {
      // Desktop: fill the available width when there's room (>=1080 -> 1:1), otherwise
      // render a 1080-wide desktop canvas scaled to fit.
      var MIN = 1080;
      width = state.fit ? Math.max(avail || MIN, MIN) : (avail || MIN);
      f = state.fit ? (avail ? Math.min(1, avail / width) : 1) : 1;
      /* No body here, so the screen takes the whole surface: `zoom` scales the rendered
         box, which is why the height that fills it is the surface's own over the factor. */
      height = f ? Math.max(0, availH / f) : availH;
    }

    /* Geometry only. The body, its corners, its shadow and the speaker live in the
       stylesheet — a look written here would be a hard-coded rule no token can reach. */
    shell.style.cssText = 'zoom:' + f + ';';
    screen.style.cssText = 'width:' + width + 'px;height:' + height + 'px;';

    /* Only the status strip takes height from the page: the browser bar floats over it,
       the way it does on the phone, so the hero runs underneath and through the glass.
       Measured rather than restated, so the height stays a stylesheet decision. */
    var status = screen.querySelector('.lv-ios--status');
    var taken = (status && status.offsetHeight) || 0;
    height = Math.max(0, height - taken);
    /* One scrollbar wider than the screen, so the bar falls outside the crop. The site
       still lays out at `width`: a classic scrollbar is not part of the viewport it
       measures. */
    frame.style.cssText = 'width:' + (width + SBW) + 'px;height:' + height + 'px;border:0;display:block;';
  }

  function render() {
    renderName();
    renderControls();
    renderHandset();
    renderFrame();
    sizeFrame();
    writeUrl();
  }

  /* ---- actions ---- */

  function select(id) {
    if (indexOfId(id) === -1) return;
    state.id = id;
    render();
  }

  function step(delta) {
    if (state.sites.length < 2) return;
    var i = indexOfId(state.id);
    if (i === -1) i = 0;
    /* Wraps deliberately: with six sites in a marketing embed, an arrow that dies on
       the last one reads as a broken control, not as the end of a list. */
    var n = state.sites.length;
    select(state.sites[((i + delta) % n + n) % n].id);
  }

  function setDevice(key) { state.device = key; render(); }
  function setFit(on) { state.fit = !!on; render(); }
  function toggleFit() { setFit(!state.fit); }

  /* ---- failure is shown, never swallowed ---- */

  function fail(msg) {
    var surf = $('lv-surf');
    if (surf) surf.innerHTML = '<p class="lv-msg">' + msg + '</p>';
    $('lv-name').textContent = 'No sites';
    $('lv-prev').disabled = true;
    $('lv-next').disabled = true;
  }

  /* ---- boot ---- */

  function boot() {
    /* The wordmark is inlined rather than <img>-ed so it takes the pill's ink through
       currentColor — white on coral here, exactly as it is on the marketing page. */
    fetch('./logo.svg').then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (svg) { if (svg) $('lv-brand').innerHTML = svg; })
      .catch(function () { /* a missing mark is not worth failing the page over */ });

    var wanted = readUrl();

    LVSites.load().then(function (all) {
      state.sites = LVSites.visible(all);
      if (!state.sites.length) { fail('No sites to show yet — add one in admin.html.'); return; }
      state.id = (wanted && indexOfId(wanted) !== -1) ? wanted : state.sites[0].id;
      render();
    }).catch(function (err) {
      fail('Could not load the site list (' + (err && err.message ? err.message : 'unknown error') + ').');
    });

    global.addEventListener('resize', sizeFrame);

  }

  global.LVViewer = { step: step, setDevice: setDevice, setFit: setFit, toggleFit: toggleFit, select: select };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
