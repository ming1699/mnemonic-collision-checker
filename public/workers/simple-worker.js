// 英语助记词列表
const wordlist = [
  "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
  "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
  // ... 添加完整的BIP39词表
];

// 生成随机助记词的函数
function generateMnemonic() {
  const strength = 128; // 12个词的助记词
  const bytes = new Uint8Array(strength / 8);
  crypto.getRandomValues(bytes);
  
  const bits = bytes.reduce((str, byte) => str + byte.toString(2).padStart(8, '0'), '');
  const words = [];
  
  for (let i = 0; i < strength / 11; i++) {
    const index = parseInt(bits.slice(i * 11, (i + 1) * 11), 2);
    words.push(wordlist[index]);
  }
  
  return words.join(' ');
}

// Worker 的主要逻辑
self.onmessage = (e) => {
  const { count } = e.data;
  let currentIndex = 0;
  
  const generateAndSend = () => {
    try {
      const mnemonic = generateMnemonic();
      
      self.postMessage({
        type: 'mnemonic',
        data: {
          mnemonic,
          index: currentIndex
        }
      });

      currentIndex++;
      
      if (currentIndex < count) {
        setTimeout(generateAndSend, 100); // 每100ms生成一个新助记词
      }
    } catch (error) {
      self.postMessage({
        type: 'error',
        data: error.message
      });
    }
  };

  generateAndSend();
}; 