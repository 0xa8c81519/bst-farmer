"use strict"
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const ethers = require("ethers");
const { mnemonic } = require('./secret.js');
const log4js = require('log4js');
const config = require('./conf/conf.js');
const PaymentFarmingProxyABIJson = require('./abis/PaymentFarmingProxy.json');
const LiqudityFarmingProxyABIJson = require('./abis/LiquidityFarmingProxy.json');
const BStablePoolABIJson = require('./abis/BStablePool.json');
const BEP20ABIJson = require('./abis/BEP20.json');
// const apiModule = require('./api.js');

log4js.configure(config.log4jsConfig);
const logger = log4js.getLogger('BST Farmer');

let network = process.argv[2];

// 初始化rpc provider，浏览器中不需要
const provider = new ethers.providers.JsonRpcProvider(config.default[network].rpc.url);
let wallets = new Array();
for (let i = 0; i < config.default.accountsSize; i++) {
    let path = "m/44'/60'/0'/0/" + i;
    // 初始化助记词
    let walletMnemonic = ethers.Wallet.fromMnemonic(mnemonic, path);
    // 初始化钱包
    let wallet = walletMnemonic.connect(provider);
    wallets.push(wallet);
}

// let api = apiModule.init(log4js, config.default);

const usdcContract = new ethers.Contract(config.default[network].usdc, BEP20ABIJson.abi, provider);
const busdContract = new ethers.Contract(config.default[network].busd, BEP20ABIJson.abi, provider);
const usdtContract = new ethers.Contract(config.default[network].usdt, BEP20ABIJson.abi, provider);
const paymentContract = new ethers.Contract(config.default[network].payment.address, PaymentFarmingProxyABIJson.abi, provider);
const liquidityContract = new ethers.Contract(config.default[network].liquidity.address, LiqudityFarmingProxyABIJson.abi, provider);



let listAccounts = () => {
    logger.info('Accounts: ');
    for (let i = 0; i < wallets.length; i++) {
        logger.info('account[' + i + ']: ' + wallets[i].address);
    }
}

let listAccountsBalance = () => {
    let arr = new Array();
    wallets.forEach(wallet => {
        let pArr = new Array();
        pArr.push(usdcContract.balanceOf(wallet.address));
        pArr.push(busdContract.balanceOf(wallet.address));
        pArr.push(usdtContract.balanceOf(wallet.address));
        pArr.push(wallet.getBalance());
        pArr.push(paymentContract.pool().then(pool => {
            let poolContract = new ethers.Contract(pool, BStablePoolABIJson.abi, provider);
            return poolContract.balanceOf(wallet.address);
        }));
        pArr.push(paymentContract.token().then(bst => {
            let bstContract = new ethers.Contract(bst, BEP20ABIJson.abi, provider);
            return bstContract.balanceOf(wallet.address);
        }));
        arr.push(Promise.all(pArr));
    });
    Promise.all(arr).then(res => {
        res.forEach((e, index) => {
            logger.info("Balance of [" + index + "]: " + wallets[index].address);
            logger.info("USDC: " + ethers.utils.formatEther(e[0]));
            logger.info("BUSD: " + ethers.utils.formatEther(e[1]));
            logger.info("USDT: " + ethers.utils.formatEther(e[2]));
            logger.info("BNB: " + ethers.utils.formatEther(e[3]));
            logger.info("BSPL-03: " + ethers.utils.formatEther(e[4]));
            logger.info("BST: " + ethers.utils.formatEther(e[5]));
            logger.info("==============================");
        });
    });
};

