import os
import json
import time
from typing import Optional, Any, Dict
from datetime import datetime, timedelta, timezone


class BaseCache:
    def get(self, key: str) -> Optional[Any]:
        raise NotImplementedError

    def set(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        raise NotImplementedError

    def delete(self, key: str) -> None:
        raise NotImplementedError

    def clear_prefix(self, prefix: str) -> None:
        raise NotImplementedError


class InMemoryCache(BaseCache):
    """
    Thread-safe in-memory cache with TTL expiration.
    Default cache for standalone local execution.
    """
    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if not entry:
            return None
        if time.time() > entry["expires_at"]:
            del self._store[key]
            return None
        return entry["value"]

    def set(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        self._store[key] = {
            "value": value,
            "expires_at": time.time() + ttl_seconds,
        }

    def delete(self, key: str) -> None:
        if key in self._store:
            del self._store[key]

    def clear_prefix(self, prefix: str) -> None:
        keys_to_del = [k for k in self._store if k.startswith(prefix)]
        for k in keys_to_del:
            del self._store[k]


class RedisCache(BaseCache):
    """
    Optional production Redis cache backend.
    Activated when REDIS_URL environment variable is provided.
    """
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
        self._client = None
        try:
            import redis
            self._client = redis.from_url(redis_url, decode_responses=True)
        except ImportError:
            print("[CACHE] redis-py not installed; falling back to InMemoryCache.")
        except Exception as e:
            print(f"[CACHE] Could not connect to Redis at {redis_url}: {e}")

    def get(self, key: str) -> Optional[Any]:
        if not self._client:
            return None
        try:
            val = self._client.get(key)
            if val:
                return json.loads(val)
        except Exception:
            return None
        return None

    def set(self, key: str, value: Any, ttl_seconds: int = 300) -> None:
        if not self._client:
            return
        try:
            val_str = json.dumps(value, default=str)
            self._client.setex(key, ttl_seconds, val_str)
        except Exception as e:
            print(f"[CACHE] Redis set error for {key}: {e}")

    def delete(self, key: str) -> None:
        if not self._client:
            return
        try:
            self._client.delete(key)
        except Exception:
            pass

    def clear_prefix(self, prefix: str) -> None:
        if not self._client:
            return
        try:
            keys = self._client.keys(f"{prefix}*")
            if keys:
                self._client.delete(*keys)
        except Exception:
            pass


def get_cache_manager() -> BaseCache:
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        return RedisCache(redis_url)
    return InMemoryCache()


cache = get_cache_manager()
