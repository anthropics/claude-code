const LINE_API_URL = "https://api.line.me/v2/bot/message/push";
export class LineNotifier {
    channelAccessToken;
    userId;
    constructor(channelAccessToken, userId) {
        this.channelAccessToken = channelAccessToken;
        this.userId = userId;
        if (!channelAccessToken) {
            throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
        }
        if (!userId) {
            throw new Error("LINE_USER_ID is not set");
        }
    }
    async notify(approaches) {
        if (approaches.length === 0)
            return;
        const message = this.buildMessage(approaches);
        await this.send(message);
    }
    buildMessage(approaches) {
        const lines = ["🚌 東武バス接近情報", "━━━━━━━━━━━━━━━━"];
        for (const bus of approaches) {
            lines.push(bus.routeName);
            lines.push("");
            if (bus.departure.delayMinutes !== null) {
                lines.push(`  🔴 約${bus.departure.delayMinutes}分遅れ`);
                lines.push(`  出発: 定刻 ${bus.departure.scheduled} → ${bus.departure.predicted}予測`);
            }
            else {
                lines.push(`  ✅ 定刻通り`);
                lines.push(`  出発: ${bus.departure.scheduled}`);
            }
            if (bus.arrival.delayMinutes !== null) {
                lines.push(`  到着: 定刻 ${bus.arrival.scheduled} → ${bus.arrival.predicted}予測`);
            }
            else {
                lines.push(`  到着: ${bus.arrival.scheduled}`);
            }
            if (bus.estimatedTravelTime) {
                lines.push(`  所要時間: ${bus.estimatedTravelTime}`);
            }
            if (bus.vehicleInfo) {
                lines.push(`  車両: ${bus.vehicleInfo}`);
            }
            lines.push("━━━━━━━━━━━━━━━━");
        }
        return lines.join("\n");
    }
    async send(text) {
        const body = {
            to: this.userId,
            messages: [{ type: "text", text }],
        };
        const res = await fetch(LINE_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.channelAccessToken}`,
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const errorBody = await res.text();
            throw new Error(`LINE API error: ${res.status} ${res.statusText} - ${errorBody}`);
        }
        console.log("[LINE] 通知を送信しました");
    }
}
//# sourceMappingURL=line.js.map