# =====================================================
# main.py - 서버 실행 파일
# =====================================================

from flask import Flask, send_from_directory, session, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO
from datetime import timedelta
import sys, os

sys.path.insert(0, os.path.dirname(__file__))

from auth      import auth_bp
from users     import users_bp
from inbound   import inbound_bp
from outbound  import outbound_bp
from returns   import returns_bp
from inventory import inventory_bp
from ocr       import ocr_bp
from requests  import requests_bp

app = Flask(__name__)
CORS(app, supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins='*')

app.secret_key = '9e8e2ecca4466912b4ab36ad6da281f214b9478c2502f8fe8f7693f11f75c18d'
app.permanent_session_lifetime = timedelta(days=7)

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend')

# Blueprint 등록
for bp in [auth_bp, users_bp, inbound_bp, outbound_bp, returns_bp, inventory_bp, ocr_bp, requests_bp]:
    app.register_blueprint(bp)

# ─────────────────────────────────────
# 로그인 확인 미들웨어
# ─────────────────────────────────────
@app.before_request
def check_auth():
    from flask import request
    public_paths = ['/api/auth/login', '/api/auth/register', '/api/auth/me',
                    '/', '/a-logo.png', '/b-logo.png']
    if request.path in public_paths:                      return None
    if request.path.startswith('/static'):                return None
    if request.path.startswith('/css/'):                  return None
    if request.path.startswith('/js/'):                   return None
    if request.path.startswith('/api/lock'):              return None
    if request.path.startswith('/api/') and 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401

# ─────────────────────────────────────
# 정적 파일 서빙
# ─────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

@app.route('/a-logo.png')
def logo_light():
    return send_from_directory(FRONTEND_DIR, 'a-logo.png')

@app.route('/b-logo.png')
def logo_dark():
    return send_from_directory(FRONTEND_DIR, 'b-logo.png')

@app.route('/css/<path:filename>')
def serve_css(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, 'css'), filename)

@app.route('/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(os.path.join(FRONTEND_DIR, 'js'), filename)

if __name__ == '__main__':
    print("=" * 50)
    print("  C&Tech 창고 재고 관리 서버 시작!")
    print("  로컬:    http://localhost:5000")
    print("=" * 50)
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)