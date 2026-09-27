"""Scaled, Thread-Safe In-Process Cache Manager for AeroTrace NGEC 2026.

Provides a robust, bounded, thread-safe in-memory cache for attribution,
weather, and route-level calculations across all 7 target cities and 28 physical
CAAQMS monitoring stations:
  - Thread safety using `threading.RLock()`.
  - Strict 30-second TTL matching the AeroTrace application revalidation cadence.
  - Bounded capacity (default max 512 entries) with Least Recently Used (LRU) eviction.
  - Station-level targeted cache invalidation (e.g., during simulated pollution spikes).
  - Production observability metrics (hits, misses, evictions, hit ratio).
"""
from __future__ import annotations

import logging
import threading
import time
from collections import OrderedDict
from typing import Any, Optional

log = logging.getLogger(__name__)


class ScaledRouteCache:
    """Thread-safe, bounded, expiring LRU cache for route and station calculations."""

    def __init__(self, max_size: int = 512, default_ttl_seconds: float = 30.0) -> None:
        self.max_size: int = max_size
        self.default_ttl_seconds: float = default_ttl_seconds
        self._lock: threading.RLock = threading.RLock()

        # Cache store: key -> (value, expiry_monotonic, station_name, category)
        self._store: OrderedDict[str, tuple[Any, float, str, str]] = OrderedDict()

        # Metrics
        self._hits: int = 0
        self._misses: int = 0
        self._evictions: int = 0

    def get(self, key: str) -> Optional[Any]:
        """Retrieve an item from cache if present and unexpired.
        
        Refreshes LRU position on hit. If expired, removes item and records a miss.
        """
        with self._lock:
            if key not in self._store:
                self._misses += 1
                return None

            value, expiry, station_name, category = self._store[key]
            now = time.monotonic()

            if now >= expiry:
                # Expired: remove and count as miss
                del self._store[key]
                self._misses += 1
                return None

            # Hit: update LRU position
            self._store.move_to_end(key)
            self._hits += 1
            return value

    def set(
        self,
        key: str,
        value: Any,
        ttl_seconds: Optional[float] = None,
        station_name: str = "",
        category: str = "",
    ) -> None:
        """Store an item in the cache with the specified or default TTL.
        
        Enforces maximum capacity via LRU eviction of the oldest entry.
        """
        ttl = self.default_ttl_seconds if ttl_seconds is None else float(ttl_seconds)
        expiry = time.monotonic() + ttl

        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
                self._store[key] = (value, expiry, station_name, category)
                return

            # Capacity check: evict oldest if at capacity
            if len(self._store) >= self.max_size:
                self._store.popitem(last=False)
                self._evictions += 1

            self._store[key] = (value, expiry, station_name, category)

    def invalidate(self, key: str) -> bool:
        """Remove a specific key from the cache. Returns True if removed."""
        with self._lock:
            if key in self._store:
                del self._store[key]
                return True
            return False

    def invalidate_station(self, station_name: str) -> int:
        """Invalidate all cached entries associated with a specific station.
        
        Matches both recorded station_name metadata and prefix key patterns.
        Returns the count of evicted keys.
        """
        if not station_name:
            return 0

        target_norm = station_name.strip().lower()
        evicted = 0

        with self._lock:
            keys_to_remove = []
            for k, (_, _, st_meta, _) in self._store.items():
                if st_meta and st_meta.strip().lower() == target_norm:
                    keys_to_remove.append(k)
                elif k.lower().startswith(f"{target_norm}_"):
                    keys_to_remove.append(k)

            for k in keys_to_remove:
                del self._store[k]
                evicted += 1

        return evicted

    def clear(self) -> None:
        """Flush all cached entries and reset metrics."""
        with self._lock:
            self._store.clear()
            self._hits = 0
            self._misses = 0
            self._evictions = 0

    def evict_expired(self) -> int:
        """Purge all expired items from the cache. Returns the count of purged items."""
        now = time.monotonic()
        purged = 0
        with self._lock:
            expired_keys = [k for k, (_, expiry, _, _) in self._store.items() if now >= expiry]
            for k in expired_keys:
                del self._store[k]
                purged += 1
        return purged

    def get_metrics(self) -> dict[str, Any]:
        """Return operational observability metrics for the cache."""
        with self._lock:
            total_requests = self._hits + self._misses
            hit_ratio = round((self._hits / total_requests) * 100.0, 1) if total_requests > 0 else 0.0
            return {
                "entries": len(self._store),
                "max_size": self.max_size,
                "ttl_seconds": self.default_ttl_seconds,
                "hits": self._hits,
                "misses": self._misses,
                "total_requests": total_requests,
                "hit_ratio_pct": hit_ratio,
                "evictions": self._evictions,
            }

    def __len__(self) -> int:
        with self._lock:
            return len(self._store)


# Global singleton instance for application route caching
_global_route_cache = ScaledRouteCache(max_size=512, default_ttl_seconds=30.0)


def get_route_cache() -> ScaledRouteCache:
    """Return the application-wide ScaledRouteCache instance."""
    return _global_route_cache
