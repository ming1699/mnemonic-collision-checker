import HDKey from 'hdkey';
import { publicToAddress, toChecksumAddress } from "ethereumjs-util";

interface Balance {
  currency: string;
  amount: string;
  symbol?: string;
  tokenAddress?: string;
}

// 定义所有支持的链类型
export type ChainType = 'ETH' | 'BSC' | 'HECO' | 'POLYGON';

// 定义派生路径类型
type DerivationPaths = Record<ChainType, readonly string[]>;

// 修改 DERIVATION_PATHS 的定义，移除 TRX
const DERIVATION_PATHS: DerivationPaths = {
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
  ]
} as const;

export const deriveAddressFromSeed = async (seed: Buffer, chainType: ChainType): Promise<string[]> => {
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

export const getAddressBalances = async (address: string, chain: ChainType): Promise<Balance[]> => {
  try {
    const balances: Balance[] = [];
    
    // 获取 API keys
    const etherscanKey = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY;
    const bscscanKey = process.env.NEXT_PUBLIC_BSCSCAN_API_KEY;
    const polygonscanKey = process.env.NEXT_PUBLIC_POLYGONSCAN_API_KEY;
    const hecoinfoKey = process.env.NEXT_PUBLIC_HECOINFO_API_KEY;
    
    // 根据不同链调用不同的 API
    switch (chain) {
      case 'ETH':
        // 以太坊余额检查
        const ethResponse = await fetch(
          `/api/etherscan/api?module=account&action=balance&address=${address}&tag=latest&apikey=${etherscanKey}`
        );
        
        if (!ethResponse.ok) {
          console.error('ETH API 请求失败:', await ethResponse.text());
          return [];
        }
        
        const ethData = await ethResponse.json();
        if (ethData.status === '1' && Number(ethData.result) > 0) {
          balances.push({
            currency: 'ETH',
            amount: (Number(ethData.result) / 1e18).toString(),
            symbol: 'ETH'
          });
        }
        break;
        
      case 'BSC':
        // BSC 余额检查
        const bscResponse = await fetch(
          `/api/bscscan/api?module=account&action=balance&address=${address}&tag=latest&apikey=${bscscanKey}`
        );
        
        if (!bscResponse.ok) {
          console.error('BSC API 请求失败:', await bscResponse.text());
          return [];
        }
        
        const bscData = await bscResponse.json();
        if (bscData.status === '1' && Number(bscData.result) > 0) {
          balances.push({
            currency: 'BNB',
            amount: (Number(bscData.result) / 1e18).toString(),
            symbol: 'BNB'
          });
        }
        break;
        
      case 'HECO':
        // HECO 余额检查
        const hecoResponse = await fetch(
          `/api/hecoinfo/api?module=account&action=balance&address=${address}&tag=latest&apikey=${hecoinfoKey}`
        );
        
        if (!hecoResponse.ok) {
          console.error('HECO API 请求失败:', await hecoResponse.text());
          return [];
        }
        
        const hecoData = await hecoResponse.json();
        if (hecoData.status === '1' && Number(hecoData.result) > 0) {
          balances.push({
            currency: 'HT',
            amount: (Number(hecoData.result) / 1e18).toString(),
            symbol: 'HT'
          });
        }
        break;
        
      case 'POLYGON':
        // Polygon 余额检查
        const polygonResponse = await fetch(
          `/api/polygonscan/api?module=account&action=balance&address=${address}&tag=latest&apikey=${polygonscanKey}`
        );
        
        if (!polygonResponse.ok) {
          console.error('Polygon API 请求失败:', await polygonResponse.text());
          return [];
        }
        
        const polygonData = await polygonResponse.json();
        if (polygonData.status === '1' && Number(polygonData.result) > 0) {
          balances.push({
            currency: 'MATIC',
            amount: (Number(polygonData.result) / 1e18).toString(),
            symbol: 'MATIC'
          });
        }
        break;
    }
    
    return balances;
  } catch (error) {
    console.error('检查余额时出错:', error);
    return [];
  }
};

// 导出链配置
export const CHAIN_CONFIGS = {
  ETH: {
    name: '以太坊',
    symbol: 'ETH',
    decimals: 18
  },
  BSC: {
    name: '币安智能链',
    symbol: 'BNB',
    decimals: 18
  },
  HECO: {
    name: '火币生态链',
    symbol: 'HT',
    decimals: 18
  },
  POLYGON: {
    name: 'Polygon',
    symbol: 'MATIC',
    decimals: 18
  }
} as const;