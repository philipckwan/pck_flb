import * as log4js from "log4js";
//import {erc20Token, ERC20_TOKEN, routerAddress, SWAP_ROUTER} from "./addresses";

import { ethers } from "ethers";

const flog = log4js.getLogger("file");
const clog = log4js.getLogger("console");

export const web3Provider = new ethers.providers.JsonRpcProvider(
    process.env.WEB3_RPC_URL
);
  
export const getBigNumber = (amount: number, decimals = 18) => {
    return ethers.utils.parseUnits(amount.toString(), decimals);
};

export const formatDate = (d: number) => {
    let aDate = new Date(d);
    let month = aDate.getMonth() + 1;
    let date = aDate.getDate();
    let hour = aDate.getHours();
    let minute = aDate.getMinutes();
    let second = aDate.getSeconds();
    let mSec = aDate.getMilliseconds();
    let testVal = process.env.TEST_KEY;
    //clog.debug(`utility.formatDate: testVal:${testVal};`);
    return `${date.toString().padStart(2,"0")}/${month.toString().padStart(2,"0")}@${hour.toString().padStart(2,"0")}:${minute.toString().padStart(2,"0")}:${second.toString().padStart(2,"0")}:${mSec.toString().padStart(3,"0")}`;
}