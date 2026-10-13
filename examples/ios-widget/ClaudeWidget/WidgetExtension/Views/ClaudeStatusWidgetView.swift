import SwiftUI
import WidgetKit

// MARK: - Status Widget

struct ClaudeStatusWidget: Widget {
    let kind = "ClaudeStatusWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ClaudeStatusProvider()) { entry in
            ClaudeStatusWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Claude Status")
        .description("Shows the current Claude API status and active model.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline
        ])
    }
}

// MARK: - View

struct ClaudeStatusWidgetView: View {
    @Environment(\.widgetFamily) var family
    var entry: ClaudeStatusEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallStatusView(entry: entry)
        case .systemMedium:
            MediumStatusView(entry: entry)
        case .accessoryCircular:
            AccessoryCircularStatusView(entry: entry)
        case .accessoryRectangular:
            AccessoryRectangularStatusView(entry: entry)
        case .accessoryInline:
            AccessoryInlineStatusView(entry: entry)
        default:
            SmallStatusView(entry: entry)
        }
    }
}

// MARK: - Small Widget

struct SmallStatusView: View {
    let entry: ClaudeStatusEntry

    var statusColor: Color {
        switch entry.status.apiStatus {
        case .operational: return .green
        case .degraded:    return .yellow
        case .outage:      return .red
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "cpu.fill")
                    .foregroundStyle(.purple)
                Spacer()
                Circle()
                    .fill(statusColor)
                    .frame(width: 10, height: 10)
            }

            Spacer()

            Text("Claude")
                .font(.headline)
                .fontWeight(.bold)

            Text(entry.status.apiStatus.rawValue)
                .font(.caption)
                .foregroundStyle(statusColor)

            Text(entry.status.currentModel)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
        }
        .padding(12)
    }
}

// MARK: - Medium Widget

struct MediumStatusView: View {
    let entry: ClaudeStatusEntry

    var statusColor: Color {
        switch entry.status.apiStatus {
        case .operational: return .green
        case .degraded:    return .yellow
        case .outage:      return .red
        }
    }

    var body: some View {
        HStack(spacing: 16) {
            // Left: Icon + status
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Image(systemName: "cpu.fill")
                        .foregroundStyle(.purple)
                        .font(.title3)
                    Text("Claude Code")
                        .font(.headline)
                        .fontWeight(.bold)
                }

                HStack(spacing: 4) {
                    Circle()
                        .fill(statusColor)
                        .frame(width: 8, height: 8)
                    Text(entry.status.apiStatus.rawValue)
                        .font(.subheadline)
                        .foregroundStyle(statusColor)
                }

                Text(entry.status.currentModel)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Divider()

            // Right: token info + last updated
            VStack(alignment: .leading, spacing: 6) {
                if let tokens = entry.status.remainingTokens {
                    Label {
                        Text("\(tokens.formatted()) tokens")
                            .font(.caption)
                    } icon: {
                        Image(systemName: "bolt.fill")
                            .foregroundStyle(.orange)
                    }
                }

                Label {
                    Text(entry.status.lastUpdated, style: .relative)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } icon: {
                    Image(systemName: "clock")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(14)
    }
}

// MARK: - Accessory Views

struct AccessoryCircularStatusView: View {
    let entry: ClaudeStatusEntry

    var statusColor: Color {
        switch entry.status.apiStatus {
        case .operational: return .green
        case .degraded:    return .yellow
        case .outage:      return .red
        }
    }

    var body: some View {
        ZStack {
            Circle().fill(statusColor.opacity(0.2))
            Image(systemName: "cpu.fill")
                .foregroundStyle(.purple)
        }
    }
}

struct AccessoryRectangularStatusView: View {
    let entry: ClaudeStatusEntry

    var body: some View {
        HStack {
            Image(systemName: "cpu.fill")
            VStack(alignment: .leading) {
                Text("Claude API")
                    .font(.headline)
                Text(entry.status.apiStatus.rawValue)
                    .font(.caption)
            }
        }
    }
}

struct AccessoryInlineStatusView: View {
    let entry: ClaudeStatusEntry

    var body: some View {
        Label(entry.status.apiStatus.rawValue, systemImage: "cpu.fill")
    }
}

// MARK: - Preview

#Preview(as: .systemSmall) {
    ClaudeStatusWidget()
} timeline: {
    ClaudeStatusEntry.placeholder
}

#Preview(as: .systemMedium) {
    ClaudeStatusWidget()
} timeline: {
    ClaudeStatusEntry.placeholder
}
