import * as log4js from "log4js";
const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
import {Strategy} from "./Strategy";
import {BigNumber} from "ethers";
import {ISwapPairRoutes, ISwapRoutes} from "../interfaces";
import {fetchSwapPrices} from "../uniswap/uniswapPrice";
import {compareSwap, getSwapsStrings, formatTime} from "../utility";
import {PCKFLBConfig} from "../config";
import {PCKFlashloanExecutor} from "../flashloan/FlashloanExecutor";

export class SerialTwoSwapsStrategy extends Strategy {
    private swapPairList:ISwapRoutes[];
    public isBusy = false;

    public constructor(aSwapPairList:ISwapRoutes[]) {
        super("SerialTwoSwapsStrategy");
        this.swapPairList=aSwapPairList;
    }

    public display() {
        flog.debug(`STSS.display: hello;`)
        super.display();
    }

    public refreshAll(): void {

    }

    public async refresh(idx:number) {
        flog.debug(`STSS.refresh: START; idx:${idx};`);
        this.isBusy = true;
        let aSwapPair = this.swapPairList[idx];
        let startTime = Date.now();
        let bnLoanAmountUSDx = aSwapPair.swapPairRoutes[0].fromAmount;
        await fetchSwapPrices(aSwapPair, bnLoanAmountUSDx);
        let endTime = Date.now();
        let timeDiff = (endTime - startTime) / 1000;
        let [diffAmt, diffPct] = compareSwap(aSwapPair);
        let isOpp = diffAmt > PCKFLBConfig.flashloanExecutionThresholdUSDx;
        //isOpp = true;
        flog.debug(`STSS.refresh; ${getSwapsStrings(aSwapPair)}; isOpp:${isOpp}; diffAmt:${diffAmt.toFixed(2)}, diffPct:${diffPct.toFixed(5)};T:[${formatTime(startTime)}->${formatTime(endTime)}(${timeDiff})];`);
    
        if (isOpp) {
            let [fromTokenSymbol, firstBestRouterName, toTokenSymbol, firstBestRouterRate, secondBestRouterName, secondBestRouterRate, finalRate] = super.getWinningPairStr(aSwapPair);
            let msg = `STSS.refresh: winning route:[${fromTokenSymbol}]->[${firstBestRouterName}:${toTokenSymbol}:${firstBestRouterRate}]->[${secondBestRouterName}:${fromTokenSymbol}:${secondBestRouterRate}]; %:${finalRate.toFixed(5)};`;
            flog.debug(msg);
            
            if (PCKFLBConfig.remainingFlashloanTries > 0) {
                flog.debug(`STSS.refresh: about to execute flashloan; final%${finalRate.toFixed(5)};`);
                let results = await PCKFlashloanExecutor.executeFlashloan(aSwapPair);
                PCKFLBConfig.remainingFlashloanTries--;
                flog.debug(`STSS.refresh: flashloan executed, results=${results}; remainingFlashloanTries:${PCKFLBConfig.remainingFlashloanTries};`);
            } else {
                flog.debug(`STSS.refresh: will not execute flashloan; remainingFlashloanTries:${PCKFLBConfig.remainingFlashloanTries};`);
            }
        }
    }

    public initTwoSwapsArray(aSwapPairList: ISwapRoutes[]): void {
        let bSwapPairList = aSwapPairList;
        throw new Error("Method not implemented.");
    }

    public printSwapPair(idx: number): void {
        let bIdx = idx;
        throw new Error("Method not implemented.");
    }
}