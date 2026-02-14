export interface BusApproach {
    routeName: string;
    approachStatus: string;
    statusDetail: string;
    departure: {
        scheduled: string;
        scheduledISO: string;
        delayMinutes: number | null;
        predicted: string | null;
        predictedISO: string | null;
    };
    arrival: {
        scheduled: string;
        scheduledISO: string;
        delayMinutes: number | null;
        predicted: string | null;
        predictedISO: string | null;
    };
    estimatedTravelTime: string;
    vehicleInfo: string;
}
export interface Config {
    departureBusstopId: string;
    arrivalBusstopId: string;
    checkCron: string;
    delayThresholdMinutes: number;
    notification: "line" | "console";
    lineChannelAccessToken: string;
    lineUserId: string;
}
export interface Notifier {
    notify(approaches: BusApproach[]): Promise<void>;
}
//# sourceMappingURL=types.d.ts.map