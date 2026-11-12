import SwiftUI
import WidgetKit

// MARK: - Session Widget

struct ClaudeSessionWidget: Widget {
    let kind = "ClaudeSessionWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ClaudeSessionProvider()) { entry in
            ClaudeSessionWidgetView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Claude Session Stats")
        .description("Shows your Claude Code session statistics at a glance.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .systemLarge
        ])
    }
}

// MARK: - View

struct ClaudeSessionWidgetView: View {
    @Environment(\.widgetFamily) var family
    var entry: ClaudeSessionEntry

    var body: some View {
        switch family {
        case .systemSmall:
            SmallSessionView(entry: entry)
        case .systemMedium:
            MediumSessionView(entry: entry)
        case .systemLarge:
            LargeSessionView(entry: entry)
        default:
            SmallSessionView(entry: entry)
        }
    }
}

// MARK: - Shared stat tile

struct StatTile: View {
    let icon: String
    let iconColor: Color
    let value: String
    let label: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Image(systemName: icon)
                .foregroundStyle(iconColor)
                .font(.caption)
            Text(value)
                .font(.headline)
                .fontWeight(.semibold)
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Small

struct SmallSessionView: View {
    let entry: ClaudeSessionEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "terminal.fill")
                    .foregroundStyle(.purple)
                Text("Sessions")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
            }

            Text("\(entry.session.totalSessions)")
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .foregroundStyle(.purple)

            Divider()

            HStack {
                Image(systemName: "doc.text.fill")
                    .foregroundStyle(.blue)
                    .font(.caption)
                Text("\(entry.session.filesEdited) files")
                    .font(.caption)
                Spacer()
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(.green)
                    .font(.caption)
                Text("\(entry.session.tasksCompleted) tasks")
                    .font(.caption)
            }

            Text(entry.session.activeProject)
                .font(.caption2)
                .foregroundStyle(.secondary)
                .lineLimit(1)
        }
        .padding(12)
    }
}

// MARK: - Medium

struct MediumSessionView: View {
    let entry: ClaudeSessionEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "terminal.fill")
                    .foregroundStyle(.purple)
                Text("Claude Code Stats")
                    .font(.headline)
                    .fontWeight(.semibold)
                Spacer()
                Text(entry.session.activeProject)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            HStack(spacing: 8) {
                StatTile(
                    icon: "play.circle.fill",
                    iconColor: .purple,
                    value: "\(entry.session.totalSessions)",
                    label: "Sessions"
                )
                StatTile(
                    icon: "doc.fill",
                    iconColor: .blue,
                    value: "\(entry.session.filesEdited)",
                    label: "Files"
                )
                StatTile(
                    icon: "checkmark.seal.fill",
                    iconColor: .green,
                    value: "\(entry.session.tasksCompleted)",
                    label: "Tasks"
                )
                StatTile(
                    icon: "pencil",
                    iconColor: .orange,
                    value: entry.session.linesChanged.formatted(.number.notation(.compactName)),
                    label: "Lines"
                )
            }
        }
        .padding(14)
    }
}

// MARK: - Large

struct LargeSessionView: View {
    let entry: ClaudeSessionEntry

    private var relativeDate: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: entry.session.lastActive, relativeTo: .now)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                HStack(spacing: 8) {
                    Image(systemName: "terminal.fill")
                        .foregroundStyle(.purple)
                        .font(.title3)
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Claude Code")
                            .font(.headline)
                            .fontWeight(.bold)
                        Text(entry.session.activeProject)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                Spacer()
                Text("Active \(relativeDate)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Divider()

            // Stat grid (2x2)
            LazyVGrid(
                columns: [GridItem(.flexible()), GridItem(.flexible())],
                spacing: 8
            ) {
                StatTile(
                    icon: "play.circle.fill",
                    iconColor: .purple,
                    value: "\(entry.session.totalSessions)",
                    label: "Total Sessions"
                )
                StatTile(
                    icon: "doc.fill",
                    iconColor: .blue,
                    value: "\(entry.session.filesEdited)",
                    label: "Files Edited"
                )
                StatTile(
                    icon: "checkmark.seal.fill",
                    iconColor: .green,
                    value: "\(entry.session.tasksCompleted)",
                    label: "Tasks Completed"
                )
                StatTile(
                    icon: "pencil.and.outline",
                    iconColor: .orange,
                    value: entry.session.linesChanged.formatted(.number.notation(.compactName)),
                    label: "Lines Changed"
                )
            }

            Divider()

            // Model info
            HStack {
                Image(systemName: "cpu.fill")
                    .foregroundStyle(.purple)
                    .font(.caption)
                Text(entry.session.modelUsed)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("Updated \(entry.date, style: .relative) ago")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(16)
    }
}

// MARK: - Previews

#Preview(as: .systemSmall) {
    ClaudeSessionWidget()
} timeline: {
    ClaudeSessionEntry.placeholder
}

#Preview(as: .systemMedium) {
    ClaudeSessionWidget()
} timeline: {
    ClaudeSessionEntry.placeholder
}

#Preview(as: .systemLarge) {
    ClaudeSessionWidget()
} timeline: {
    ClaudeSessionEntry.placeholder
}
