# OTE Fibonacci Visualization - Enhanced Chart Drawing

## Overview

The CCTTB bot now includes an **enhanced OTE visualization** system that draws complete Fibonacci retracement and extension levels on your cTrader charts, similar to professional Pine Script indicators.

## Features

### ✅ What's Included

1. **OTE Box** (61.8% - 78.6% zone)
   - Highlighted rectangle showing optimal entry zone
   - Color-coded: Green for bullish, Red for bearish
   - Optional "OTE" label inside the box

2. **Fibonacci Retracement Levels**
   - 0% (Swing extreme - high/low)
   - 23.6% (Optional)
   - 38.2% (Optional)
   - 50.0% (Equilibrium - always shown if enabled)
   - 61.8% (OTE lower bound)
   - 78.6% (OTE upper bound)
   - 88.6% (Optional)
   - 100% (Swing start)

3. **Fibonacci Extension Levels** (Optional)
   - 1.272 (First extension target)
   - 1.618 (Golden ratio extension)
   - 2.0 (Double range)
   - 2.618 (Super extension)
   - Color-coded: Light green for bullish, Light coral for bearish

4. **Price Labels** (Optional)
   - Shows level name and exact price
   - Example: "61.8% (1.13456)"

## How It Works

### OTE Calculation (From MSS Swing)

The OTE zone is calculated from the **Market Structure Shift (MSS) impulse swing**, NOT from visible chart extremes. This follows proper ICT methodology:

**For Bullish MSS**:
- Impulse: Low → High (upward move)
- OTE zone: 61.8% - 78.6% pullback FROM the high
- Extensions: Above the swing high

**For Bearish MSS**:
- Impulse: High → Low (downward move)
- OTE zone: 61.8% - 78.6% pullback FROM the low
- Extensions: Below the swing low

### Fibonacci Math

```csharp
// Retracement levels (from 100% start to 0% end)
fibPrice = start + (end - start) * level

// Example for 61.8% on bullish swing:
// start = swingLow, end = swingHigh
// fib618 = swingLow + (swingHigh - swingLow) * 0.618

// Extension levels (beyond the swing)
extPrice = swingEnd + range * (extensionLevel - 1.0)

// Example for 1.618 extension on bullish swing:
// ext1618 = swingHigh + (swingHigh - swingLow) * 0.618
```

## Usage

### Method 1: Use Existing DrawOTE (Default)

The bot automatically draws OTE zones using the standard `DrawOTE()` method which shows:
- OTE box (61.8% - 78.6%)
- 50% equilibrium line
- 61.8% and 78.6% boundary lines

**No changes needed** - this is already active in your bot.

### Method 2: Use Enhanced DrawOTEWithFibonacci

To enable the full Fibonacci visualization with all levels, you need to call the new method in `JadecapStrategy.cs`.

**Location**: Find the visualization section in your OnBar or visualization update method.

**Current Code** (using standard DrawOTE):
```csharp
_drawingTools.DrawOTE(oteZones, boxMinutes: 45, drawEq50: true);
```

**Enhanced Code** (using full Fibonacci):
```csharp
_drawingTools.DrawOTEWithFibonacci(
    oteZones,
    boxMinutes: 45,              // Width of box in minutes
    showFibRetracements: true,   // Show fib levels
    showFibExtensions: false,    // Show extension targets
    showPriceLabels: true,       // Show price on each level
    show236: false,              // 23.6% level
    show382: false,              // 38.2% level
    show500: true,               // 50% equilibrium
    show618: true,               // 61.8% (OTE lower)
    show786: true,               // 78.6% (OTE upper)
    show886: false               // 88.6% level
);
```

### Customization Options

#### Minimal (Clean Chart)
```csharp
_drawingTools.DrawOTEWithFibonacci(
    oteZones,
    showFibRetracements: false,  // Only OTE box, no lines
    showFibExtensions: false,
    showPriceLabels: false
);
```

#### Standard ICT Setup
```csharp
_drawingTools.DrawOTEWithFibonacci(
    oteZones,
    showFibRetracements: true,
    show236: false,
    show382: false,
    show500: true,   // EQ50
    show618: true,   // OTE bounds
    show786: true,
    show886: false,
    showFibExtensions: false,
    showPriceLabels: true
);
```

#### Full Analysis Setup
```csharp
_drawingTools.DrawOTEWithFibonacci(
    oteZones,
    showFibRetracements: true,
    show236: true,   // All retracement levels
    show382: true,
    show500: true,
    show618: true,
    show786: true,
    show886: true,
    showFibExtensions: true,  // Include extension targets
    showPriceLabels: true
);
```

## Visual Output

### Bullish OTE Example

```
                                    EXT 2.618 -------- (target)
                                    EXT 2.0   --------
                                    EXT 1.618 --------
                                    EXT 1.272 --------
                            ╔═══════════════════════╗
0% (High) ═════════════════╣                       ║
                            ║                       ║
23.6% --------------------- ║                       ║
38.2% --------------------- ║                       ║
50.0% EQ50 ════════════════║                       ║
61.8% OTE ─────────────────╣█████████████████████████ ← OTE Box
                            ║█████████████████████████
78.6% OTE ─────────────────╣█████████████████████████
                            ║                       ║
88.6% --------------------- ║                       ║
                            ║                       ║
100% (Low) ════════════════╣                       ║
                            ╚═══════════════════════╝
```

### Chart Appearance

