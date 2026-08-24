# Site viewer

The editor without the editor. It frames the Lazy sites that are already live —
pick one, step through them, switch device width — so the marketing page can show
what a Lazy site looks like without anyone signing in.

Nothing here renders a site. The sites are deployed, static and flat; this is an
iframe, a bar, and a list.

## Run it

Any static file server. There is no build step, no bundler and no backend.

```bash
python3 -m http.server 8080
```

- Viewer: <http://localhost:8080/index.html>
- Admin: <http://localhost:8080/admin.html>

The viewer takes its state from the URL, so an embed can ask for one view:

```
index.html?site=capecod&device=phone&fit=0
```

`site` is an id from `sites.json`, `device` is `desktop` · `tablet` · `phone`,
`fit=0` means 100% instead of scaled-to-fit.

## The device view

Phone and tablet render inside a device body — real screen sizes (390x844 and
834x1112), scaled to fit both dimensions. The handset carries its own UI: the status
bar in the site's header colour, the Dynamic Island, a glass Safari bar floating over
the hero, and the home indicator. Only the clock and the address in that bar are
live; everything else is drawing, and all of it is hidden from assistive technology.

Two things are worth knowing about how it is done:

- **The scrollbar is clipped, not hidden.** A framed page draws its own scrollbar and
  another origin's scrollbar cannot be styled, so the screen is exactly the device
  width and the frame inside it is one scrollbar wider. The site still lays out at the
  true device width, because a classic scrollbar sits outside the layout viewport.
- **The blurred ground is a second copy of the site.** A cross-origin page's pixels
  cannot be sampled or captured, so the only way to show the site blurred behind the
  device is to render it again. It costs one extra page load, and only on phone and
  tablet — desktop has nothing showing around the frame and drops it. Its look is four
  tokens in `css/viewer.css`: `--lv-bg-blur`, `--lv-bg-sat`, `--lv-bg-fade` and
  `--lv-veil-clear`.

Desktop gets no body: the window you are already looking through is the desktop.

## Embedding it

```html
<iframe src="https://<where-this-is-hosted>/index.html?site=shalomus"
        style="width:100%;height:640px;border:0"></iframe>
```

The bar wraps to two rows under 600px. The frame cannot measure a cross-origin
page, so it fills the height you give the embed and scrolls inside it. **Get Lazy**
uses `target="_top"` so it escapes both frames.

## The list

`sites.json` is the whole data layer — an array, in display order:

```json
{ "id": "capecod", "name": "Cape Cod", "url": "https://capecod.lazy.vacations/",
  "headerColor": "#f4b13e", "note": "", "hidden": false }
```

`id` is stable and appears in the viewer's URL. `hidden` keeps a site in the file
but out of the viewer. `note` is your own reference and is not rendered anywhere.

`headerColor` is the site's own header colour (`--header` in its theme). The phone
view paints the status bar with it so the strip continues the site's header instead
of sitting on it as a white band, and the ink on that strip is derived from the
colour by luminance — no second setting. It has to be stated here because it cannot
be read: the sites send no CORS header, so a fetch is blocked, and a cross-origin
iframe cannot be inspected. Empty falls back to white.

`admin.html` edits that list — add, rename, reorder, hide, annotate. It holds your
work in `localStorage` while you edit and hands you the finished file: it is a
static page and cannot write the repo, so **Download sites.json**, drop it in, and
commit. **Revert** throws the draft away and goes back to what is committed.

## Where the look comes from

The chrome is copied from the Lazy builder — `css/lazyapp.css` tokens, the device
row, the Fit/100% tabs, the property switcher (reused as the site switcher), and
`logos/lazy.svg`. Copied, not imported: nothing here loads anything from the lazy
repo at runtime, and this project does not deploy with it.
