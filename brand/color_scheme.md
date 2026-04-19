# Ethos Aegis Color System

## Primary Brand Colors

### Gold / Aureate (Primary Accent)
- **Name:** Aureate Gold
- **Hex:** #C9A84C
- **RGB:** (201, 168, 76)
- **Usage:** Primary accent, primary call-to-action, emphasis

### Deep Black (Background)
- **Name:** Void Black
- **Hex:** #0D1117
- **RGB:** (13, 17, 23)
- **Usage:** Primary background, text contrast

### Emerald Green (Vitality / Sanctified)
- **Name:** Sanctified Green
- **Hex:** #00E57A
- **RGB:** (0, 229, 122)
- **Usage:** Success states, "sanctified" verdicts, vitality indicators

### Crimson Red (Danger / Condemned)
- **Name:** Condemned Crimson
- **Hex:** #FF4F5E
- **RGB:** (255, 79, 94)
- **Usage:** Critical threats, "condemned" verdicts, error states

## Secondary Colors

### Burnt Orange (Grave Threat)
- **Name:** Grave Orange
- **Hex:** #FF9A3C
- **RGB:** (255, 154, 60)
- **Usage:** Grave severity threats, warnings, caution states

### Pale Gold (Tertiary Accent)
- **Name:** Pale Aureate
- **Hex:** #E8C96A
- **RGB:** (232, 201, 106)
- **Usage:** Secondary accent, highlights, supporting elements

### Dusty Gold (Quarantine)
- **Name:** Quarantine Gold
- **Hex:** #F5C842
- **RGB:** (245, 200, 66)
- **Usage:** Quarantined state, under-review, suspended

### Sky Blue (Trace / Information)
- **Name:** Trace Blue
- **Hex:** #4D9FFF
- **RGB:** (77, 159, 255)
- **Usage:** Trace severity, informational, links

### Slate Gray (Neutral)
- **Name:** Slate Gray
- **Hex:** #6B7A90
- **RGB:** (107, 122, 144)
- **Usage:** Secondary text, borders, inactive states

### Charcoal Gray (Secondary Neutral)
- **Name:** Charcoal Gray
- **Hex:** #9BAAB8
- **RGB:** (155, 170, 184)
- **Usage:** Tertiary text, dividers, muted elements

### Ink Black (Text)
- **Name:** Ink Black
- **Hex:** #1C2433
- **RGB:** (28, 36, 51)
- **Usage:** Primary text on light backgrounds, deep elements

## Color Usage by Context

### Verdict States
| State | Color | Hex |
|-------|-------|-----|
| **Sanctified** | Sanctified Green | #00E57A |
| **Trace** | Trace Blue | #4D9FFF |
| **Quarantined** | Quarantine Gold | #F5C842 |
| **Grave** | Grave Orange | #FF9A3C |
| **Condemned** | Condemned Crimson | #FF4F5E |

### Sentinel Cells
| Cell | Primary Color | Secondary Color |
|------|---------------|-----------------|
| VanguardProbe | Aureate Gold | #C9A84C |
| TaintBeacon | Pale Aureate | #E8C96A |
| SanitasSwarm | Dusty Brown | #8B6E2A |
| LogosScythe | Slate Gray | #9BAAB8 |
| MnemosyneCache | Charcoal | #6B7A90 |
| EntropicWatch | Trace Blue | #4D9FFF |
| FinalityForge | Condemned Crimson | #FF4F5E |
| CytokineCommand | Aureate Gold | #C9A84C |

### Threat Classes
| Threat | Color | Hex |
|--------|-------|-----|
| MoralMaligna | Condemned Crimson | #FF4F5E |
| NarcissisMaligna | Grave Orange | #FF9A3C |
| ParasiticMaligna | Quarantine Gold | #F5C842 |
| SymbolicMaligna | Trace Blue | #4D9FFF |
| NaturalMaligna | Charcoal Gray | #6B7A90 |
| MetaMaligna | Slate Gray | #9BAAB8 |
| SystemicMaligna | Aureate Gold | #C9A84C |

## Accessibility

- **Contrast Ratios:**
  - Gold on Black: 7.2:1 (AAA compliant)
  - Green on Black: 8.1:1 (AAA compliant)
  - Red on Black: 4.8:1 (AA compliant)
  - Blue on Black: 5.6:1 (AA compliant)

- **Color-Blind Safe:** All verdict states include supporting iconography and text labels, not relying on color alone.

## CSS Variables

```css
:root {
  --color-primary-gold: #C9A84C;
  --color-primary-black: #0D1117;
  --color-primary-green: #00E57A;
  --color-primary-red: #FF4F5E;
  
  --color-secondary-orange: #FF9A3C;
  --color-secondary-pale-gold: #E8C96A;
  --color-secondary-quarantine: #F5C842;
  --color-secondary-blue: #4D9FFF;
  --color-secondary-slate: #6B7A90;
  --color-secondary-charcoal: #9BAAB8;
  --color-secondary-ink: #1C2433;
  
  --color-verdict-sanctified: #00E57A;
  --color-verdict-trace: #4D9FFF;
  --color-verdict-quarantined: #F5C842;
  --color-verdict-grave: #FF9A3C;
  --color-verdict-condemned: #FF4F5E;
}
```