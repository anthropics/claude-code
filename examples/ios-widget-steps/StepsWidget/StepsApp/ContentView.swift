import SwiftUI

struct ContentView: View {
    @StateObject private var manager = HealthKitManager()
    @State private var showGoalSheet = false
    @State private var goalDraft: Double = 10_000

    private var ringColor: Color { manager.progress >= 1.0 ? .green : .blue }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 28) {
                    progressRing
                    statsGrid
                    goalCard
                    if manager.authorizationStatus == .denied { deniedBanner }
                }
                .padding(.bottom, 24)
            }
            .navigationTitle("Schritte")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Task { await manager.fetchTodaySteps() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
            .sheet(isPresented: $showGoalSheet) {
                GoalEditorSheet(goal: $goalDraft) { manager.updateGoal(Int(goalDraft)) }
            }
            .task { manager.requestAuthorization() }
        }
    }

    // MARK: - Sub-views

    private var progressRing: some View {
        ZStack {
            Circle()
                .stroke(ringColor.opacity(0.15), lineWidth: 22)
            Circle()
                .trim(from: 0, to: manager.progress)
                .stroke(ringColor, style: StrokeStyle(lineWidth: 22, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.8), value: manager.progress)
            VStack(spacing: 4) {
                Text(manager.todaySteps.formatted())
                    .font(.system(size: 52, weight: .bold, design: .rounded))
                    .contentTransition(.numericText())
                Text("Schritte heute")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                if manager.progress >= 1.0 {
                    Label("Ziel erreicht!", systemImage: "checkmark.circle.fill")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(.green)
                }
            }
        }
        .frame(width: 260, height: 260)
        .padding(.top, 8)
    }

    private var statsGrid: some View {
        LazyVGrid(
            columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())],
            spacing: 12
        ) {
            StatCard(icon: "flag.fill",    color: .orange, value: "\(Int(manager.progress * 100)) %", label: "Fortschritt")
            StatCard(icon: "figure.walk",  color: .blue,   value: String(format: "%.2f km", manager.distanceKm), label: "Distanz")
            StatCard(icon: "flame.fill",   color: .red,    value: "\(manager.estimatedKcal) kcal", label: "Kalorien")
        }
        .padding(.horizontal)
    }

    private var goalCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("Tagesziel", systemImage: "target")
                    .font(.headline)
                Spacer()
                Button("Anpassen") {
                    goalDraft = Double(manager.stepGoal)
                    showGoalSheet = true
                }
                .buttonStyle(.bordered)
                .tint(.blue)
            }
            ProgressView(value: manager.progress)
                .tint(ringColor)
            Text("\(manager.todaySteps.formatted()) / \(manager.stepGoal.formatted()) Schritte")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding()
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
        .padding(.horizontal)
    }

    private var deniedBanner: some View {
        ContentUnavailableView(
            "HealthKit-Zugriff verweigert",
            systemImage: "heart.slash",
            description: Text("Erlaube den Zugriff in Einstellungen > Datenschutz > Health.")
        )
        .padding(.horizontal)
    }
}

// MARK: - Stat Card

struct StatCard: View {
    let icon: String
    let color: Color
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(color)
            Text(value)
                .font(.subheadline)
                .fontWeight(.semibold)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
    }
}

// MARK: - Goal Editor Sheet

struct GoalEditorSheet: View {
    @Binding var goal: Double
    @Environment(\.dismiss) private var dismiss
    let onSave: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Tagesziel in Schritten") {
                    Slider(value: $goal, in: 1_000...30_000, step: 500) {
                        Text("Ziel")
                    } minimumValueLabel: {
                        Text("1K").font(.caption)
                    } maximumValueLabel: {
                        Text("30K").font(.caption)
                    }
                    Text("\(Int(goal).formatted()) Schritte")
                        .font(.title2.bold())
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.vertical, 4)
                }
            }
            .navigationTitle("Ziel anpassen")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Abbrechen") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Speichern") { onSave(); dismiss() }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

#Preview {
    ContentView()
}
