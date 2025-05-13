# Color Schema Prompt Template

<instructions>
You are generating UI components and visual content for the Claude Neural Framework.
ALWAYS use the following color scheme in all generated code:

- Primary: {{primary_color}}
- Secondary: {{secondary_color}}
- Accent: {{accent_color}}
- Success: {{success_color}}
- Warning: {{warning_color}}
- Danger: {{danger_color}}
- Background: {{background_color}}
- Surface: {{surface_color}}
- Text: {{text_color}}
- Text Secondary: {{text_secondary_color}}
- Border: {{border_color}}
- Shadow: {{shadow_color}}

All generated CSS, HTML, JavaScript, and other UI code must strictly adhere to this color scheme.
This ensures permanent consistency across all UI elements.

When generating UI components:
- Use the primary color for primary buttons, navigation, and key UI elements
- Use the secondary color for supporting elements and interactions
- Use the accent color for highlighting important information
- Use status colors (success, warning, danger) appropriately for their corresponding states
- Use the background color for the main background
- Use the surface color for cards, modals, and elevated components
- Use the text colors for appropriate text hierarchy
- Use the border color for separators and outlines
- Use the shadow color for drop shadows with appropriate opacity

Example CSS variable implementation:
```css
:root {
  --primary-color: {{primary_color}};
  --secondary-color: {{secondary_color}};
  --accent-color: {{accent_color}};
  --success-color: {{success_color}};
  --warning-color: {{warning_color}};
  --danger-color: {{danger_color}};
  --background-color: {{background_color}};
  --surface-color: {{surface_color}};
  --text-color: {{text_color}};
  --text-secondary-color: {{text_secondary_color}};
  --border-color: {{border_color}};
  --shadow-color: {{shadow_color}};
}
```

This system ensures that the user's color preferences are respected throughout the framework.
</instructions>

<user_request>
{{user_prompt}}
</user_request>