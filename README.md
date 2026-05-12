<p align="center">
  <img src="extension/icons/icon128.png" width="96" alt="Open Claude in Firefox">
</p>

<h1 align="center">Open Claude in Firefox</h1>

<p align="center">
  <em>Official Claude in Chrome gives you 58 blocked domains and two browsers.<br/>
  <strong>Open Claude in Firefox gives you the whole web — in Firefox.</strong></em>
  <br/>
  <sub>Firefox port of the open-source Claude browser automation extension. No blocklist. Full MCP tool parity.</sub>
</p>

<p align="center">
  <a href="#whats-different">What's different</a> ·
  <a href="#installation">Install</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#firefox-notes">Firefox notes</a>
</p>

---

This is a Firefox port of [open-claude-in-chrome](https://github.com/noemica/open-claude-in-chrome), a clean-room reimplementation of Anthropic's [Claude in Chrome](https://code.claude.com/docs/en/chrome) extension. It gives Claude Code (and Claude Desktop) full browser automation via 18 MCP tools, without any domain restrictions, running in Firefox instead of Chromium.

## What's Different

| | Claude in Chrome (official) | Open Claude in Firefox |
|---|---|---|
| **Domain blocklist** | 58 blocked domains across 11 categories | No blocklist. Navigate anywhere. |
| **Browser** | Chrome and Edge only | Firefox |
| **Source code** | Closed source | Open source (MIT) |
| **Tools** | 18 MCP tools | Same 18 MCP tools |
| **Automation method** | Chrome DevTools Protocol (CDP) | Firefox WebExtension APIs |

### Blocked Domains in the Official Extension

| Category | Blocked Sites |
|----------|--------------|
| Banking | Chase, BofA, Wells Fargo, Citibank |
| Investing/Brokerage | Schwab, Fidelity, Robinhood, E-Trade, Wealthfront, Betterment |
| Payments/Transfers | PayPal, Venmo, Cash App, Zelle, Stripe, Square, Wise, Western Union, MoneyGram, Adyen, Checkout.com |
| BNPL | Klarna, Affirm, Afterpay |
| Neobanks/Fintech | SoFi, Chime, Mercury, Brex, Ramp |
| Crypto | Coinbase, Binance, Kraken, MetaMask |
| Gambling | DraftKings, FanDuel, Bet365, Bovada, PokerStars, BetMGM, Caesars |
| Dating | Tinder, Bumble, Hinge, Match, OKCupid |
| Adult | Pornhub, XVideos, XNXX |
| News/Media | NYT, WSJ, Barron's, MarketWatch, Bloomberg, Reuters, Economist, Wired, Vogue |
| Social Media | Reddit |

Open Claude in Firefox has **none of these restrictions**.

## Architecture

```
Claude Code / Claude Desktop <--stdio MCP--> mcp-server.js <--TCP--> native-host.js <--native messaging--> Extension <--> Firefox
```

Three components:
1. **Extension** — Manifest V3 using Firefox WebExtension APIs (screenshots via `captureVisibleTab`, input via content script synthetic events, JS eval via `scripting.executeScript`)
2. **MCP Server** — Node.js process started by Claude Code or Claude Desktop, exposes tools via MCP
3. **Native Messaging Host** — Bridge between the MCP server and the extension

## Installation

### Prerequisites

- **Node.js** v18+
- **Firefox** 109+
- **Claude Code** v2.0.73+ and/or **Claude Desktop**

### Step 1: Install dependencies

```bash
cd host
npm install
cd ..
```

### Step 2: Load the extension in Firefox

1. Open `about:debugging` in Firefox
2. Click **This Firefox**
3. Click **Load Temporary Add-on...**
4. Select `extension/manifest.json`

> **Permanent install**: Go to `about:addons` → gear icon → **Install Add-on From File** and select `extension/manifest.json`. Or load the `.xpi` if one is provided.

Unlike Chrome, Firefox assigns the extension ID from `manifest.json` (`open-claude-in-firefox@anthropic`), so you don't need to pass an ID to the install script.

### Step 3: Register the native messaging host

#### macOS / Linux

```bash
./install.sh
```

#### Windows (manual)

Firefox on Windows finds native messaging hosts via the registry. Three steps:

**3a.** Create a wrapper script at `host\native-host-wrapper.bat`:

```bat
@echo off
node "%~dp0native-host.js"
```

**3b.** Create the manifest at `host\com.anthropic.open_claude_in_firefox.json` (use the actual absolute path):

```json
{
  "name": "com.anthropic.open_claude_in_firefox",
  "description": "Open Claude in Firefox Native Messaging Host",
  "path": "C:\\path\\to\\open-claude-in-firefox\\host\\native-host-wrapper.bat",
  "type": "stdio",
  "allowed_extensions": ["open-claude-in-firefox@anthropic"]
}
```

**3c.** Register it in the registry. Run in PowerShell (adjust the path):

```powershell
$manifestPath = "C:\path\to\open-claude-in-firefox\host\com.anthropic.open_claude_in_firefox.json"
New-Item -Path "HKCU:\SOFTWARE\Mozilla\NativeMessagingHosts\com.anthropic.open_claude_in_firefox" -Force |
  Set-ItemProperty -Name "(Default)" -Value $manifestPath
```

### Step 4: Restart Firefox

Close **all** Firefox windows and reopen. Firefox reads native messaging host configs on startup.

### Step 5: Add to Claude Code

```bash
claude mcp add open-claude-in-firefox -- node /absolute/path/to/host/mcp-server.js
```

Find the absolute path with:

```bash
# macOS / Linux
echo "node $(pwd)/host/mcp-server.js"

# Windows (PowerShell)
"node $(Resolve-Path host\mcp-server.js)"
```

### Step 5 (alternative): Add to Claude Desktop

Edit your Claude Desktop config file and add an `mcpServers` entry:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "open-claude-in-firefox": {
      "command": "node",
      "args": ["/absolute/path/to/host/mcp-server.js"]
    }
  }
}
```

Fully quit and restart Claude Desktop after saving.

## Verification

Start a new Claude Code (or Claude Desktop) session and test:

```
Navigate to reddit.com and take a screenshot
```

Reddit loads. No domain restriction.

## Available Tools

All 18 tools, matching the Claude in Chrome interface:

| Tool | Description |
|------|-------------|
| `tabs_context_mcp` | Get MCP window tab context |
| `tabs_create_mcp` | Create new tab in MCP window |
| `navigate` | Navigate to URL, back, forward |
| `computer` | Mouse, keyboard, screenshots (13 actions) |
| `read_page` | Accessibility tree with element refs |
| `get_page_text` | Extract article/main text |
| `find` | Find elements by text/purpose |
| `form_input` | Set form values by ref |
| `javascript_tool` | Execute JS in page context |
| `read_console_messages` | Console output (filtered) |
| `read_network_requests` | Network activity |
| `resize_window` | Resize browser window |
| `upload_image` | Not supported in Firefox WebExtensions |
| `gif_creator` | GIF recording (stub) |
| `shortcuts_list` | List shortcuts (stub) |
| `shortcuts_execute` | Run shortcut (stub) |
| `switch_browser` | Switch browser (stub) |
| `update_plan` | Present plan (auto-approved) |

## Firefox Notes

### Tab groups → MCP window

The Chrome version uses tab groups to track Claude's tabs. Firefox has no tab groups API, so this extension instead opens a dedicated **MCP window**. All tabs Claude creates live in that window. The window ID is saved to extension storage and recovered automatically after Firefox restarts or the service worker is reloaded.

### Synthetic events

Firefox WebExtensions cannot use the Chrome DevTools Protocol. Mouse clicks, keyboard input, and scrolling are dispatched as synthetic DOM events from a content script. These events have `isTrusted: false`, which means:

- Most web apps work fine — synthetic events are standard practice for testing frameworks
- A small number of hardened apps check `event.isTrusted` and ignore synthetic events; those interactions will fail silently

### Screenshots

`tabs.captureVisibleTab()` can only capture the active tab in a window. The extension automatically activates the target tab before each screenshot. If the MCP window is in the background, the tab switch is invisible since Firefox doesn't require the window to be focused.

### Console monitoring

Console messages are captured via a MAIN-world interceptor injected into the page. Messages logged **before** `read_console_messages` is first called on a tab are not captured. Call `read_console_messages` early in a session to start capturing.

## Updating After Code Changes

No build step. All files are plain JavaScript. After pulling or editing:

| What changed | What to do |
|---|---|
| `extension/background.js`, `content.js`, or `manifest.json` | Reload: `about:debugging` → click the reload icon next to the extension |
| `host/mcp-server.js` | Kill stale servers and reconnect: `pkill -f "node.*mcp-server"` then `/mcp` in Claude Code |
| `host/native-host.js` | Restart Firefox (close all windows, reopen) |
| `install.sh` or native host name changed | Re-run `./install.sh`, restart Firefox, re-add MCP |

### Quick reset

If things are broken and you're not sure why:

```bash
# 1. Kill all MCP servers
pkill -f "node.*mcp-server"

