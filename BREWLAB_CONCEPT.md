# BrewLab — Specialty Coffee Brewing App Concept

## Context

Specialty coffee has grown from a niche hobby into a mainstream movement, yet most coffee apps are either too simplistic (just timers) or too intimidating (dense data with no guidance). There's a gap for an app that meets users where they are — helping beginners brew better coffee immediately while giving enthusiasts the precision tools and data they crave. BrewLab fills that gap by combining guided brewing, recipe management, brew logging, and personalized recommendations into a single, elegant mobile experience.

---

## 1. Target Users

### Primary: The Aspiring Home Barista
- Owns a pour-over dripper or AeroPress, maybe a hand grinder
- Watches YouTube coffee content, follows creators like James Hoffmann
- Wants to improve but feels overwhelmed by variables (grind size, ratio, water temp)
- Willing to invest time but needs clear guidance

### Secondary: The Seasoned Enthusiast
- Owns multiple brew devices, a quality grinder, and a scale
- Dials in espresso shots regularly, experiments with recipes
- Wants to log brews, track what works, and refine over time
- Values data, precision, and the ability to share/import recipes

### Tertiary: The Curious Beginner
- Just bought their first french press or moka pot
- Doesn't know ratios, grind sizes, or water temperatures
- Wants a "just tell me what to do" experience
- May graduate into the aspiring barista segment

---

## 2. User Pain Points

| Pain Point | Description |
|---|---|
| **Too many variables** | Grind size, dose, water temp, ratio, brew time, agitation — beginners don't know what matters most |
| **No memory** | Users forget what they did last time when a brew tasted great |
| **Recipes are scattered** | Saved in screenshots, notes apps, Reddit posts, YouTube comments |
| **Timers are dumb** | Generic timers don't guide pour stages or step-by-step technique |
| **No feedback loop** | No way to correlate changes (finer grind, higher temp) with taste outcomes |
| **Device-specific knowledge gaps** | Each brew method has its own best practices, and most resources assume you already know them |
| **Grinder calibration confusion** | "Setting 15" means nothing across different grinders |

---

## 3. Core Features

### 3.1 Guided Brewing (Step-by-Step)
- Select a brew method → choose a recipe → follow real-time guided steps
- Each step shows: what to do, a countdown timer, target weight (if using a scale), and a short tip
- Visual pour-rate indicator for pour-over methods (pace guidance)
- Audio/haptic cues for step transitions so users don't have to stare at the screen
- "Quick Brew" mode: skip guidance, just run the timer with phase markers

### 3.2 Recipe Library
- **Built-in starter recipes** for every supported method, curated by coffee professionals
- **Community recipes** — browse, save, and rate recipes shared by other users
- **Custom recipes** — create from scratch or fork an existing recipe and modify it
- Recipe fields: method, dose, water amount, ratio, grind size (descriptive + numeric), water temp, total brew time, step-by-step instructions, tasting notes, tags
- Import/export recipes via shareable links or QR codes

### 3.3 Brew Log & History
- After each guided brew, prompt user to rate and add tasting notes
- Log captures: date, recipe used, grind setting, actual brew time, ratio, user rating (1-5 stars), flavor tags, free-text notes, photo (optional)
- Filterable/searchable history by method, bean, rating, date range
- "Best Brews" — surface top-rated brews for quick repeat

### 3.4 Smart Tools
- **Ratio Calculator** — input any one of dose/water/ratio and auto-calculate the others. Supports g, oz, ml
- **Brew Timer** — standalone timer with lap/phase functionality for unguided brewing
- **Grind Tracker** — log grinder model + setting per brew, build a personal reference chart mapping grinder settings to brew methods and taste outcomes
- **Water Temperature Guide** — recommendations by method and roast level
- **Extraction Compass** — after tasting, select flavor descriptors (sour, bitter, watery, balanced) and receive a plain-language suggestion ("try grinding 1-2 clicks finer" or "lower your water temperature by 3-5 degrees")

