import type { BusApproach, Notifier } from "../types.js";
export declare class LineNotifier implements Notifier {
    private channelAccessToken;
    private userId;
    constructor(channelAccessToken: string, userId: string);
    notify(approaches: BusApproach[]): Promise<void>;
    private buildMessage;
    private send;
}
//# sourceMappingURL=line.d.ts.map