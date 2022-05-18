import { sendRequest } from "./request";
import {PCKFLBConfig} from "../config";
import * as log4js from "log4js";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");

class GasPriceCalculator {
    private static _instance: GasPriceCalculator;

    private constructor() {
    }

    public static get Instance() {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    private polygonAPIUrl:string;
    public isInited:boolean = false;

    public init() {
        if (this.isInited) {
            let msg = `GasPriceCalculator.init: WARN - already inited;`;
            clog.warn(msg);
            flog.warn(msg);
        }
        this.polygonAPIUrl = `https://api.polygonscan.com/api?module=gastracker&action=gasoracle&apikey=${PCKFLBConfig.polygonAPIKey}`;
        this.isInited = true;
    }

    public async getGasPrice(): Promise<number> {
        let gasPrice = 0;
    
        if (PCKFLBConfig.isAPIGetGasPrice == false) {
            return PCKFLBConfig.gasPriceAdder;
        }
        let gasPriceFromPolyscan = await this.getGasPriceFromPolyscan();
        gasPrice = (PCKFLBConfig.gasPriceMultiplier * gasPriceFromPolyscan) + PCKFLBConfig.gasPriceAdder;
    
    
        return Math.round((gasPrice + Number.EPSILON) * 100) / 100;
    }
    
    private async getGasPriceFromPolyscan(): Promise<number> {
        clog.debug(`GasPriceCalculator.getGasPriceFromPolyscan: 1.0;`);
        let gasPrice = 0;
        
        const resultData = await sendRequest(this.polygonAPIUrl);
        gasPrice = resultData.data.result.FastGasPrice;
        clog.debug(`GasPriceCalculator.getGasPriceFromPolyscan: gasPrice:${gasPrice};`);
        //const safeGasPrice = resultData1.data.protocols;
        return gasPrice;
    }

    private async getGasPriceFromEthers(): Promise<number> {
        // TODO - to be implemented
        let gasPrice = 0;

        return gasPrice;
    }

    public logConfigs () {
        let msg = `GasPriceCalculator.logConfigs: v0.1; polygonAPIUrl:${this.polygonAPIUrl};`;
        clog.debug(msg);
        flog.debug(msg);
    }
}

export const gasPriceCalculator = GasPriceCalculator.Instance;