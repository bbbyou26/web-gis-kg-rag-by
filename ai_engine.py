"""
ai_engine.py — Engine AI: LLM, Embedding
=========================================================================
Berisi semua fungsi yang memanggil AI:
  - call_llm()               : wrapper panggilan OpenAI LLM
  - get_embedding()          : buat vector embedding (Semantic Search)
"""

from config import client_llm, client_embed, MODEL_NAME, EMBED_MODEL, HAS_ADVANCED_TOOLS, OPENAI_API_KEY_LLM, BASE_URL


# ===============================
# UTILS: EMBEDDING (SEMANTIC)
# ===============================
def get_embedding(text: str) -> list:
    """Buat vector embedding dari teks menggunakan OpenAI Embeddings API."""
    try:
        response = client_embed.embeddings.create(model=EMBED_MODEL, input=text)
        return response.data[0].embedding
    except Exception as e:
        print(f"[ai_engine] Embedding failed: {e}")
        return None


# ===============================
# PANGGILAN LLM 
# ===============================
def call_llm(system_prompt: str, user_prompt: str, temperature: float = 0.75, media_data: str = None) -> str:
    """Kirim prompt ke LLM dan kembalikan teks respons (Stateless). Mendukung Vision jika media_data (base64) disertakan."""
    messages = [
        {"role": "system", "content": system_prompt}
    ]
    
    if media_data:
        # Jika ada media (Vision), format pesan user sebagai list of contents
        messages.append({
            "role": "user",
            "content": [
                {"type": "text", "text": user_prompt},
                {
                    "type": "image_url",
                    "image_url": {
                        "url": media_data # media_data harus berupa data:image/jpeg;base64,....
                    }
                }
            ]
        })
    else:
        # Pesan teks biasa
        messages.append({"role": "user", "content": user_prompt})

    response = client_llm.chat.completions.create(
        model=MODEL_NAME,
        temperature=temperature,
        max_tokens=4096,
        messages=messages,
    )
    return response.choices[0].message.content
