const CACHE_KEY = 'checked_addresses';
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

export const loadFromCache = (): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(CACHE_KEY) || '[]'));
  } catch (error) {
    console.error('Error loading from cache:', error);
    return new Set();
  }
}; 