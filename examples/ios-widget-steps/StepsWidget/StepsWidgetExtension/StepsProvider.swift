import WidgetKit
@preconcurrency import HealthKit

// MARK: - Timeline Entry

struct StepsEntry: TimelineEntry {
    let date: Date
    let steps: Int
    let goal: Int

    var progress: Double {
        guard goal > 0 else { return 0 }
        return min(Double(steps) / Double(goal), 1.0)
    }

    var distanceKm: Double { Double(steps) * 0.000762 }
    var isGoalReached: Bool { steps >= goal }

    static let placeholder = StepsEntry(date: .now, steps: 7_432, goal: 10_000)
}

// MARK: - Timeline Provider

struct StepsProvider: TimelineProvider {
    private static let appGroup = "group.com.example.stepswidget"
    private static let goalKey  = "stepGoal"

    func placeholder(in context: Context) -> StepsEntry { .placeholder }

    func getSnapshot(in context: Context, completion: @escaping (StepsEntry) -> Void) {
        guard !context.isPreview else { completion(.placeholder); return }
        fetchEntry(completion: completion)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StepsEntry>) -> Void) {
        fetchEntry { entry in
            let next = Calendar.current.date(byAdding: .minute, value: 15, to: .now)!
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    // MARK: - Private

    private func fetchEntry(completion: @escaping (StepsEntry) -> Void) {
        let goal = loadGoal()

        guard HKHealthStore.isHealthDataAvailable() else {
            completion(StepsEntry(date: .now, steps: 0, goal: goal))
            return
        }

        let store    = HKHealthStore()
        let stepType = HKQuantityType(.stepCount)

        store.requestAuthorization(toShare: [], read: [stepType]) { success, _ in
            guard success else {
                completion(StepsEntry(date: .now, steps: 0, goal: goal))
                return
            }
            querySteps(store: store) { steps in
                completion(StepsEntry(date: .now, steps: steps, goal: goal))
            }
        }
    }

    private func querySteps(store: HKHealthStore, completion: @escaping (Int) -> Void) {
        let stepType = HKQuantityType(.stepCount)
        let start    = Calendar.current.startOfDay(for: Date())
        let pred     = HKQuery.predicateForSamples(withStart: start, end: Date(), options: .strictStartDate)

        let query = HKStatisticsQuery(
            quantityType: stepType,
            quantitySamplePredicate: pred,
            options: .cumulativeSum
        ) { _, result, _ in
            let steps = Int(result?.sumQuantity()?.doubleValue(for: .count()) ?? 0)
            completion(steps)
        }
        store.execute(query)
    }

    private func loadGoal() -> Int {
        let stored = UserDefaults(suiteName: Self.appGroup)?.integer(forKey: Self.goalKey) ?? 0
        return stored > 0 ? stored : 10_000
    }
}
