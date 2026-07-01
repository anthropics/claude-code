# Hammerspoon: MRU tab switching for Chrome

[`chrome-mru-tabs.lua`](chrome-mru-tabs.lua) is a [Hammerspoon](https://www.hammerspoon.org/)
script that changes Ctrl-Tab in Google Chrome to cycle through tabs in
**most-recently-used order** (like Alt-Tab does for windows) instead of
Chrome's default "next tab in the strip".

## What it does

| Key | Action |
| --- | --- |
| `Ctrl-Tab` | Switch to the most recently used tab |
| `Ctrl-Tab` (held Ctrl, repeated Tab presses) | Step deeper into tab history, previewing each tab |
| `Ctrl-Shift-Tab` | Step back toward more recent tabs |
| Release `Ctrl` | Commit the previewed tab to the top of the history |

The shortcuts are only intercepted while Chrome is the frontmost
application; Ctrl-Tab behaves normally in every other app. Tab history is
tracked across all Chrome windows (tabs keep their history when dragged
between windows), and closed tabs are pruned automatically. When there is
no usable history — right after Hammerspoon reloads, or after Chrome
restarts — the keys fall back to Chrome's native next/previous-tab
behavior until history builds up again.

## Installation

1. Install Hammerspoon: `brew install --cask hammerspoon`, then launch it and
   grant it Accessibility permissions when prompted.
2. Copy the script into your Hammerspoon config directory:

   ```sh
   cp chrome-mru-tabs.lua ~/.hammerspoon/
   ```

3. Load it from `~/.hammerspoon/init.lua`:

   ```lua
   chromeMruTabs = require("chrome-mru-tabs")
   ```

   (Assigning to a global keeps the watcher and hotkeys from being garbage
   collected.)

4. Reload the Hammerspoon config (menu bar icon → "Reload Config").

The first time the script talks to Chrome, macOS will ask you to allow
Hammerspoon to control Google Chrome — click **OK** (this is the Automation
permission under System Settings → Privacy & Security). If you clicked
**Don't Allow**, the script shows an on-screen alert the next time it tries;
re-enable Hammerspoon → Google Chrome under System Settings → Privacy &
Security → Automation to fix it.

## Notes

- The script polls Chrome's active tab every 0.5 seconds (only while Chrome
  is frontmost) to build the history, since Chrome exposes no tab-switch
  event. Adjust `POLL_INTERVAL` at the top of the script if you switch tabs
  faster than that and want tighter tracking.
- History is capped at the 50 most recent tabs (`MAX_HISTORY`) and cleared
  when Chrome quits (Chrome's AppleScript tab ids don't survive a restart).
- Holding Tab down does not autorepeat through the history — press Tab once
  per step while holding Ctrl.
- Known limitations of Chrome's AppleScript interface: Ctrl-Tab is still
  intercepted (but can't do anything useful) in Chrome windows that aren't
  regular tabbed windows, such as undocked DevTools or `--app=` shortcut
  windows, and switching to a tab in a fullscreen window on another macOS
  Space raises the window without switching Spaces.
- Works with regular Chrome (`com.google.Chrome`). For Chrome Beta, Canary,
  Chromium, or other Chromium browsers that expose the same AppleScript
  interface, change `CHROME_BUNDLE_ID` at the top of the script (both the
  hotkey scoping and the AppleScript target derive from it).