### 3.5 Coffee Bean Vault
- Log beans: roaster, origin, process, roast date, roast level, flavor notes from bag
- Track freshness (days off roast) with a visual indicator
- Link beans to brew log entries to see which recipes work best with which beans
- Barcode/QR scan to auto-populate bean info (where available)

### 3.6 Personalized Recommendations
- After 5+ logged brews, the app begins suggesting adjustments based on patterns
- "You rated light roasts higher with V60 — try this Nordic-style recipe"
- "Your last 3 AeroPress brews were rated low — consider a coarser grind"
- Weekly "Brew of the Week" suggestion based on user's bean vault and preferences

---

## 4. Supported Brew Methods

| Method | Key Parameters | Guided Steps |
|---|---|---|
| **Espresso** | Dose, yield, time, pressure profile | Pre-infusion → extraction → target yield |
| **Pour-Over (V60, Kalita, Chemex)** | Dose, water, ratio, pour stages, bloom | Bloom → staged pours with timing |
| **AeroPress** | Standard / inverted, steep time, pressure | Add water → steep → press |
| **French Press** | Dose, water, steep time, plunge | Add water → steep → break crust → plunge |
| **Moka Pot** | Dose, grind, heat level | Fill → heat → monitor → remove |
| **Cold Brew** | Ratio, steep duration (12-24h), filtration | Mix → refrigerate (with reminder notification) → filter |

---

## 5. App Flow & Main Screens

### 5.1 Information Architecture

```
Tab Bar (4 tabs)
├── Brew (home)
│   ├── Quick Start — pick method, pick recipe, go
│   ├── Active Brew Session — step-by-step guided timer
│   └── Post-Brew Rating — log taste, notes, photo
├── Recipes
│   ├── My Recipes — saved and custom
│   ├── Explore — community + curated recipes
│   └── Recipe Detail — full recipe with brew button
├── Journal
│   ├── Brew History — chronological log
│   ├── Bean Vault — coffee inventory
│   ├── Stats — brewing trends and insights
│   └── Brew Detail — single brew entry with all data
└── Tools
    ├── Ratio Calculator
    ├── Extraction Compass
    ├── Grind Reference
    └── Water Temp Guide
```

### 5.2 Key Screen Descriptions

**Home / Brew Tab**
- Hero card: "Continue where you left off" or "Start a Brew"
- Method selector: horizontal scroll of brew method icons (V60, AeroPress, etc.)
- Below: recent brews (quick-repeat), suggested recipe of the day
- One-tap access to start a guided brew

**Active Brew Session**
- Full-screen focused UI — minimal distractions
- Large circular timer as the centerpiece
- Current step instruction in large text ("Pour 60g in slow circles")
- Progress bar showing all steps, current step highlighted
- Target vs. actual weight display (for scale-connected or manual entry)
- Pause / skip step / abandon brew controls
- Dark mode auto-activates during brew for reduced distraction

**Post-Brew Log**
- Star rating (1-5)
- Flavor wheel tap selector: fruity, floral, nutty, chocolatey, spicy, sweet, sour, bitter
- Quick tags: "too bitter," "too sour," "just right," "watery," "strong"
- Optional: free-text notes, photo
- Auto-populated fields: recipe, method, grind setting, ratio, brew time

**Recipe Detail**
- Clean card layout: method icon, name, author, rating
- At-a-glance stats: ratio, dose, water, brew time, grind size, temp
- Step-by-step breakdown (expandable)
- "Brew This" primary CTA button
- "Fork Recipe" to create a personal variation
- User reviews/ratings from community

**Journal / Brew History**
- Card-per-brew layout, chronological
- Each card: date, method icon, bean name, rating stars, key stats
- Filter bar: by method, bean, rating, date range
- Tap to expand full brew detail

**Stats Dashboard**
- Brews this week/month (bar chart)
- Average rating trend over time (line chart)
- Most-used method (donut chart)
- Flavor profile radar chart (aggregate of tasting notes)
- "Personal bests" — highest-rated brew per method

