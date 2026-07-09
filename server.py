from config import app

# Import semua modul route agar route-nya terdaftar ke `app`
import routes_auth       
import routes_actors     
import routes_spatial    
import routes_ragas


# ===============================
# RUN SERVER
# ===============================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
