import "dotenv/config";
import { fetchApproaches } from "./scraper.js";
import { ConsoleNotifier } from "./notifiers/console.js";
import { LineNotifier } from "./notifiers/line.js";
import type { BusApproach, Config, Notifier } from "./types.js";

function loadConfig(): Config {
  return {
    departureBusstopId: process.env.DEPARTURE_BUSSTOP_ID ?? "00310821",
    arrivalBusstopId: process.env.ARRIVAL_BUSSTOP_ID ?? "00310511",
    delayThresholdMinutes: parseInt(
      process.env.DELAY_THRESHOLD_MINUTES ?? "0",
      10,
    ),
    notification: (process.env.NOTIFICATION_TYPE as Config["notification"]) ?? "console",
    lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "",
    lineUserId: process.env.LINE_USER_ID ?? "",
  };
}

function createNotifier(config: Config): Notifier {
  if (config.notification === "line") {
    return new LineNotifier(config.lineChannelAccessToken, config.lineUserId);
  }
  return new ConsoleNotifier();
}

function filterByDelay(
  approaches: BusApproach[],
  thresholdMinutes: number,
): BusApproach[] {
  if (thresholdMinutes <= 0) return approaches;

  return approaches.filter((bus) => {
    const depDelay = bus.departure.delayMinutes ?? 0;
    const arrDelay = bus.arrival.delayMinutes ?? 0;
    return depDelay >= thresholdMinutes || arrDelay >= thresholdMinutes;
  });
}

async function main(): Promise<void> {
  const config = loadConfig();
  const notifier = createNotifier(config);

  console.log("🚌 東武バス接近情報通知ツール");
  console.log(`  出発バス停: ${config.departureBusstopId}`);
  console.log(`  到着バス停: ${config.arrivalBusstopId}`);
  console.log(`  通知先: ${config.notification}`);
  console.log(`  遅延しきい値: ${config.delayThresholdMinutes}分`);
  console.log("");

  try {
    const approaches = await fetchApproaches(
      config.departureBusstopId,
      config.arrivalBusstopId,
    );

    if (approaches.length === 0) {
      console.log("接近情報はありません");
      return;
    }

    const filtered = filterByDelay(approaches, config.delayThresholdMinutes);

    if (filtered.length === 0) {
      console.log(
        `しきい値（${config.delayThresholdMinutes}分）以上の遅延はありません`,
      );
      return;
    }

    await notifier.notify(filtered);
  } catch (err) {
    console.error("エラー:", err);
    process.exit(1);
  }
}

main();
