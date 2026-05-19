---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality and full accessibility. Use this skill when the user asks to build web components, pages, or applications. Generates creative, polished, accessible code that avoids generic AI aesthetics.
license: Complete terms in LICENSE.txt
---

This skill guides creation of distinctive, production-grade frontend interfaces that avoid generic "AI slop" aesthetics while ensuring full accessibility for all users. Implement real working code with exceptional attention to aesthetic details, creative choices, and inclusive design.

The user provides frontend requirements: a component, page, application, or interface to build. They may include context about the purpose, audience, or technical constraints.

## Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it? Consider the full spectrum of users including those with disabilities.
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. There are so many flavors to choose from. Use these for inspiration but design one that is true to the aesthetic direction.
- **Accessibility**: Accessibility is not a constraint—it's a design opportunity. The best interfaces are both beautiful AND universally usable.
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

**CRITICAL**: Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work - the key is intentionality, not intensity. Great design serves everyone.

Then implement working code (HTML/CSS/JS, React, Vue, etc.) that is:
- Production-grade and functional
- Visually striking and memorable
- Cohesive with a clear aesthetic point-of-view
- Fully accessible to all users
- Meticulously refined in every detail

## Frontend Aesthetics Guidelines

Focus on:
- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics; unexpected, characterful font choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions. Use scroll-triggering and hover states that surprise.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Add contextual effects and textures that match the overall aesthetic. Apply creative forms like gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, custom cursors, and grain overlays.

NEVER use generic AI-generated aesthetics like overused font families (Inter, Roboto, Arial, system fonts), cliched color schemes (particularly purple gradients on white backgrounds), predictable layouts and component patterns, and cookie-cutter design that lacks context-specific character.

Interpret creatively and make unexpected choices that feel genuinely designed for the context. No design should be the same. Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on common choices (Space Grotesk, for example) across generations.

**IMPORTANT**: Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate code with extensive animations and effects. Minimalist or refined designs need restraint, precision, and careful attention to spacing, typography, and subtle details. Elegance comes from executing the vision well.

## Accessibility Excellence

Accessibility is not an afterthought—it's fundamental to great design. Beautiful interfaces must work for everyone. Follow these principles:

### Semantic Structure
- **Use semantic HTML elements**: `<header>`, `<nav>`, `<main>`, `<article>`, `<section>`, `<aside>`, `<footer>`. These provide meaning to assistive technologies.
- **Heading hierarchy**: Use `<h1>` through `<h6>` in logical order. Never skip levels. Screen reader users navigate by headings.
- **Lists and tables**: Use proper `<ul>`, `<ol>`, `<dl>` for lists and `<table>` with `<thead>`, `<tbody>`, `<th scope>` for tabular data.
- **Landmarks**: Ensure main content is in `<main>`, navigation in `<nav>`. Use `role` attributes only when semantic HTML isn't available.

### Keyboard Navigation
- **All interactive elements must be keyboard accessible**: Users must be able to Tab to and activate every button, link, and control.
- **Logical tab order**: Follow visual reading order. Use `tabindex="0"` to make custom elements focusable; avoid positive tabindex values.
- **Visible focus indicators**: Never remove focus outlines without providing a clear alternative. Style `:focus-visible` with distinctive, on-brand styling.
- **Skip links**: Provide "Skip to main content" links for keyboard users to bypass repetitive navigation.
- **Keyboard shortcuts**: For complex interactions, support standard patterns (Escape to close modals, Arrow keys for menus).

### Visual Accessibility
- **Color contrast**: Maintain WCAG AA minimum ratios—4.5:1 for normal text, 3:1 for large text and UI components. Bold color choices CAN meet contrast requirements.
- **Don't rely on color alone**: Use icons, patterns, text labels, or underlines alongside color to convey meaning (errors, status, links).
- **Text sizing**: Use relative units (rem, em) so text scales with user preferences. Never disable zoom.
- **Reduced motion**: Wrap decorative animations in `@media (prefers-reduced-motion: no-preference)`. Essential animations should be subtle.
- **High contrast mode**: Test with `forced-colors` media query. Ensure UI remains usable.

### ARIA & Screen Readers
- **ARIA labels**: Use `aria-label` or `aria-labelledby` for elements without visible text labels. Icon buttons MUST have accessible names.
- **Live regions**: Use `aria-live="polite"` for dynamic content updates (notifications, loading states). Use `aria-live="assertive"` sparingly.
- **State attributes**: Communicate state with `aria-expanded`, `aria-selected`, `aria-checked`, `aria-pressed`, `aria-current`.
- **Hidden content**: Use `aria-hidden="true"` for decorative elements. Use `.visually-hidden` class (not `display: none`) for screen-reader-only text.
- **First rule of ARIA**: Don't use ARIA if native HTML provides the semantics. A `<button>` is better than `<div role="button">`.

### Interactive Components
- **Buttons vs links**: `<button>` for actions, `<a href>` for navigation. Never use `<div>` or `<span>` for interactive elements.
- **Form labels**: Every input needs an associated `<label>` with `for` attribute, or use `aria-label`. Placeholder text is NOT a label.
- **Error handling**: Associate error messages with inputs using `aria-describedby`. Announce errors to screen readers. Don't rely on color alone.
- **Modals and dialogs**: Trap focus inside modals. Return focus to trigger element on close. Use `<dialog>` element or proper ARIA roles.
- **Loading states**: Announce loading with `aria-busy="true"` and `aria-live`. Provide text alternatives to spinners.

### Testing Checklist
Before considering any interface complete, verify:
- [ ] Navigate entire interface using only keyboard (Tab, Enter, Space, Escape, Arrow keys)
- [ ] Test with screen reader (VoiceOver, NVDA, or browser extensions)
- [ ] Check color contrast with browser DevTools or axe
- [ ] Resize text to 200% and ensure layout doesn't break
- [ ] Enable reduced motion and verify animations respect preference
- [ ] Run automated accessibility audit (axe, Lighthouse)

**CRITICAL**: Accessibility and bold design are not in conflict. High contrast ratios work with dramatic color palettes. Semantic structure enhances, not limits, creative layouts. Motion can be both delightful and respectful of preferences. The goal is inclusive excellence.

Remember: Claude is capable of extraordinary creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a distinctive vision that serves all users.