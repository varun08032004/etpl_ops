# EtherTrack Tab Reporter (browser extension)

Reports the active tab's real URL (not a title guess) to EtherTrack Agent
running on the same machine, over `http://127.0.0.1:47823` — never leaves
the computer. This is what fixes "no browser activity recorded" — the
agent's own title-parsing fallback only worked when a page happened to put
its domain in the title bar, which most sites don't.

## Load it for testing (Chrome or Edge — both work unmodified)

1. Go to `chrome://extensions` (or `edge://extensions`)
2. Turn on **Developer mode** (top-right toggle)
3. **Load unpacked** → select this `browser-extension` folder
4. Click the extension icon in the toolbar (or right-click → Options)
5. Paste the `localServerToken` value from `agent/config.json` into the
   pairing token field, click **Save**
6. The status dot should turn green ("EtherTrack Agent is running") once
   the agent is open — doesn't need a session started, just running

That's it — browse normally, and app_usage/website_usage should now show
real domains on the Monitoring dashboard instead of "No browser activity
recorded."

## Making it stick — employees can't just disable it

Loading it as above is fine for testing, but **anyone can turn it off**
from `chrome://extensions` just as easily as you turned it on. If the goal
is that employees on company laptops can't quietly disable tracking, the
loading method has to change — this isn't something I can code around,
it's a Chrome/Windows device-management setting your org needs to turn on:

- **If you're on Google Workspace**: Admin Console → Chrome management →
  Apps & extensions → force-install this extension for managed Chrome
  profiles (`ExtensionInstallForcelist` policy). Once forced, it can't be
  removed or disabled from `chrome://extensions` on that profile — the
  toggle is greyed out.
- **If you're on Windows without Google Workspace** (plain domain-joined
  PCs, or standalone like ASUS's laptop): the same `ExtensionInstallForcelist`
  policy can be set via **Group Policy** (`gpedit.msc` → Computer
  Configuration → Administrative Templates → Google Chrome / Microsoft
  Edge → Extensions) or via a registry key, pointing at this extension's
  ID once it's hosted somewhere Chrome/Edge can fetch it from (an internal
  update URL, or the Chrome Web Store in "unlisted" mode).

This is a real config step on your side (needs whatever device management
you have, or setting one up), not something bundled into the extension
files themselves — flagging that clearly rather than implying "install
this and it's locked down."

## What this does and doesn't cover

- Chrome and Edge (Chromium-based) — covered.
- Firefox — not covered. Same idea (`browser.tabs` instead of
  `chrome.tabs`) but a separate build; ask if you want it.
- Incognito/InPrivate windows — extensions are off by default in these
  unless explicitly allowed per-extension, and most orgs leave that off on
  purpose. That gap is a policy choice, not a bug.
- If the agent isn't running, or Start Work hasn't been clicked, this
  extension's requests just fail silently — no data goes anywhere, no
  error shown.
