"""
routes_spatial.py — Spatial AI Chatbot
========================================================
Menangani endpoint:
  - POST /api/chat/spatial
"""
from flask import request, jsonify, session
import json
import re
from config import app, driver, HAS_GIS
from ai_engine import call_llm

@app.route("/api/chat/spatial", methods=["POST"])
def spatial_chat():
    """
    Chatbot Strategis: Fokus pada kecepatan dan ketepatan radius.
    Menghapus semua bottleneck pencarian yang lambat.
    """
    try:
        data               = request.get_json()
        prompt             = data.get("prompt", "")
        mode               = data.get("mode", "default")
        actors_in_radius   = data.get("actors", [])
        polygons_in_radius = data.get("polygons", [])
        pinned_center      = data.get("pinnedCenter")
        radius             = data.get("radius", 500)
        location_name      = data.get("location_name", "Area Target")

        # Authenticated User for DB Memory
        user_id = session.get("user") or session.get("moderator") or "guest_spatial"

        # ------------------------------------------------------------------
        # 1. KONSTRUKSI KONTEKS DATA (REAL-TIME)
        # ------------------------------------------------------------------
        context_text = f"### ANALISIS RADIUS ###\n"
        if pinned_center:
            lat = pinned_center.get('lat', 0)
            lng = pinned_center.get('lng', 0)
            context_text += f"- Lokasi Nyata: *{location_name}*\n"
            context_text += f"- Koordinat Pusat: {lat:.6f}, {lng:.6f}\n"
            context_text += f"- Jangkauan Radius: {radius} meter\n"
        context_text += "\n"

        
        if not actors_in_radius:
            context_text += "STATUS: Radius ini belum memiliki data aktor terpetakan.\n"
        else:
            context_text += f"STRUKTUR EKOSISTEM ({len(actors_in_radius)} entitas terdeteksi):\n"
            for a in actors_in_radius:
                name   = a.get('name', 'Unknown')
                a_type = a.get('type', 'Aktor')
                a_id   = a.get('id', '')
                context_text += f"- Nama: {name}, Tag AEO: [[{name}|{a_id}]] ({a_type})\n"


        # C. Prediction Trigger dihapus untuk realisme murni simulasi

        # ------------------------------------------------------------------
        # 3. SYSTEM PROMPT (Strategic & Professional)
        # ------------------------------------------------------------------
        system_prompt = (
            "Anda adalah Chatbot Strategis (Tool Cipta Kerja). "
            "Anda adalah AI Strategis yang memiliki memori jangka panjang dan kemampuan simulasi.\n\n"
            "INSTRUKSI EKSEKUSI:\n"
            "1. PERSONA: Penasihat Strategis Senior yang REALISTIS.\n"
            "4. VISUAL PREMIUM: Gunakan **Tabel Markdown** jika menyajikan perbandingan data.\n"
            "5. AEO LINKS (WAJIB): Ketika menyebutkan nama aktor, GUNAKAN HANYA 'Tag AEO' dari data (contoh: [[Nama|ID]]). JANGAN menulis ulang nama aktor secara terpisah (misal: jangan menulis '**Kopi Senja** [[Kopi Senja|ID]]').\n"
            "6. NO BRANDING: Dilarang menyebut kata 'Antigravity AI'.\n"
            "7. INFO SPASIAL: Selalu sebutkan titik koordinat dan radius jika tersedia di data. Format nama Lokasi Nyata HANYA dengan cetak miring (*Nama Lokasi*), jangan ditebalkan.\n"
        )

        user_prompt = f"DATA RADIUS:\n{context_text}\n\nPERINTAH USER: {prompt}"

        # Inject spesifik prompt berdasarkan mode (tanpa mengubah system_prompt)
        if mode != "default":
            # Manajemen Memori Lintas Sesi (Job Creation Context)
            history = session.get("job_creation_memory", [])
            # Tambahkan prompt user ke memori
            history.append({"mode": mode, "prompt": prompt})
            # Batasi memori max 5 iterasi terakhir agar token tidak bengkak
            history = history[-5:]
            session["job_creation_memory"] = history

            history_context = "\n[RIWAYAT KONTEKS IDE BISNIS / SUMBER DAYA]:\n"
            for h in history[:-1]:
                history_context += f"- Mode {h['mode'].upper()}: {h['prompt']}\n"
            if len(history) > 1:
                user_prompt = history_context + "\n" + user_prompt

            mode_instructions = {
                "sumber-daya": "FOKUS ANALISIS (Inventarisasi & Pemanfaatan):\n1. Lakukan inventarisasi aset secara detail pada produk/sumber daya yang disebutkan.\n2. Temukan 'Kekuatan Unik' dan potensi pemanfaatan segera yang praktis dan realistis tanpa modal besar.\n3. Hubungkan secara langsung dengan data Neo4j (aktor, lokasi) di radius ini untuk melihat siapa yang bisa menyediakan bahan atau menjadi mitra awal.",
                "celah-rantai-nilai": "FOKUS ANALISIS (Celah Rantai Nilai / Value Chain Gaps):\n1. Analisis relasi dan keberadaan aktor bisnis di dalam radius ini.\n2. Identifikasi posisi atau peran rantai pasok/nilai yang masih KOSONG atau kurang (misal: belum ada distributor, belum ada pengemas, belum ada produsen hilir).\n3. Rekomendasikan ide bisnis baru yang realistis untuk mengisi celah tersebut agar ekosistem ekonomi lokal lengkap.",
                "analisis": "FOKUS ANALISIS (Analisis Teknis & Operasional):\n1. Berikan alur kerja praktis dan langkah-langkah operasional yang realistis untuk mengeksekusi ide bisnis ini.\n2. Jelaskan 'Kebutuhan Alat & Bahan' secara detail.\n3. Kaitkan dengan aktor atau fasilitas di radius yang bisa dimanfaatkan untuk mendukung operasional (misalnya sebagai supplier atau tempat produksi).",
                "sinergi-kemitraan": "FOKUS ANALISIS (Sinergi & Kemitraan / Synergy Matcher):\n1. Identifikasi aktor-aktor usaha ril yang ada di radius Neo4j saat ini yang dapat dihubungkan.\n2. Rancang bentuk kolaborasi konkret (misal: Aktor A membeli bahan baku dari Aktor B, Aktor C membantu distribusi untuk Aktor D).\n3. Jelaskan bagaimana kolaborasi ini menguntungkan kedua belah pihak secara finansial atau operasional.",
                "simulasi-lapangan-kerja": "FOKUS ANALISIS (Simulasi Lapangan Kerja / Job Simulation):\n1. Estimasi jumlah penyerapan tenaga kerja (langsung seperti staf produksi, tidak langsung seperti kurir/supplier) yang tercipta dari ide usaha ini.\n2. Hubungkan potensi penyerapan tersebut dengan pemukiman (Pemukiman) terdekat yang terdeteksi di radius.\n3. Berikan saran program peningkatan keterampilan singkat (pelatihan) agar warga setempat siap bekerja."
            }
            if mode in mode_instructions:
                user_prompt += f"\n\n[INSTRUKSI MODE KHUSUS: {mode.upper()}]\nTolong FOKUSKAN jawaban Anda secara detail, realistis, dan praktis berdasarkan kerangka Job Creation:\n{mode_instructions[mode]}"
        else:
            # Jika mode default, reset memori job creation agar tidak bocor ke obrolan biasa
            if "job_creation_memory" in session:
                session.pop("job_creation_memory", None)

        # 4. PANGGIL LLM (Stateless untuk Kecepatan Real-Time)
        reply = call_llm(system_prompt=system_prompt, user_prompt=user_prompt, temperature=0.75)


        return jsonify({
            "success": True, 
            "reply": reply,
            "context": context_text
        })

    except Exception as e:
        print(f"[routes_spatial] Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route("/api/spatial/pin", methods=["POST"])
def save_spatial_pin():
    """Simpan pin secara ringan ke Neo4j."""
    data = request.get_json()
    if driver:
        with driver.session() as session:
            session.run("MATCH (f:FocusArea) DETACH DELETE f")
            session.run("CREATE (f:FocusArea {lat: $lat, lng: $lng, radius: $radius})",
                        lat=data.get("lat"), lng=data.get("lng"), radius=data.get("radius"))
    return jsonify({"success": True})