# 2. Re-run install
./install.sh

# 3. Restart Firefox (close all windows, reopen)

# 4. Reload extension in about:debugging

# 5. Reconnect in Claude Code
# /mcp
```

## Multiple Sessions

Multiple Claude Code sessions can share the same browser extension. The first session becomes the "primary" (owns the TCP port), and subsequent sessions connect as clients through the primary.

If a session disconnects, kill stale servers and reconnect:

```bash
pkill -f "node.*mcp-server"
# then /mcp in each Claude Code session
```

## Troubleshooting

### Extension not connecting

1. Verify the extension is loaded and enabled in `about:debugging`
2. Make sure `./install.sh` completed without errors (macOS/Linux) or the registry key is set (Windows)
3. Restart Firefox completely (all windows closed)
4. Verify the native messaging manifest exists:
   - **macOS**: `~/Library/Application Support/Mozilla/NativeMessagingHosts/com.anthropic.open_claude_in_firefox.json`
   - **Linux**: `~/.mozilla/native-messaging-hosts/com.anthropic.open_claude_in_firefox.json`
   - **Windows**: check `HKCU\SOFTWARE\Mozilla\NativeMessagingHosts\com.anthropic.open_claude_in_firefox` in the registry

### MCP server not found

Use an absolute path:
```bash
claude mcp add open-claude-in-firefox -- node /absolute/path/to/host/mcp-server.js
```

### "Browser extension is not connected"

The MCP server started but the native host hasn't connected. Try:
1. Open any webpage in the MCP window (wakes the service worker)
2. Check service worker logs: `about:debugging` → Inspect the extension's service worker
3. Verify `host/native-host-wrapper.sh` (macOS/Linux) or `host/native-host-wrapper.bat` (Windows) exists and is executable

### Tools fail immediately after reconnect

Stale MCP server processes from previous sessions may be holding the port:

```bash
pkill -f "node.*mcp-server"
```

Then `/mcp` in Claude Code to reconnect.

### Port conflict

Default port is 18765. To change:
1. Create `~/.config/open-claude-in-firefox/config.json`:
   ```json
   { "port": 19000 }
   ```
2. Restart Firefox and Claude Code

## License

MIT
