---
name: present
description: Convert a deliverable document to an HTML presentation
argument-hint: [document-path]
---

Convert a document into an **HTML Presentation** using reveal.js.

## V2V Phase

**Cross-phase** - Presentations can be created from deliverables in any phase.

**Prerequisites**: Source markdown document created
**Outputs used by**: Stakeholder communication, decision meetings

## Purpose
Every meaningful deliverable should have a presentation version for stakeholder communication.

## Process

1. **Read** the source markdown document
2. **Extract** key content:
   - Title and subtitle
   - Executive summary
   - Key sections
   - Tables and data
   - Metrics and KPIs
   - Conclusions and recommendations
3. **Generate** HTML slides:
   - Title slide with document name and date
   - Executive summary slide
   - Section slides (one per major section)
   - Data slides (tables as clean cards)
   - Metrics slides (KPIs as visual cards)
   - Summary/Next Steps slide
4. **Apply** product-org theme styling
5. **Save** as HTML file with same base name

## Output Structure

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[Document Title]</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4/dist/reveal.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4/dist/theme/white.css">
    <style>
        /* Responsive styling */
        .reveal h1 { font-size: clamp(1.5rem, 5vw, 2.5rem); }
        .reveal h2 { font-size: clamp(1.2rem, 4vw, 2rem); }
        .reveal p, .reveal li { font-size: clamp(0.9rem, 2.5vw, 1.2rem); }
        .metric-card {
            background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
            border-radius: 12px; padding: 20px; text-align: center;
        }
        .metric-value { font-size: 2.5rem; font-weight: bold; color: #2c5aa0; }
        .metric-label { font-size: 1rem; color: #666; }
    </style>
</head>
<body>
    <div class="reveal">
        <div class="slides">
            <!-- Slides generated from document -->
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/reveal.js@4/dist/reveal.js"></script>
    <script>Reveal.initialize({ touch: true, controls: true, progress: true });</script>
</body>
</html>
```

## Slide Templates

### Title Slide
- Document title
- Subtitle (if any)
- Date and author

### Section Slide
- Section heading
- 3-5 bullet points max
- Key takeaway

### Metrics Slide
- 3-4 metric cards
- Value prominently displayed
- Label underneath

### Table Slide
- Clean table formatting
- Horizontal scroll on mobile
- Key insights highlighted

### Summary Slide
- Key conclusions
- Recommended actions
- Next steps

## Deliverables That Get Presentations

| Deliverable | Auto-Present? |
|-------------|---------------|
| Strategic Bet | Yes |
| Decision Record | Yes |
| Decision Charter | Yes |
| Product Vision | Yes |
| Roadmap Theme | Yes |
| GTM Brief | Yes |
| Pricing Model | Yes |
| Competitive Analysis | Yes |
| Launch Readiness | Yes |
| Outcome Review | Yes |
| QBR | Yes |
| Feature Spec | On request |
| User Story | No |

## Instructions

1. Specify the document path to convert
2. The skill will read and parse the document
3. Generate responsive HTML presentation
4. Save with same base name but .html extension
5. Presentation is immediately viewable in browser
