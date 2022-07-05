import * as log4js from "log4js";
const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
import {ITwoSwaps, ISwapPairRoutes, IRouterToAmount, IToRate, ISwapRoutes, ISwap} from "../interfaces";
import {BigNumber, ethers} from "ethers";
import {getSwapRate} from "../uniswap/uniswapPrice"
import {PCKFlashloanExecutor} from "../flashloan/FlashloanExecutor";
import {PCKFLBConfig} from "../config";
import {Strategy} from "./Strategy";
import {getBigNumber, formatTime} from "../utility";



export class ParallelTwoSwapsStrategy extends Strategy {


    public constructor() {
        super("ParallelTwoSwapsStrategy");
    }

    public swapRouteList:ISwapRoutes[] = []
    public twoSwapsArray:ITwoSwaps[] = [];
    public isBusy = false;
    private latestRateThreshold = 1.001;

    public display():void {
        flog.debug(`PTSS.display: 2.0;`)
        super.display();
    }

    public refreshAll():void {
        for (let i = 0; i < this.swapRouteList.length; i++) {
            this.refresh(i);
        }
    }

    public init(): void {
        throw new Error("Method not implemented.");
    }

    public async initTwoSwapsArray(aSwapPairList:ISwapRoutes[]) {
        this.swapRouteList = aSwapPairList;
        flog.debug(`PTSS.initTwoSwapsArray: 1.0;`)
        for (let i = 0; i < aSwapPairList.length; i++) {
            let aSwapRoutes = aSwapPairList[i];
            let bnLoanAmount = getBigNumber(PCKFLBConfig.baseToken.amountForSwap, aSwapRoutes.swapPairRoutes[0].fromToken.decimals);
            flog.debug(`__bnLoanAmount:${bnLoanAmount};`);
            await this.addSwapPair(aSwapRoutes.swapPairRoutes[0], aSwapRoutes.swapPairRoutes[1], bnLoanAmount);
            this.printSwapPair(i);
        }
    }

    private async addSwapPair(aFromSwap:ISwapPairRoutes, aToSwap:ISwapPairRoutes, fromSwapFromAmount:BigNumber) {
        let aTwoSwaps:ITwoSwaps = {
            fromSwap:aFromSwap,
            fromWinnerIdx:0,
            toSwap:aToSwap,
            toWinnerIdx:0
        }

        flog.debug(`PTSS.addSwapPair: initializing fromSwap...`);
        aTwoSwaps.fromSwap.fromAmount = fromSwapFromAmount;
        for (let i = 0; i < aTwoSwaps.fromSwap.routerToAmountList.length; i++) {
            let aRouteToAmount = aTwoSwaps.fromSwap.routerToAmountList[i];
            try {
              let amountAndRate = await getSwapRate(aTwoSwaps.fromSwap.fromToken, aTwoSwaps.fromSwap.toToken, aRouteToAmount.router);
              aRouteToAmount.toFromRate = amountAndRate.toFromRate;           
            } catch (e) {
              flog.error(`PTSS.addSwapPair: ERROR - 1;`);
              aRouteToAmount.toFromRate = 0;
            } 
        }
        aTwoSwaps.fromWinnerIdx = this.findWinnerIdx(aTwoSwaps.fromSwap.routerToAmountList);

        flog.debug(`PTSS.addSwapPair: initializing toSwap...`);
        aTwoSwaps.toSwap.fromAmount = getBigNumber(aTwoSwaps.toSwap.fromToken.amountForSwap, aTwoSwaps.toSwap.fromToken.decimals);
        for (let i = 0; i < aTwoSwaps.toSwap.routerToAmountList.length; i++) {
            let aRouteToAmount = aTwoSwaps.toSwap.routerToAmountList[i];
            try {
              let amountAndRate = await getSwapRate(aTwoSwaps.toSwap.fromToken, aTwoSwaps.toSwap.toToken, aRouteToAmount.router);
              aRouteToAmount.toFromRate = amountAndRate.toFromRate;       
            } catch (e) {
              flog.error(`PTSS.addSwapPair: ERROR - 2;`);
              aRouteToAmount.toFromRate = 0;
            } 
        }
        aTwoSwaps.toWinnerIdx = this.findWinnerIdx(aTwoSwaps.toSwap.routerToAmountList);
        this.twoSwapsArray.push(aTwoSwaps);
    }

