// 添加调试日志
console.log('定义类型文件加载');

export type Checkpoint = {
  timestamp: number;
  lastMnemonic?: string;
  count?: number;
}

export type Balance = {
  currency: string;
  amount: string;
  symbol?: string;
  tokenAddress?: string;
}

export type ValidMnemonic = {
  mnemonic: string;
  address: string;
  balances: Balance[];
  chain: string;
}

// 添加调试日志
console.log('类型定义完成'); 