let getBalance = (index) => {
    let wallet = wallets[index];
    let pArr = new Array();
    pArr.push(usdcContract.balanceOf(wallet.address));
    pArr.push(busdContract.balanceOf(wallet.address));
    pArr.push(usdtContract.balanceOf(wallet.address));
    pArr.push(wallet.getBalance());
    pArr.push(paymentContract.pool().then(pool => {
        let poolContract = new ethers.Contract(pool, BStablePoolABIJson.abi, provider);
        return poolContract.balanceOf(wallet.address);
    }));
    pArr.push(paymentContract.token().then(bst => {
        let bstContract = new ethers.Contract(bst, BEP20ABIJson.abi, provider);
        return bstContract.balanceOf(wallet.address);
    }));
    Promise.all(pArr).then(res => {
        logger.info("Balance of [" + index + "]: " + wallet.address);
        logger.info("USDC: " + ethers.utils.formatEther(res[0]));
        logger.info("BUSD: " + ethers.utils.formatEther(res[1]));
        logger.info("USDT: " + ethers.utils.formatEther(res[2]));
        logger.info("BNB: " + ethers.utils.formatEther(res[3]));
        logger.info("BSPL-03: " + ethers.utils.formatEther(res[4]));
        logger.info("BST: " + ethers.utils.formatEther(res[5]));
        logger.info("==============================");
    });
};

let distributeBNB = (index, amtPerAcc) => {
    let wallet = wallets[0];
    let amt = ethers.utils.parseEther(amtPerAcc);
    wallet.sendTransaction({ to: wallets[index].address, value: amt.toHexString() }).catch(e => {
        console.error("BNB ditribution error on : " + index);
        console.error(e.message);
    });
};

let collectBNB = async () => {
    let maxAmts = new Array();
    for (let i = 0; i < wallets.length; i++) {
        let wallet = wallets[i];
        let balance = await wallet.getBalance();
        let price = await wallet.getGasPrice();
        let gasFee = ethers.BigNumber.from(21000).mul(price);
        let maxAmt = balance.gt(0) ? balance.sub(gasFee) : ethers.BigNumber.from(0);
        maxAmts.push(maxAmt);
    }
    for (let i = 1; i < wallets.length; i++) {
        try {
            await wallets[i].sendTransaction({ to: wallets[0].address, value: maxAmts[i].toHexString() });
        } catch (e) {
            logger.error("Collect BNB error at: " + i);
            logger.error(e.message);
        }
    }
};

let distributeToken = (index, amtPerAcc, tokenAddress) => {
    let wallet = wallets[0];
    let amt = ethers.utils.parseEther(amtPerAcc);
    let tokenContract = new ethers.Contract(tokenAddress, BEP20ABIJson.abi, provider);
    tokenContract.connect(wallet).transfer(wallets[index].address, amt).then(() => {
        // getBalance(index);
    }).catch(e => {
        logger.error("Distribution error on : " + index);
        logger.error(e.message);
    });
};

let collectToken = (tokenAddress) => {
    let wallet = wallets[0];
    let pArr = new Array();
    let tokenContract = new ethers.Contract(tokenAddress, BEP20ABIJson.abi, provider);
    for (let i = 0; i < wallets.length; i++) {
        pArr.push(tokenContract.balanceOf(wallets[i].address));
    }
    Promise.all(pArr).then(async res => {
        for (let i = 0; i < wallets.length; i++) {
            if (i > 0) {
                try {
                    await tokenContract.connect(wallets[i]).transfer(wallet.address, res[i]);
                } catch (e) {
                    logger.error("Collect Token error at: " + i);
                    logger.error(e);
                }
            }
        }
    }).catch(e => {
        logger.error(e);
    })
};

let addPool3InitLiquidity = (amts) => {
    let wallet = wallets[0];
    paymentContract.pool().then(pool => {
        let poolContract = new ethers.Contract(pool, BStablePoolABIJson.abi, provider);
        let _amts = new Array();
        amts.forEach((e, i) => {
            let amt = ethers.utils.parseEther(e);
            _amts.push(amt);
        });
        usdcContract.connect(wallet).approve(poolContract.address, _amts[0]).then(r => {
            return busdContract.connect(wallet).approve(poolContract.address, _amts[1]);
        }).then(r => {
            return usdtContract.connect(wallet).approve(poolContract.address, _amts[2]);
        }).then(r => {
            return poolContract.connect(wallet).add_liquidity(_amts, 0).then();
        });
    });
};

