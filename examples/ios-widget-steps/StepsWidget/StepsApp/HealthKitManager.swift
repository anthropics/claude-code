import HealthKit
import WidgetKit

// MARK: - HealthKit Manager

@MainActor
final class HealthKitManager: ObservableObject {
    private let store = HKHealthStore()

    @Published var todaySteps: Int = 0
    @Published var stepGoal: Int = 10_000
    @Published var authorizationStatus: AuthStatus = .notDetermined

    enum AuthStatus { case notDetermined, authorized, denied }

    private static let appGroup = "group.com.example.stepswidget"
    private static let goalKey  = "stepGoal"

    init() {
        let stored = UserDefaults(suiteName: Self.appGroup)?.integer(forKey: Self.goalKey) ?? 0
        stepGoal = stored > 0 ? stored : 10_000
    }

    // MARK: - Authorization

    func requestAuthorization() {
        guard HKHealthStore.isHealthDataAvailable() else {
            authorizationStatus = .denied
            return
        }
        let stepType = HKQuantityType(.stepCount)
        store.requestAuthorization(toShare: [], read: [stepType]) { [weak self] success, _ in
            Task { @MainActor [weak self] in
                self?.authorizationStatus = success ? .authorized : .denied
                if success { await self?.fetchTodaySteps() }
            }
        }
    }

    // MARK: - Step Query

    func fetchTodaySteps() async {
        guard HKHealthStore.isHealthDataAvailable() else { return }
        let stepType = HKQuantityType(.stepCount)
        let start = Calendar.current.startOfDay(for: .now)
        let pred  = HKQuery.predicateForSamples(withStart: start, end: .now, options: .strictStartDate)

        let steps: Int = await withCheckedContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: stepType,
                quantitySamplePredicate: pred,
                options: .cumulativeSum
            ) { _, result, _ in
                let count = Int(result?.sumQuantity()?.doubleValue(for: .count()) ?? 0)
                continuation.resume(returning: count)
            }
            store.execute(query)
        }
        todaySteps = steps
    }

    // MARK: - Goal

    func updateGoal(_ newGoal: Int) {
        stepGoal = newGoal
        UserDefaults(suiteName: Self.appGroup)?.set(newGoal, forKey: Self.goalKey)
        WidgetCenter.shared.reloadTimelines(ofKind: "StepsWidget")
    }

    // MARK: - Derived values

    var progress: Double {
        guard stepGoal > 0 else { return 0 }
        return min(Double(todaySteps) / Double(stepGoal), 1.0)
    }

    var distanceKm: Double { Double(todaySteps) * 0.000762 }

    var estimatedKcal: Int { Int(Double(todaySteps) * 0.04) }
}
