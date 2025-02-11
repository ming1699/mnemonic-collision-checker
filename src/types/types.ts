export interface Checkpoint {
  timestamp: number;
  lastMnemonic?: string;
  count?: number;
}

export interface Balance {
  currency: string;
  amount: string;
  symbol?: string;
  tokenAddress?: string;
}

export interface ValidMnemonic {
  mnemonic: string;
  address: string;
  balances: Balance[];
  chain: string;
} 