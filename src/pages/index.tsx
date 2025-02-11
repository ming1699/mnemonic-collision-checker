import { useState, useRef, useEffect } from "react";
import { Button, Input, Card, CardContent } from "@/components/ui";
import { generateMnemonic, mnemonicToSeedSync } from "bip39";
import { getAddressBalances, deriveAddressFromSeed, CHAIN_CONFIGS, type ChainType } from "@/utils/blockchain";
import { loadCheckpoint, saveCheckpoint } from "@/utils/checkpoint";
import type { ICheckpoint, IBalance, IValidMnemonic } from '../types/index';

// 调试日志：检查所有导入
console.log('index.tsx: 导入检查', {
  useState: typeof useState !== 'undefined',
  generateMnemonic: typeof generateMnemonic !== 'undefined',
  getAddressBalances: typeof getAddressBalances !== 'undefined',
  loadCheckpoint: typeof loadCheckpoint !== 'undefined'
});

// 调试日志：检查全局类型
console.log('index.tsx: 全局类型检查', {
  globalThis: typeof globalThis !== 'undefined',
  window: typeof window !== 'undefined'
});

// 调试日志：检查运行环境
console.log('index.tsx: 环境检查', {
  env: process.env.NODE_ENV,
  isServer: typeof window === 'undefined'
});

