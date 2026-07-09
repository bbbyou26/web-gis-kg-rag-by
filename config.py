"""
config.py — Inisialisasi Flask, Database, OpenAI & Neo4j
=========================================================
Semua konfigurasi global & koneksi diletakkan di sini agar
modul lain cukup melakukan: from config import app, db, driver, ...
"""
import os
from flask import Flask
from openai import OpenAI
from neo4j import GraphDatabase
from pymongo import MongoClient

# ===============================
# FLASK APP
# ===============================
app = Flask(__name__)
app.secret_key = "secret123"

UPLOAD_FOLDER = 'static/uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# ===============================
# MONGODB
# ===============================
_mongo_client = MongoClient(
    "mongodb+srv://naskahprasetyo_db_user:UAH3NfLD85D3rjCH@p1.r9jhs5z.mongodb.net/"
)
db = _mongo_client['mydatabase']

users_collection        = db['users']
job_cases_collection    = db['job_cases']
permission_requests_collection = db['permission_requests']

# ===============================
# OPENAI / LLM
# ===============================
OPENAI_API_KEY_LLM  = "sk-_OlgjbzxzOAiCi83dQ6jQQ"
OPENAI_API_KEY_EMBED = "sk-WzeaX3n53IrKai9xEo4pRA"
BASE_URL    = "https://api.maiarouter.ai/v1"
MODEL_NAME  = "openai/gpt-4.1-mini-2025-04-14"
EMBED_MODEL = "openai/text-embedding-3-large"

client_llm = OpenAI(api_key=OPENAI_API_KEY_LLM,  base_url=BASE_URL)
client_embed = OpenAI(api_key=OPENAI_API_KEY_EMBED, base_url=BASE_URL)

# ===============================
# NEO4J GRAPH DATABASE
# ===============================
# NEO4J_URI      = "neo4j+s://0eee7da8.databases.neo4j.io"
# NEO4J_USER     = "0eee7da8"
# NEO4J_PASSWORD = "czrfB-U4GmdFZDqStdC7ZkdniTG74Vyf7w3QmW9p0N4"

NEO4J_URI      = "bolt://127.0.0.1:7687"
NEO4J_USER     = "neo4j"
NEO4J_PASSWORD = "26022002"

driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))

# ===============================
# CORE LIBRARIES (REQUIRED)
# ===============================

HAS_GIS           = False
HAS_ADVANCED_TOOLS = False
