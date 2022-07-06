import {ethers} from "ethers";
import {PCKFLBConfig} from "../config";
import * as log4js from "log4js";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");

class Web3Handler {
    private static _instance: Web3Handler;

    private constructor() {
    }

    public static get Instance() {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public isInited:boolean = false;
    public web3Provider:ethers.providers.StaticJsonRpcProvider;
    public web3Signer:ethers.Wallet;

    public init() {
        if (this.isInited) {
            let msg = `Web3Handler.init: WARN - already inited;`;
            clog.warn(msg);
            flog.warn(msg);
        }
        this.web3Provider = new ethers.providers.StaticJsonRpcProvider(PCKFLBConfig.web3RPCURL);
        this.web3Signer = new ethers.Wallet(PCKFLBConfig.privateKey, this.web3Provider);
        let msg = `Web3Handler.init: DONE;`;
        clog.info(msg);
        flog.info(msg);
        this.isInited = true;
    }

}

export const PCKWeb3Handler = Web3Handler.Instance;