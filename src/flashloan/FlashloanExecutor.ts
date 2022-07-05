import {IParams, IToken, ISwap, IHop, IFlashloanRoute, ISwapPairRoutes, ItfTrade, ItfHop, ItfFlashloanV2Hop, ItfFlashloanV2Route} from "../interfaces";
import * as log4js from "log4js";
import {ethers} from "ethers";
import * as FlashloanJson from "../abis/Flashloan.json";
import * as FlashloanJsonV2 from "../abis/FlashloanV2.json";
import {dodoV2Pool, PROTOCOL_ROUTER, SWAP_ROUTER} from "../addresses";
import {getBigNumber} from "../utility";
import {PCKWeb3Handler} from "../utils/Web3Handler";
import {PCKFLBConfig} from "../config";
import {PCKPriceV3} from "../uniswap/priceV3"
import {gasPriceCalculator} from "../utils/GasPriceCalculator";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");

type testedPoolMap = { [erc20Address: string]: string[] };
const testedPools: testedPoolMap = {
    WETH: [dodoV2Pool.WETH_USDC],
    USDC: [dodoV2Pool.WETH_USDC],
    WMATIC: [dodoV2Pool.WMATIC_USDC],
    USDT: [dodoV2Pool.USDT_USDC],
  };

class FlashloanExecutor {
    private static _instance: FlashloanExecutor;

    public isBusy = false;

    private constructor() {
    }

    public static get Instance() {
        // Do you need arguments? Make it a regular static method instead.
        return this._instance || (this._instance = new this());
    }

    private getLendingPool(borrowingToken: IToken) {
        return testedPools[borrowingToken.symbol][0];
    }

    private passRoutes(hops:ItfHop[]):ItfFlashloanV2Route[] {
      let flashloanHops:ItfFlashloanV2Hop[] = [];
      for (let i = 0; i < hops.length; i++) {
        let aHop = hops[i];
        let tokenFrom:IToken = hops[i].tokenFrom;
        let tokenTo:IToken = hops[i].tokenTo;
        let aFLHop:ItfFlashloanV2Hop = {
          protocol: aHop.swapRouter.protocol,
          data: this.getProtocolData(aHop.swapRouter.protocol, tokenFrom, tokenTo),
          path: [tokenFrom.address, tokenTo.address]
        } 
        flashloanHops.push(aFLHop);
      }
      return [
        {
          hops: flashloanHops,
          part: 10000,
        },
      ];
    }
    

    public async executeFlashloanTrade(trade:ItfTrade):Promise<[string, string]> {
      let txHash = "n/a";
      if (PCKFLBConfig.remainingFlashloanTries <= 0) {
        flog.debug(`FlEx.executeFlashloanTrade: will not execute flashloan; remainingFlashloanTries:${PCKFLBConfig.remainingFlashloanTries};`);
        return ["NOT EXECUTED", txHash];
      }
      this.isBusy = true;
      let flashloanPool = this.getLendingPool(PCKFLBConfig.baseToken);
      let bnLoanAmount = getBigNumber(PCKFLBConfig.baseToken.amountForSwap, PCKFLBConfig.baseToken.decimals);

      let params = {
        flashLoanPool: flashloanPool,
        loanAmount: bnLoanAmount,
        routes: this.passRoutes(trade.hops),
      };

      const Flashloan = new ethers.Contract(
        PCKFLBConfig.flashloanContractAddress,
        FlashloanJsonV2.abi,
        PCKWeb3Handler.web3Provider
      );

      let executionGasPrice = await gasPriceCalculator.getGasPrice();
      if (executionGasPrice > PCKFLBConfig.gasPriceLimit) {
        flog.debug(`FlEx.executeFlashloanTrade: gasPrice too high, will not execute flashloan; executionGasPrice:${executionGasPrice};`);
        return ["NOT EXECUTED", txHash];
      }

      flog.debug(`FlEx.executeFlashloanTrade: about to flashloan...; executionGasPrice:${executionGasPrice};`);
      let results = "NEW";
      
      try {
        let tx = await Flashloan.connect(PCKWeb3Handler.web3Signer).dodoFlashLoan(params, {
          gasLimit: PCKFLBConfig.gasLimit,
          gasPrice: ethers.utils.parseUnits(`${executionGasPrice}`, "gwei"),
          });
        flog.debug(`FlEx.executeFlashloanTrade: flashloan executed; tx.hash:${tx.hash};`);
        flog.debug(`${JSON.stringify(tx)};`);
        txHash = tx.hash;
        PCKFLBConfig.remainingFlashloanTries--;
        results = "EXECUTED";
      } catch (ex) {
        let msg = `FlEx.executeFlashloanTrade: ERROR;`;
        clog.error(msg);
        flog.error(msg);
        flog.error(ex);
        results = "ERROR";
      }
      this.isBusy = false;
      return [results, txHash];
    }

