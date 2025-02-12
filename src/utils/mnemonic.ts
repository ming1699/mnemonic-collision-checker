// 创建一个新文件来管理全局助记词集合

// 全局助记词集合
export class GlobalMnemonicSet {
  private static instance: GlobalMnemonicSet;
  private mnemonics: Set<string>;

  private constructor() {
    this.mnemonics = new Set();
  }

  public static getInstance(): GlobalMnemonicSet {
    if (!GlobalMnemonicSet.instance) {
      GlobalMnemonicSet.instance = new GlobalMnemonicSet();
    }
    return GlobalMnemonicSet.instance;
  }

  public add(mnemonic: string): void {
    this.mnemonics.add(mnemonic);
  }

  public has(mnemonic: string): boolean {
    return this.mnemonics.has(mnemonic);
  }

  public clear(): void {
    this.mnemonics.clear();
  }

  public size(): number {
    return this.mnemonics.size;
  }
}

// 导出单例实例
export const globalMnemonics = GlobalMnemonicSet.getInstance(); 