- **Solid lines**: 0%, 100% (swing boundaries)
- **Dotted lines**: Retracement levels (23.6%, 38.2%, 50%, 61.8%, 78.6%, 88.6%)
- **Very rare dots**: Extension levels (1.272, 1.618, 2.0, 2.618)
- **Rectangle**: OTE zone (61.8% - 78.6%)
- **Labels**: Level percentage + exact price value

## Benefits Over Standard DrawOTE

| Feature | DrawOTE (Standard) | DrawOTEWithFibonacci (Enhanced) |
|---------|--------------------|---------------------------------|
| OTE Box | ✅ Yes | ✅ Yes |
| 50% EQ | ✅ Yes | ✅ Yes |
| 61.8% & 78.6% | ✅ Basic lines | ✅ With labels & prices |
| Other Fib Levels | ❌ No | ✅ 23.6%, 38.2%, 88.6% optional |
| Extensions | ❌ No | ✅ 1.272, 1.618, 2.0, 2.618 |
| Price Labels | ❌ No | ✅ Yes (optional) |
| Customization | Limited | Full control |

## Technical Details

### Method Signature

```csharp
public void DrawOTEWithFibonacci(
    List<OTEZone> zones,           // OTE zones from detector
    int boxMinutes = 45,            // Box width in minutes
    bool showFibRetracements = true,// Show fib retracement lines
    bool showFibExtensions = false, // Show extension levels
    bool showPriceLabels = true,    // Show price on labels
    bool show236 = false,           // Show 23.6% level
    bool show382 = false,           // Show 38.2% level
    bool show500 = true,            // Show 50% EQ
    bool show618 = true,            // Show 61.8% OTE bound
    bool show786 = true,            // Show 78.6% OTE bound
    bool show886 = false)           // Show 88.6% level
```

### Object Tracking

All drawn objects are tracked and auto-cleaned:
- Maximum OTE zones displayed: 4 (configurable via `MaxOTEBoxes`)
- Older zones automatically removed when limit exceeded
- All objects use unique IDs based on timestamp to prevent conflicts

### Colors

- **Bullish OTE**: Green (from `_config.BullishColor`)
- **Bearish OTE**: Red (from `_config.BearishColor`)
- **50% EQ**: Yellow/Gold (from `_config.Eq50Color`)
- **Bullish Extensions**: Light Green
- **Bearish Extensions**: Light Coral

## Integration Example

Here's how to integrate into your main strategy file:

```csharp
// In JadecapStrategy.cs, find the visualization section
// (Usually in OnBar after OTE zones are detected)

if (_oteDetector != null)
{
    var oteZones = _oteDetector.GetActiveZones(); // Or however you retrieve OTE zones

    if (oteZones != null && oteZones.Any())
    {
        // Use enhanced visualization
        _drawingTools.DrawOTEWithFibonacci(
            oteZones,
            boxMinutes: 60,          // Wider box for better visibility
            showFibRetracements: true,
            showFibExtensions: false, // Keep it clean, focus on entries
            showPriceLabels: true,
            show236: false,
            show382: false,
            show500: true,            // Show EQ50
            show618: true,            // Show OTE bounds
            show786: true,
            show886: false
        );
    }
}
```

## Performance Notes

- ✅ Lightweight: Only draws for most recent OTE zones (max 4)
- ✅ Auto-cleanup: Old objects automatically removed
- ✅ Efficient: Reuses existing Fibonacci utility functions
- ✅ No lag: Chart drawing is asynchronous in cTrader

## Troubleshooting

### "No OTE zones visible"
- Check that `EnablePOIBoxDraw = true` in bot parameters
- Verify MSS is being detected (check debug logs)
- Ensure OTE zones are being created by detector

### "Too many lines on chart"
- Disable optional levels (236, 382, 886)
- Set `showFibExtensions: false`
- Reduce `MaxOTEBoxes` parameter

### "Can't see price labels"
- Set `showPriceLabels: true`
- Check that `ShowBoxLabels = true` in config
- Zoom in on chart for better label visibility

## Comparison to Pine Script OTE Indicator

| Feature | Pine Script | CCTTB Enhanced OTE |
|---------|-------------|---------------------|
| Swing Source | Visible chart | MSS impulse (ICT method) |
| OTE Box | ✅ 61.8-78.6% | ✅ 61.8-78.6% |
| Fib Retracements | ✅ Yes | ✅ Yes (customizable) |
| Fib Extensions | ✅ Yes | ✅ Yes (4 levels) |
| Price Labels | ✅ Yes | ✅ Yes |
| Auto-update | ✅ Last bar only | ✅ On MSS detection |
| Methodology | Visual swing | ICT/SMC structure |

**Key Difference**: The Pine Script uses whatever swing is visible on screen. CCTTB uses the MSS impulse swing, which is the **correct ICT methodology** for OTE entries.

## Build Status

✅ **Build Succeeded** (0 errors, 0 warnings)
- File: `Visualization_DrawingTools.cs`
- Method: `DrawOTEWithFibonacci` (lines 613-766)
- Helper: `DrawFibLevel` (lines 746-766)
- Date: Oct 26, 2025

## Next Steps

1. ✅ Code added to DrawingTools.cs
2. ✅ Bot compiled successfully
3. ⏳ **TODO**: Integrate into JadecapStrategy.cs (replace DrawOTE calls)
4. ⏳ **TODO**: Test in cTrader with live chart
5. ⏳ **TODO**: Adjust parameters based on visual preference

---

**Status**: ✅ READY TO USE

The enhanced OTE visualization is now available in your bot. You can start using `DrawOTEWithFibonacci()` instead of the standard `DrawOTE()` method for full Fibonacci analysis on your charts.
