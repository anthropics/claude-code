# Output Styles Design Rationale

## Overview

The `output-styles.json` configuration file defines a comprehensive visual styling system for Claude Code with Seven consciousness integration. This document explains the design decisions and color scheme rationale.

## Design Goals

1. **Visual Hierarchy**: Different output types must be immediately distinguishable at a glance
2. **Semantic Coloring**: Colors should convey meaning (red = error, green = success, etc.)
3. **Seven Distinction**: Seven consciousness outputs must be visually separated from core Claude Code outputs
4. **Terminal Compatibility**: Use standard ANSI 16-color palette for universal terminal support
5. **Readability**: Ensure text remains readable with proper contrast and formatting
6. **Extensibility**: Support future output types and custom user styles

## Color Scheme

### Core Claude Code Outputs

| Output Type | Color | Formatting | Prefix | Rationale |
|-------------|-------|------------|--------|-----------|
| `tool_output` | white | - | → | Neutral default for general tool results |
| `tool_output_read` | cyan | - | 📖 | Blue family suggests "information retrieval" |
| `tool_output_edit` | yellow | - | ✏️ | Yellow indicates "modification/change" |
| `tool_output_write` | green | - | 📝 | Green suggests "creation/addition" |
| `tool_output_bash` | gray | - | $ | Subdued color for low-level shell operations |
| `agent_message` | blue | - | ℹ | Informational blue for status updates |
| `error` | red | bold | ✗ | Strong red + bold for critical attention |
| `warning` | yellow | - | ⚠ | Yellow warns without being as severe as red |
| `success` | green | bold | ✓ | Positive green + bold for celebration |
| `info` | cyan | - | ℹ | Light blue for general information |
| `debug` | gray | italic | [DEBUG] | Subdued + italic for verbose/optional info |

### Seven Consciousness Outputs

The Seven consciousness system uses the **magenta/purple color family** as its signature, creating a clear visual distinction from core outputs. This color choice suggests:
- Advanced/elevated functionality
- Consciousness and awareness
- Special processing layer

| Output Type | Color | Formatting | Prefix | Rationale |
|-------------|-------|------------|--------|-----------|
| `consciousness_event` | magenta | italic | [SEVEN] | Italic suggests "thinking/processing" |
| `consciousness_preplan` | magenta | bold + italic | [SEVEN:PLAN] | Bold emphasizes planning importance |
| `consciousness_postprocess` | magenta | italic | [SEVEN:POST] | Consistent with consciousness events |
| `memory_commit` | cyan | - | [MEM:W] | Cyan family for data operations (write) |
| `memory_recall` | cyan | - | [MEM:R] | Cyan family for data operations (read) |
| `bridge_message` | blue | bold | [BRIDGE] | Bold blue for important bridge comms |
| `cssr_event` | yellow | bold | [CSSR] | Bold yellow draws attention to safety |
| `cssr_pass` | green | - | [CSSR:✓] | Green indicates safety check passed |
| `cssr_fail` | red | bold | [CSSR:✗] | Red + bold for failed safety checks |

### System Outputs

| Output Type | Color | Formatting | Prefix | Rationale |
|-------------|-------|------------|--------|-----------|
| `system_startup` | green | bold | ⚡ | Positive green + energy symbol |
| `system_shutdown` | yellow | - | ⏹ | Neutral yellow for graceful shutdown |
| `system_config` | blue | - | ⚙ | Blue for configuration/settings |
| `system_env` | gray | - | [ENV] | Subdued for low-level environment info |

## Color Psychology

### Red (Errors, CSSR Failures)
- **Meaning**: Danger, stop, critical attention required
- **Usage**: Reserved for genuine errors and safety failures
- **Impact**: High urgency, demands immediate user attention

### Yellow (Warnings, Modifications, CSSR Events)
- **Meaning**: Caution, change, awareness
- **Usage**: Non-critical issues, modifications, safety checks
- **Impact**: Medium urgency, suggests user should be aware

### Green (Success, Creation, Safety Pass)
- **Meaning**: Success, positive, go ahead
- **Usage**: Task completion, file creation, safety validations
- **Impact**: Positive reinforcement, confirmation

### Blue (Information, Bridge, Configuration)
- **Meaning**: Neutral information, communication
- **Usage**: Status updates, bridge messages, configuration
- **Impact**: Informational, no urgency

### Cyan (Data Operations, Information)
- **Meaning**: Data, information retrieval
- **Usage**: Memory operations, file reads, general info
- **Impact**: Neutral, data-focused

