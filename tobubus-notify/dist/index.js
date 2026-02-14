import "dotenv/config";
import cron from "node-cron";
import { fetchApproaches } from "./scraper.js";
import { ConsoleNotifier } from "./notifiers/console.js";
import { LineNotifier } from "./notifiers/line.js";
function loadConfig() {
    return {
        departureBusstopId: process.env.DEPARTURE_BUSSTOP_ID ?? "00310821",
        arrivalBusstopId: process.env.ARRIVAL_BUSSTOP_ID ?? "00310511",
        checkCron: process.env.CHECK_CRON ?? "*/5 * * * *",
        delayThresholdMinutes: parseInt(process.env.DELAY_THRESHOLD_MINUTES ?? "0", 10),
        notification: process.env.NOTIFICATION_TYPE ?? "console",
        lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
        lineUserId: process.env.LINE_USER_ID ?? "",
    };
}
function createNotifier(config) {
    if (config.notification === "line") {
        return new LineNotifier(config.lineChannelAccessToken, config.lineUserId);
    }
    return new ConsoleNotifier();
}
function filterByDelay(approaches, thresholdMinutes) {
    if (thresholdMinutes <= 0)
        return approaches;
    return approaches.filter((bus) => {
        const depDelay = bus.departure.delayMinutes ?? 0;
        const arrDelay = bus.arrival.delayMinutes ?? 0;
        return depDelay >= thresholdMinutes || arrDelay >= thresholdMinutes;
    });
}
// Duplicate notification prevention
// Key: "routeName|scheduledDeparture" -> last notified timestamp
const notifiedMap = new Map();
const DEDUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
function deduplicateApproaches(approaches) {
    const now = Date.now();
    const result = [];
    for (const bus of approaches) {
        const key = `${bus.routeName}|${bus.departure.scheduled}`;
        const lastNotified = notifiedMap.get(key);
        if (lastNotified && now - lastNotified < DEDUP_INTERVAL_MS) {
            continue;
        }
        notifiedMap.set(key, now);
        result.push(bus);
    }
    // Clean up old entries
    for (const [key, timestamp] of notifiedMap) {
        if (now - timestamp > DEDUP_INTERVAL_MS) {
            notifiedMap.delete(key);
        }
    }
    return result;
}
async function check(config, notifier) {
    const timestamp = new Date().toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
    });
    console.log(`[${timestamp}] チェック中...`);
    try {
        const approaches = await fetchApproaches(config.departureBusstopId, config.arrivalBusstopId);
        const delayed = filterByDelay(approaches, config.delayThresholdMinutes);
        if (delayed.length === 0) {
            console.log(`[${timestamp}] 遅延情報なし（しきい値: ${config.delayThresholdMinutes}分以上）`);
            return;
        }
        const toNotify = deduplicateApproaches(delayed);
        if (toNotify.length === 0) {
            console.log(`[${timestamp}] 通知済みのため、スキップ`);
            return;
        }
        await notifier.notify(toNotify);
    }
    catch (err) {
        console.error(`[${timestamp}] エラー:`, err);
    }
}
async function main() {
    const config = loadConfig();
    const notifier = createNotifier(config);
    const isWatch = process.argv.includes("--watch");
    console.log("🚌 東武バス接近情報通知ツール");
    console.log(`  出発バス停: ${config.departureBusstopId}`);
    console.log(`  到着バス停: ${config.arrivalBusstopId}`);
    console.log(`  通知先: ${config.notification}`);
    console.log(`  遅延しきい値: ${config.delayThresholdMinutes}分`);
    if (isWatch) {
        console.log(`  チェック間隔: ${config.checkCron}`);
        console.log("");
        console.log("ウォッチモードで起動しました。Ctrl+C で終了。");
        console.log("");
        // Run immediately on start
        await check(config, notifier);
        // Schedule periodic checks
        cron.schedule(config.checkCron, () => {
            check(config, notifier);
        });
    }
    else {
        console.log("");
        // One-shot mode: fetch all approaches and notify (no delay filter for one-shot)
        try {
            const approaches = await fetchApproaches(config.departureBusstopId, config.arrivalBusstopId);
            if (approaches.length === 0) {
                console.log("接近情報はありません");
                return;
            }
            await notifier.notify(approaches);
        }
        catch (err) {
            console.error("エラー:", err);
            process.exit(1);
        }
    }
}
main();
//# sourceMappingURL=index.js.map