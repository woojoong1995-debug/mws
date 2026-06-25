# =====================================================
# auth.py - 로그인 / 로그아웃 / 회원가입 API
# =====================================================
# 역할: 직원 인증을 담당합니다.
#
# API 목록:
#   POST /api/auth/register  -> 회원가입 신청
#   POST /api/auth/login     -> 로그인
#   POST /api/auth/logout    -> 로그아웃
#   GET  /api/auth/me        -> 현재 로그인 정보 확인
#
# 보안:
#   - 비밀번호는 SHA256으로 암호화 저장
#   - 로그인 시 세션 토큰 발급 (브라우저 쿠키 저장)
#   - 회원가입은 운영자 승인 후 사용 가능
# =====================================================

from flask import Blueprint, request, jsonify, session
from user_db import load_users, save_users, hash_password
import time

auth_bp = Blueprint('auth', __name__)


@auth_bp.route('/api/auth/register', methods=['POST'])
def register():
    """
    회원가입 신청 API

    받는 데이터 (JSON):
        name     : 이름
        username : 아이디 (영문/숫자)
        password : 비밀번호

    처리:
        - 아이디 중복 확인
        - 비밀번호 암호화 저장
        - 상태: 'pending' (운영자 승인 대기)
        - 운영자가 승인해야 로그인 가능
    """
    body = request.get_json()
    if not body:
        return jsonify({'success': False, 'message': '데이터가 없습니다'}), 400

    name     = (body.get('name')     or '').strip()
    username = (body.get('username') or '').strip()
    password = (body.get('password') or '').strip()
    team     = (body.get('team')     or '').strip()  # 팀 선택 (선택 사항)

    if not name:
        return jsonify({'success': False, 'message': '이름을 입력하세요'}), 400
    if not username:
        return jsonify({'success': False, 'message': '아이디를 입력하세요'}), 400
    if not password or len(password) < 4:
        return jsonify({'success': False, 'message': '비밀번호는 4자 이상이어야 합니다'}), 400
    if team not in ('material', 'production'):
        return jsonify({'success': False, 'message': '팀을 선택 해주세요'}), 400

    users = load_users()

    # 아이디 중복 확인
    if any(u.get('username') == username for u in users):
        return jsonify({'success': False, 'message': '이미 사용 중인 아이디입니다'}), 400

    # 새 사용자 추가
    new_user = {
        'id'       : int(time.time() * 1000),
        'name'     : name,
        'username' : username,
        'password' : hash_password(password),  # 암호화 저장
        'role'     : 'user',                   # 기본 역할: 일반 직원
        'team'     : team,                     # 선택한 팀
        'status'   : 'pending',                # 운영자 승인 대기
        'created'  : time.strftime('%Y-%m-%d'),
    }
    users.append(new_user)
    save_users(users)

    return jsonify({'success': True, 'message': '회원가입 신청 완료! 운영자 승인 후 로그인 가능합니다'}), 201


@auth_bp.route('/api/auth/login', methods=['POST'])
def login():
    """
    로그인 API

    받는 데이터 (JSON):
        username : 아이디
        password : 비밀번호

    반환:
        user: { id, name, username, role }
        role: 'admin' = 운영자, 'user' = 일반 직원
    """
    body = request.get_json()
    if not body:
        return jsonify({'success': False, 'message': '데이터가 없습니다'}), 400

    username = (body.get('username') or '').strip()
    password = (body.get('password') or '').strip()

    users = load_users()

    # 아이디/비밀번호 확인
    user = next((u for u in users if u.get('username') == username), None)
    if not user:
        return jsonify({'success': False, 'message': '아이디 또는 비밀번호가 틀렸습니다'}), 401
    if user.get('password') != hash_password(password):
        return jsonify({'success': False, 'message': '아이디 또는 비밀번호가 틀렸습니다'}), 401

    # 계정 상태 확인
    if user.get('status') == 'pending':
        return jsonify({'success': False, 'message': '운영자 승인 대기 중입니다'}), 403
    if user.get('status') == 'inactive':
        return jsonify({'success': False, 'message': '비활성화된 계정입니다. 운영자에게 문의하세요'}), 403

    # 세션에 로그인 정보 저장
    session['user_id']   = user['id']
    session['username']  = user['username']
    session['name']      = user['name']
    session['role']      = user.get('role', 'user')
    session['team']      = user.get('team', 'material')
    session.permanent    = True  # 브라우저 닫아도 유지

    return jsonify({
        'success': True,
        'user': {
            'id'      : user['id'],
            'name'    : user['name'],
            'username': user['username'],
            'role'    : user.get('role', 'user'),
            'team'    : user.get('team', 'material')
        }
    })


@auth_bp.route('/api/auth/logout', methods=['POST'])
def logout():
    """
    로그아웃 API
    세션을 삭제합니다.
    """
    session.clear()
    return jsonify({'success': True, 'message': '로그아웃 완료'})


@auth_bp.route('/api/auth/me', methods=['GET'])
def get_me():
    """
    현재 로그인 정보 확인 API
    페이지 로드 시 로그인 상태 확인에 사용
    """
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401

    return jsonify({
        'success': True,
        'user': {
            'id'      : session.get('user_id'),
            'name'    : session.get('name'),
            'username': session.get('username'),
            'role'    : session.get('role', 'user'),
            'team'    : session.get('team', 'material'),
        }
    })

@auth_bp.route('/api/auth/change-password', methods=['POST'])
def change_password():
    '''
    비밀번호 변경 API
    본인 비밀번호만 변경 가능
    '''
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401
    
    body = request.get_json()
    if not body:
        return jsonify({'success': False, 'message': '데이터가 없습니다'}), 400
    
    current = (body.get('current') or '').strip()
    new_pw = (body.get('new_password') or '').strip()

    if not current or not new_pw:
        return jsonify({'success': False, 'message': '모든 항목을 입력하세요'}), 400
    if len(new_pw) < 4:
        return jsonify({'success': False, 'message': '새 비밀번호는 4자 이상이어야 합니다'}), 400
    
    users = load_users()
    for user in users:
        if user.get('id') == session['user_id']:
            # 현재 비밀번호 확인
            if user.get('password') != hash_password(current):
                return jsonify({'success': False, 'message': '현재 비밀번호가 틀렸습니다'}), 401
            # 새 비밀번호로 저장
            user['password'] = hash_password(new_pw)
            save_users(users)
            return jsonify({'success': True, 'message': '비밀번호가 변경되었습니다'})
        
    return jsonify({'success': False, 'message': '사용자 정보를 찾을 수 없습니다'}), 404