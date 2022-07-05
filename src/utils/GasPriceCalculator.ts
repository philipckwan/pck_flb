import { sendRequest } from "./request";
import {PCKFLBConfig} from "../config";
import {PCKWeb3Handler} from "./Web3Handler";
import * as log4js from "log4js";
import {ethers} from "ethers";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");

enum GAS_PRICE_MODE {POLY_SAFE, POLY_PROPOSE, POLY_FAST, ETHERS}

export const callThis = () => {
    gasPriceCalculator.doAPollGasPrice();
}

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
    private useRecentGasPrice:boolean = true;
    private gasPriceMode = GAS_PRICE_MODE.POLY_FAST;
    private pollGasPriceIntervalMSec = 15000;

    private gasPriceRecentPolygonSafe:number;
    private gasPriceRecentPolygonPropose:number;
    private gasPriceRecentPolygonFast:number;
    private gasPriceRecentEthers:number;

    public init() {
        if (this.isInited) {
            let msg = `GasPriceCalculator.init: WARN - already inited;`;
            clog.warn(msg);
            flog.warn(msg);
        }
        this.polygonAPIUrl = `https://api.polygonscan.com/api?module=gastracker&action=gasoracle&apikey=${PCKFLBConfig.polygonAPIKey}`;
        this.gasPriceRecentPolygonSafe = 10;
        this.gasPriceRecentPolygonPropose = 20;
        this.gasPriceRecentPolygonFast = 30;
        this.gasPriceRecentEthers = 15;

        this.gasPriceMode = (PCKFLBConfig.getGasPriceField === GAS_PRICE_MODE[GAS_PRICE_MODE.POLY_SAFE]) ? GAS_PRICE_MODE.POLY_SAFE :
                            (PCKFLBConfig.getGasPriceField === GAS_PRICE_MODE[GAS_PRICE_MODE.POLY_PROPOSE]) ? GAS_PRICE_MODE.POLY_PROPOSE :
                            (PCKFLBConfig.getGasPriceField === GAS_PRICE_MODE[GAS_PRICE_MODE.POLY_FAST]) ? GAS_PRICE_MODE.POLY_FAST :
                            GAS_PRICE_MODE.ETHERS;          
        this.useRecentGasPrice = PCKFLBConfig.isUseRecentGasPrice;                                      

        let msg = `GasPriceCalculator.init: DONE; gasPriceMode:${GAS_PRICE_MODE[this.gasPriceMode]}; useRecentGasPrice:${this.useRecentGasPrice};`;
        clog.info(msg);
        flog.info(msg);
        if (this.useRecentGasPrice) {
            setInterval(callThis, this.pollGasPriceIntervalMSec);
        }
        this.isInited = true;
    }

    public async getGasPrice(): Promise<number> {
        let gasPrice = 0;
    
        if (PCKFLBConfig.isAPIGetGasPrice == false) {
            gasPrice = PCKFLBConfig.gasPriceAdder;
        } else {
            let gotGasPrice = 0;
            if (this.useRecentGasPrice) {
                switch(this.gasPriceMode) {
                    case GAS_PRICE_MODE.POLY_SAFE: {
                        gotGasPrice = this.gasPriceRecentPolygonSafe;
                        break;
                    }
                    case GAS_PRICE_MODE.POLY_PROPOSE: {
                        gotGasPrice = this.gasPriceRecentPolygonPropose;
                        break;
                    }
                    case GAS_PRICE_MODE.POLY_FAST: {
                        gotGasPrice = this.gasPriceRecentPolygonFast;
                        break;
                    }
                    case GAS_PRICE_MODE.ETHERS: {
                        gotGasPrice = this.gasPriceRecentEthers;
                        break;
                    }
                    default: {
                        gotGasPrice = this.gasPriceRecentPolygonPropose;
                    }
                }
            } else {
                gotGasPrice = await this.getGasPriceDispatch(false);
            }
            gasPrice = (PCKFLBConfig.gasPriceMultiplier * gotGasPrice) + PCKFLBConfig.gasPriceAdder;
        }        
        return Math.round((gasPrice + Number.EPSILON) * 100) / 100;
        /*
        let gasPriceFromPolyscan = await this.getGasPriceFromPolyscan();
        let gasPriceFromEthers = await this.getGasPriceFromEthers();
        flog.debug(`GasPriceCalculator.getGasPrice: gasPriceFromPolysdan:${gasPriceFromPolyscan}; gasPriceFromEthers:${gasPriceFromEthers};`);
        */
        
    }

    private async getGasPriceDispatch(updateGasPriceRecent = false): Promise<number> {
        flog.debug(`GasPriceCalculator.getGasPriceDispatch: v1.2; updateGasPriceRecent:${updateGasPriceRecent};`);
        if (updateGasPriceRecent) {
            //this.getGasPriceFromEthers(updateGasPriceRecent);
            this.getGasPriceFromPolyscan(updateGasPriceRecent);
            return 0;
        } else {
            if (this.gasPriceMode == GAS_PRICE_MODE.ETHERS) {
                return this.getGasPriceFromEthers(updateGasPriceRecent);
            } else {
                return this.getGasPriceFromPolyscan(updateGasPriceRecent);
            }
        }   
    }
    
    private async getGasPriceFromPolyscan(updateGasPriceRecent = false): Promise<number> {
        //flog.debug(`GasPriceCalculator.getGasPriceFromPolyscan: 1.0;`);
        let gasPrice = 0;
        
        try {
            let startTime = Date.now();
            const resultData = await sendRequest(this.polygonAPIUrl);
            let endTime = Date.now();
            let timeDiff = (endTime - startTime) / 1000;
            if (updateGasPriceRecent) {
                this.gasPriceRecentPolygonSafe = resultData.data.result.SafeGasPrice;
                this.gasPriceRecentPolygonPropose = resultData.data.result.ProposeGasPrice;
                this.gasPriceRecentPolygonFast = resultData.data.result.FastGasPrice;
                gasPrice = 0;
            } else {
                switch (this.gasPriceMode) {
                    case GAS_PRICE_MODE.POLY_SAFE: {
                        gasPrice = resultData.data.result.SafeGasPrice;
                        break;
                    }
                    case GAS_PRICE_MODE.POLY_PROPOSE: {
                        gasPrice = resultData.data.result.ProposeGasPrice;
                        break;
                    }
                    case GAS_PRICE_MODE.POLY_FAST: {
                        gasPrice = resultData.data.result.FastGasPrice;
                        break;
                    }
                    default: {
                        gasPrice = resultData.data.result.ProposeGasPrice;
                    }
                }
            }
            flog.debug(`GasPriceCalculator.getGasPriceFromPolyscan: SAFE:${this.gasPriceRecentPolygonSafe}; PROPOSE:${this.gasPriceRecentPolygonPropose}; FAST:${this.gasPriceRecentPolygonFast}: T:${timeDiff};`);
        } catch (ex) {
            flog.error(`GasPriceCalculator.getGasPriceFromPolyscan: ERROR;`);
            flog.error(ex);
        }
        return gasPrice;

    }

    private async getGasPriceFromEthers(updateGasPriceRecent = false): Promise<number> {
        let gasPrice = 0;

        try {
            let startTime = Date.now();
            const bnGasPrice = await PCKWeb3Handler.web3Provider.getGasPrice();
            let endTime = Date.now();
            let timeDiff = (endTime - startTime) / 1000;
            gasPrice = parseFloat(ethers.utils.formatUnits(bnGasPrice, "gwei"));
            if (updateGasPriceRecent) {
                this.gasPriceRecentEthers = gasPrice;
            }
            flog.debug(`GasPriceCalculator.getGasPriceFromEthers: time:${timeDiff};`);
        } catch (ex) {
            flog.error(`GasPriceCalculator.getGasPriceFromEthers: ERROR;`);
            flog.error(ex);
        }
        return gasPrice;
    }

    public async doAPollGasPrice() {
        await this.getGasPriceDispatch(true);
        //flog.debug(`GasPriceCalculator.doAPollGasPrice: safe:${this.gasPriceRecentPolygonSafe}; propose:${this.gasPriceRecentPolygonPropose}; fast:${this.gasPriceRecentPolygonFast}: ethers:${this.gasPriceRecentEthers};`);
    }

    public display () {
        let msg = `GasPriceCalculator.display: v0.1; polygonAPIUrl:${this.polygonAPIUrl};`;
        clog.debug(msg);
        flog.debug(msg);
    }
}

export const gasPriceCalculator = GasPriceCalculator.Instance;