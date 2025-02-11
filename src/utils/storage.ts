const CACHE_KEY = 'address_cache';
const RESULTS_KEY = 'valid_mnemonics';

export const saveToCache = (addresses: string[]) => {
  try {
    const existing = new Set(JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'));
    addresses.forEach(addr => existing.add(addr));
    localStorage.setItem(CACHE_KEY, JSON.stringify([...existing]));
  } catch (error) {
    console.error('Error saving to cache:', error);
  }
};

export const getFromCache = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
  } catch (error) {
    console.error('Error reading from cache:', error);
    return [];
  }
};

export const clearCache = () => {
  localStorage.removeItem(CACHE_KEY);
}; 