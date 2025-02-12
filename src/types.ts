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