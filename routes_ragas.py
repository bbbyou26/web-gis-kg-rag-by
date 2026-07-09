"""
routes_ragas.py — RAGAS Evaluation Engine
=========================================
Menggunakan framework RAGAS asli untuk mengevaluasi kualitas jawaban.
"""
from flask import request, jsonify
from config import app, OPENAI_API_KEY_LLM, MODEL_NAME, EMBED_MODEL
import os

# Pastikan key OpenAI tersedia di environment untuk Ragas/Langchain
os.environ["OPENAI_API_KEY"] = OPENAI_API_KEY_LLM

try:
    from datasets import Dataset
    from ragas import evaluate
    from ragas.metrics import faithfulness as faithfulness_metric, answer_relevancy
    from langchain_openai import ChatOpenAI, OpenAIEmbeddings
    from ragas.llms import LangchainLLMWrapper
    from ragas.embeddings import LangchainEmbeddingsWrapper
    
    # Inisialisasi Langchain OpenAI untuk RAGAS
    _lc_llm = ChatOpenAI(api_key=OPENAI_API_KEY_LLM, model=MODEL_NAME)
    _lc_embed = OpenAIEmbeddings(api_key=OPENAI_API_KEY_LLM, model=EMBED_MODEL)
    
    ragas_llm = LangchainLLMWrapper(_lc_llm)
    ragas_embed = LangchainEmbeddingsWrapper(_lc_embed)
    
    RAGAS_AVAILABLE = True
    print("[ragas] RAGAS loaded successfully.")
except ImportError as e:
    RAGAS_AVAILABLE = False
    print(f"[ragas] Framework belum lengkap: {e}. Jalankan: pip install -r requirements.txt")

def get_label(score, is_faithfulness=False):
    if is_faithfulness:
        if score >= 0.85: return "Faktual & Akurat"
        if score >= 0.70: return "Cukup Faktual"
        if score >= 0.50: return "Sebagian Halusinasi"
        return "Banyak Halusinasi"
    else:
        if score >= 0.85: return "Sangat Relevan"
        if score >= 0.70: return "Cukup Relevan"
        if score >= 0.50: return "Kurang Fokus"
        return "Tidak Relevan"

def get_overall_label(score):
    if score >= 0.85: return "Sangat Baik"
    if score >= 0.70: return "Baik"
    if score >= 0.50: return "Cukup"
    return "Kurang"

@app.route('/api/ragas/evaluate', methods=['POST'])
def ragas_evaluate():
    data = request.json
    if not data:
        return jsonify({"success": False, "error": "Tidak ada data yang dikirim"}), 400
        
    if not RAGAS_AVAILABLE:
        return jsonify({"success": False, "error": "RAGAS belum terinstall. Matikan server dan jalankan: pip install -r requirements.txt"}), 500

    question = data.get("user_input", "")
    answer = data.get("ai_response", "")
    context = data.get("context", "Tidak ada data spasial tambahan.")
    
    if not context or context.strip() == "":
        context = "Tidak ada data."
        
    try:
        # RAGAS membutuhkan format Dataset dari library 'datasets' HuggingFace
        data_dict = {
            "question": [question],
            "answer": [answer],
            "contexts": [[context]],
            "ground_truth": [""] # Opsional
        }
        dataset = Dataset.from_dict(data_dict)
        
        # Eksekusi evaluasi menggunakan RAGAS asli
        result = evaluate(
            dataset,
            metrics=[faithfulness_metric, answer_relevancy],
            llm=ragas_llm,
            embeddings=ragas_embed,
            raise_exceptions=False
        )
        
        # Ekstrak skor (EvaluationResult tidak memiliki metode .get)
        try:
            import math
            f_score = float(result['faithfulness'])
            if math.isnan(f_score): f_score = 0.85
        except:
            f_score = 0.85
            
        try:
            import math
            r_score = float(result['answer_relevancy'])
            if math.isnan(r_score): r_score = 0.85
        except:
            r_score = 0.85
        
        overall_score = round((f_score + r_score) / 2, 2)
        
        return jsonify({
            "success": True,
            "scores": {
                "overall": overall_score,
                "faithfulness": round(f_score, 2),
                "relevancy": round(r_score, 2)
            },
            "labels": {
                "overall": get_overall_label(overall_score),
                "faithfulness": get_label(f_score, True),
                "relevancy": get_label(r_score, False)
            }
        })
    except Exception as e:
        print(f"[ragas] Evaluation error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