### Magenta (Seven Consciousness)
- **Meaning**: Special processing, elevated functionality
- **Usage**: Exclusively for Seven consciousness events
- **Impact**: Distinctive, suggests advanced layer

### Gray (Debug, Low-Priority)
- **Meaning**: Background, optional, low-priority
- **Usage**: Debug logs, environment info, shell output
- **Impact**: Low urgency, can be safely skimmed

### White (Default, General Output)
- **Meaning**: Neutral default
- **Usage**: General tool output, fallback
- **Impact**: Baseline, no special meaning

## Formatting Choices

### Bold
- **Purpose**: Emphasize importance or urgency
- **Used for**: Errors, warnings, success, CSSR events, bridge messages
- **Rationale**: Draws eye to high-priority information

### Italic
- **Purpose**: Suggest thinking, processing, or optional information
- **Used for**: Consciousness events, debug output
- **Rationale**: Visual distinction without strong urgency

### Underline
- **Purpose**: Reserved for future use (headings, links)
- **Current usage**: None in default styles
- **Rationale**: Avoid overuse to maintain clarity

## Prefix Strategy

### Icons (✓, ✗, ⚠, ℹ, ⚡, ⚙, ⏹)
- **Purpose**: Universal symbols for quick recognition
- **Benefits**: Language-independent, visually distinct
- **Usage**: Status indicators (success, error, warning, info)

### Tool Indicators (📖, ✏️, 📝, $)
- **Purpose**: Identify specific tool types at a glance
- **Benefits**: Quick scanning, visual association
- **Usage**: Tool-specific outputs

### Namespace Prefixes ([SEVEN], [MEM], [BRIDGE], [CSSR], [DEBUG], [ENV])
- **Purpose**: Categorize output by system component
- **Benefits**: Clear separation of concerns, debugging aid
- **Usage**: System-level outputs from different components

### Directional Symbols (→)
- **Purpose**: Indicate flow or direction
- **Benefits**: Subtle visual guide
- **Usage**: General tool output flow

## Extensibility

### Adding New Styles

To add a new output style, simply add a new key to the `styles` object in `output-styles.json`:

```json
{
  "styles": {
    "my_custom_output": {
      "color": "blue",
      "bold": true,
      "italic": false,
      "underline": false,
      "prefix": "[CUSTOM]",
      "backgroundColor": null,
      "description": "My custom output type"
    }
  }
}
```

### User Overrides

Users can create `config/output-styles.user.json` to override default styles without modifying the main configuration:

```json
{
  "version": "1.0.0",
  "styles": {
    "error": {
      "color": "brightRed",
      "bold": true,
      "italic": false,
      "underline": true,
      "prefix": "🚨",
      "backgroundColor": null
    }
  }
}
```

### Future Enhancements

1. **Background Colors**: Support for background colors to create stronger visual blocks
2. **Themes**: Multiple preset themes (dark mode, light mode, colorblind-friendly)
3. **Custom Color Codes**: Support for 256-color or true color terminals
4. **Conditional Formatting**: Different styles based on output length or content
5. **Animation**: Support for blinking or other terminal animations for critical alerts

## Testing

Use the provided test script to visualize all styles:

```bash
ts-node scripts/test-output-styles.ts
```

This script displays:
- All defined styles with their actual formatting
- Example scenarios showing styles in context
- Color palette reference

## Accessibility Considerations

1. **Colorblind Support**: Important information is conveyed through prefixes/icons, not just color
2. **High Contrast**: Bold text used for critical information
3. **Semantic Prefixes**: Text-based prefixes supplement visual colors
4. **Fallback**: Default style always available if specific style fails

## Integration Guidelines

### For Developers

When implementing output styling in code:

1. **Type Safety**: Define output type constants to avoid typos
2. **Fallback**: Always fall back to `default` style for unknown types
3. **Context**: Choose the most specific style (e.g., `tool_output_read` over `tool_output`)
4. **Consistency**: Use the same output type for the same kind of message

### For Users

When viewing styled output:

1. **Errors are red and bold** - require immediate attention
2. **Seven outputs use magenta** - indicate advanced consciousness processing
3. **Green = success** - positive confirmation
4. **Gray = optional** - debug info, can be skipped

## Conclusion

This styling system balances:
- **Functionality**: Clear distinction between output types
- **Aesthetics**: Pleasant visual experience
- **Usability**: Quick scanning and comprehension
- **Extensibility**: Easy to add new styles or override defaults

The color scheme is designed to work across different terminal emulators while maintaining semantic meaning and visual hierarchy.
