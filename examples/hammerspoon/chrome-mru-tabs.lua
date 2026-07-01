-- chrome-mru-tabs.lua
--
-- Makes Ctrl-Tab in Google Chrome cycle through tabs in most-recently-used
-- order (like Alt-Tab for windows) instead of Chrome's default "next tab".
--
-- Behavior:
--   * Ctrl-Tab            -> switch to the most recently used tab
--   * Ctrl-Tab, Tab, ...  -> while Ctrl is held, each Tab press steps one
--                            tab deeper into the MRU history (previews live)
--   * Ctrl-Shift-Tab      -> step back toward more recently used tabs
--   * releasing Ctrl      -> commits the selection to the top of the MRU list
--
-- The hotkeys are only active while Chrome is the frontmost application, so
-- Ctrl-Tab keeps its normal meaning everywhere else. With no usable history
-- (e.g. right after Hammerspoon reloads) the keys fall back to Chrome's
-- native next/previous-tab behavior for the rest of that Ctrl hold.
--
-- Install: see README.md in this directory.

local CHROME_BUNDLE_ID = "com.google.Chrome"
local POLL_INTERVAL = 0.5 -- seconds between checks of Chrome's active tab
local MAX_HISTORY = 50    -- cap on remembered tabs

-- MRU list of tab ids (as strings), most recent first. Chrome tab ids are
-- unique app-wide and stay with a tab when it moves between windows, but
-- they are session-scoped — the list is cleared when Chrome quits.
local mru = {}

-- Cycling state: non-nil while Ctrl is held and we're stepping through tabs.
-- { index = n, startKey = k } for an MRU cycle, or { native = true } when
-- falling back to Chrome's built-in tab order.
local cycle = nil

local function chromeRunning()
  return #hs.application.applicationsForBundleID(CHROME_BUNDLE_ID) > 0
end

-- Runs body inside a `tell` block targeting Chrome. Returns the script's
-- result, or nil if Chrome isn't running or the script failed (e.g. the
-- Automation permission was denied). Never launches Chrome.
local warnedFailure = false
local function chromescript(body)
  if not chromeRunning() then return nil end
  local ok, result = hs.osascript.applescript(
    'tell application id "' .. CHROME_BUNDLE_ID .. '"\n' .. body .. "\nend tell"
  )
  if not ok then
    if not warnedFailure then
      warnedFailure = true
      hs.alert.show("chrome-mru-tabs: cannot control Chrome — check "
        .. "System Settings → Privacy & Security → Automation")
    end
    return nil
  end
  return result
end

-- Returns the id of Chrome's active tab as a string, or nil.
local function activeTabKey()
  local result = chromescript([[
    if (count of windows) is 0 then return ""
    return (id of active tab of front window) as text
  ]])
  if result == nil or result == "" then return nil end
  return result
end

local function removeKey(key)
  for i, k in ipairs(mru) do
    if k == key then
      table.remove(mru, i)
      return
    end
  end
end

-- Moves key to the front of the MRU list.
local function touch(key)
  removeKey(key)
  table.insert(mru, 1, key)
  while #mru > MAX_HISTORY do
    table.remove(mru)
  end
end

-- Focuses the tab identified by key, searching every window (tabs keep
-- their id when dragged between windows). Returns true when focused,
-- false when the tab no longer exists, nil when Chrome was unreachable.
local function focusTab(key)
  local tabId = key:match("^%d+$")
  if not tabId then return false end
  return chromescript(string.format([[
    repeat with w in windows
      set i to 1
      repeat with t in tabs of w
        if id of t is %s then
          set active tab index of w to i
          if minimized of w then set minimized of w to false
          set index of w to 1
          return true
        end if
        set i to i + 1
      end repeat
    end repeat
    return false
  ]], tabId))
end

-- Chrome's built-in next/previous tab.
local function nativeCycle(direction)
  chromescript(string.format([[
    if (count of windows) is 0 then return
    set w to front window
    set n to count of tabs of w
    set active tab index of w to ((active tab index of w + %d + n - 1) mod n) + 1
  ]], direction))
end

-- Records the currently active tab into the MRU list and returns its key.
-- Skipped while cycling so previewed tabs don't reorder the history.
local function poll()
  if cycle then return nil end
  local key = activeTabKey()
  if key and key ~= mru[1] then touch(key) end
  return key
end

