"""
routes_actors.py — API CRUD Aktor di Knowledge Graph Neo4j
===========================================================
Menangani:
  - POST /api/actor/save   : simpan/update aktor ke Neo4j + embedding
  - GET  /api/actors       : ambil semua aktor dari Neo4j
  - POST /api/actor/delete : hapus aktor dari Neo4j
  - GET  /api/health       : cek status server & model
"""
import json
import uuid

from flask import request, jsonify, render_template, session

from config import app, driver, client_embed, EMBED_MODEL


# ---------------------------------------------------------------
# HELPER: Buat Embedding Teks (Semantic Search)
# ---------------------------------------------------------------
def get_embedding(text: str) -> list:
    """Buat vector embedding dari teks menggunakan OpenAI Embeddings API."""
    response = client_embed.embeddings.create(model=EMBED_MODEL, input=text)
    return response.data[0].embedding


# ---------------------------------------------------------------
# SIMPAN / UPDATE AKTOR
# ---------------------------------------------------------------
@app.route("/api/actor/save", methods=["POST"])
def save_actor():
    data       = request.get_json()
    actor_id   = data.get("id", str(uuid.uuid4()))

    # Check permission
    user = session.get("user", "")
    is_admin = user.endswith(':admin') or user.endswith(':admin@2211080.com')
    if not is_admin:
        from config import db
        perm = db['permission_requests'].find_one({"nama_akun": user, "actor_id": actor_id, "status": "approved"})
        if not perm:
            return jsonify({"success": False, "error": "Unauthorized"}), 403

    actor_type = data.get("type", "unknown")
    name       = data.get("name", "")
    lat        = data.get("lat")
    lng        = data.get("lng")

    # Filter field yang tidak relevan untuk teks
    exclude_keys = {
        "lat", "lng", "foto", "Foto Visual Path", "color", "warna", "Warna",
        "Titik Koordinat (Lat, Lon)", "icon", "id", "type", "timestamp", "Marker Type",
        "landing_page_data"  # Exclude raw layout JSON from embedding calculation
    }
    
    # Extract landing page text if present
    landing_page_text = data.get("landing_page_text", "")
    if not landing_page_text and "landing_page_data" in data:
        try:
            lp_json = json.loads(data["landing_page_data"])
            lp_elements = lp_json.get("elements", [])
            clean_texts = []
            for el in lp_elements:
                if el.get("type") in ["title", "text"]:
                    val = str(el.get("content", "")).strip()
                    if val:
                        clean_texts.append(val)
            landing_page_text = "\n\n".join(clean_texts)
        except Exception:
            pass
    if landing_page_text:
        data["landing_page_text"] = landing_page_text

    text_content = {k: v for k, v in data.items()
                    if k not in exclude_keys and not isinstance(v, list)}
    text_content.update({k: v for k, v in data.items()
                          if k not in exclude_keys and isinstance(v, list)})

    str_representation  = json.dumps(text_content, ensure_ascii=False)
    full_data_repr      = json.dumps(data, ensure_ascii=False)

    # Buat embedding (semantic search)
    try:
        embedding = get_embedding(str_representation)
    except Exception as e:
        print(f"[routes_actors] Embedding failed: {e}")
        embedding = None

    # Simpan ke Neo4j (MERGE = insert or update)
    query = """
    MERGE (a:Actor {id: $act_id})
    SET a.type              = $act_type,
        a.name              = $name,
        a.lat               = $lat,
        a.lng               = $lng,
        a.raw_data          = $raw_data,
        a.embedding         = $embedding,
        a.landing_page_text = $landing_page_text
    """
    with driver.session(database="pp1") as neo_session:
        neo_session.run(
            query,
            act_id=actor_id, act_type=actor_type, name=name,
            lat=lat, lng=lng, raw_data=full_data_repr, embedding=embedding,
            landing_page_text=landing_page_text
        )

    return jsonify({"success": True, "id": actor_id})


# ---------------------------------------------------------------
# AMBIL SEMUA AKTOR
# ---------------------------------------------------------------
@app.route("/api/actors", methods=["GET"])
def get_actors():
    query = """
    MATCH (a:Actor)
    RETURN a.id AS id, a.type AS type, a.name AS name,
           a.lat AS lat, a.lng AS lng, a.raw_data AS raw_data
    """
    actors = []
    try:
        with driver.session(database="pp1") as neo_session:
            for record in neo_session.run(query):
                raw = {}
                if record["raw_data"]:
                    try:
                        raw = json.loads(record["raw_data"])
                    except Exception:
                        pass
                actors.append({
                    "id":       record["id"],
                    "type":     record["type"],
                    "name":     record["name"],
                    "lat":      record["lat"],
                    "lng":      record["lng"],
                    "raw_data": raw,
                })
        return jsonify({"actors": actors})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------