let paymentFarming = async () => {
    let payEvent = paymentContract.filters.Pay(null, null, null, null);
    paymentContract.on(payEvent, (payToken, receiptToken, payer, receipt) => {
        logger.info('Get a payment:');
        logger.info('payToken: ' + payToken);
        logger.info('receiptToken: ' + receiptToken);
        logger.info('payer: ' + payer);
        logger.info('receipt: ' + receipt);
        logger.info('==============================');
    });
    for (; true;) {
        let delayMS = Math.floor(Math.random() * 10 * 1000);
        await delay(delayMS);
        let wltIndex = Math.floor(Math.random() * config.default.accountsSize);
        let recIndex = Math.floor(Math.random() * config.default.accountsSize);
        let coiIndex = Math.floor(Math.random() * 3);
        let wallet = wallets[wltIndex];
        let coins = new Array();
        coins.push(usdcContract);
        coins.push(busdContract);
        coins.push(usdtContract);
        let randomAmtPercent = Math.floor(Math.random() * 100);
        try {
            let balance = await coins[coiIndex].balanceOf(wallet.address);
            let amt = balance.mul(randomAmtPercent).div(100);
            await coins[coiIndex].connect(wallet).approve(paymentContract.address, amt);
            await delay(5000);
            await paymentContract.connect(wallet).pay(coins[coiIndex].address, wallets[recIndex].address, amt);
            logger.info('Payment done!');
            await delay(5000);
            await paymentContract.connect(wallet).withdrawReward();
        } catch (e) {
            logger.error(e);
        }
        logger.info('Withdraw Payment Rward!');
    }
};

let liquidityFarming = async () => {
    let pool = await paymentContract.pool();
    let poolContract = new ethers.Contract(pool, BStablePoolABIJson.abi, provider);
    let addLiquidityEvent = poolContract.filters.AddLiquidity(null, null, null, null, null);
    poolContract.on(addLiquidityEvent, (provider, token_amounts, fees, invariant, token_supply) => {
        logger.info('Get a AddLiquditidy Event: ');
        logger.info('token_amounts: ' + JSON.stringify(token_amounts));
        logger.info('fees: ' + JSON.stringify(fees));
        logger.info('invariant: ' + invariant);
        logger.info('token_supply: ' + token_supply);
        logger.info('==============================');
    });
    let withdrawEvent = liquidityContract.filters.Withdraw(null, null, null);
    liquidityContract.on(withdrawEvent, (user, pid, amount) => {
        logger.info('Get a Withdraw Event: ');
        logger.info('user: ' + user);
        logger.info('pid: ' + pid);
        logger.info('amount: ' + amount);
        logger.info('==============================');
    });
    let depositEvent = liquidityContract.filters.Deposit(null, null, null);
    liquidityContract.on(depositEvent, (user, pid, amount) => {
        logger.info('Get a Deposit Event: ');
        logger.info('user: ' + user);
        logger.info('pid: ' + pid);
        logger.info('amount: ' + amount);
        logger.info('==============================');
    });
    for (; true;) {
        let delayMS = Math.floor(Math.random() * 10 * 1000);
        await delay(delayMS);
        let wltIndex = Math.floor(Math.random() * config.default.accountsSize);
        let wallet = wallets[wltIndex];
        try {
            let pendingBST = await liquidityContract.pendingReward(2, wallet.address);
            let lpBalance = await poolContract.balanceOf(wallet.address);
            if (pendingBST.lte(0) && lpBalance.lte(0)) {
                // add liquidity
                let usdcBal = await usdcContract.balanceOf(wallet.address);
                let busdBal = await busdContract.balanceOf(wallet.address);
                let usdtBal = await usdtContract.balanceOf(wallet.address);
                let randPercent = Math.floor(Math.random() * 100);
                let amts = new Array();
                amts.push(usdcBal.mul(randPercent).div(100));
                amts.push(busdBal.mul(randPercent).div(100));
                amts.push(usdtBal.mul(randPercent).div(100));
                await usdcContract.connect(wallet).approve(pool, amts[0]);
                await delay(3000);
                await busdContract.connect(wallet).approve(pool, amts[1]);
                await delay(3000);
                await usdtContract.connect(wallet).approve(pool, amts[2]);
                await delay(3000);
                await poolContract.connect(wallet).add_liquidity(amts, 0);
                logger.info('Add liquidity!');
            }
            if (pendingBST.gt(0)) {
                // withdraw reward 
                await liquidityContract.connect(wallet).withdraw(2, 0);
                logger.info('Withdraw reward!');
            }
            if (lpBalance.gt(0)) {
                // deposit lp
                await poolContract.connect(wallet).approve(liquidityContract.address, lpBalance);
                await delay(3000);
                await liquidityContract.connect(wallet).deposit(2, lpBalance);
                logger.info('Deposit LP!');
            }
        } catch (e) {
            logger.error(e);
        }
    }
};

