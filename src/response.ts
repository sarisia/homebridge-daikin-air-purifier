export interface GetControlInfoResponse {
    readonly power: boolean;
}

export interface GetSensorInfoResponse {
    readonly temperature: number;
    readonly humidity: number;
}
