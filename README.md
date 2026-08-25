# Kasatria People Table

An interactive CSS3D visualization of 200 people, adapted from the
[three.js `css3d_periodictable` example](https://threejs.org/examples/#css3d_periodictable).
Data is loaded live from a Google Sheet, and the page is gated behind
Google Sign-In.

## Stack

Plain HTML/CSS/JS (ES modules), no build step. Three.js is loaded via an
import map from a CDN. Google Identity Services provides the sign-in
gate.

## Configuration

Public, non-secret config lives in [`js/config.js`](js/config.js):

- `GOOGLE_CLIENT_ID` — OAuth 2.0 Web Client ID from Google Cloud Console.
  Its **Authorized JavaScript origins** must include every origin the
  page is served from (e.g. `http://localhost:8000` for local dev, and
  the deployed GitHub Pages origin).
- `SHEET_ID` — the Google Sheet's ID. The Sheet's general access must be
  set to "Anyone with the link: Viewer" so the page can fetch it via the
  public CSV export endpoint (`/export?format=csv`).

The Sheet must have a header row with columns `Name`, `Photo`, `Age`,
`Country`, `Interest`, `Net Worth`, followed by exactly 200 data rows.

## Running locally

Any static file server works, e.g.:

```
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Layouts

- **Table** — the real periodic table shape (18 columns x 10 rows, with
  the lanthanide/actinide rows split out), inside a 20 x 10 bounding box.
  That shape only has 118 real positions, so the remaining people re-use
  the same footprint as a second layer stacked behind it (visible when
  you orbit) rather than breaking the recognisable outline.
- **Sphere** — golden-angle (Fibonacci) point distribution.
- **Helix** — double helix: people alternate between two strands wound
  around a shared axis, like DNA.
- **Grid** — 5 × 4 × 10 volume.

## Net worth color coding

- Red: below $100,000
- Orange: $100,000 to just under $200,000
- Green: $200,000 and above
