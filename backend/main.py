# =====================================================
# main.py - 서버 실행 파일
# =====================================================
# 역할: Flask 서버를 실행하고 각 기능 파일을 연결합니다.
#
# 실행 방법:
#   1. pip install flask flask-cors
#   2. python main.py
#   3. 브라우저: http://localhost:5000
#      폰 접속: http://[컴퓨터IP]:5000
#
# 기본 운영자 계정 (첫 실행 시 자동 생성):
#   아이디: admin / 비밀번호: admin1234
#
# 파일 구조:
#   main.py      <- 서버 시작
#   database.py  <- 재고 데이터
#   user_db.py   <- 회원 데이터
#   auth.py      <- 로그인/회원가입
#   users.py     <- 직원 관리 (운영자 전용)
#   inbound.py   <- 입고 API
#   outbound.py  <- 불출 API
#   returns.py   <- 환입 API
#   inventory.py <- 재고 조회 API
# =====================================================

from flask import Flask, send_from_directory, session, jsonify
from flask_cors import CORS
import sys, os
sys.path.insert(0, os.path.dirname(__file__))  # 현재 디렉토리를 모듈 경로에 추가

import secrets

# 각 기능 파일에서 Blueprint 가져오기
from auth      import auth_bp
from users     import users_bp
from inbound   import inbound_bp
from outbound  import outbound_bp
from returns   import returns_bp
from inventory import inventory_bp

app = Flask(__name__)
CORS(app, supports_credentials=True)  # 쿠키/세션 포함 허용

# 세션 암호화 키 (서버 재시작 시 새로 생성)
app.secret_key = '9e8e2ecca4466912b4ab36ad6da281f214b9478c2502f8fe8f7693f11f75c18d'

# 세션 유지 시간 설정
from datetime import timedelta
app.permanent_session_lifetime = timedelta(days=7)  # 7일간 로그인 유지

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend')

# Blueprint 등록
app.register_blueprint(auth_bp)
app.register_blueprint(users_bp)
app.register_blueprint(inbound_bp)
app.register_blueprint(outbound_bp)
app.register_blueprint(returns_bp)
app.register_blueprint(inventory_bp)


# ─────────────────────────────────────
# API 접근 전 로그인 확인 미들웨어
# 로그인 없이는 API 사용 불가
# ─────────────────────────────────────
@app.before_request
def check_auth():
    from flask import request

    # 로그인/회원가입 API는 인증 없이 허용
    public_paths = ['/api/auth/login', '/api/auth/register', '/api/auth/me', '/', '/logo.jpg']
    if request.path in public_paths:
        return None
    if request.path.startswith('/static'):
        return None

    # API 요청인데 로그인 안 된 경우
    if request.path.startswith('/api/') and 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401


# 메인 화면
@app.route('/')
def index():
    return send_from_directory(FRONTEND_DIR, 'index.html')

# 로고 이미지
@app.route('/logo.jpg')
def logo():
    return send_from_directory(FRONTEND_DIR, 'logo.jpg')


if __name__ == '__main__':
    print("=" * 50)
    print("  C&Tech 창고 재고 관리 서버 시작!")
    print("  로컬:    http://localhost:5000")
    print("  폰 접속: http://[이 컴퓨터 IP]:5000")
    print("")
    print("  기본 운영자: admin / admin1234")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)
