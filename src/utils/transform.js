// snake_case -> camelCase 的键名转换工具
// 性能要点：
// 1. 用 Map 缓存已转换过的键名（接口字段是固定集合，命中率极高）；
// 2. 当对象/数组里没有任何键需要转换时，直接复用原对象，避免整棵结构重新分配 ——
//    历史记录轮询每次都会走这里，几百条记录乘以十几个字段的内存分配是可以省掉的。

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
