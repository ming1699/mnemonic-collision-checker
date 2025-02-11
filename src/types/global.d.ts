declare global {
  type Checkpoint = {
    timestamp: number;
    lastMnemonic?: string;
    count?: number;
  }

  type Balance = {
    currency: string;
    amount: string;
    symbol?: string;
    tokenAddress?: string;
  }

  type ValidMnemonic = {
    mnemonic: string;
    address: string;
    balances: Balance[];
    chain: string;
  }
}

// 确保这个文件被视为模块
export {}; 