**Ratio Calculator**
- Three linked input fields: dose, water, ratio
- Change one, others update live
- Unit toggle: grams / ounces / ml
- Quick presets: 1:15, 1:16, 1:17 for filter; 1:2, 1:2.5 for espresso

**Extraction Compass**
- "How did it taste?" — select from: sour, bitter, astringent, watery, balanced, sweet
- Returns a plain-language adjustment: "Your coffee is likely under-extracted. Try grinding 1-2 steps finer or increasing brew time by 15 seconds."
- Optional: link to current brew log entry

---

## 6. UI Direction & Visual Design

### Design Principles
1. **Calm precision** — the app should feel like a well-designed kitchen tool, not a social media platform
2. **Progressive disclosure** — show beginners only what they need; let enthusiasts dig deeper
3. **Warmth with restraint** — warm neutrals and natural tones, not cold tech aesthetics

### Color Palette
- **Background**: Warm off-white (`#FAF7F2`) for light mode; deep espresso brown (`#1C1612`) for dark mode
- **Primary accent**: Rich amber (`#C47D2A`) — evokes fresh crema
- **Secondary accent**: Deep teal (`#2A6B5E`) — for interactive elements and contrast
- **Text**: Charcoal (`#2D2926`) on light; warm cream (`#F0EAE0`) on dark
- **Subtle surfaces**: Light linen (`#F0EBE3`) for cards; dark roast (`#2A2420`) for dark mode cards
- **Semantic colors**: Soft green for "balanced/good," warm red for "off/bitter," amber for "sour/under"

### Typography
- **Headlines**: A geometric sans-serif (e.g., DM Sans or Plus Jakarta Sans) — modern, clean, legible
- **Body**: Same family at lighter weights for a cohesive, uncluttered feel
- **Timer/Numbers**: Monospace or tabular numerals for the brew timer — precise and functional (e.g., JetBrains Mono or SF Mono)

### Iconography
- Custom line icons for brew methods — simple, recognizable silhouettes (V60 cone, AeroPress cylinder, French press, moka pot, etc.)
- Consistent 2px stroke weight, rounded caps
- Icons feel hand-drawn but precise — approachable yet professional

### Key UI Patterns
- **Cards with subtle shadows** — brew entries, recipes, and beans presented as tactile cards
- **Bottom sheet modals** — for quick actions (add tasting note, adjust grind, rate brew)
- **Micro-animations** — water ripple effect on timer start, steam animation on brew complete, subtle pour animation during guided steps
- **Haptic feedback** — gentle taps on step transitions, a satisfying pulse on brew completion
- **Minimal chrome** — no unnecessary borders or dividers; spacing and typography create hierarchy

### Brew Session UI (Special Attention)
- The brew session is the hero experience
- Full-bleed dark background during active brew (reduces distraction, feels focused)
- Large, high-contrast timer numbers (48pt+) visible from arm's length
- Step instructions large enough to read while hands are busy
- Circular progress ring around timer shows phase completion
- Ambient: subtle warm glow animation around timer ring as brew progresses

---

## 7. Monetization Model (Suggested)

| Tier | Price | Includes |
|---|---|---|
| **Free** | $0 | 3 brew methods, 10 built-in recipes, basic timer, 30-day brew history |
| **BrewLab Pro** | $4.99/mo or $39.99/yr | All methods, unlimited recipes, full history, stats dashboard, extraction compass, grind tracker, community access, bean vault |
| **One-time Unlock** | $79.99 | Lifetime Pro access (appeals to the "buy it for life" coffee crowd) |

---

## 8. Differentiators

- **Extraction Compass**: No other mainstream coffee app offers real-time taste-based correction guidance in plain language
- **Grind Tracker**: Maps personal grinder settings to outcomes — solves a universal pain point
- **Fork & Iterate**: Recipes are living documents users refine over time, not static instructions
- **Progressive complexity**: A beginner and an expert use the same app but see different levels of depth
- **Bean-to-brew connection**: Linking beans to brews creates a personal knowledge base that improves every cup