// 组件定义
const MnemonicCollision = () => {
  // 调试日志：组件初始化
  console.log('MnemonicCollision: 组件初始化开始');
  
  const [mnemonic, setMnemonic] = useState("");
  const [walletAddress, setWalletAddress] = useState("");
  const [balances, setBalances] = useState<IBalance[]>([]);
  const [validMnemonics, setValidMnemonics] = useState<IValidMnemonic[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const [checkCount, setCheckCount] = useState(0);
  const autoCheckRef = useRef<Worker | null>(null);
  const stopAutoCheckRef = useRef<(() => void) | null>(null);
  const [selectedChains, setSelectedChains] = useState<ChainType[]>(['ETH']);
  const [useCheckpoint, setUseCheckpoint] = useState(true);
  const [checkpointData, setCheckpointData] = useState<ICheckpoint | null>(null);

  // 调试日志：组件状态初始化完成
  console.log('MnemonicCollision: 状态初始化完成', {
    hasCheckpointData: checkpointData !== null,
    balancesLength: balances.length,
    validMnemonicsLength: validMnemonics.length
  });

  const generateRandomMnemonic = () => {
    const newMnemonic = generateMnemonic();
    setMnemonic(newMnemonic);
    return newMnemonic;
  };

  const toggleChain = (chain: ChainType) => {
    setSelectedChains(prev => {
      if (prev.includes(chain)) {
        return prev.filter(c => c !== chain);
      } else {
        return [...prev, chain];
      }
    });
  };

  const startCollisionCheck = async (currentMnemonic: string) => {
    try {
      console.log('正在检查助记词:', currentMnemonic);
      const seed = mnemonicToSeedSync(currentMnemonic);
      let foundBalance = false;
      
      // 确保至少选择了一个链
      if (selectedChains.length === 0) {
        console.log('请至少选择一个链进行检查');
        return false;
      }

      console.log('选中的链:', selectedChains);
      
      // 遍历所有选中的链
      for (const chain of selectedChains) {
        console.log(`开始检查 ${chain} 链...`);
        
        try {
          const addresses = await deriveAddressFromSeed(seed, chain);
          console.log(`${chain} 链生成的地址列表:`, addresses);
          
          // 检查每个地址的余额
          for (const address of addresses) {
            setWalletAddress(address);
            
            try {
              const walletBalances = await getAddressBalances(address, chain);
              console.log(`${chain} 链地址 ${address} 的余额:`, walletBalances);
              
              if (walletBalances.length > 0) {
                console.log(`在 ${chain} 链上发现有余额!`, {
                  助记词: currentMnemonic,
                  链: chain,
                  地址: address,
                  余额: walletBalances
                });
                
                setBalances(prev => [...prev, ...walletBalances]);
                
                // 添加到有效助记词列表
                setValidMnemonics(prev => [...prev, {
                  mnemonic: currentMnemonic,
                  address,
                  balances: walletBalances,
                  chain
                }]);
                
                foundBalance = true;
              }
            } catch (error) {
              console.error(`检查 ${chain} 链地址 ${address} 余额时出错:`, error);
              continue;
            }
          }
        } catch (error) {
          console.error(`处理 ${chain} 链时出错:`, error);
          continue;
        }
      }
      
      // 只有在所有链都检查完毕且找到余额时才停止
      if (foundBalance) {
        if (autoCheckRef.current) {
          console.log('找到有余额地址，正在停止自动检查...');
          const worker = autoCheckRef.current as Worker;
          worker.terminate();
          autoCheckRef.current = null;
          setIsAutoRunning(false);
        }
        return true;
      }
      
      setBalances([]);
      return false;
    } catch (error) {
      console.error("检查助记词时出错:", error);
      return false;
    }
  };

  const startAutoCheck = () => {
    if (isAutoRunning) return;
    
    setIsAutoRunning(true);
    setCheckCount(0);

    try {
      const workerCode = `
        self.onmessage = (e) => {
          const { count } = e.data;
          let currentIndex = 0;
          
          const generateAndSend = () => {
            try {
              self.postMessage({
                type: 'request_mnemonic',
                data: { index: currentIndex }
              });

              currentIndex++;
              if (currentIndex < count) {
                setTimeout(generateAndSend, 100);
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
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));
      
      worker.onmessage = async (e) => {
        if (e.data.type === 'request_mnemonic') {
          const { index } = e.data.data;
          // 在主线程使用 bip39 生成助记词
          const mnemonic = generateMnemonic();
          console.log(`第 ${index + 1} 次尝试，生成助记词:`, mnemonic);
          
          setMnemonic(mnemonic);
          setCheckCount(index + 1);
          
          try {
            const found = await startCollisionCheck(mnemonic);
            if (found) {
              console.log('找到有效助记词，停止检查');
              worker.terminate();
              setIsAutoRunning(false);
            }
          } catch (error) {
            console.error('检查地址时出错:', error);
          }
        }
      };

      worker.postMessage({ count: 1000000 });
      autoCheckRef.current = worker;
      
    } catch (error) {
      console.error('启动 Worker 时出错:', error);
      setIsAutoRunning(false);
    }
  };

  const stopAutoCheck = () => {
    if (autoCheckRef.current) {
      console.log('正在停止自动检查...');
      const worker = autoCheckRef.current as Worker;
      worker.terminate();
      autoCheckRef.current = null;
      setIsAutoRunning(false);
    }
  };

  useEffect(() => {
    const checkpoint = loadCheckpoint();
    if (checkpoint) {
      setCheckpointData(checkpoint);
    }
  }, []);

  const handleWorkerMessage = async (e: MessageEvent) => {
    if (e.data.type === 'checkpoint') {
      const { mnemonic, count } = e.data.data;
      saveCheckpoint(mnemonic, count);
      setCheckpointData({
        timestamp: Date.now(),
        lastMnemonic: mnemonic,
        count: count
      });
      return;
    }

    const { mnemonic, address } = e.data;
    
    // 检查余额
    const balances = await getAddressBalances(address);
    if (balances.length > 0) {
      setValidMnemonics(prev => [...prev, {
        mnemonic,
        address,
        balances,
        chain: selectedChains[0]
      }]);
      stopAutoCheck();
    }
  };

  const getChainName = (chain: ChainType): string => {
    const names = {
      ETH: '以太坊 (ETH)',
      BSC: '币安智能链 (BSC)',
      HECO: '火币生态链 (HECO)',
      POLYGON: 'Polygon',
      TRX: '波场 (TRON)'
    };
    return names[chain];
  };

  return (
    <div className="p-4 max-w-full mx-auto">
      <h2 className="text-2xl font-bold mb-4 text-center">助记词碰撞检测</h2>
      <div className="mb-4">
        <h3 className="text-lg font-bold mb-2">选择要检查的链</h3>
        <div className="flex flex-wrap gap-2">
          {(['ETH', 'BSC', 'HECO', 'POLYGON', 'TRX'] as const).map((chain) => (
            <label key={chain} className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={selectedChains.includes(chain)}
                onChange={() => toggleChain(chain)}
                disabled={isAutoRunning}
                className="form-checkbox h-5 w-5"
              />
              <span>{getChainName(chain)}</span>
            </label>
          ))}
        </div>
      </div>
      <Input
        type="text"
        placeholder="输入助记词..."
        value={mnemonic}
        onChange={(e) => setMnemonic(e.target.value)}
        className="mb-4 w-full text-lg font-mono"
        style={{ 
          minWidth: '800px',
          height: '48px',
          padding: '0.75rem 1rem',
          backgroundColor: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '0.375rem',
        }}
        readOnly={isAutoRunning}
      />
      <div className="flex gap-4 mb-4 justify-center">
        <Button 
          onClick={() => !isAutoRunning && generateRandomMnemonic()} 
          disabled={isAutoRunning}
          className="text-lg px-6 py-2"
        >
          随机生成
        </Button>
        <Button 
          onClick={() => !isAutoRunning && startCollisionCheck(mnemonic)} 
          disabled={isAutoRunning || loading}
          className="text-lg px-6 py-2"
        >
          {loading ? "计算中..." : "开始碰撞"}
        </Button>
        <Button 
          onClick={isAutoRunning ? stopAutoCheck : startAutoCheck}
          className={`text-lg px-6 py-2 ${isAutoRunning ? 'bg-red-500' : 'bg-green-500'}`}
        >
          {isAutoRunning ? "停止自动" : "开始自动"}
        </Button>
      </div>
      
      <div className="text-center mb-4">
        <span className="font-bold">已检查次数: {checkCount}</span>
        {isAutoRunning && <span className="ml-2 text-blue-500">自动检查中...</span>}
      </div>

      {walletAddress && (
        <Card className="mt-4 text-base">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">地址：</span>
              <span className="font-mono text-base break-all">{walletAddress}</span>
            </div>
            {balances.length > 0 ? (
              <div className="mt-2">
                <span className="text-gray-600 font-bold">检测到余额！</span>
                {balances.map((balance, index) => (
                  <div key={index} className="ml-2 text-green-600">
                    {balance.currency} ({balance.symbol || balance.currency}): 
                    <span className="font-bold">{balance.amount}</span>
                    {balance.tokenAddress && (
                      <span className="ml-2 text-xs text-gray-500">
                        Token: {balance.tokenAddress}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-gray-600">未检测到余额</span>
            )}
          </CardContent>
        </Card>
      )}

      {validMnemonics.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xl font-bold mb-2">已发现的助记词</h3>
          {validMnemonics.map((entry, index) => (
            <Card key={index} className="mb-2 text-base">
              <CardContent className="p-4">
                <div className="grid gap-2">
                  <div>
                    <span className="text-gray-600">助记词：</span>
                    <span className="font-mono text-red-600 ml-2">{entry.mnemonic}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">地址：</span>
                    <span className="font-mono ml-2">{entry.address}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">余额：</span>
                    {entry.balances.map((balance, idx) => (
                      <span key={idx} className="ml-2">
                        {balance.currency}: {balance.amount}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="mb-4">
        <h3 className="text-lg font-bold mb-2">高级选项</h3>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={useCheckpoint}
              onChange={(e) => setUseCheckpoint(e.target.checked)}
              className="mr-2"
            />
            启用断点续查
          </label>
          {checkpointData && (
            <div className="text-sm text-gray-600">
              上次检查点: {new Date(checkpointData.timestamp).toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MnemonicCollision; 