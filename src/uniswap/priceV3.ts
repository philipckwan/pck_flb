import { BigNumber, ethers } from "ethers";
import { abi as QuoterABI } from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json";

import * as log4js from "log4js";
import {getBigNumber} from "../utility"
import {PCKWeb3Handler} from "../utils/Web3Handler";
import {quoterAddressUniswapV3} from "../addresses"

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
  
const uniswapV3Fee = new Map([
    ["DAI", new Map([
        ["USDC", 500],
        ["USDT", 500],
        ["WETH", 3000],
        ["WMATIC", 500],
        ["WBTC", 3000],
    ])],
    ["USDC", new Map([
        ["DAI", 500],
        ["USDT", 500],
        ["WETH", 500],
        ["WMATIC", 500],
        ["WBTC", 3000],
    ])],
    ["USDT", new Map([
        ["DAI", 500],
        ["USDC", 500],
        ["WETH", 3000],
        ["WMATIC", 500],
    ])],
    ["WBTC", new Map([
        ["WETH", 500],
        ["WMATIC", 500],
    ])],
    ["WETH", new Map([
        ["DAI", 3000],
        ["USDC", 500],
        ["USDT", 3000],
        ["WMATIC", 500],
    ])],
    ["WMATIC", new Map([
        ["DAI", 500],
        ["USDC", 500],
        ["USDT", 500],
        ["WETH", 500],
    ])],
]);

const DEFAULT_FEE = 3000;

class PriceV3 {
    private static _instance: PriceV3;

    private constructor() {
    }

    public static get Instance() {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public isInited:boolean = false;
    private quoterContract:ethers.Contract;

    public init() {
        if (this.isInited) {
            let msg = `PriceV3.init: WARN - already inited;`;
            clog.warn(msg);
            flog.warn(msg);
        }
        this.quoterContract = new ethers.Contract(
            // https://polygonscan.com/address/0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6
            quoterAddressUniswapV3,
            QuoterABI,
            PCKWeb3Handler.web3Provider
        );
        let msg = `PriceV3.init: DONE;`;
        clog.info(msg);
        flog.info(msg);
        this.isInited = true;
    }

    public getFeeOnUniV3(tokenIn: string, tokenOut: string) {
        let fee = uniswapV3Fee.get(tokenIn)?.get(tokenOut);
        if (!fee) {
            let msg = `priceV3.getFeeOnUniV3: WARN - fee not found for [${tokenIn}] -> [${tokenOut}], default fee [${DEFAULT_FEE}] will be used;`;
            clog.warn(msg);
            flog.warn(msg)
            fee = DEFAULT_FEE;
        }
        return fee;
    }
    
    /**
     *
     * @param tokenIn address of token to convert from
     * @param tokenOut address of token to convert to
     * @param amountIn amount of token to convert from
     * @param fee pool fee
     * @returns
     */
    public async getPriceOnUniV3 (
    tokenIn: string,
    tokenOut: string,
    amountIn: BigNumber,
    fee: number
    ): Promise<BigNumber> {
        //clog.debug(`priceV3.getPriceOnUniV3: 1.0; ${tokenIn}; ${tokenOut}; ${amountIn}; ${fee};`);
        let quotedAmountOut = 0;
        try {
        quotedAmountOut = await this.quoterContract.callStatic.quoteExactInputSingle(
            tokenIn,
            tokenOut,
            fee,
            amountIn.toString(),
            0
        );
        } catch (ex) {
            clog.debug(`priceV3.getPriceOnUniV3: ERROR;`);
            clog.debug(ex);
            throw(ex);
        }
        if (!ethers.BigNumber.isBigNumber(quotedAmountOut)) {
            return getBigNumber(0);
        }
        //clog.debug(`priceV3.getPriceOnUniV3: 2.0;`);
        return quotedAmountOut;
    }
}

export const PCKPriceV3 = PriceV3.Instance;