let intervalFarming = async (delayMs) => {
    if (delayMs <= 0) {
        return;
    }
    let payEvent = paymentContract.filters.Pay(null, null, null, null);
    paymentContract.on(payEvent, (payToken, receiptToken, payer, receipt) => {
        logger.info('Get a payment:');
        logger.info('payToken: ' + payToken);
        logger.info('receiptToken: ' + receiptToken);
        logger.info('payer: ' + payer);
        logger.info('receipt: ' + receipt);
        logger.info('==============================');
    });
    let pool = await paymentContract.pool();
    let poolContract = new ethers.Contract(pool, BStablePoolABIJson.abi, provider);
    let addLiquidityEvent = poolContract.filters.AddLiquidity(null, null, null, null, null);
    poolContract.on(addLiquidityEvent, (provider, token_amounts, fees, invariant, token_supply) => {
        logger.info('Get a AddLiquditidy Event: ');
        logger.info('token_amounts: ' + JSON.stringify(token_amounts));
        logger.info('fees: ' + JSON.stringify(fees));
        logger.info('invariant: ' + invariant);
        logger.info('token_supply: ' + token_supply);
        logger.info('==============================');
    });
    let withdrawEvent = liquidityContract.filters.Withdraw(null, null, null);
    liquidityContract.on(withdrawEvent, (user, pid, amount) => {
        logger.info('Get a Withdraw Event: ');
        logger.info('user: ' + user);
        logger.info('pid: ' + pid);
        logger.info('amount: ' + amount);
        logger.info('==============================');
    });
    let depositEvent = liquidityContract.filters.Deposit(null, null, null);
    liquidityContract.on(depositEvent, (user, pid, amount) => {
        logger.info('Get a Deposit Event: ');
        logger.info('user: ' + user);
        logger.info('pid: ' + pid);
        logger.info('amount: ' + amount);
        logger.info('==============================');
    });
    let paymenntFarming = async wallet => {
        let recIndex = Math.floor(Math.random() * config.default.accountsSize);
        let coiIndex = Math.floor(Math.random() * 3);
        let coins = new Array();
        coins.push(usdcContract);
        coins.push(busdContract);
        coins.push(usdtContract);
        let randomAmtPercent = Math.floor(Math.random() * 100);
        try {
            let balance = await coins[coiIndex].balanceOf(wallet.address);
            let amt = balance.mul(randomAmtPercent).div(100);
            await coins[coiIndex].connect(wallet).approve(paymentContract.address, amt);
            await delay(5000);
            await paymentContract.connect(wallet).pay(coins[coiIndex].address, wallets[recIndex].address, amt);
            logger.info('Payment done!');
            await delay(5000);
            await paymentContract.connect(wallet).withdrawReward();
        } catch (e) {
            logger.error(e);
        }
        logger.info('Withdraw Payment Rward!');
    };
    let liquidityFarming = async wallet => {
        try {
            let pendingBST = await liquidityContract.pendingReward(2, wallet.address);
            let lpBalance = await poolContract.balanceOf(wallet.address);
            if (pendingBST.lte(0) && lpBalance.lte(0)) {
                // add liquidity
                let usdcBal = await usdcContract.balanceOf(wallet.address);
                let busdBal = await busdContract.balanceOf(wallet.address);
                let usdtBal = await usdtContract.balanceOf(wallet.address);
                let randPercent = Math.floor(Math.random() * 100);
                let amts = new Array();
                amts.push(usdcBal.mul(randPercent).div(100));
                amts.push(busdBal.mul(randPercent).div(100));
                amts.push(usdtBal.mul(randPercent).div(100));
                await usdcContract.connect(wallet).approve(pool, amts[0]);
                await delay(3000);
                await busdContract.connect(wallet).approve(pool, amts[1]);
                await delay(3000);
                await usdtContract.connect(wallet).approve(pool, amts[2]);
                await delay(3000);
                await poolContract.connect(wallet).add_liquidity(amts, 0);
                logger.info('Add liquidity!');
            }
            if (pendingBST.gt(0)) {
                // withdraw reward 
                await liquidityContract.connect(wallet).withdraw(2, 0);
                logger.info('Withdraw reward!');
            }
            if (lpBalance.gt(0)) {
                // deposit lp
                await poolContract.connect(wallet).approve(liquidityContract.address, lpBalance);
                await delay(3000);
                await liquidityContract.connect(wallet).deposit(2, lpBalance);
                logger.info('Deposit LP!');
            }
        } catch (e) {
            logger.error(e);
        }
    };
    let task = async () => {
        let wallet = wallets[0];
        await liquidityFarming(wallet);
        await paymenntFarming(wallet);
    };
    setInterval(task, delayMs);
};

