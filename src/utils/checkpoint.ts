import type { ICheckpoint } from '../types/index';

// 添加调试日志
console.log('checkpoint.ts: 导出的类型和函数');

export const saveCheckpoint = (mnemonic: string, count: number) => {
  // 添加调试日志
  console.log('保存检查点:', { mnemonic, count });
  
  try {
    const checkpoint: ICheckpoint = {
      timestamp: Date.now(),
      lastMnemonic: mnemonic,
      count: count
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('collision_checkpoint', JSON.stringify(checkpoint));
    }
  } catch (error) {
    console.error('保存检查点失败:', error);
  }
};

export const loadCheckpoint = (): ICheckpoint | null => {
  // 添加调试日志
  console.log('加载检查点');
  
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('collision_checkpoint');
      if (saved) {
        return JSON.parse(saved) as ICheckpoint;
      }
    }
  } catch (error) {
    console.error('加载检查点失败:', error);
  }
  return null;
};

export const clearCheckpoint = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('collision_checkpoint');
  }
};

// 导出接口
export type { ICheckpoint }; 