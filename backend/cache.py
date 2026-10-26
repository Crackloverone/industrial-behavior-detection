"""
简单的内存缓存模块
提供 TTL 基础的 LRU 缓存，用于统计查询
"""

import time
import threading
from typing import Any, Optional
from collections import OrderedDict


class TTLCache:
    """TTL 缓存"""
    
    def __init__(self, maxsize: int = 100, ttl: int = 60):
        """
        初始化缓存
        
        Args:
            maxsize: 最大条目数
            ttl: 过期时间 (秒)
        """
        self.maxsize = maxsize
        self.ttl = ttl
        self._cache: OrderedDict = OrderedDict()
        self._timestamps: dict = {}
        self._lock = threading.Lock()
    
    def get(self, key: str) -> Optional[Any]:
        """
        获取缓存
        
        Args:
            key: 缓存键
        
        Returns:
            缓存值，如果不存在或已过期返回 None
        """
        with self._lock:
            if key not in self._cache:
                return None
            
            # 检查过期
            timestamp = self._timestamps.get(key, 0)
            if time.time() - timestamp > self.ttl:
                del self._cache[key]
                del self._timestamps[key]
                return None
            
            # 移到末尾 (最近使用)
            self._cache.move_to_end(key)
            return self._cache[key]
    
    def set(self, key: str, value: Any):
        """
        设置缓存
        
        Args:
            key: 缓存键
            value: 缓存值
        """
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            else:
                # 超出容量，删除最旧的
                if len(self._cache) >= self.maxsize:
                    oldest_key = next(iter(self._cache))
                    del self._cache[oldest_key]
                    self._timestamps.pop(oldest_key, None)
            
            self._cache[key] = value
            self._timestamps[key] = time.time()
    
    def delete(self, key: str):
        """删除缓存"""
        with self._lock:
            self._cache.pop(key, None)
            self._timestamps.pop(key, None)
    
    def clear(self):
        """清空缓存"""
        with self._lock:
            self._cache.clear()
            self._timestamps.clear()
    
    def size(self) -> int:
        """获取缓存大小"""
        with self._lock:
            return len(self._cache)


# 全局缓存实例
_stats_cache = TTLCache(maxsize=50, ttl=30)
_alarms_cache = TTLCache(maxsize=50, ttl=15)


def get_stats_cache() -> TTLCache:
    """获取统计缓存实例"""
    return _stats_cache


def get_alarms_cache() -> TTLCache:
    """获取报警缓存实例"""
    return _alarms_cache


def cache_get(cache: TTLCache, key: str) -> Optional[Any]:
    """从缓存获取"""
    return cache.get(key)


def cache_set(cache: TTLCache, key: str, value: Any):
    """设置缓存"""
    cache.set(key, value)