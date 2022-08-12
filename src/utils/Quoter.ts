import * as log4js from "log4js";
import {IToken, IRouter, IToRate, ItfHop} from "../interfaces";
import {getBigNumber, formatDate} from "../utility";
import {BigNumber, ethers} from "ethers";
import {quoterAddressUniswapV3, SWAP_ROUTER} from "../addresses"
import { abi as QuoterABI } from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json";
import * as UniswapV2Router from "../abis/IUniswapV2Router02.json";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");
const slog = log4js.getLogger("statsFile");

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

export class Quoter {

    public name:string;
    public isInited = false;
    private uv3QuoterContract:ethers.Contract;
    private uv2QuoterContractMap:Map<string, ethers.Contract> = new Map();
        
    public constructor(name:string) {
        this.name = name;
    }
    
    public init(web3Provider:ethers.providers.StaticJsonRpcProvider) {
        let msg = "";
        if (this.isInited) {
            msg = `Quoter.init: [${this.name}] WARN - already inited;`;
            clog.warn(msg);
            flog.warn(msg);
        }
  
        msg = `Quoter.init: [${this.name}]; START;`;
        clog.info(msg);
        flog.info(msg);

        this.uv3QuoterContract = new ethers.Contract(
            quoterAddressUniswapV3,
            QuoterABI,
            web3Provider
        );

        let aRouterName = "POLYGON_SUSHISWAP";
        //let aRouter = SWAP_ROUTER[aRouterName];
        //let aRouterAddress = aRouter.address;
        this.uv2QuoterContractMap.set(SWAP_ROUTER[aRouterName].address.toLowerCase(), new ethers.Contract(SWAP_ROUTER[aRouterName].address, UniswapV2Router.abi, web3Provider));
        
        aRouterName = "POLYGON_QUICKSWAP";
        this.uv2QuoterContractMap.set(SWAP_ROUTER[aRouterName].address.toLowerCase(), new ethers.Contract(SWAP_ROUTER[aRouterName].address, UniswapV2Router.abi, web3Provider));

        aRouterName = "POLYGON_APESWAP";
        this.uv2QuoterContractMap.set(SWAP_ROUTER[aRouterName].address.toLowerCase(), new ethers.Contract(SWAP_ROUTER[aRouterName].address, UniswapV2Router.abi, web3Provider));

        aRouterName = "POLYGON_JETSWAP";
        this.uv2QuoterContractMap.set(SWAP_ROUTER[aRouterName].address.toLowerCase(), new ethers.Contract(SWAP_ROUTER[aRouterName].address, UniswapV2Router.abi, web3Provider));

        aRouterName = "POLYGON_POLYCAT";
        this.uv2QuoterContractMap.set(SWAP_ROUTER[aRouterName].address.toLowerCase(), new ethers.Contract(SWAP_ROUTER[aRouterName].address, UniswapV2Router.abi, web3Provider));

        aRouterName = "POLYGON_WAULTSWAP";
        this.uv2QuoterContractMap.set(SWAP_ROUTER[aRouterName].address.toLowerCase(), new ethers.Contract(SWAP_ROUTER[aRouterName].address, UniswapV2Router.abi, web3Provider));

        msg = `Quoter.init: [${this.name}]; DONE;`;
        clog.info(msg);
        flog.info(msg);
        this.isInited = true;
    }


    public async getSwapRateByHop(hop:ItfHop, router:IRouter, blockNum:number) : Promise<[ItfHop, IToRate]> {
        let resultToRate:IToRate = await this.getSwapRate(hop.tokenFrom, hop.tokenTo, router, blockNum);
        return [hop, resultToRate];
    }

