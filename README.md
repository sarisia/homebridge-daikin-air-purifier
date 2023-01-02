# homebridge-daikin-air-purifier

[![](https://img.shields.io/npm/v/@sarisia/homebridge-daikin-air-purifier?style=flat-square)](https://www.npmjs.com/package/@sarisia/homebridge-daikin-air-purifier)

Control Daikin air purifier from Homebridge

# Usage

Add the following lines to the Homebridge config (`config.json`):

```json
    "accessories": [
        {
            "accessory": "DaikinAirPurifier",
            "name": "DaikinAirPurifier",
            "ip_address": "192.168.77.101"
        }
    ]
```
