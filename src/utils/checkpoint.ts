interface Checkpoint {
  lastMnemonic: string;
  lastPath: string;
  lastIndex: number;
  chainType: string;
  timestamp: number;
}

const CHECKPOINT_KEY = 'collision_checkpoint';

export const saveCheckpoint = (data: Checkpoint) => {
  try {
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving checkpoint:', error);
  }
};

export const loadCheckpoint = (): Checkpoint | null => {
  try {
    const data = localStorage.getItem(CHECKPOINT_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error loading checkpoint:', error);
    return null;
  }
};

export const clearCheckpoint = () => {
  localStorage.removeItem(CHECKPOINT_KEY);
}; 