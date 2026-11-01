const keyCache = new Map();
const KEY_CACHE_LIMIT = 2000;

const toCamelCase = (str) => {
  if (!str.includes('_')) return str;

  const cached = keyCache.get(str);
  if (cached !== undefined) return cached;

  const converted = str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
  if (keyCache.size < KEY_CACHE_LIMIT) keyCache.set(str, converted);
  return converted;
};

const transformKeys = (obj) => {
  if (Array.isArray(obj)) {
    let changed = false;
    const result = new Array(obj.length);
    for (let i = 0; i < obj.length; i += 1) {
      result[i] = transformKeys(obj[i]);
      if (result[i] !== obj[i]) changed = true;
    }
    return changed ? result : obj;
  }

  if (obj && typeof obj === 'object') {
    if (obj instanceof Date || obj.constructor !== Object) return obj;

    const keys = Object.keys(obj);
    const result = {};
    let changed = false;

    for (const key of keys) {
      const newKey = toCamelCase(key);
      if (newKey !== key) changed = true;
      const value = transformKeys(obj[key]);
      if (value !== obj[key]) changed = true;
      result[newKey] = value;
    }

    return changed ? result : obj;
  }

  return obj;
};

export { transformKeys, toCamelCase };