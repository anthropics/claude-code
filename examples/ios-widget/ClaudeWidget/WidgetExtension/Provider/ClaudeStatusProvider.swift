import WidgetKit
import Foundation

// MARK: - Timeline Entry

struct ClaudeStatusEntry: TimelineEntry {
    let date: Date
    let status: ClaudeStatusData
    let isPlaceholder: Bool

    static let placeholder = ClaudeStatusEntry(
        date: .now,
        status: .placeholder,
        isPlaceholder: true
    )
}

// MARK: - Timeline Provider

struct ClaudeStatusProvider: TimelineProvider {
    typealias Entry = ClaudeStatusEntry

    func placeholder(in context: Context) -> ClaudeStatusEntry {
        .placeholder
    }

    func getSnapshot(in context: Context, completion: @escaping (ClaudeStatusEntry) -> Void) {
        let entry = ClaudeStatusEntry(
            date: .now,
            status: loadStatus(),
            isPlaceholder: context.isPreview
        )
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ClaudeStatusEntry>) -> Void) {
        let currentDate = Date.now
        let status = loadStatus()

        let entry = ClaudeStatusEntry(date: currentDate, status: status, isPlaceholder: false)

        // Refresh every 15 minutes
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: currentDate)!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }

    // MARK: - Private

    private func loadStatus() -> ClaudeStatusData {
        guard
            let defaults = UserDefaults.widgetGroup,
            let data = defaults.data(forKey: "claudeStatus"),
            let decoded = try? JSONDecoder().decode(ClaudeStatusData.self, from: data)
        else {
            return .placeholder
        }
        return decoded
    }
}
