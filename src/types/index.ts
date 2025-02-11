// 检查点类型
export interface ICheckpoint {
  timestamp: number;
  lastMnemonic?: string;
  count?: number;
}

// 余额类型
export interface IBalance {
  currency: string;
  amount: string;
  symbol?: string;
  tokenAddress?: string;
}

// 有效助记词类型
export interface IValidMnemonic {
  mnemonic: string;
  address: string;
  balances: IBalance[];
  chain: string;
} 