# HAPUS AKTOR
# ---------------------------------------------------------------
@app.route("/api/actor/delete", methods=["POST"])
def delete_actor():
    actor_id = request.get_json().get("id")
    query    = "MATCH (a:Actor {id: $act_id}) DETACH DELETE a"
    with driver.session(database="pp1") as neo_session:
        neo_session.run(query, act_id=actor_id)
    return jsonify({"success": True})


# ---------------------------------------------------------------
# HEALTH CHECK
# ---------------------------------------------------------------
@app.route("/api/health", methods=["GET"])
def health():
    from config import MODEL_NAME, BASE_URL
    return jsonify({"status": "ok", "model": MODEL_NAME, "base_url": BASE_URL})



# ---------------------------------------------------------------
# LANDING PAGE BUILDER & VIEWER ROUTES
# ---------------------------------------------------------------
@app.route("/landing_page_builder.html")
def landing_page_builder():
    actor_id = request.args.get("actor_id")
    if not actor_id:
        return "Actor ID is required", 400

    query = """
    MATCH (a:Actor {id: $act_id})
    RETURN a.name AS name, a.raw_data AS raw_data
    """
    with driver.session(database="pp1") as neo_session:
        result = neo_session.run(query, act_id=actor_id).single()
        if not result:
            return "Actor not found", 404
        
        name = result["name"]
        raw_data_str = result["raw_data"]
        raw_data = {}
        if raw_data_str:
            try:
                raw_data = json.loads(raw_data_str)
            except Exception:
                pass
                
        # Dapatkan data landing page (default "[]")
        landing_page_data = raw_data.get("landing_page_data", "[]")
        foto_visual = raw_data.get("Foto Visual Path") or raw_data.get("foto") or ""

    # Cek apakah user saat ini adalah admin
    user = session.get("user", "")
    is_admin = user.endswith(':admin') or user.endswith(':admin@2211080.com')
    if not is_admin and user:
        from config import db
        perm = db['permission_requests'].find_one({"nama_akun": user, "actor_id": actor_id, "status": "approved"})
        if perm:
            is_admin = True

    return render_template(
        "landing_page_builder.html",
        unique_id=actor_id,
        name=name,
        landing_page_data=landing_page_data,
        foto_visual=foto_visual,
        is_admin=is_admin
    )


@app.route("/api/actor/<actor_id>/landing/save", methods=["POST"])
def save_landing_page(actor_id):
    data = request.get_json()
    landing_page_data = data.get("landing_page_data", "[]")

    # Ekstrak data teks paragraf dan judul secara bersih
    clean_texts = []
    try:
        lp_json = json.loads(landing_page_data)
        lp_elements = lp_json.get("elements", [])
        for el in lp_elements:
            if el.get("type") in ["title", "text"]:
                val = str(el.get("content", "")).strip()
                if val:
                    clean_texts.append(val)
    except Exception as e:
        print(f"[routes_actors] Error parsing landing_page_data elements: {e}")
    
    landing_page_text = "\n\n".join(clean_texts)

    get_query = "MATCH (a:Actor {id: $act_id}) RETURN a.raw_data AS raw_data"
    with driver.session(database="pp1") as neo_session:
        result = neo_session.run(get_query, act_id=actor_id).single()
        if not result:
            return jsonify({"success": False, "error": "Actor not found"}), 404
        
        raw_data_str = result["raw_data"]
        raw_data = {}
        if raw_data_str:
            try:
                raw_data = json.loads(raw_data_str)
            except Exception:
                pass
        
        # Simpan landing page data dan text ke dalam raw_data
        raw_data["landing_page_data"] = landing_page_data
        raw_data["landing_page_text"] = landing_page_text
        
        # Hitung ulang embedding untuk aktor secara bersih
        exclude_keys = {
            "lat", "lng", "foto", "Foto Visual Path", "color", "warna", "Warna",
            "Titik Koordinat (Lat, Lon)", "icon", "id", "type", "timestamp", "Marker Type",
            "landing_page_data"  # Exclude raw layout JSON from embedding calculation
        }
        text_content = {k: v for k, v in raw_data.items()
                        if k not in exclude_keys and not isinstance(v, list)}
        text_content.update({k: v for k, v in raw_data.items()
                              if k not in exclude_keys and isinstance(v, list)})
        
        str_representation = json.dumps(text_content, ensure_ascii=False)
        try:
            embedding = get_embedding(str_representation)
        except Exception as e:
            print(f"[routes_actors] Embedding failed in save_landing_page: {e}")
            embedding = None

        updated_raw_data_str = json.dumps(raw_data, ensure_ascii=False)

        update_query = """
        MATCH (a:Actor {id: $act_id})
        SET a.raw_data = $raw_data,
            a.landing_page_text = $landing_page_text,
            a.embedding = $embedding
        """
        neo_session.run(
            update_query,
            act_id=actor_id,
            raw_data=updated_raw_data_str,
            landing_page_text=landing_page_text,
            embedding=embedding
        )

    return jsonify({"success": True})