local pollTimer = hs.timer.new(POLL_INTERVAL, poll)

local commitCycle -- forward declaration: referenced by flagsTap's callback

-- Watches for Ctrl being released to commit the current cycle selection.
local flagsTap = hs.eventtap.new({ hs.eventtap.event.types.flagsChanged }, function(event)
  if cycle and not event:getFlags().ctrl then
    commitCycle()
  end
  return false
end)

local function endCycle()
  if not cycle then return end
  cycle = nil
  flagsTap:stop()
end

local deferredPoll -- keeps the one-shot timer below from being collected

commitCycle = function()
  if not cycle then return end
  local key
  if not cycle.native then
    -- The last focusTab left this tab active; commit it to the front of
    -- the history without another round-trip to Chrome.
    key = mru[cycle.index]
  end
  endCycle()
  if key then
    touch(key)
  else
    -- Native fallback: learn where it landed, outside this callback.
    deferredPoll = hs.timer.doAfter(0, poll)
  end
end

-- Steps the cycle by direction (+1 = less recent, -1 = more recent),
-- pruning tabs that have been closed since we last saw them.
local function step(direction)
  if not cycle then
    -- Arm the commit watcher before any blocking AppleScript call, so a
    -- Ctrl release while we're busy below is never missed.
    flagsTap:start()
    local current = poll() -- the current tab must head the list
    if not current then
      flagsTap:stop()
      return
    end
    if #mru < 2 then
      cycle = { native = true }
    else
      cycle = { index = 1, startKey = current }
    end
  end
  local c = cycle
  if c.native then
    nativeCycle(direction)
  else
    while #mru > 0 do
      if #mru == 1 and mru[1] == c.startKey then
        -- Every other remembered tab is gone; act like the no-history case
        -- for the rest of this hold instead of swallowing the keystroke.
        c.native = true
        nativeCycle(direction)
        break
      end
      c.index = ((c.index - 1 + direction) % #mru) + 1
      local key = mru[c.index]
      local focused = focusTab(key)
      if focused then break end
      if focused == nil then
        -- Chrome is unreachable (busy, quitting, automation denied):
        -- keep the history intact and give up on this cycle.
        endCycle()
        return
      end
      -- Tab was closed: drop it from the history and try the next. The
      -- modular advance above renormalizes any out-of-range index.
      table.remove(mru, c.index)
      if direction > 0 then c.index = c.index - 1 end
    end
    if #mru == 0 then
      endCycle()
      return
    end
  end
  -- If Ctrl was released during the calls above, the release may have fired
  -- before the cycle existed; commit now instead of leaving it dangling.
  if not hs.eventtap.checkKeyboardModifiers().ctrl then
    commitCycle()
  end
end

-- No repeatfn: key autorepeat would queue steps faster than the blocking
-- AppleScript calls can drain them. Step once per discrete Tab press.
local nextTab = hs.hotkey.new({ "ctrl" }, "tab", function() step(1) end)
local prevTab = hs.hotkey.new({ "ctrl", "shift" }, "tab", function() step(-1) end)

-- Enables or disables everything based on whether Chrome is frontmost.
-- Level-triggered so that app switches, Chrome quitting, and initial load
-- all take the same path.
local active = false
local function syncToFrontmost()
  local front = hs.application.frontmostApplication()
  local shouldBeActive = front ~= nil and front:bundleID() == CHROME_BUNDLE_ID
  if shouldBeActive == active then return end
  active = shouldBeActive
  if active then
    nextTab:enable()
    prevTab:enable()
    pollTimer:start()
  else
    nextTab:disable()
    prevTab:disable()
    pollTimer:stop()
    endCycle()
    if not chromeRunning() then
      -- Chrome quit: its ids are session-scoped, so after a relaunch the
      -- history would point at arbitrary other tabs.
      mru = {}
    end
  end
end

local watcherEvents = hs.application.watcher
local appWatcher = watcherEvents.new(function(_, event)
  if event == watcherEvents.activated
      or event == watcherEvents.deactivated
      or event == watcherEvents.terminated then
    syncToFrontmost()
  end
end)
appWatcher:start()
syncToFrontmost()

-- Keep references alive so they aren't garbage collected.
return {
  appWatcher = appWatcher,
  pollTimer = pollTimer,
  flagsTap = flagsTap,
  hotkeys = { nextTab, prevTab },
}
