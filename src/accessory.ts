import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  HAP,
  Logging,
  Service
} from "homebridge";
import { DeviceClient } from "./client";
import { GetControlInfoResponse, GetSensorInfoResponse } from "./response";

interface State {
  updated_at: number;
  controlInfo: GetControlInfoResponse,
  sensorInfo: GetSensorInfoResponse
}

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever ever import anything directly from the "homebridge" module (or the "hap-nodejs" module).
 * The above import block may seem like, that we do exactly that, but actually those imports are only used for types and interfaces
 * and will disappear once the code is compiled to Javascript.
 * In fact you can check that by running `npm run build` and opening the compiled Javascript file in the `dist` folder.
 * You will notice that the file does not contain a `... = require("homebridge");` statement anywhere in the code.
 *
 * The contents of the above import statement MUST ONLY be used for type annotation or accessing things like CONST ENUMS,
 * which is a special case as they get replaced by the actual value and do not remain as a reference in the compiled code.
 * Meaning normal enums are bad, const enums can be used.
 *
 * You MUST NOT import anything else which remains as a reference in the code, as this will result in
 * a `... = require("homebridge");` to be compiled into the final Javascript code.
 * This typically leads to unexpected behavior at runtime, as in many cases it won't be able to find the module
 * or will import another instance of homebridge causing collisions.
 *
 * To mitigate this the {@link API | Homebridge API} exposes the whole suite of HAP-NodeJS inside the `hap` property
 * of the api object, which can be acquired for example in the initializer function. This reference can be stored
 * like this for example and used to access all exported variables and classes from HAP-NodeJS.
 */
let hap: HAP;

/*
 * Initializer function called when the plugin is loaded.
 */
export = (api: API) => {
  hap = api.hap;
  api.registerAccessory("DaikinAirPurifier", DaikinAirPurifier);
};

class DaikinAirPurifier implements AccessoryPlugin {

  private readonly log: Logging;
  private readonly name: string;

  private readonly informationService: Service;
  private readonly airPurifierService: Service;
  private readonly temperatureSensorService: Service;
  private readonly humidifierService: Service;

  private state: State = {
    updated_at: 0,
    controlInfo: {
      power: false,
      humidifier: false
    },
    sensorInfo: {
      temperature: 0,
      humidity: 0
    }
  };

  private readonly client: DeviceClient;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.log = log;
    this.name = config.name;
    const ipaddr: string | undefined = config.ip_address;
    if (!ipaddr) {
      throw new Error("ip address is missing")
    }
    this.client = new DeviceClient(log, ipaddr);

    this.informationService = new hap.Service.AccessoryInformation()
      .setCharacteristic(hap.Characteristic.Manufacturer, "Daikin")
      .setCharacteristic(hap.Characteristic.Model, "Unknown")
      .setCharacteristic(hap.Characteristic.Name, this.name);

    this.airPurifierService = new hap.Service.AirPurifier();

    this.airPurifierService.getCharacteristic(hap.Characteristic.TargetAirPurifierState)
      .onGet(async () => { return this.getTargetAirPurifierState() })
      .onSet(async (value) => { })

    this.airPurifierService.getCharacteristic(hap.Characteristic.Active)
      // power on / off
      .onGet(async () => { return this.getActive() })
      .onSet(async (value) => {
        this.log.info(`Active => ${value}`)
        await this.client.setControlInfo({
          power: value === hap.Characteristic.Active.ACTIVE
        });
        this.updateState();
      })

    this.airPurifierService.getCharacteristic(hap.Characteristic.CurrentAirPurifierState)
      // power on / off
      .onGet(async () => { return this.getCurrentAirPurifierState() })

    setInterval(() => {
      if (Date.now() < (this.state.updated_at + 5000)) {
        this.log.info("use cached");
        return;
      }

      this.updateState()
    }, 10000);

    this.temperatureSensorService = new hap.Service.TemperatureSensor();
    this.temperatureSensorService.getCharacteristic(hap.Characteristic.CurrentTemperature)
      .onGet(async () => { return this.getCurrentTemperature() })