# ---------------------------------------------------------------
# AI BACKGROUND REMOVAL (rembg)
# ---------------------------------------------------------------
@app.route("/api/ai/remove_bg", methods=["POST"])
def remove_bg():
    import io
    import base64
    try:
        import rembg
        from PIL import Image
    except ImportError:
        return jsonify({"success": False, "error": "Library rembg/pillow belum terinstall di server."}), 500

    data = request.get_json() or {}
    image_data_url = data.get("image")
    if not image_data_url:
        return jsonify({"success": False, "error": "Data gambar tidak ditemukan."}), 400

    try:
        if image_data_url.startswith("data:image"):
            # Format: data:image/png;base64,...
            header, encoded = image_data_url.split(",", 1)
            img_bytes = base64.b64decode(encoded)
            img = Image.open(io.BytesIO(img_bytes))
        else:
            import requests
            resp = requests.get(image_data_url, timeout=15)
            img = Image.open(io.BytesIO(resp.content))

        if img.mode != "RGBA":
            img = img.convert("RGBA")

        # Process background removal
        output_img = rembg.remove(img)

        # Convert back to Base64
        buffered = io.BytesIO()
        output_img.save(buffered, format="PNG")
        output_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        return jsonify({
            "success": True,
            "image": f"data:image/png;base64,{output_base64}"
        })
    except Exception as e:
        print(f"[remove_bg] Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# ---------------------------------------------------------------
# AI COPYWRITING ASSISTANT
# ---------------------------------------------------------------
@app.route("/api/ai/copywriter_assist", methods=["POST"])
def copywriter_assist():
    from ai_engine import call_llm
    data = request.get_json() or {}
    user_prompt = data.get("prompt", "")
    element_type = data.get("type", "text")  # 'title' or 'text'
    current_content = data.get("current_content", "")

    if not user_prompt:
        return jsonify({"success": False, "error": "Prompt tidak boleh kosong."}), 400

    system_prompt = (
        "Anda adalah asisten pemasaran digital dan ahli copywriting profesional yang sangat ahli dalam "
        "membuat headline yang menjual, kalimat ajakan (CTA) yang kuat, dan pesan pemasaran yang persuasif. "
        "Bantu pengguna membuat atau menyempurnakan salinan iklan/teks pemasaran mereka.\n\n"
        "PENTING:\n"
        "1. Berikan beberapa alternatif saran copywriting yang menarik dan siap pakai.\n"
        "2. Di bagian akhir, berikan rekomendasi ide-ide promosi, copywriting pemasaran kreatif, atau tips pemasaran "
        "yang relevan untuk meningkatkan penjualan.\n"
        "3. Tulis jawaban Anda dalam bahasa Indonesia yang menarik dan format Markdown yang rapi dengan pembagian judul dan poin-poin.\n"
        "4. Pisahkan opsi-opsi alternatif dengan jelas sehingga pengguna bisa memilih yang terbaik."
    )

    full_prompt = (
        f"Jenis Elemen: {element_type}\n"
        f"Teks Saat Ini: {current_content}\n"
        f"Permintaan Pengguna: {user_prompt}\n\n"
        "Berikan beberapa saran kalimat copywriting terbaik dan beberapa ide pemasaran/promosi yang kuat."
    )

    try:
        response_text = call_llm(system_prompt, full_prompt)
        return jsonify({"success": True, "response": response_text})
    except Exception as e:
        print(f"[copywriter_assist] Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500



