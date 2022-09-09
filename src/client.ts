import axios from "axios";
import { Logging } from "homebridge";
import { SetControlInfoOptions } from "./request";
import { GetControlInfoResponse, GetSensorInfoResponse } from "./response";

export class DeviceClient {
    private readonly log: Logging;
    private readonly ip_address: string;

    constructor(log: Logging, ip_address: string) {
        this.log = log;
        this.ip_address = ip_address;
    }

    async getSensorInfo(): Promise<GetSensorInfoResponse> {
        const resp = await this.callDevice("/cleaner/get_sensor_info")

        const temp = parseFloat(resp.htemp)
        const humd = parseFloat(resp.hhum)

        return {
            temperature: temp,
            humidity: humd
        }
    }

    async getControlInfo(): Promise<GetControlInfoResponse> {
        const resp = await this.callDevice("/cleaner/get_control_info")

        let power: boolean;
        switch (resp.pow) {
            case "0":
                power = false;
                break;
            case "1":
                power = true;
                break;
            default:
                throw new Error(`Unknown value for pow: ${resp.pow}`)
        }

        let humidifier: boolean;
        switch (resp.humd) {
            case "0":
                humidifier = false;
                break;
            case "1":
            case "2":
            case "3":
            case "4": // auto
                humidifier = true;
                break;
            default:
                throw new Error(`Unknown value for humd: ${resp.humd}`)
        }

        return {
            power,
            humidifier
        }
    }

    async setControlInfo(option: SetControlInfoOptions) {
        await this.callDevice("/cleaner/set_control_info", {
            "pow": option.power ? "1" : "0"
        })
    }

    async callDevice(path: string, args: { [k: string]: string } = {}): Promise<{ [k: string]: string }> {
        const url = new URL(path, `http://${this.ip_address}`);
        this.log.debug(`GET ${url.toString()}`)
        this.log.debug(`args: ${JSON.stringify(args)}`)

        const resp = await axios.get(url.toString(), { params: args });
        this.log.debug(`raw resp: ${JSON.stringify(resp.data)}`)

        // response format:
        // ret=OK,pow=1,mode=1,airvol=0,humd=4
        const ret: { [k: string]: string } = {};
        for (const item of (resp.data as string).split(",")) {
            const [k, v] = item.split("=", 2)
            ret[k] = v;
        }
        this.log.debug(`response: ${JSON.stringify(ret)}`)

        // check return code
        if (ret.ret !== "OK") {
            throw new Error(`device API failed: ${ret}`)
        }

        return ret;
    }

}