    this.humidifierService = new hap.Service.HumidifierDehumidifier();
    this.humidifierService.getCharacteristic(hap.Characteristic.Active)
      .onGet(async () => { return this.getActive() })
      .onSet(async (value) => {
        this.log.info(`Active => ${value}`)
        await this.client.setControlInfo({
          power: value === hap.Characteristic.Active.ACTIVE
        });
        this.updateState();
      })
    this.humidifierService.getCharacteristic(hap.Characteristic.CurrentRelativeHumidity)
      .onGet(async () => {
        return this.getCurrentHumidity()
      })
    this.humidifierService.getCharacteristic(hap.Characteristic.TargetHumidifierDehumidifierState)
      .onGet(async () => { return this.getTargetHumidifierState() })
      .onSet(async (value) => { })
    this.humidifierService.getCharacteristic(hap.Characteristic.CurrentHumidifierDehumidifierState)
      .onGet(async () => {
        return this.getCurrentHumidifierState()
      })


    this.updateState();

    log.info("Init done!");
  }

  /*
   * This method is optional to implement. It is called when HomeKit ask to identify the accessory.
   * Typical this only ever happens at the pairing process.
   */
  identify(): void {
    this.log("Identify!");
  }

  /*
   * This method is called directly after creation of this instance.
   * It should return all services which should be added to the accessory.
   */
  getServices(): Service[] {
    return [
      this.informationService,
      this.airPurifierService,
      this.temperatureSensorService,
      this.humidifierService
    ];
  }

  getCurrentAirPurifierState() {
    return this.state.controlInfo.power ? hap.Characteristic.CurrentAirPurifierState.PURIFYING_AIR
      : hap.Characteristic.CurrentAirPurifierState.INACTIVE;
  }

  getActive() {
    return this.state.controlInfo.power ? hap.Characteristic.Active.ACTIVE : hap.Characteristic.Active.INACTIVE;
  }

  getTargetAirPurifierState() {
    return hap.Characteristic.TargetAirPurifierState.AUTO;
  }

  getCurrentTemperature() {
    return this.state.sensorInfo.temperature
  }

  getCurrentHumidity() {
    return this.state.sensorInfo.humidity
  }

  getTargetHumidifierState() {
    return hap.Characteristic.TargetHumidifierDehumidifierState.HUMIDIFIER
  }

  getCurrentHumidifierState() {
    return this.state.controlInfo.humidifier ? hap.Characteristic.CurrentHumidifierDehumidifierState.HUMIDIFYING
      : hap.Characteristic.CurrentHumidifierDehumidifierState.INACTIVE;
  }

  async updateState() {
    const ctrlInfo = await this.client.getControlInfo();
    const sensorInfo = await this.client.getSensorInfo();
    this.state = {
      updated_at: Date.now(),
      controlInfo: ctrlInfo,
      sensorInfo: sensorInfo
    }

    // no updates for information service

    // air purifier
    this.airPurifierService.getCharacteristic(hap.Characteristic.CurrentAirPurifierState)
      .updateValue(this.getCurrentAirPurifierState())
    this.airPurifierService.getCharacteristic(hap.Characteristic.Active)
      .updateValue(this.getActive())
    this.airPurifierService.getCharacteristic(hap.Characteristic.TargetAirPurifierState)
      .updateValue(this.getTargetAirPurifierState())

    // temperature sensor
    this.temperatureSensorService.getCharacteristic(hap.Characteristic.CurrentTemperature)
      .updateValue(this.getCurrentTemperature())

    // humidifier
    this.humidifierService.getCharacteristic(hap.Characteristic.Active)
      .updateValue(this.getActive())
    this.humidifierService.getCharacteristic(hap.Characteristic.CurrentRelativeHumidity)
      .updateValue(this.getCurrentHumidity())
    this.humidifierService.getCharacteristic(hap.Characteristic.TargetHumidifierDehumidifierState)
      .updateValue(this.getTargetHumidifierState())
    this.humidifierService.getCharacteristic(hap.Characteristic.CurrentHumidifierDehumidifierState)
      .updateValue(this.getCurrentHumidifierState())
  }

}
