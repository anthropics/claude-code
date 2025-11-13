# Feature Request: Animation Control Settings

## Problem Statement

Claude Code uses animated UI elements in the terminal, including:
- Spinning star characters (✢, ✳, ✶, ✻, ✽) that rotate during operations
- Blinking indicators and loading animations
- Dynamic status updates with visual feedback

These animations enhance the user experience for most users, but cause significant flickering issues on smaller terminals or when terminal window size is constrained. The rapid screen updates required for animations can make the interface difficult to read and cause eye strain for users with:
- Small terminal windows
- Low-refresh displays
- Accessibility needs (motion sensitivity)
- Remote/SSH connections with limited bandwidth
- Terminal emulators with slower rendering

## Proposed Solution

Add animation control settings to allow users to disable animations while maintaining full functionality.

### Settings Configuration

Add a new `disableAnimations` setting in `.claude/settings.json`:

```json
{
  "disableAnimations": false
}
```

When set to `true`, Claude Code would:
- Replace animated spinners with static indicators
- Disable pulsing/blinking effects
- Use simpler progress indicators (e.g., dots or percentage)
- Maintain all functionality while reducing visual motion

### Environment Variable Alternative

For users who want global control without modifying project settings:

```bash
export CLAUDE_CODE_DISABLE_ANIMATIONS=true
```

### Implementation Behavior

**With animations enabled (default):**
```
✢ Processing request...
```

**With animations disabled:**
```
> Processing request...
```

or

```
[*] Processing request...
```

## Alternative Solutions Considered

1. **Automatic detection**: Detect small terminal size and auto-disable animations
   - Challenge: Threshold determination, user might want animations anyway

2. **Animation speed control**: Allow users to slow down animations
   - Challenge: Doesn't solve flickering, just makes it slower

3. **CLI flag**: `claude --no-animations`
   - Challenge: Must be specified every time, not persistent

4. **Reduced motion detection**: Respect system accessibility settings
   - Challenge: Not all terminals expose this information

## Use Case Example

### Scenario 1: Small Terminal Window
```
User: Developer working on a laptop with split-screen setup
1. Opens terminal in small window alongside code editor
2. Runs Claude Code for assistance
3. Animated spinner causes visible flickering
4. Sets "disableAnimations": true in settings
5. UI remains stable and readable
```

### Scenario 2: Remote SSH Session
```
User: DevOps engineer working on remote server
1. Connects via SSH with limited bandwidth
2. Animation updates cause lag and screen artifacts
3. Sets CLAUDE_CODE_DISABLE_ANIMATIONS=true
4. Terminal output is clean and efficient
```

### Scenario 3: Accessibility
```
User: Developer with motion sensitivity
1. Animated elements cause discomfort
2. Enables animation disabling in settings
3. Can use Claude Code comfortably for extended periods
```

## Priority

**Medium - Would be very helpful**

This feature improves accessibility and usability for a subset of users while not affecting the default experience for others.

## Feature Category

**Configuration and settings** / **Interactive mode (TUI)**

## Additional Context

### Technical Considerations

The animation system appears to use:
- Interval-based character rotation (approximately 120ms intervals)
- Unicode spinner characters: `["·","✢","✳","✶","✻","✽"]`
- Flash opacity animations for certain modes
- Shimmer/glimmer effects on text

### Related Settings

This would complement existing UI configuration options:
- `outputStyle`: Already controls presentation format
- `statusLine`: Controls status display
- Theme synchronization via `/config`

### Similar Features in Other Tools

- **npm**: `--no-progress` flag
- **webpack**: `progress` configuration option
- **many CLIs**: `--quiet` or `--no-color` flags
- **OS accessibility**: Reduced motion preferences

### Proposed Settings Schema

```typescript
interface ClaudeCodeSettings {
  // ... existing settings
  disableAnimations?: boolean; // Default: false
  animationStyle?: "full" | "reduced" | "none"; // Alternative: granular control
}
```

## Expected Benefits

1. **Accessibility**: Better experience for users with motion sensitivity
2. **Performance**: Reduced CPU usage for terminal rendering
3. **Bandwidth**: Less data over SSH/remote connections
4. **Flexibility**: Users can choose based on their environment
5. **No breaking changes**: Fully backward compatible

## References

- Settings documentation: https://code.claude.com/docs/en/settings.md
- Terminal config: https://code.claude.com/docs/en/terminal-config.md
- GitHub issue: [Link to be added when issue is created]
