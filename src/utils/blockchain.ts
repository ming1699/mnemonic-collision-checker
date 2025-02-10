import HDKey from 'hdkey';
import { publicToAddress, toChecksumAddress } from "ethereumjs-util";

interface Balance {
  currency: string;
  amount: string;
  symbol?: string;
  tokenAddress?: string;
}

// 添加更多常用的派生路径
const DERIVATION_PATHS = {
  // 以太坊系列
  ETH: [
    "m/44'/60'/0'/0/0",     // 标准路径
    "m/44'/60'/0'",         // Ledger Legacy
    "m/44'/60'/0'/0",       // MEW
    "m/44'/60'",            // 简化路径
    "m/44'/60'/0'/0/1",     // 第二个地址
    "m/44'/60'/0'/0/2",     // 第三个地址
  ],
  BSC: [
    "m/44'/60'/0'/0/0",
    "m/44'/60'/0'/0/1",
    "m/44'/60'/0'/0/2",
  ],
  HECO: [
    "m/44'/60'/0'/0/0",
    "m/44'/60'/0'/0/1",
  ],
  POLYGON: [
    "m/44'/60'/0'/0/0",
    "m/44'/60'/0'/0/1",
  ],
  TRX: [
    "m/44'/195'/0'/0/0",
    "m/44'/195'/0'/0/1",
  ]
} as const;

export type ChainType = keyof typeof DERIVATION_PATHS | 'TRX';

export const deriveAddressFromSeed = async (seed: Buffer, chainType: ChainType = 'ETH'): Promise<string[]> => {
  try {
    const hdkey = require('hdkey');
    const ethUtil = require('ethereumjs-util');
    const hdWallet = hdkey.fromMasterSeed(seed);
    const addresses: string[] = [];
    
    // 获取当前链的所有派生路径
    const paths = DERIVATION_PATHS[chainType];
    
    // 遍历所有派生路径生成地址
    for (const path of paths) {
      try {
        const wallet = hdWallet.derive(path);
        const pubKey = wallet.publicKey;
        const address = ethUtil.pubToAddress(pubKey, true);
        const formattedAddress = ethUtil.toChecksumAddress(`0x${address.toString('hex')}`);
        addresses.push(formattedAddress);
      } catch (error) {
        console.error(`派生路径 ${path} 生成地址失败:`, error);
        continue;
      }
    }
    
    return addresses;
  } catch (error) {
    console.error("生成地址时出错:", error);
    throw error;
  }
};

// 修改子地址生成功能
const generateChildAddresses = (seed: Buffer, basePath: string, count: number = 20): string[] => {
  const addresses: string[] = [];
  const hdWallet = HDKey.fromMasterSeed(seed);
  const ethUtil = require('ethereumjs-util');
  
  for (let i = 0; i < count; i++) {
    try {
      const path = `${basePath}/${i}`;
      const wallet = hdWallet.derive(path);
      const pubKey = wallet.publicKey;
      const address = ethUtil.pubToAddress(pubKey, true);
      const formattedAddress = ethUtil.toChecksumAddress(`0x${address.toString('hex')}`);
      addresses.push(formattedAddress);
    } catch (error) {
      console.error(`生成子地址失败 (index: ${i}):`, error);
      continue;
    }
  }
  
  return addresses;
};

