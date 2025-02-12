import { useState, useRef } from "react";
import { Button, Input, Card, CardContent } from "@/components/ui";
import { generateMnemonic, mnemonicToSeedSync } from "bip39";
import HDKey from 'hdkey';
import { Buffer } from 'buffer';
import { keccak256 } from 'ethereumjs-util';
import bs58 from 'bs58';
import { globalMnemonics } from '@/utils/mnemonic';

interface TronBalance {
  currency: string;
  amount: string;
  symbol?: string;
  tokenAddress?: string;
}

interface TronValidMnemonic {
  mnemonic: string;
  address: string;
  balances: TronBalance[];
}

// TRON 的派生路径
const TRON_PATH = "m/44'/195'/0'/0/0";

// TRON 地址生成函数
const generateTronAddress = async (seed: Buffer) => {
  try {
    const hdkey = HDKey.fromMasterSeed(seed);
    const childKey = hdkey.derive(TRON_PATH);
    const publicKey = childKey.publicKey;
    
    // 获取公钥的 keccak256 哈希
    const hash = keccak256(publicKey.slice(1));
    
    // 取最后20字节作为地址
    const address = hash.slice(-20);
    
    // 添加 TRON 地址前缀 0x41
    const tronAddress = Buffer.concat([Buffer.from('41', 'hex'), address]);
    
    // Base58Check 编码
    const checkSum = keccak256(tronAddress).slice(0, 4);
    const addressWithChecksum = Buffer.concat([tronAddress, checkSum]);
    
    // 转换为 Base58 格式
    return bs58.encode(addressWithChecksum);
  } catch (error) {
    console.error('生成 TRON 地址时出错:', error);
    throw error;
  }
};

