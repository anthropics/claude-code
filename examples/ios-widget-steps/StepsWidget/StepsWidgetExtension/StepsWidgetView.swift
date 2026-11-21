import SwiftUI
import WidgetKit

// MARK: - Widget Configuration

struct StepsWidget: Widget {
    let kind = "StepsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StepsProvider()) { entry in
            StepsWidgetRootView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Schritte")
        .description("Zeigt deine heutigen Schritte aus Apple Health.")
        .supportedFamilies([
            .systemSmall,
            .systemMedium,
            .accessoryCircular,
            .accessoryRectangular,
            .accessoryInline,
        ])
    }
}

// MARK: - Root View

struct StepsWidgetRootView: View {
    @Environment(\.widgetFamily) var family
    let entry: StepsEntry

    var body: some View {
        switch family {
        case .systemSmall:           SmallStepsView(entry: entry)
        case .systemMedium:          MediumStepsView(entry: entry)
        case .accessoryCircular:     AccessoryCircularView(entry: entry)
        case .accessoryRectangular:  AccessoryRectangularView(entry: entry)
        case .accessoryInline:       AccessoryInlineView(entry: entry)
        default:                     SmallStepsView(entry: entry)
        }
    }
}

// MARK: - Small Widget  (progress ring + step count)

struct SmallStepsView: View {
    let entry: StepsEntry
    var ringColor: Color { entry.isGoalReached ? .green : .blue }

    var body: some View {
        ZStack {
            Circle()
                .stroke(ringColor.opacity(0.18), lineWidth: 12)
                .padding(14)
            Circle()
                .trim(from: 0, to: entry.progress)
                .stroke(ringColor, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .padding(14)

            VStack(spacing: 2) {
                Image(systemName: "figure.walk")
                    .font(.caption2)
                    .foregroundStyle(ringColor)
                Text(stepsLabel)
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                Text("Schritte")
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
                if entry.isGoalReached {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.caption2)
                        .foregroundStyle(.green)
                        .padding(.top, 1)
                }
            }
        }
    }

    private var stepsLabel: String {
        entry.steps >= 10_000
            ? String(format: "%.1fK", Double(entry.steps) / 1_000)
            : entry.steps.formatted()
    }
}

// MARK: - Medium Widget  (ring + stats)

struct MediumStepsView: View {
    let entry: StepsEntry
    var ringColor: Color { entry.isGoalReached ? .green : .blue }

    var body: some View {
        HStack(spacing: 16) {
            // Progress ring
            ZStack {
                Circle()
                    .stroke(ringColor.opacity(0.18), lineWidth: 11)
                Circle()
                    .trim(from: 0, to: entry.progress)
                    .stroke(ringColor, style: StrokeStyle(lineWidth: 11, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 1) {
                    Text(entry.steps.formatted())
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                    Text("\(Int(entry.progress * 100)) %")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 90, height: 90)

            // Stats
            VStack(alignment: .leading, spacing: 7) {
                StepStatRow(icon: "target",       color: .orange, text: "Ziel: \(entry.goal.formatted())")
                StepStatRow(icon: "figure.walk",  color: .blue,   text: String(format: "%.2f km", entry.distanceKm))
                ProgressView(value: entry.progress).tint(ringColor)

                HStack {
                    if entry.isGoalReached {
                        Label("Ziel erreicht!", systemImage: "star.fill")
                            .font(.caption2).fontWeight(.semibold).foregroundStyle(.green)
                    }
                    Spacer()
                    Text(entry.date, style: .relative)
                        .font(.caption2).foregroundStyle(.tertiary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
    }
}

private struct StepStatRow: View {
    let icon: String
    let color: Color
    let text: String

    var body: some View {
        Label {
            Text(text).font(.caption)
        } icon: {
            Image(systemName: icon).foregroundStyle(color)
        }
    }
}

// MARK: - Accessory Circular  (Lock Screen – Gauge)

struct AccessoryCircularView: View {
    let entry: StepsEntry

    var body: some View {
        Gauge(value: entry.progress) {
            Image(systemName: "figure.walk")
        } currentValueLabel: {
            Text(compactSteps)
                .font(.system(size: 11, weight: .bold, design: .rounded))
        }
        .gaugeStyle(.accessoryCircular)
        .tint(entry.isGoalReached ? .green : .blue)
    }

    private var compactSteps: String {
        entry.steps >= 1_000
            ? String(format: "%.1fK", Double(entry.steps) / 1_000)
            : "\(entry.steps)"
    }
}

// MARK: - Accessory Rectangular  (Lock Screen)

struct AccessoryRectangularView: View {
    let entry: StepsEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Label("Schritte heute", systemImage: "figure.walk")
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(entry.steps.formatted())
                .font(.system(.headline, design: .rounded))
                .fontWeight(.bold)
            ProgressView(value: entry.progress)
                .tint(entry.isGoalReached ? .green : .blue)
        }
    }
}

// MARK: - Accessory Inline  (Lock Screen)

struct AccessoryInlineView: View {
    let entry: StepsEntry

    var body: some View {
        Label(
            "\(entry.steps.formatted()) / \(entry.goal.formatted())",
            systemImage: "figure.walk"
        )
    }
}

// MARK: - Previews

#Preview("Small", as: .systemSmall) {
    StepsWidget()
} timeline: {
    StepsEntry.placeholder
    StepsEntry(date: .now, steps: 10_823, goal: 10_000)
}

#Preview("Medium", as: .systemMedium) {
    StepsWidget()
} timeline: {
    StepsEntry.placeholder
    StepsEntry(date: .now, steps: 10_823, goal: 10_000)
}

#Preview("Circular", as: .accessoryCircular) {
    StepsWidget()
} timeline: {
    StepsEntry.placeholder
}

#Preview("Rectangular", as: .accessoryRectangular) {
    StepsWidget()
} timeline: {
    StepsEntry.placeholder
}