    public async refresh(idx:number) {
        //flog.debug(`PTSS.refresh: START; idx:${idx};`);
        this.isBusy = true;
        let aTwoSwaps = this.twoSwapsArray[idx];

        let allSwapPromises = [];
        let startTime = Date.now();
        for (let aRTA of aTwoSwaps.fromSwap.routerToAmountList) {
            let promANewAmountAndRate = getSwapRate(aTwoSwaps.fromSwap.fromToken, aTwoSwaps.fromSwap.toToken, aRTA.router, aRTA.idx, true);
            allSwapPromises.push(promANewAmountAndRate);
        }
        for (let aRTA of aTwoSwaps.toSwap.routerToAmountList) {
            let promANewAmountAndRate = getSwapRate(aTwoSwaps.toSwap.fromToken, aTwoSwaps.toSwap.toToken, aRTA.router, aRTA.idx, false);
            allSwapPromises.push(promANewAmountAndRate);
        }
        Promise.all(allSwapPromises).then(async (newAmountAndRates) => {
            let fromMaxRate = 0;
            let fromWinnerIdx = 0;
            let toMaxRate = 0;
            let toWinnerIdx = 0;
            for (let i = 0; i < newAmountAndRates.length; i++) {
                let aNewAmountAndRate = newAmountAndRates[i];
                //flog.debug(`PTSS.refresh: fromSwap: aNAAR[${i}].toFromRate:${aNewAmountAndRate.toFromRate.toFixed(6)};`);
                if (aNewAmountAndRate.isFrom) {
                    //flog.debug(`__from:routerIdx:[${aNewAmountAndRate.routerIdx}]; %:${aNewAmountAndRate.toFromRate};`);
                    if (aNewAmountAndRate.toFromRate > fromMaxRate) {                        
                        fromWinnerIdx = aNewAmountAndRate.routerIdx;
                        fromMaxRate = aNewAmountAndRate.toFromRate;
                    } 
                } else {
                    //flog.debug(`__to:routerIdx:[${aNewAmountAndRate.routerIdx}]; %:${aNewAmountAndRate.toFromRate};`);
                    if (aNewAmountAndRate.toFromRate > toMaxRate) {
                        toWinnerIdx = aNewAmountAndRate.routerIdx;
                        toMaxRate = aNewAmountAndRate.toFromRate;
                    }
                }
            }
            let endTime = Date.now();
            let timeDiff = (endTime - startTime) / 1000;
            let newFinalRate = fromMaxRate * toMaxRate;
            let isOpp = newFinalRate > this.latestRateThreshold;
            let fromBestRouter = aTwoSwaps.fromSwap.routerToAmountList[fromWinnerIdx].router.name;
            let toBestRouter = aTwoSwaps.toSwap.routerToAmountList[toWinnerIdx].router.name;
            flog.debug(`PTSS.refresh: isOpp:${isOpp};final%:${newFinalRate.toFixed(6)};T:[${timeDiff}|${formatTime(startTime)}->${formatTime(endTime)}];[${aTwoSwaps.fromSwap.fromToken.symbol}:${aTwoSwaps.toSwap.fromToken.symbol}];[${fromBestRouter}:${fromMaxRate.toFixed(6)}]->[${toBestRouter}:${toMaxRate.toFixed(6)}];`);

            if (isOpp) {
                flog.debug(`PTSS.refresh: about to call flashloan executor;`);
                let results = await PCKFlashloanExecutor.executeFlashloanPair(aTwoSwaps.fromSwap, fromWinnerIdx, aTwoSwaps.toSwap, toWinnerIdx);
                flog.debug(`PTSS.refresh: flashloan executor called, results=${results}; remainingFlashloanTries:${PCKFLBConfig.remainingFlashloanTries};`);
            }
            this.isBusy = false;
        });
    }

    public getFinalRate(idx:number):number {
        let finalRate = 0;
        finalRate = this.twoSwapsArray[idx].fromSwap.routerToAmountList[this.twoSwapsArray[idx].fromWinnerIdx].toFromRate * this.twoSwapsArray[idx].toSwap.routerToAmountList[this.twoSwapsArray[idx].toWinnerIdx].toFromRate;
        return finalRate;
    }

    private findWinnerIdx(RTAs:IRouterToAmount[]):number {
        let winnerIdx = -1;
        let maxRate = 0;
        for (let i = 0; i < RTAs.length; i++) {
            if (RTAs[i].toFromRate > maxRate) {
                maxRate = RTAs[i].toFromRate;
                winnerIdx = i;
            }
        }
        return winnerIdx;
    }

    public printSwapPair(idx:number) {
        let aTwoSwaps = this.twoSwapsArray[idx];
        flog.debug(`PTSS.printTwoSwaps: START;`);
        let nFromAmount = Number(ethers.utils.formatUnits(aTwoSwaps.fromSwap.fromAmount, aTwoSwaps.fromSwap.fromToken.decimals));
        flog.debug(`_fromSwap:[${aTwoSwaps.fromSwap.fromToken.symbol}->${aTwoSwaps.fromSwap.toToken.symbol}]; $:${nFromAmount.toFixed(4)}; fw:${aTwoSwaps.fromWinnerIdx};`);
        for (let i = 0; i < aTwoSwaps.fromSwap.routerToAmountList.length; i++) {
            let aRTA = aTwoSwaps.fromSwap.routerToAmountList[i];
            let msg = `__@:${aRTA.router.name.padStart(18)}; %:${aRTA.toFromRate.toFixed(8)};`;
            if (i == aTwoSwaps.fromWinnerIdx) {
                msg += `<--winner;`;
            }
            flog.debug(msg);
        }
        nFromAmount = Number(ethers.utils.formatUnits(aTwoSwaps.toSwap.fromAmount, aTwoSwaps.toSwap.fromToken.decimals));
        flog.debug(`_toSwap:[${aTwoSwaps.toSwap.fromToken.symbol}->${aTwoSwaps.toSwap.toToken.symbol}]; $:${nFromAmount.toFixed(4)}; tw:${aTwoSwaps.toWinnerIdx};`);
        for (let i = 0; i < aTwoSwaps.toSwap.routerToAmountList.length; i++) {
            let aRTA = aTwoSwaps.toSwap.routerToAmountList[i];
            let msg = `__@:${aRTA.router.name.padStart(18)}; %:${aRTA.toFromRate.toFixed(8)};`;
            if (i == aTwoSwaps.toWinnerIdx) {
                msg += `<--winner;`;
            }
            flog.debug(msg);
        }
        flog.debug(`PTSS.printTwoSwaps: END; finalRate:${this.getFinalRate(idx)};`);
    }

}
//export const PCKParallelTwoSwapsStrategy = ParallelTwoSwapsStrategy.Instance;
/*
export namespace ParallelTwoSwapsStrategy {
    export enum VERSION {V1, V2}
}
*/