import * as cheerio from "cheerio";
const BASE_URL = "https://transfer-cloud.navitime.biz/tobubus/approachings";
export async function fetchApproaches(departureBusstopId, arrivalBusstopId) {
    const url = `${BASE_URL}?departure-busstop=${departureBusstopId}&arrival-busstop=${arrivalBusstopId}`;
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch approach page: ${res.status} ${res.statusText}`);
    }
    const html = await res.text();
    return parseApproaches(html);
}
export function parseApproaches(html) {
    const $ = cheerio.load(html);
    const approaches = [];
    $("li > button.w-full").each((_, el) => {
        const $el = $(el);
        // Route name: first span inside h3
        const routeName = $el.find("h3 span").first().text().trim();
        if (!routeName)
            return;
        // Approach status: text inside .text-error within the status section
        const statusDiv = $el.find(".my-3");
        const approachStatus = statusDiv
            .find(".text-error")
            .first()
            .text()
            .replace(/\s+/g, "")
            .trim();
        // Status detail
        const statusDetail = statusDiv.find(".text-sm.mt-1").text().trim();
        // Time rows: departure (first .flex.items-center with time) and arrival (second)
        const timeContainer = $el.find(".mx-2.mb-2 > div.w-full");
        const timeRows = timeContainer.children("div.flex.items-center");
        const departure = parseTimeRow($, timeRows.eq(0));
        const arrival = parseTimeRow($, timeRows.eq(1));
        // Estimated travel time
        const travelTimeText = $el.find(".text-text-grey").text().trim();
        const estimatedTravelTime = travelTimeText.replace("予測所要時間", "").trim();
        // Vehicle info
        const vehicleInfo = $el.find("dl dd span").text().trim();
        approaches.push({
            routeName,
            approachStatus,
            statusDetail,
            departure,
            arrival,
            estimatedTravelTime,
            vehicleInfo,
        });
    });
    return approaches;
}
function parseTimeRow($, $row) {
    // Scheduled time from <time> with class containing text-2xl font-bold
    const scheduledTimeEl = $row.find("time.mx-2");
    const scheduled = scheduledTimeEl.text().trim();
    const scheduledISO = scheduledTimeEl.attr("datetime") ?? "";
    // Delay info from .text-error span
    const errorDiv = $row.find(".text-error");
    const delayText = errorDiv.find("span").first().text().trim();
    const delayMatch = delayText.match(/約(\d+)分遅れ/);
    const delayMinutes = delayMatch ? parseInt(delayMatch[1], 10) : null;
    // Predicted time
    const predictedTimeEl = errorDiv.find("time[datetime]");
    const predictedText = predictedTimeEl.text().trim();
    const predicted = predictedText ? predictedText.replace("予測", "") : null;
    const predictedISO = predictedTimeEl.attr("datetime") ?? null;
    return {
        scheduled,
        scheduledISO,
        delayMinutes,
        predicted,
        predictedISO,
    };
}
//# sourceMappingURL=scraper.js.map