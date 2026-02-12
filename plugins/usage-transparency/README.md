# Usage Transparency Plugin

## Overview

This plugin addresses **Issue #9862: Usage limit decrease without telling developers**, where Anthropic significantly decreased weekly usage limits in September without transparently communicating these changes to developers.

## Problem Statement

Developers experienced unexpected workflow disruptions when:
- **Weekly limits decreased from 2000 to 1000 requests** without notification
- **No proactive communication** about policy changes
- **No in-app visibility** of current usage or approaching limits
- **Business planning became impossible** without usage transparency

## Solution

This plugin provides comprehensive usage transparency with:

1. **Real-time Usage Display**: Clear visibility of daily/weekly/monthly usage
2. **Policy Change Tracking**: Monitor and alert on limit changes
3. **Proactive Notifications**: Warnings at 80% and 95% of limits
4. **Usage Projections**: Predict when limits will be reached
5. **Developer Communication**: Changelog and transparent updates

## Key Features

- ✅ **Usage Dashboard**: Real-time display of limits and consumption
- ✅ **Policy Change Alerts**: Immediate notification of limit changes
- ✅ **Smart Projections**: Predict usage patterns and depletion
- ✅ **Graduated Warnings**: 80% and 95% threshold alerts
- ✅ **Historical Tracking**: Archive of all policy changes
- ✅ **Business Planning**: Tools for capacity planning

## Installation

```bash
cp -r usage-transparency ~/.claude/plugins/
```

## Usage

### Quick Status Check
```bash
claude usage:status
```

Output:
```
🔍 Claude Code Usage Status
==================================================
📅 Daily: 🟢 45/200 (22.5%)
   Remaining: 155 | Resets: Today 11:59 PM
📊 Weekly: 🟡 820/1000 (82.0%)
   Remaining: 180 | Resets: Sunday 11:59 PM
📈 Monthly: 🟢 2890/4000 (72.3%)
   Remaining: 1110 | Resets: Oct 31 11:59 PM

🔮 Projections
   Daily pace: 67 requests/day
   Weekly pace: 1025 requests/week
   ⚠️  Estimated limit depletion: Tomorrow 3:45 PM

📢 Recent Policy Changes
   📉 Sep 15: Weekly limits decreased from 2000 to 1000
==================================================
```

### View Recent Policy Changes
```bash
claude usage:policy-changes
```

### Monitor Alerts
```bash
claude usage:alerts
```

## Configuration

```json
{
  "enablePolicyChangeAlerts": true,
  "enableUsageAlerts": true,
  "enableProjections": true,
  "thresholds": {
    "warning": 80,
    "critical": 95
  },
  "channels": {
    "console": true,
    "email": false
  }
}
```

## Technical Implementation

The plugin addresses the transparency gap by:

### 1. Usage Monitoring
- Tracks daily, weekly, monthly consumption
- Calculates percentage usage and remaining quotas
- Projects future usage based on current patterns

### 2. Policy Change Detection
- Monitors for limit changes (simulated - would integrate with Anthropic API)
- Archives historical changes with impact analysis
- Generates change notifications and documentation

### 3. Alert System
- **80% threshold**: Warning notifications
- **95% threshold**: Critical alerts
- **Policy changes**: Immediate notifications
- **Limit exceeded**: Error alerts with guidance

### 4. Business Intelligence
- Usage trend analysis
- Capacity planning projections
- Impact assessment for policy changes
- Historical usage patterns

## Example Scenarios

### Scenario 1: Approaching Limits
```
⚠️  Warning: weekly usage at 82.0% (820/1000)
🔮 Projection: Limit will be reached in 2.3 days
💡 Consider upgrading plan or optimizing usage patterns
```

### Scenario 2: Policy Change (Issue #9862)
```
📢 IMPORTANT POLICY CHANGE DETECTED
📉 Sep 15: Weekly limits decreased from 2000 to 1000
**Impact**: Significant impact on heavy users and workflows
**Notified**: No ⚠️  (This was the problem!)
```

### Scenario 3: Smart Projections
```
🔮 Usage Projections
Daily pace: 67 requests/day (trending up 15%)
Weekly pace: 1025 requests/week (over limit!)
⚠️  Estimated depletion: Tomorrow 3:45 PM
💡 Suggestion: Reduce usage by 25 requests/day to stay within limits
```

## Benefits

### For Developers
- **Predictable Planning**: Know your usage patterns and limits
- **Proactive Management**: Get warnings before hitting limits
- **Transparency**: Full visibility into policy changes
- **Business Impact**: Understand how changes affect workflows

### For Teams
- **Capacity Planning**: Project usage needs and upgrade timing
- **Cost Management**: Optimize usage patterns
- **Workflow Continuity**: Prevent unexpected interruptions
- **Change Management**: Prepare for policy updates

## Impact on Issue #9862

**Before (September 2025)**:
- Limits decreased from 2000 to 1000 weekly requests ❌
- No notification to developers ❌
- Sudden workflow disruption ❌
- No visibility into usage patterns ❌

**After (with this plugin)**:
- Immediate policy change alerts ✅
- Clear usage dashboard ✅
- Proactive limit warnings ✅
- Historical change tracking ✅

## Integration Points

The plugin would integrate with:
- **Anthropic API**: Real usage data and limit information
- **Notification Services**: Email, Slack, webhook alerts
- **Analytics**: Usage pattern analysis and trends
- **CLI/UI**: Dashboard and command integration

## Future Enhancements

1. **Email Notifications**: Direct email alerts for policy changes
2. **Webhook Integration**: Custom notification endpoints
3. **Usage Analytics**: Detailed pattern analysis
4. **Team Dashboards**: Multi-user usage visibility
5. **API Integration**: Real-time data from Anthropic services

## Contributing

This plugin addresses a critical communication gap that affects developer productivity. Contributions welcome for:
- Enhanced usage analytics
- Better projection algorithms
- Additional notification channels
- Integration improvements

## License

Same as Claude Code main project.