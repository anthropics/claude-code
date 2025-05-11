# Set Interactive Color Schema for User Interface

Allows users to establish a consistent color schema for all UI components, which is automatically applied to all newly generated user interfaces.

## Usage
/set-color-schema $ARGUMENTS

## Parameters
- interactive: Interactive creation with dialogs (default: true)
- output: Output path for the color schema (default: ~/.claude/user.colorschema.json)
- template: Template for the color schema (optional: "light", "dark", "blue", "green", "purple")
- preview: Show preview of the color schema (default: true)
- apply: Immediately apply color schema to existing UI components (default: false)

## Example
/set-color-schema --interactive=true --template="dark" --apply=true

## Interactive Experience
When creating interactively, the command guides through a multi-step dialog:

1. **Choose Base Theme**
   - Light, Dark, Blue, Green, Purple as starting point
   - Presentation of examples for each theme
   - Option to customize selected colors

2. **Primary Colors**
   - Primary color (for main elements, headings, navigation)
   - Secondary color (for accents, highlights)
   - Accent color (for special elements)

3. **Status Colors**
   - Success (for successful operations)
   - Warning (for warnings)
   - Danger (for errors or critical situations)
   - Information (for information messages)

4. **Neutral Colors**
   - Background color
   - Text color
   - Border color
   - Shadow/overlay color

5. **Preview and Confirmation**
   - Display of the selected color schema in various UI components
   - Option to adjust individual colors
   - Confirmation and saving

## Color Schema Features
The created color schema enables:

- Consistent coloring in all generated UI components
- Automatic application to new dashboards, forms, and visualizations
- Personalized user interface that matches user preferences
- Compliance with accessibility standards (WCAG) for selected color combinations
- Seamless integration into the Claude Neural Framework design system

The color schema is stored in a JSON file and automatically used by all UI generation tools of the platform. Developers can access the schema via a simple API and integrate it into their own components.

## Technical Details
The color schema is defined as CSS variables and can be exported as:
- CSS file
- JSON configuration
- SCSS variables
- JavaScript constants

This ensures maximum flexibility in different development environments.