    public async executeFlashloanPair(firstSwap:ISwapPairRoutes, firstRouteIdx:number, secondSwap:ISwapPairRoutes, secondRouteIdx:number) : Promise<string> {
        if (PCKFLBConfig.remainingFlashloanTries <= 0) {
          flog.debug(`FlEx.executeFlashloanPair: will not execute flashloan; remainingFlashloanTries:${PCKFLBConfig.remainingFlashloanTries};`);
          return "NOT EXECUTED";
        }
        if (this.isBusy) {
          flog.debug(`FlEx.executeFlashloanPair: will not execute flashloan, another flashloan is in progress;`);
          return "BUSY";
        }
        this.isBusy = true;

        let flashloanPool = this.getLendingPool(PCKFLBConfig.baseToken);
        let bnLoanAmount = getBigNumber(PCKFLBConfig.baseToken.amountForSwap, PCKFLBConfig.baseToken.decimals);
        let firstToToken = firstSwap.toToken;
        let firstRoute = firstSwap.routerToAmountList[firstRouteIdx];
        let firstRouteProtocol = firstRoute.router.protocol;

        let secondFromToken = secondSwap.fromToken;
        let secondToToken = secondSwap.toToken;
        let secondRoute = secondSwap.routerToAmountList[secondRouteIdx];
        let secondRouteProtocol = secondRoute.router.protocol;

        let params:IParams = {
          flashLoanPool:flashloanPool,
          loanAmount: bnLoanAmount,
          firstRoutes:[],
          secondRoutes:[]
      }

      let aFirstRoutes = this.toRoute(firstRouteProtocol, PCKFLBConfig.baseToken, firstToToken);
      //let msg = `FlEx.executeFlashloan: aFirstRoutes:${JSON.stringify(aFirstRoutes)};`;
      //clog.debug(msg);
      //flog.debug(msg);
      let aSecondRoutes = this.toRoute(secondRouteProtocol, secondFromToken, secondToToken);
      //msg = `FlEx.executeFlashloan: aSecondRoutes:${JSON.stringify(aSecondRoutes)};`;
      //clog.debug(msg);
      //flog.debug(msg);
      params.firstRoutes = aFirstRoutes;
      params.secondRoutes = aSecondRoutes;

      let executionGasPrice = await gasPriceCalculator.getGasPrice();
      let gasPriceLimit = PCKFLBConfig.gasPriceLimit;

      if (executionGasPrice > gasPriceLimit) {
        flog.debug(`FlEx.executeFlashloanPair: gasPrice too high, will not execute flashloan; executionGasPrice:${executionGasPrice};`);
        return "NOT EXECUTED";
      }

      flog.debug(`FlEx.executeFlashloanPair: about to flashloan...; executionGasPrice:${executionGasPrice};`);
      /*
      if (true) {
        return "DEBUG";
      }
      */
      const Flashloan = new ethers.Contract(
          PCKFLBConfig.flashloanContractAddress,
          FlashloanJson.abi,
          PCKWeb3Handler.web3Provider
      );
      let results = "NEW";
      try {
        let tx = await Flashloan.connect(PCKWeb3Handler.web3Signer).dodoFlashLoan(params, {
          gasLimit: PCKFLBConfig.gasLimit,
          gasPrice: ethers.utils.parseUnits(`${executionGasPrice}`, "gwei"),
          });
        flog.debug(`FlEx.executeFlashloanPair: flashloan executed; tx.hash:${tx.hash};`);
        PCKFLBConfig.remainingFlashloanTries--;
        results = "EXECUTED";
      } catch (ex) {
        let msg = `FlEx.executeFlashloanPair: ERROR;`;
        clog.error(msg);
        flog.error(msg);
        flog.error(ex);
        results = "ERROR";
      }
      this.isBusy = false;
      return results;
    }

    private toRoute(protocol:number, fromToken:IToken, toToken:IToken) {
        let routes:IFlashloanRoute[] = [];
        let aRoute:IFlashloanRoute = {
            part:10000,
            hops:[]
        }
        aRoute.hops = this.toHops(protocol, fromToken, toToken);
        routes.push(aRoute);
        return routes;
    }

    private toHops(protocol:number, fromToken:IToken, toToken:IToken) {
        let hops:IHop[] = [];
        let aHop:IHop = {
            path:[],
            swaps:[]
        }
        aHop.path.push(fromToken.address);
        aHop.path.push(toToken.address);
        let aSwaps = this.toSwaps(protocol, fromToken, toToken);
        aHop.swaps = aSwaps;
        hops.push(aHop);
        return hops;
      };

    private toSwaps(protocol:number, fromToken:IToken, toToken:IToken) {
        let swaps:ISwap[] = [];
        let aSwap:ISwap = {
            protocol:0,
            part:10000,
            data:""
        }
        aSwap.protocol = protocol;
        aSwap.data = this.getProtocolData(protocol, fromToken, toToken);

        swaps.push(aSwap);
        return swaps;
      }
      

      private getProtocolData (protocol: number, fromToken: IToken, toToken: IToken) {
        if (protocol === 0) {
          // uniswap V3
          return ethers.utils.defaultAbiCoder.encode(
            ["address", "uint24"],
            [SWAP_ROUTER[PROTOCOL_ROUTER[protocol]].address, PCKPriceV3.getFeeOnUniV3(fromToken.symbol, toToken.symbol)]
          );
        } else {
          // uniswap V2
          return ethers.utils.defaultAbiCoder.encode(
            ["address"],
            [SWAP_ROUTER[PROTOCOL_ROUTER[protocol]].address]
          );
        }
      }

}

export const PCKFlashloanExecutor = FlashloanExecutor.Instance;