// 添加延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 检查 TRON 余额的函数
const checkTronBalance = async (address: string) => {
  const maxRetries = 3;
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      // 添加延迟，避免触发频率限制
      await delay(1000); // 1秒延迟

      const accountResponse = await fetch(
        `/api/tronscan/account?address=${address}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      if (accountResponse.status === 403) {
        console.log('API 请求频率限制，等待后重试...');
        await delay(2000 * (retryCount + 1)); // 递增延迟
        retryCount++;
        continue;
      }

      if (!accountResponse.ok) {
        console.error('账户检查失败:', await accountResponse.text());
        return [];
      }

      const accountData = await accountResponse.json();
      const balances = [];

      // 检查 TRX 余额
      if (accountData.balance) {
        const trxBalance = accountData.balance / 1_000_000;
        if (trxBalance > 0) {
          balances.push({
            currency: 'TRX',
            amount: trxBalance.toString(),
            symbol: 'TRX'
          });
        }
      }

      // 检查 USDT 余额
      if (accountData.trc20token_balances) {
        const usdtToken = accountData.trc20token_balances.find(
          (token: any) => token.tokenId === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
        );
        
        if (usdtToken && parseFloat(usdtToken.balance) > 0) {
          const usdtBalance = parseFloat(usdtToken.balance) / 1_000_000;
          balances.push({
            currency: 'USDT',
            amount: usdtBalance.toString(),
            symbol: 'USDT'
          });
        }
      }

      return balances;

    } catch (error) {
      console.error('检查余额时出错:', error);
      retryCount++;
      if (retryCount < maxRetries) {
        console.log(`第 ${retryCount} 次重试...`);
        await delay(2000 * retryCount); // 递增延迟
        continue;
      }
      return [];
    }
  }

  return []; // 所有重试都失败后返回空数组
};

export const TronCollision = () => {
  const [mnemonic, setMnemonic] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [balances, setBalances] = useState<TronBalance[]>([]);
  const [validMnemonics, setValidMnemonics] = useState<TronValidMnemonic[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  const autoCheckRef = useRef<Worker | null>(null);

  const generateRandomMnemonic = () => {
    const newMnemonic = generateMnemonic();
    setMnemonic(newMnemonic);
    return newMnemonic;
  };

  const startCollisionCheck = async (currentMnemonic: string) => {
    try {
      console.log('正在检查 TRON 助记词:', currentMnemonic);
      setLoading(true);
      
      const seed = mnemonicToSeedSync(currentMnemonic);
      
      // 生成真实的 TRON 地址
      const address = await generateTronAddress(seed);
      console.log('生成的 TRON 地址:', address);
      setWalletAddress(address);
      
      // 检查余额
      try {
        const walletBalances = await checkTronBalance(address);
        console.log('余额检查结果:', walletBalances);
        
        if (walletBalances.length > 0) {
          console.log('发现有余额的 TRON 地址!', {
            助记词: currentMnemonic,
            地址: address,
            余额: walletBalances
          });
          
          setBalances(walletBalances);
          setValidMnemonics(prev => [...prev, {
            mnemonic: currentMnemonic,
            address,
            balances: walletBalances
          }]);
          
          if (isAutoRunning) {
            stopAutoCheck();
          }
          
          setLoading(false);
          return true;
        }
      } catch (error) {
        console.error('检查余额时出错:', error);
      }
      
      setLoading(false);
      return false;
    } catch (error) {
      console.error("检查 TRON 助记词时出错:", error);
      setLoading(false);
      return false;
    }
  };

  const startAutoCheck = () => {
    if (isAutoRunning) return;
    
    console.log('开始 TRON 自动检查...');
    
    try {
      const workerCode = `
        self.onmessage = function(e) {
          console.log('TRON Worker 收到消息:', e.data);
          
          if (e.data.type === 'stop') {
            console.log('TRON Worker 收到停止信号');
            return;
          }

          function generateMnemonics() {
            console.log('开始生成 TRON 助记词...');
            const { count } = e.data;
            let currentIndex = 0;

            function sendNext() {
              if (currentIndex >= count) return;

              self.postMessage({
                type: 'request_mnemonic',
                data: { index: currentIndex }
              });

              currentIndex++;
              setTimeout(sendNext, 1500);
            }

            sendNext();
          }

          generateMnemonics();
        };
      `;

      console.log('创建 TRON Worker...');
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));
      
      autoCheckRef.current = worker;
      
      worker.onmessage = async (e) => {
        console.log('TRON 主线程收到 Worker 消息:', e.data);

        if (!autoCheckRef.current) {
          console.log('TRON Worker 已停止，不处理消息');
          return;
        }

        if (e.data.type === 'request_mnemonic') {
          const { index } = e.data.data;
          let mnemonic;
          
          // 生成不重复的助记词
          do {
            mnemonic = generateMnemonic();
          } while (globalMnemonics.has(mnemonic));
          
          // 添加到全局集合
          globalMnemonics.add(mnemonic);
          
          console.log(`生成第 ${index + 1} 个 TRON 助记词:`, mnemonic);
          
          setMnemonic(mnemonic);
          setCheckCount(index + 1);
          
          try {
            console.log('开始检查 TRON 助记词...');
            const found = await startCollisionCheck(mnemonic);
            if (found) {
              console.log('找到有效 TRON 助记词，停止检查');
              stopAutoCheck();
            }
          } catch (error) {
            console.error('检查 TRON 地址时出错:', error);
          }
        }
      };

      worker.onerror = (error) => {
        console.error('TRON Worker 错误:', error);
        stopAutoCheck();
      };

      console.log('发送初始消息给 TRON Worker...');
      worker.postMessage({ count: 1000000 });
      
      setIsAutoRunning(true);
      setCheckCount(0);
      
    } catch (error) {
      console.error('启动 TRON Worker 时出错:', error);
      if (autoCheckRef.current) {
        autoCheckRef.current.terminate();
        autoCheckRef.current = null;
      }
      setIsAutoRunning(false);
    }
  };

  const stopAutoCheck = () => {
    if (autoCheckRef.current) {
      console.log('正在停止 TRON 自动检查...');
      const worker = autoCheckRef.current;
      
      try {
        worker.postMessage({ type: 'stop' });
        worker.terminate();
        
        // 清理状态
        autoCheckRef.current = null;
        setIsAutoRunning(false);
        setLoading(false);
        globalMnemonics.clear(); // 清空全局助记词集合
        
        console.log('TRON 自动检查已成功停止');
      } catch (error) {
        console.error('停止 TRON 自动检查时出错:', error);
      }
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold mb-8 text-center">TRON (波场) 助记词碰撞检测</h2>
      
      {/* 助记词输入框 */}
      <Input
        type="text"
        placeholder="输入 TRON 助记词..."
        value={mnemonic}
        onChange={(e) => setMnemonic(e.target.value)}
        className="mb-8 w-full text-xl font-mono"
        style={{ 
          width: '100%',
          minHeight: '64px',
          padding: '1rem',
          backgroundColor: '#fff',
          border: '2px solid #e2e8f0',
          borderRadius: '0.75rem',
          fontSize: '18px',
        }}
        readOnly={isAutoRunning}
      />

      {/* 按钮组 */}
      <div className="grid grid-cols-1 gap-4 mb-8">
        <Button 
          onClick={() => !isAutoRunning && generateRandomMnemonic()} 
          disabled={isAutoRunning}
          className="text-xl px-6 py-4 w-full"
        >
          随机生成
        </Button>
        <Button 
          onClick={() => !isAutoRunning && startCollisionCheck(mnemonic)} 
          disabled={isAutoRunning || loading}
          className="text-xl px-6 py-4 w-full"
        >
          {loading ? "计算中..." : "开始碰撞"}
        </Button>
        <Button 
          onClick={isAutoRunning ? stopAutoCheck : startAutoCheck}
          className={`text-xl px-6 py-4 w-full ${
            isAutoRunning ? 'bg-red-500' : 'bg-green-500'
          }`}
        >
          {isAutoRunning ? "停止自动" : "开始自动"}
        </Button>
      </div>
      
      {/* 检查次数显示 */}
      <div className="text-center mb-8">
        <span className="font-bold text-xl">已检查次数: {checkCount}</span>
        {isAutoRunning && <span className="ml-3 text-blue-500 text-xl">自动检查中...</span>}
      </div>

      {/* 地址和余额显示 */}
      {(walletAddress || balances.length > 0) && (
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="space-y-4">
              {walletAddress && (
                <div className="space-y-2">
                  <span className="text-gray-600 block text-xl">TRON 地址：</span>
                  <span className="font-mono text-xl break-all text-blue-600">{walletAddress}</span>
                </div>
              )}
              {balances.length > 0 && (
                <div className="mt-3">
                  <span className="text-gray-600 font-bold block mb-2 text-xl">检测到余额！</span>
                  {balances.map((balance, index) => (
                    <div key={index} className="text-green-600 text-xl py-2">
                      {balance.currency}: <span className="font-bold">{balance.amount}</span>
                      <span className="ml-2">({balance.symbol})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 有效助记词列表 */}
      {validMnemonics.length > 0 && (
        <div className="mt-8">
          <h3 className="text-2xl font-bold mb-4">已发现的 TRON 助记词</h3>
          {validMnemonics.map((entry, index) => (
            <Card key={index} className="mb-4">
              <CardContent className="p-4">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <span className="text-gray-600 block text-xl">助记词：</span>
                    <span className="font-mono text-red-600 text-xl break-all">
                      {entry.mnemonic}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <span className="text-gray-600 block text-xl">地址：</span>
                    <span className="font-mono text-blue-600 text-xl break-all">
                      {entry.address}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <span className="text-gray-600 block text-xl">余额：</span>
                    <div className="grid gap-2">
                      {entry.balances.map((balance, idx) => (
                        <span key={idx} className="text-green-600 text-xl">
                          {balance.currency}: {balance.amount} {balance.symbol}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}; 