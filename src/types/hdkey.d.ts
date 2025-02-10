declare module 'hdkey' {
  export default class HDKey {
    static fromMasterSeed(seed: Buffer): HDKey;
    derive(path: string): HDKey;
    publicKey: Buffer;
  }
} 