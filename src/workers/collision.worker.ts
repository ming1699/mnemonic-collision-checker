import { generateMnemonic, mnemonicToSeedSync } from 'bip39';
import { deriveAddressFromSeed } from '../utils/blockchain';

self.onmessage = async (e) => {
  const { count, pathType } = e.data;
  
  for (let i = 0; i < count; i++) {
    const mnemonic = generateMnemonic();
    const seed = mnemonicToSeedSync(mnemonic);
    const address = deriveAddressFromSeed(seed, pathType);
    
    self.postMessage({
      mnemonic,
      address,
      index: i
    });
  }
}; 