// 修改余额检查函数支持多链
export async function getAddressBalances(address: string, chain: ChainType = 'ETH') {
  try {
    console.log(`正在检查 ${CHAIN_CONFIGS[chain].name} 链上的地址 ${address}`);
    
    // 如果是 TRX，使用不同的 API 处理逻辑
    if (chain === 'TRX') {
      // 这里添加 TRX 的特殊处理逻辑
      console.log('TRX 链暂不支持余额检查');
      return [];
    }

    const config = CHAIN_CONFIGS[chain];
    const maxRetries = 3;
    let retryCount = 0;
    const balances: Balance[] = [];
    
    while (retryCount < maxRetries) {
      try {
        // 检查原生代币余额
        console.log(`检查 ${config.name} 原生代币余额...`);
        const nativeResponse = await fetch(
          `${config.apiUrl}?module=account&action=balance&address=${address}&tag=latest&apikey=${config.apiKey}`
        );

        if (nativeResponse.ok) {
          const nativeData = await nativeResponse.json();
          if (nativeData.status === "1" && nativeData.result) {
            const balanceInWei = nativeData.result;
            const balanceInEth = parseInt(balanceInWei) / 1e18;
            
            if (balanceInEth > 0) {
              console.log(`在 ${config.name} 上发现原生代币余额: ${balanceInEth}`);
              balances.push({
                currency: chain,
                amount: balanceInEth.toFixed(6)
              });
            }
          }
        }

        // 检查 ERC20 代币余额
        console.log(`检查 ${config.name} ERC20 代币余额...`);
        const tokenResponse = await fetch(
          `${config.apiUrl}?module=account&action=tokentx&address=${address}&startblock=0&endblock=999999999&sort=desc&apikey=${config.apiKey}`
        );

        if (tokenResponse.ok) {
          const tokenData = await tokenResponse.json();
          if (tokenData.status === "1" && tokenData.result) {
            for (const tx of tokenData.result.slice(0, 5)) {
              console.log(`检查代币: ${tx.tokenName}`);
              const tokenBalanceResponse = await fetch(
                `${config.apiUrl}?module=account&action=tokenbalance&contractaddress=${tx.contractAddress}&address=${address}&tag=latest&apikey=${config.apiKey}`
              );

              if (tokenBalanceResponse.ok) {
                const tokenBalanceData = await tokenBalanceResponse.json();
                if (tokenBalanceData.status === "1" && tokenBalanceData.result) {
                  const decimals = parseInt(tx.tokenDecimal);
                  const balance = parseInt(tokenBalanceData.result) / Math.pow(10, decimals);

                  if (balance > 0) {
                    console.log(`发现代币余额: ${tx.tokenName} = ${balance}`);
                    balances.push({
                      currency: tx.tokenName,
                      symbol: tx.tokenSymbol,
                      amount: balance.toFixed(6),
                      tokenAddress: tx.contractAddress
                    });
                  }
                }
              }
              await new Promise(resolve => setTimeout(resolve, 200));
            }
          }
        }

        if (balances.length > 0) {
          console.log(`在 ${config.name} 上发现总计 ${balances.length} 个代币有余额`);
        } else {
          console.log(`在 ${config.name} 上未发现任何余额`);
        }
        return balances;

      } catch (error) {
        retryCount++;
        console.error(`检查 ${config.name} 余额失败，第 ${retryCount} 次重试:`, error);
        if (retryCount === maxRetries) return balances;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }
    return balances;
  } catch (error) {
    console.error(`检查 ${chain} 余额时出错:`, error);
    return [];
  }
}

// 导出 CHAIN_CONFIGS
export const CHAIN_CONFIGS = {
  ETH: {
    apiUrl: '/api/etherscan',
    apiKey: process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY,
    explorer: 'https://etherscan.io',
    name: '以太坊'
  },
  BSC: {
    apiUrl: '/api/bscscan',
    apiKey: process.env.NEXT_PUBLIC_BSCSCAN_API_KEY,
    explorer: 'https://bscscan.com',
    name: '币安智能链'
  },
  HECO: {
    apiUrl: '/api/hecoinfo',
    apiKey: process.env.NEXT_PUBLIC_HECOINFO_API_KEY,
    explorer: 'https://hecoinfo.com',
    name: '火币生态链'
  },
  POLYGON: {
    apiUrl: '/api/polygonscan',
    apiKey: process.env.NEXT_PUBLIC_POLYGONSCAN_API_KEY,
    explorer: 'https://polygonscan.com',
    name: 'Polygon'
  },
  TRX: {
    apiUrl: '/api/tronscan',
    apiKey: process.env.NEXT_PUBLIC_TRONSCAN_API_KEY,
    explorer: 'https://tronscan.org',
    name: '波场'
  }
} as const;