    public async getSwapRate(fromToken:IToken, toToken:IToken, router:IRouter, blockNum:number = -1, aRouterIdx = 0, aIsFrom = true) : Promise<IToRate> {
        //let bnFromAmount = getBigNumber(fromAmount, fromToken.decimals);
        let resultToAmountAndRate:IToRate = {toFromRate:0, routerIdx:aRouterIdx, isFrom:aIsFrom, router:router};
        let bnToAmount = getBigNumber(0);
        let startTime = Date.now();
        let bnFromAmount = ethers.utils.parseUnits(fromToken.amountForSwap.toString(), fromToken.decimals); 
        //clog.debug(`Quoter.getSwapRate: ${fromToken.symbol} -> ${toToken.symbol} @ [${router.name}]; from$${fromAmount}`);
        try {
            if (router.name == "POLYGON_UNISWAP_V3") {
                let fee = Quoter.getFeeOnUniV3(fromToken.symbol, toToken.symbol);
                //clog.debug(`_fee:${fee};`);
                bnToAmount = await this.getPriceOnUniV3(fromToken.address, toToken.address, bnFromAmount, fee);
            } else {
                bnToAmount = await this.getPriceOnUniV2(fromToken.address, toToken.address, bnFromAmount, router.address);
            }
        } catch (ex) {
            clog.error(`Quoter.getSwapRate: ERROR;`)
            flog.error(`Quoter.getSwapRate: ERROR;`);
            flog.error(ex);
        }
        let endTime = Date.now();
        let timeDiff = (endTime - startTime) / 1000;
        let nToAmount = Number(ethers.utils.formatUnits(bnToAmount,toToken.decimals));
        let nFromAmount = Number(ethers.utils.formatUnits(bnFromAmount,fromToken.decimals));
        resultToAmountAndRate.toFromRate = nToAmount / nFromAmount;
        //clog.debug(`__toFromRate:${resultToAmountAndRate.toFromRate}; router:${router.name};`);
        slog.debug(`${this.name}@${blockNum}|${fromToken.symbol.padStart(6)}|${toToken.symbol.padStart(6)}|${router.name.padStart(18)}|${resultToAmountAndRate.toFromRate.toFixed(7).padStart(14)}|${formatDate(startTime)}|${formatDate(endTime)}|${timeDiff.toFixed(3)}`);
        return resultToAmountAndRate;
    }

    public static getFeeOnUniV3(tokenIn: string, tokenOut: string) {
        let fee = uniswapV3Fee.get(tokenIn)?.get(tokenOut);
        if (!fee) {
            let msg = `Quoter.getFeeOnUniV3: WARN - fee not found for [${tokenIn}] -> [${tokenOut}], default fee [${DEFAULT_FEE}] will be used;`;
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
    private async getPriceOnUniV3(tokenIn: string, tokenOut: string, amountIn: BigNumber, fee: number): Promise<BigNumber> {
        //clog.debug(`Quoter.getPriceOnUniV3: 1.0; ${tokenIn}; ${tokenOut}; ${amountIn}; ${fee};`);
        let quotedAmountOut = 0;
        try {
        quotedAmountOut = await this.uv3QuoterContract.callStatic.quoteExactInputSingle(
            tokenIn,
            tokenOut,
            fee,
            amountIn.toString(),
            0
        );
        } catch (ex) {
            clog.debug(`Quoter.getPriceOnUniV3: ERROR;`);
            clog.debug(ex);
            throw(ex);
        }
        if (!ethers.BigNumber.isBigNumber(quotedAmountOut)) {
            return getBigNumber(0);
        }
        //clog.debug(`Quoter.getPriceOnUniV3: 2.0;`);
        return quotedAmountOut;
    }

    private async getPriceOnUniV2(tokenIn: string, tokenOut: string, amountIn: BigNumber, routerAddress: string): Promise<BigNumber> {
        let quoterContract = this.uv2QuoterContractMap.get(routerAddress.toLowerCase());
        if (quoterContract == undefined) {
            let msg = `Quoter.getPriceOnUniV2: ERROR - cannot find uniswapV2 quoter contract; routerAddress:${routerAddress};`;
            clog.error(msg);
            flog.error(msg);
            throw new Error(msg);
        }
        const amountsOut = await quoterContract.getAmountsOut(amountIn, [
          tokenIn,
          tokenOut,
        ]);
        if (!amountsOut || amountsOut.length !== 2) {
          return getBigNumber(0);
        }
        return amountsOut[1];
      };
}
