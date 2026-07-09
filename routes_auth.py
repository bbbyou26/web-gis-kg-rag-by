"""
routes_auth.py — Autentikasi & Manajemen Profil Pengguna
=========================================================
Menangani:
  - Halaman utama (map, workspace, auth)
  - Login / Register / Logout
  - Update profil (nama & foto)
"""
import os
import uuid
import base64
from datetime import datetime

from flask import render_template, redirect, url_for, session, request, jsonify
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash

from config import app, users_collection, permission_requests_collection


# ---------------------------------------------------------------
# HELPER: Ambil Data User dari Sesi
# ---------------------------------------------------------------
def get_current_user_data():
    """Kembalikan dict {name, foto_base64} atau None jika belum login."""
    user_akun = session.get("user")
    if not user_akun:
        return None

    user_doc = users_collection.find_one({"nama_akun": user_akun})
    if not user_doc:
        return None

    b64_foto = user_doc.get("foto", "")
    if b64_foto.startswith("uploads/"):
        foto_path = os.path.join(app.config['UPLOAD_FOLDER'], os.path.basename(b64_foto))
        if os.path.exists(foto_path):
            with open(foto_path, "rb") as img:
                b64_foto = base64.b64encode(img.read()).decode('utf-8')
        else:
            b64_foto = ""

    return {"name": user_doc.get("nama", user_akun), "foto": b64_foto}


# ---------------------------------------------------------------
# HALAMAN UTAMA
# ---------------------------------------------------------------
@app.route("/map.html")
def app_page():
    user_data = get_current_user_data()
    if not user_data:
        return redirect(url_for("index"))
    return render_template("map.html", user=user_data)


@app.route("/")
@app.route("/beranda.html")
def index():
    return render_template("beranda.html")


@app.route("/tentang")
@app.route("/tentang.html")
def tentang_page():
    return render_template("tentang.html")


@app.route("/auth")
@app.route("/auth.html")
def auth_page():
    return render_template("auth.html")


@app.route("/login_page")
def login_page():
    return redirect(url_for("auth_page", **request.args))


# ---------------------------------------------------------------
# AUTH: LOGIN & REGISTER
# ---------------------------------------------------------------
@app.route("/login", methods=["POST"])
def login_user():
    nama_akun = request.form.get("nama_akun")
    password  = request.form.get("password")
    user      = users_collection.find_one({"nama_akun": nama_akun})

    if not user:
        return redirect(url_for("login_page", error="user_not_found"))

    if check_password_hash(user["password"], password):
        session["user"] = nama_akun
        return redirect(url_for("app_page"))

    return redirect(url_for("login_page", error="wrong_password"))


@app.route("/register", methods=["POST"])
def register_user():
    nama_akun = request.form.get("nama_akun")
    nama      = request.form.get("nama")
    password  = request.form.get("password")

    if not nama_akun or not password or not nama:
        return redirect(url_for("login_page", error="register_field_invalid"))

    if users_collection.find_one({"nama_akun": nama_akun}):
        return redirect(url_for("login_page", error="register_name_used"))

    foto      = request.files.get("foto")
    b64_foto  = ""
    if foto and foto.filename != "":
        b64_foto = base64.b64encode(foto.read()).decode('utf-8')

    users_collection.insert_one({
        "nama_akun":  nama_akun,
        "nama":       nama,
        "password":   generate_password_hash(password),
        "foto":       b64_foto,
        "created_at": datetime.utcnow()
    })
    return redirect(url_for("login_page", error="register_success"))


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login_page"))


# ---------------------------------------------------------------
# PROFIL: UPDATE NAMA & FOTO
# ---------------------------------------------------------------
@app.route("/api/user/update", methods=["POST"])
def update_user_profile():
    nama_akun = session.get("user")
    if not nama_akun:
        return jsonify({"error": "Unauthorized"}), 401

    nama        = request.form.get("nama")
    foto        = request.files.get("foto")
    update_data = {}

    if nama:
        update_data["nama"] = nama

    if foto and foto.filename != "":
        update_data["foto"] = base64.b64encode(foto.read()).decode('utf-8')

    if update_data:
        users_collection.update_one({"nama_akun": nama_akun}, {"$set": update_data})
        return jsonify({"success": True})

    return jsonify({"error": "No data provided"}), 400