let funName = process.argv[3];
switch (funName) {
    case 'addLiquidity':
        logger.info('BST Farmer - addLiquidity:');
        let arr = new Array();
        arr.push(process.argv[4]);
        arr.push(process.argv[5]);
        arr.push(process.argv[6]);
        addPool3InitLiquidity(arr);
        break;
    case 'listAccounts':
        logger.info('BST Farmer - listAccounts:');
        listAccounts();
        break;
    case 'listAccountsBalance':
        logger.info('BST Farmer - listAccountsBalance:');
        listAccountsBalance();
        break;
    case 'getBalance':
        logger.info('BST Farmer - getBalance:');
        getBalance(process.argv[4]);
        break;
    case 'distributeBNB':
        logger.info('BST Farmer - distributeBNB:');
        distributeBNB(process.argv[4], process.argv[5]);
        break;
    case 'collectBNB':
        logger.info('BST Farmer - collectBNB:');
        collectBNB();
        break;
    case 'distributeUSDC':
        logger.info('BST Farmer - distributeUSDC:');
        distributeToken(process.argv[4], process.argv[5], config.default[network].usdc);
        break;
    case 'collectUSDC':
        logger.info('BST Farmer - collectUSDC:');
        collectToken(config.default[network].usdc);
        break;
    case 'distributeBUSD':
        logger.info('BST Farmer - distributeBUSD:');
        distributeToken(process.argv[4], process.argv[5], config.default[network].busd);
        break;
    case 'collectBUSD':
        logger.info('BST Farmer - collectBUSD:');
        collectToken(config.default[network].busd);
        break;
    case 'distributeUSDT':
        logger.info('BST Farmer - distributeUSDT:');
        distributeToken(process.argv[4], process.argv[5], config.default[network].usdt);
        break;
    case 'collectUSDT':
        logger.info('BST Farmer - collectUSDT:');
        collectToken(config.default[network].usdt);
        break;
    case 'collectBST':
        logger.info('BST Farmer - collectBST:');
        paymentContract.token().then(bst => {
            return collectToken(bst);
        });
        break;
    case 'paymentFarming':
        logger.info('BST Farmer - Payment Farming');
        paymentFarming();
        break;
    case 'liquidityFarming':
        logger.info('BST Farmer - Liquidity Farming');
        liquidityFarming();
        break;
    case 'intervalFarming':
        logger.info('BST Farmer - Interval Farming');
        intervalFarming(process.argv[4] * 1000);
        break;
    default: {
        logger.info('BST Farmer - starting');
    }
}