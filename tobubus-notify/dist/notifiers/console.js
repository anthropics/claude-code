export class ConsoleNotifier {
    async notify(approaches) {
        if (approaches.length === 0) {
            console.log("接近情報はありません");
            return;
        }
        console.log("");
        console.log("🚌 東武バス接近情報");
        for (const bus of approaches) {
            console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
            console.log(bus.routeName);
            console.log("");
            if (bus.approachStatus) {
                console.log(`  📍 ${bus.approachStatus}`);
            }
            if (bus.statusDetail) {
                console.log(`     ${bus.statusDetail}`);
            }
            console.log("");
            // Departure
            const depDelay = bus.departure.delayMinutes !== null
                ? ` 🔴 約${bus.departure.delayMinutes}分遅れ → ${bus.departure.predicted}予測`
                : " ✅ 定刻通り";
            console.log(`  出発: 定刻 ${bus.departure.scheduled}${depDelay}`);
            // Arrival
            const arrDelay = bus.arrival.delayMinutes !== null
                ? ` 🔴 約${bus.arrival.delayMinutes}分遅れ → ${bus.arrival.predicted}予測`
                : " ✅ 定刻通り";
            console.log(`  到着: 定刻 ${bus.arrival.scheduled}${arrDelay}`);
            if (bus.estimatedTravelTime) {
                console.log(`  所要時間: ${bus.estimatedTravelTime}`);
            }
            if (bus.vehicleInfo) {
                console.log(`  車両: ${bus.vehicleInfo}`);
            }
        }
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("");
    }
}
//# sourceMappingURL=console.js.map