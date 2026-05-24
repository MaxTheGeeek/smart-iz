import redis.asyncio as aioredis
import json

REDIS_URL = "redis://localhost:6379"
TRANSLATION_TTL = 60 * 60 * 24 * 30  # 30 days

_client: aioredis.Redis | None = None

async def get_redis() -> aioredis.Redis:
    global _client
    if _client is None:
        _client = aioredis.from_url(REDIS_URL, decode_responses=True)
    return _client

def make_cache_key(doc_id: str, chapter_idx: int, page_idx: int, lang: str) -> str:
    return f"trans:{doc_id}:{chapter_idx}:{page_idx}:{lang}"

async def get_cached_page(doc_id: str, chapter_idx: int, page_idx: int, lang: str) -> str | None:
    """Returns the cached translated text, or None if not cached or Redis is down."""
    try:
        r = await get_redis()
        return await r.get(make_cache_key(doc_id, chapter_idx, page_idx, lang))
    except Exception as e:
        print(f"[warning] Redis read failed (graceful degradation): {e}")
        return None

async def set_cached_page(doc_id: str, chapter_idx: int, page_idx: int, lang: str, text: str) -> None:
    """Caches page translation, failing silently if Redis is offline."""
    try:
        r = await get_redis()
        await r.setex(make_cache_key(doc_id, chapter_idx, page_idx, lang), TRANSLATION_TTL, text)
    except Exception as e:
        print(f"[warning] Redis write failed (graceful degradation): {e}")

async def is_page_cached(doc_id: str, chapter_idx: int, page_idx: int, lang: str) -> bool:
    """Checks if a page is cached, failing gracefully."""
    try:
        r = await get_redis()
        return bool(await r.exists(make_cache_key(doc_id, chapter_idx, page_idx, lang)))
    except Exception:
        return False

async def get_chapter_cache_status(doc_id: str, chapter_idx: int, page_count: int, lang: str) -> list[bool]:
    """Returns a list of booleans representing cache hit status for all pages in a chapter."""
    status = []
    for i in range(page_count):
        cached = await is_page_cached(doc_id, chapter_idx, i, lang)
        status.append(cached)
    return status
