import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { Button, Input, Card, CardContent } from "@/components/ui";
import { generateMnemonic, mnemonicToSeedSync } from "bip39";
import { getAddressBalances, deriveAddressFromSeed, CHAIN_CONFIGS, type ChainType } from "@/utils/blockchain";
import { loadCheckpoint, saveCheckpoint } from "@/utils/checkpoint";
import type { ICheckpoint, IBalance, IValidMnemonic } from '@/types/index';
import { TronCollision } from "@/components/TronCollision";
import { globalMnemonics } from '@/utils/mnemonic';

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

// 不需要重新定义 ChainType
const SUPPORTED_CHAINS: ChainType[] = ['ETH', 'BSC', 'HECO', 'POLYGON'];

// 添加延迟函数
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

  // 添加一个 Set 来存储已检查的助记词
  const checkedMnemonicsRef = useRef<Set<string>>(new Set());

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

  // 修改余额检查函数，添加重试和延迟机制
  const startCollisionCheck = async (currentMnemonic: string) => {
    try {
      console.log('正在检查助记词:', currentMnemonic);
      setLoading(true);
      
      const seed = mnemonicToSeedSync(currentMnemonic);
      
      // 确保至少选择了一个链
      if (selectedChains.length === 0) {
        console.log('请至少选择一个链进行检查');
        setLoading(false);
        return false;
      }

      // 遍历所有选中的链
      for (const chain of selectedChains) {
        console.log(`开始检查 ${chain} 链...`);
        
        const maxRetries = 3;
        let retryCount = 0;

        while (retryCount < maxRetries) {
          try {
            // 添加延迟，避免触发频率限制
            await delay(1000); // 1秒延迟

            const addresses = await deriveAddressFromSeed(seed, chain);
            console.log(`${chain} 链生成的地址列表:`, addresses);
            
            // 检查每个地址的余额
            for (const address of addresses) {
              setWalletAddress(address);
              
              try {
                // 添加延迟，避免触发频率限制
                await delay(1500);

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
                  setValidMnemonics(prev => [...prev, {
                    mnemonic: currentMnemonic,
                    address,
                    balances: walletBalances,
                    chain
                  }]);
                  
                  setLoading(false);
                  return true;
                }
              } catch (error) {
                console.error(`检查 ${chain} 地址余额时出错:`, error);
                await delay(2000 * (retryCount + 1)); // 递增延迟
                continue;
              }
            }

            break; // 如果成功完成，跳出重试循环

          } catch (error) {
            console.error(`检查 ${chain} 链时出错:`, error);
            retryCount++;
            if (retryCount < maxRetries) {
              console.log(`第 ${retryCount} 次重试...`);
              await delay(2000 * retryCount); // 递增延迟
              continue;
            }
          }
        }
      }
      
      setLoading(false);
      return false;
    } catch (error) {
      console.error("检查助记词时出错:", error);
      setLoading(false);
      return false;
    }
  };

  // 修改自动检查的 Worker 代码
  const startAutoCheck = () => {
    if (isAutoRunning) return;
    
    console.log('开始自动检查...');
    
    try {
      const workerCode = `
        self.onmessage = function(e) {
          console.log('Worker 收到消息:', e.data);
          
          if (e.data.type === 'stop') {
            console.log('Worker 收到停止信号');
            return;
          }

          function generateMnemonics() {
            console.log('开始生成助记词...');
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

      console.log('创建 Worker...');
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const worker = new Worker(URL.createObjectURL(blob));
      
      autoCheckRef.current = worker;
      
      worker.onmessage = async (e) => {
        console.log('主线程收到 Worker 消息:', e.data);

        if (!autoCheckRef.current) {
          console.log('Worker 已停止，不处理消息');
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
          
          console.log(`生成第 ${index + 1} 个助记词:`, mnemonic);
          
          setMnemonic(mnemonic);
          setCheckCount(index + 1);
          
          try {
            console.log('开始检查助记词...');
            const found = await startCollisionCheck(mnemonic);
            if (found) {
              console.log('找到有效助记词，停止检查');
              stopAutoCheck();
            }
          } catch (error) {
            console.error('检查地址时出错:', error);
          }
        }
      };

      worker.onerror = (error) => {
        console.error('Worker 错误:', error);
        stopAutoCheck();
      };

      console.log('发送初始消息给 Worker...');
      worker.postMessage({ count: 1000000 });
      
      setIsAutoRunning(true);
      setCheckCount(0);
      
    } catch (error) {
      console.error('启动 Worker 时出错:', error);
      if (autoCheckRef.current) {
        autoCheckRef.current.terminate();
        autoCheckRef.current = null;
      }
      setIsAutoRunning(false);
    }
  };

  const stopAutoCheck = () => {
    if (autoCheckRef.current) {
      console.log('正在停止自动检查...');
      const worker = autoCheckRef.current;
      
      try {
        worker.postMessage({ type: 'stop' });
        worker.terminate();
        
        // 清理状态
        autoCheckRef.current = null;
        checkedMnemonicsRef.current.clear(); // 清空已检查的助记词集合
        setIsAutoRunning(false);
        setLoading(false);
        
        console.log('自动检查已成功停止');
        globalMnemonics.clear(); // 清空全局助记词集合
      } catch (error) {
        console.error('停止自动检查时出错:', error);
      }
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

    // 确保有选择的链
    if (selectedChains.length === 0) {
      console.error('没有选择任何链');
      return;
    }

    const { mnemonic, address } = e.data;
    
    // 使用第一个选择的链来检查余额
    const chain = selectedChains[0];
    
    // 检查余额时传入 chain 参数
    const balances = await getAddressBalances(address, chain);
    if (balances.length > 0) {
      setValidMnemonics(prev => [...prev, {
        mnemonic,
        address,
        balances,
        chain
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
    };
    return names[chain];
  };

  // 添加清理效果
  useEffect(() => {
    return () => {
      // 组件卸载时确保停止所有检查
      if (autoCheckRef.current) {
        stopAutoCheck();
      }
    };
  }, []);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <h2 className="text-3xl font-bold mb-8 text-center">助记词碰撞检测</h2>
      
      {/* 链选择部分 */}
      <div className="mb-8">
        <h3 className="text-2xl font-bold mb-4">选择要检查的链</h3>
        <div className="grid grid-cols-1 gap-4">
          {SUPPORTED_CHAINS.map((chain) => (
            <label key={chain} className="flex items-center space-x-3 text-xl py-2">
              <input
                type="checkbox"
                checked={selectedChains.includes(chain)}
                onChange={() => toggleChain(chain)}
                disabled={isAutoRunning}
                className="form-checkbox h-6 w-6"
              />
              <span>{getChainName(chain)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* 助记词输入框 */}
      <Input
        type="text"
        placeholder="输入助记词..."
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
      {walletAddress && (
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="space-y-1">
                <span className="text-gray-600 block">地址：</span>
                <span className="font-mono text-base break-all">{walletAddress}</span>
              </div>
              {balances.length > 0 && (
                <div className="mt-3">
                  <span className="text-gray-600 font-bold block mb-2">检测到余额！</span>
                  {balances.map((balance, index) => (
                    <div key={index} className="text-green-600 text-base py-1">
                      {balance.currency}: <span className="font-bold">{balance.amount}</span>
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
        <div className="mt-4">
          <h3 className="text-lg sm:text-xl font-bold mb-2">已发现的助记词</h3>
          {validMnemonics.map((entry, index) => (
            <Card key={index} className="mb-2">
              <CardContent className="p-4">
                <div className="grid gap-2">
                  <div className="flex flex-col sm:flex-row gap-1">
                    <span className="text-gray-600 whitespace-nowrap">助记词：</span>
                    <span className="font-mono text-red-600 text-sm sm:text-base break-all">
                      {entry.mnemonic}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1">
                    <span className="text-gray-600 whitespace-nowrap">地址：</span>
                    <span className="font-mono text-sm sm:text-base break-all">
                      {entry.address}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-1">
                    <span className="text-gray-600 whitespace-nowrap">余额：</span>
                    <div className="flex flex-wrap gap-2">
                      {entry.balances.map((balance, idx) => (
                        <span key={idx} className="text-sm sm:text-base">
                          {balance.currency}: {balance.amount}
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

      {/* 高级选项 */}
      <div className="mb-8">
        <h3 className="text-2xl font-bold mb-4">高级选项</h3>
        <div className="space-y-4">
          <label className="flex items-center text-xl">
            <input
              type="checkbox"
              checked={useCheckpoint}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setUseCheckpoint(e.target.checked)}
              className="mr-3 h-6 w-6"
            />
            启用断点续查
          </label>
          {checkpointData && (
            <div className="text-lg text-gray-600">
              上次检查点: {new Date(checkpointData.timestamp).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      {/* TRON 碰撞检测组件 */}
      <div className="mt-12 pt-8 border-t-2 border-gray-200">
        <TronCollision />
      </div>
    </div>
  );
};

export default MnemonicCollision; 