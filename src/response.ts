export interface GetControlInfoResponse {
    readonly power: boolean;
    readonly humidifier: boolean;
}

export interface GetSensorInfoResponse {
    readonly temperature: number;
    readonly humidity: number;
}
