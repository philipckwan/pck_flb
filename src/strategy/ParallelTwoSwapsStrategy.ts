import * as log4js from "log4js";
const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
import {ITwoSwaps, ISwapPairRoutes, IRouterToAmount, IToAmountAndRate, ISwapRoutes} from "../interfaces";
import {BigNumber, ethers} from "ethers";
import {getSwapAmountAndRate} from "../uniswap/uniswapPrice"
import {getBigNumber} from "../utility"
import {PCKFlashloanExecutor} from "../flashloan/FlashloanExecutor";
import {PCKFLBConfig} from "../config";

class ParallelTwoSwapsStrategy {
    private static _instance: ParallelTwoSwapsStrategy;

    private constructor() {
    }

    public static get Instance() {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    public isInited:boolean = false;
    public twoSwapsArray:ITwoSwaps[] = [];
    public isBusy = false;
    private latestRateThreshold = 1.001;
    private swapRoutesList:ISwapRoutes[];

    public init(aSwapRoutesList:ISwapRoutes[]) {
        if (this.isInited) {
            let msg = `PTSS.init: WARN - already inited;`;
            clog.warn(msg);
            flog.warn(msg);
        }
        this.swapRoutesList = aSwapRoutesList;
        let msg = `ParallelTwoSwapsStrategy(PTSS).init: v0.1; DONE;`;
        clog.info(msg);
        flog.info(msg);

        this.isInited = true;
    }

    public async add(aFromSwap:ISwapPairRoutes, aToSwap:ISwapPairRoutes, fromSwapFromAmount:BigNumber) {
        let aTwoSwaps:ITwoSwaps = {
            fromSwap:aFromSwap,
            fromWinnerIdx:0,
            toSwap:aToSwap,
            toWinnerIdx:0
        }

        flog.debug(`PTSS.add: initializing fromSwap...`);
        aTwoSwaps.fromSwap.fromAmount = fromSwapFromAmount;
        for (let i = 0; i < aTwoSwaps.fromSwap.routerToAmountList.length; i++) {
            let aRouteToAmount = aTwoSwaps.fromSwap.routerToAmountList[i];
            try {
              let amountAndRate = await getSwapAmountAndRate(aTwoSwaps.fromSwap.fromToken, aTwoSwaps.fromSwap.toToken, aRouteToAmount.router, aTwoSwaps.fromSwap.fromAmount);
              aRouteToAmount.toFromRate = amountAndRate.toFromRate;
              aRouteToAmount.toAmount = amountAndRate.toAmount;             
            } catch (e) {
              flog.error(`PTSS.add: ERROR - 1;`);
              aRouteToAmount.toFromRate = 0;
            } 
        }
        aTwoSwaps.fromWinnerIdx = this.findWinnerIdx(aTwoSwaps.fromSwap.routerToAmountList);

        flog.debug(`PTSS.add: initializing toSwap...`);
        aTwoSwaps.toSwap.fromAmount = aTwoSwaps.fromSwap.routerToAmountList[aTwoSwaps.fromWinnerIdx].toAmount;
        for (let i = 0; i < aTwoSwaps.toSwap.routerToAmountList.length; i++) {
            let aRouteToAmount = aTwoSwaps.toSwap.routerToAmountList[i];
            try {
              let amountAndRate = await getSwapAmountAndRate(aTwoSwaps.toSwap.fromToken, aTwoSwaps.toSwap.toToken, aRouteToAmount.router, aTwoSwaps.toSwap.fromAmount);
              aRouteToAmount.toFromRate = amountAndRate.toFromRate;
              aRouteToAmount.toAmount = amountAndRate.toAmount;             
            } catch (e) {
              flog.error(`PTSS.add: ERROR - 2;`);
              aRouteToAmount.toFromRate = 0;
            } 
        }
        aTwoSwaps.toWinnerIdx = this.findWinnerIdx(aTwoSwaps.toSwap.routerToAmountList);
        this.twoSwapsArray.push(aTwoSwaps);
    }
    public async refresh(idx:number){
        flog.debug(`PTSS.refresh: START;`);
        this.isBusy = true;
        let aTwoSwaps = this.twoSwapsArray[idx];

        let fromSwapPromises = [];
        for (let aRTA of aTwoSwaps.fromSwap.routerToAmountList) {
            let promANewAmountAndRate = getSwapAmountAndRate(aTwoSwaps.fromSwap.fromToken, aTwoSwaps.fromSwap.toToken, aRTA.router, aTwoSwaps.fromSwap.fromAmount);
            fromSwapPromises.push(promANewAmountAndRate);
        }
        Promise.all(fromSwapPromises).then((newAmountAndRates) => {
            flog.debug(`PTSS.refresh: fromSwap: 1.0;`);
            let fromMaxRate = 0;
            let fromWinnerIdx = 0;
            for (let i = 0; i < newAmountAndRates.length; i++) {
                let aNewAmountAndRate = newAmountAndRates[i];
                flog.debug(`PTSS.refresh: fromSwap: aNAAR[${i}].toFromRate:${aNewAmountAndRate.toFromRate.toFixed(6)};`);
                if (aNewAmountAndRate.toFromRate > fromMaxRate) {
                    fromWinnerIdx = i;
                    fromMaxRate = aNewAmountAndRate.toFromRate;
                }
            }
            flog.debug(`PTSS.refresh: fromSwap: fromWinnerIdx:${fromWinnerIdx}; fromMaxRate:${fromMaxRate.toFixed(6)};`);
            let toSwapPromises = [];
            for (let aRTA of aTwoSwaps.toSwap.routerToAmountList) {
                let promANewAmountAndRate = getSwapAmountAndRate(aTwoSwaps.toSwap.fromToken, aTwoSwaps.toSwap.toToken, aRTA.router, aTwoSwaps.toSwap.fromAmount);
                toSwapPromises.push(promANewAmountAndRate);
            }
            Promise.all(toSwapPromises).then(async (newAmountAndRates) => {
                flog.debug(`PTSS.refresh: toSwap: 1.0;`);
                let toMaxRate = 0;
                let toWinnerIdx = 0;
                for (let i = 0; i < newAmountAndRates.length; i++) {
                    let aNewAmountAndRate = newAmountAndRates[i];
                    flog.debug(`PTSS.refresh: toSwap: aNAAR[${i}].toFromRate:${aNewAmountAndRate.toFromRate.toFixed(6)};`);
                    if (aNewAmountAndRate.toFromRate > toMaxRate) {
                        toWinnerIdx = i;
                        toMaxRate = aNewAmountAndRate.toFromRate;
                    }
                }
                flog.debug(`PTSS.refresh: toSwap: toWinnerIdx:${toWinnerIdx}; toMaxRate:${toMaxRate.toFixed(6)};`);

                let newFinalRate = fromMaxRate * toMaxRate;
                flog.debug(`PTSS.refresh: newFinalRate:${newFinalRate.toFixed(6)}; fromWinnerIdx:${fromWinnerIdx}; toWinnerIdx:${toWinnerIdx};`);

                if (newFinalRate > this.latestRateThreshold) {
                    if (PCKFLBConfig.remainingFlashloanTries > 0) {
                        flog.debug(`PTSS.refresh: will execute flashloan...`);
                        let results = await PCKFlashloanExecutor.executeFlashloanWithIdxs(this.swapRoutesList[idx], fromWinnerIdx, toWinnerIdx);
                        PCKFLBConfig.remainingFlashloanTries--;
                        flog.debug(`PTSS.refresh: flashloan executed, results=${results}; remainingFlashloanTries:${PCKFLBConfig.remainingFlashloanTries};`);
                    }   else {
                        flog.debug(`PTSS.refresh: will not execute flashloan; remainingFlashloanTries:${PCKFLBConfig.remainingFlashloanTries};`);
                    }
                }
                this.isBusy = false;
            });
        });

    }
/*
    public async refreshOld(idx:number):Promise<number> {
        flog.debug(`PTSS.refresh: START;`);
        let newFinalRate = 0;
        let aTwoSwaps = this.twoSwapsArray[idx];

        //flog.debug(`PTSS.refresh: refreshing fromSwap...`);
        for (let aRTA of aTwoSwaps.fromSwap.routerToAmountList) {
        //aTwoSwaps.fromSwap.routerToAmountList.forEach(async (aRTA) => {
            let newAmountAndRate:IToAmountAndRate = {toAmount:getBigNumber(0), toFromRate:0};
            try {
                newAmountAndRate = await getSwapAmountAndRate(aTwoSwaps.fromSwap.fromToken, aTwoSwaps.fromSwap.toToken, aRTA.router, aTwoSwaps.fromSwap.fromAmount);
            } catch (ex) {
                flog.error(`PTSS.refresh: ERROR - fromSwap getSwapAmountAndRate() returns error;`);
                flog.error(ex);
                newAmountAndRate = {toAmount:getBigNumber(0), toFromRate:0};
            }

            if (newAmountAndRate.toFromRate > aTwoSwaps.fromSwap.routerToAmountList[aTwoSwaps.fromWinnerIdx].toFromRate) {
                flog.debug(`PTSS.refresh: fromSwap newBest%; router:[${aTwoSwaps.fromSwap.routerToAmountList[aTwoSwaps.fromWinnerIdx].router.name}->${aRTA.router.name}], %:[${aTwoSwaps.fromSwap.routerToAmountList[aTwoSwaps.fromWinnerIdx].toFromRate.toFixed(6)}->${newAmountAndRate.toFromRate.toFixed(6)}];`);

                // simply replace the winnerIdx
                aTwoSwaps.fromWinnerIdx = aRTA.idx;

                // and refresh this aRTA
                aRTA.toAmount = newAmountAndRate.toAmount;
                aRTA.toFromRate = newAmountAndRate.toFromRate;

                // here, calculate the finalRate and determine whether need to do flashloan
                newFinalRate = this.getFinalRate(idx);
                flog.debug(`PTSS.refresh: fromSwap newFinal%:${newFinalRate.toFixed(6)};`);
            } else {
                // if not the highest rate, then need to check whether it was the previous winnerIdx
                // first need to refresh this aRTA
                aRTA.toAmount = newAmountAndRate.toAmount;
                aRTA.toFromRate = newAmountAndRate.toFromRate;                
                if (aRTA.idx == aTwoSwaps.fromWinnerIdx) {
                    // it is the previous winnerIdx, need to find the winnerIdx again
                    let newFromWinnerIdx = this.findWinnerIdx(aTwoSwaps.fromSwap.routerToAmountList);
                    flog.debug(`PTSS.refresh: fromSwap updateBest%; router:[${aTwoSwaps.fromSwap.routerToAmountList[aTwoSwaps.fromWinnerIdx].router.name}->${aTwoSwaps.fromSwap.routerToAmountList[newFromWinnerIdx].router.name}], %:[${aTwoSwaps.fromSwap.routerToAmountList[newFromWinnerIdx].toFromRate.toFixed(6)}];`);
                    aTwoSwaps.fromWinnerIdx = newFromWinnerIdx;
                } 
            }
        //});
        }

        //flog.debug(`PTSS.refresh: refreshing toSwap...`);
        for (let aRTA of aTwoSwaps.toSwap.routerToAmountList) {
        //aTwoSwaps.toSwap.routerToAmountList.forEach(async (aRTA) => {
            let newAmountAndRate:IToAmountAndRate = {toAmount:getBigNumber(0), toFromRate:0};
            try {
                newAmountAndRate = await getSwapAmountAndRate(aTwoSwaps.toSwap.fromToken, aTwoSwaps.toSwap.toToken, aRTA.router, aTwoSwaps.toSwap.fromAmount);
            } catch (ex) {
                flog.error(`PTSS.refresh: ERROR - toSwap getSwapAmountAndRate() returns error;`);
                flog.error(ex);
                newAmountAndRate = {toAmount:getBigNumber(0), toFromRate:0};
            }

            if (newAmountAndRate.toFromRate > aTwoSwaps.toSwap.routerToAmountList[aTwoSwaps.toWinnerIdx].toFromRate) {
                flog.debug(`PTSS.refresh: toSwap newBest%; router:[${aTwoSwaps.toSwap.routerToAmountList[aTwoSwaps.toWinnerIdx].router.name}->${aRTA.router.name}], %:[${aTwoSwaps.toSwap.routerToAmountList[aTwoSwaps.toWinnerIdx].toFromRate.toFixed(6)}->${newAmountAndRate.toFromRate.toFixed(6)}];`);

                // simply replace the winnerIdx
                aTwoSwaps.toWinnerIdx = aRTA.idx;

                // and refresh this aRTA
                aRTA.toAmount = newAmountAndRate.toAmount;
                aRTA.toFromRate = newAmountAndRate.toFromRate;

                // here, calculate the finalRate and determine whether need to do flashloan
                newFinalRate = this.getFinalRate(idx);
                flog.debug(`PTSS.refresh: toSwap newFinal%:${newFinalRate.toFixed(6)};`);
            } else {
                // if not the highest rate, then need to check whether it was the previous winnerIdx
                // first need to refresh this aRTA
                aRTA.toAmount = newAmountAndRate.toAmount;
                aRTA.toFromRate = newAmountAndRate.toFromRate;                
                if (aRTA.idx == aTwoSwaps.toWinnerIdx) {
                    // it is the previous winnerIdx, need to find the winnerIdx again
                    let newToWinnerIdx = this.findWinnerIdx(aTwoSwaps.toSwap.routerToAmountList);
                    flog.debug(`PTSS.refresh: toSwap updateBest%; router:[${aTwoSwaps.toSwap.routerToAmountList[aTwoSwaps.toWinnerIdx].router.name}->${aTwoSwaps.toSwap.routerToAmountList[newToWinnerIdx].router.name}], %:[${aTwoSwaps.toSwap.routerToAmountList[newToWinnerIdx].toFromRate.toFixed(6)}];`);
                    aTwoSwaps.toWinnerIdx = newToWinnerIdx;
                } 
            }
        //});
        }
        newFinalRate = this.getFinalRate(idx);
        flog.debug(`PTSS.refresh: END; newFinalRate:${newFinalRate};`);
        return newFinalRate;
        
    }
*/
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

    public printTwoSwaps(idx:number) {
        let aTwoSwaps = this.twoSwapsArray[idx];
        flog.debug(`PTSS.printTwoSwaps: START;`);
        let nFromAmount = Number(ethers.utils.formatUnits(aTwoSwaps.fromSwap.fromAmount, aTwoSwaps.fromSwap.fromToken.decimals));
        flog.debug(`_fromSwap:[${aTwoSwaps.fromSwap.fromToken.symbol}->${aTwoSwaps.fromSwap.toToken.symbol}]; $:${nFromAmount.toFixed(4)}; fw:${aTwoSwaps.fromWinnerIdx};`);
        for (let i = 0; i < aTwoSwaps.fromSwap.routerToAmountList.length; i++) {
            let aRTA = aTwoSwaps.fromSwap.routerToAmountList[i];
            let nToAmount = Number(ethers.utils.formatUnits(aRTA.toAmount, aTwoSwaps.fromSwap.toToken.decimals));
            let msg = `__@:${aRTA.router.name.padStart(18)}; $:${nToAmount.toFixed(4).padStart(10)}; %:${aRTA.toFromRate.toFixed(8)};`;
            if (i == aTwoSwaps.fromWinnerIdx) {
                msg += `<--winner;`;
            }
            flog.debug(msg);
        }
        nFromAmount = Number(ethers.utils.formatUnits(aTwoSwaps.toSwap.fromAmount, aTwoSwaps.toSwap.fromToken.decimals));
        flog.debug(`_toSwap:[${aTwoSwaps.toSwap.fromToken.symbol}->${aTwoSwaps.toSwap.toToken.symbol}]; $:${nFromAmount.toFixed(4)}; tw:${aTwoSwaps.toWinnerIdx};`);
        for (let i = 0; i < aTwoSwaps.toSwap.routerToAmountList.length; i++) {
            let aRTA = aTwoSwaps.toSwap.routerToAmountList[i];
            let nToAmount = Number(ethers.utils.formatUnits(aRTA.toAmount, aTwoSwaps.toSwap.toToken.decimals));
            let msg = `__@:${aRTA.router.name.padStart(18)}; $:${nToAmount.toFixed(4).padStart(10)}; %:${aRTA.toFromRate.toFixed(8)};`;
            if (i == aTwoSwaps.toWinnerIdx) {
                msg += `<--winner;`;
            }
            flog.debug(msg);
        }
        flog.debug(`PTSS.printTwoSwaps: END; finalRate:${this.getFinalRate(idx)};`);
    }

}
export const PCKParallelTwoSwapsStrategy = ParallelTwoSwapsStrategy.Instance;