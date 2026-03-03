# core/doc_parser.py
"""
LlamaCloud (LlamaParse) entegrasyonu.
Dokümanları parse eder, ham metni döndürür.
"""
import asyncio

from llama_cloud import AsyncLlamaCloud


async def _parse_async(file_bytes, filename, api_key):
    """
    LlamaCloud API ile dokümanı asenkron parse eder.

    Args:
        file_bytes: Dosya içeriği (bytes)
        filename: Dosya adı (uzantısıyla birlikte)
        api_key: LlamaCloud API anahtarı

    Returns:
        {"raw_text": str, "filename": str}
    """
    client = AsyncLlamaCloud(api_key=api_key)

    # 1. Dosyayı yükle — tuple (filename, bytes) formatı ile
    file_obj = await client.files.create(
        file=(filename, file_bytes),
        purpose="parse",
    )

    # 2. Parse et (agentic tier — OCR + yapılandırılmış çıkarma)
    result = await client.parsing.parse(
        file_id=file_obj.id,
        tier="agentic",
        version="latest",
        processing_options={
            "ocr_parameters": {"languages": ["tr", "pl", "en"]}
        },
        expand=["text", "markdown"],
    )

    # 3. Markdown veya düz metin çıktısını al
    full_text = ""
    if result.markdown_full:
        full_text = result.markdown_full
    elif result.text_full:
        full_text = result.text_full
    elif result.markdown and hasattr(result.markdown, "pages") and result.markdown.pages:
        full_text = "\n".join(
            p.markdown if hasattr(p, "markdown") else str(p)
            for p in result.markdown.pages
        )

    return {
        "raw_text": full_text,
        "filename": filename,
    }


def parse_document(file_bytes, filename, api_key):
    """
    Senkron wrapper — Flask endpoint'ten çağrılır.

    Args:
        file_bytes: Dosya içeriği (bytes)
        filename: Dosya adı
        api_key: LlamaCloud API anahtarı

    Returns:
        {"raw_text": str, "filename": str}
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # Zaten çalışan bir event loop varsa yeni bir loop oluştur
        new_loop = asyncio.new_event_loop()
        try:
            return new_loop.run_until_complete(_parse_async(file_bytes, filename, api_key))
        finally:
            new_loop.close()
    else:
        return asyncio.run(_parse_async(file_bytes, filename, api_key))