# ---------------------------------------------------------------
# PERMISSION: REQUEST & APPROVE
# ---------------------------------------------------------------
@app.route("/api/permission/request", methods=["POST"])
def request_permission():
    nama_akun = session.get("user")
    if not nama_akun:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json() or {}
    actor_id = data.get("actor_id")
    actor_name = data.get("actor_name", "Aktor")

    if not actor_id:
        return jsonify({"error": "actor_id is required"}), 400

    user_doc = users_collection.find_one({"nama_akun": nama_akun})
    if not user_doc:
        return jsonify({"error": "User profile not found"}), 404

    # Check if already approved
    existing = permission_requests_collection.find_one({
        "nama_akun": nama_akun,
        "actor_id": actor_id,
        "status": "approved"
    })
    if existing:
        return jsonify({"success": True, "message": "Already approved"})

    permission_requests_collection.update_one(
        {"nama_akun": nama_akun, "actor_id": actor_id},
        {
            "$set": {
                "nama": user_doc.get("nama", nama_akun),
                "foto": user_doc.get("foto", ""),
                "actor_name": actor_name,
                "tanggal": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "status": "pending"
            }
        },
        upsert=True
    )
    return jsonify({"success": True})


@app.route("/api/permission/requests", methods=["GET"])
def get_permission_requests():
    nama_akun = session.get("user", "")
    is_admin = nama_akun.endswith(':admin') or nama_akun.endswith(':admin@2211080.com')
    if not is_admin:
        return jsonify({"error": "Unauthorized"}), 403

    requests_cursor = permission_requests_collection.find({"status": "pending"})
    requests_list = []
    for req in requests_cursor:
        requests_list.append({
            "nama_akun": req["nama_akun"],
            "nama": req.get("nama", req["nama_akun"]),
            "foto": req.get("foto", ""),
            "actor_id": req["actor_id"],
            "actor_name": req.get("actor_name", "Aktor"),
            "tanggal": req.get("tanggal", ""),
            "status": req.get("status", "pending")
        })

    return jsonify({"requests": requests_list})


@app.route("/api/permission/approve", methods=["POST"])
def approve_permission():
    nama_akun_session = session.get("user", "")
    is_admin = nama_akun_session.endswith(':admin') or nama_akun_session.endswith(':admin@2211080.com')
    if not is_admin:
        return jsonify({"error": "Unauthorized"}), 403

    data = request.get_json() or {}
    target_nama_akun = data.get("nama_akun")
    actor_id = data.get("actor_id")

    if not target_nama_akun or not actor_id:
        return jsonify({"error": "Missing nama_akun or actor_id"}), 400

    permission_requests_collection.update_one(
        {"nama_akun": target_nama_akun, "actor_id": actor_id},
        {"$set": {"status": "approved"}}
    )
    return jsonify({"success": True})


@app.route("/api/user/permissions", methods=["GET"])
def get_user_permissions():
    nama_akun = session.get("user")
    if not nama_akun:
        return jsonify({"permissions": []})

    approved_requests = permission_requests_collection.find({
        "nama_akun": nama_akun,
        "status": "approved"
    })
    
    actor_ids = [req["actor_id"] for req in approved_requests]
    return jsonify({"permissions": actor_ids})
def get_user_permissions():
    nama_akun = session.get("user")
    if not nama_akun:
        return jsonify({"permissions": [], "can_create": False})

    approved_requests = permission_requests_collection.find({
        "nama_akun": nama_akun,
        "status": "approved"
    })
    actor_ids = [req["actor_id"] for req in approved_requests]

    user_doc = users_collection.find_one({"nama_akun": nama_akun})
    can_create = user_doc.get("can_create_markers", False) if user_doc else False

    return jsonify({
        "permissions": actor_ids,
        "can_create": can_create
    })
