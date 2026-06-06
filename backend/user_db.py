# =====================================================
# user_db.py - 회원 데이터 저장/불러오기
# =====================================================
# 역할: 직원 계정 정보를 users.json 파일에 저장합니다.
#
# 파일 위치: backend/users.json (자동 생성)
#
# 기본 운영자 계정:
#   아이디: admin
#   비밀번호: admin1234
#   (처음 실행 시 자동 생성, 나중에 변경 권장)
# =====================================================

import json
import os
import hashlib
import time

USERS_FILE = os.path.join(os.path.dirname(__file__), 'users.json')


def hash_password(password):
    """
    비밀번호를 SHA256으로 암호화합니다.
    원본 비밀번호는 저장되지 않습니다.
    """
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


def load_users():
    """
    저장된 회원 데이터를 불러옵니다.
    파일이 없으면 기본 운영자 계정을 생성합니다.
    """
    if not os.path.exists(USERS_FILE):
        # 기본 운영자 계정 자동 생성
        default_admin = [{
            'id'      : int(time.time() * 1000),
            'name'    : '운영자',
            'username': 'admin',
            'password': hash_password('admin1234'),
            'role'    : 'admin',   # 운영자
            'status'  : 'active',  # 바로 활성화
            'created' : time.strftime('%Y-%m-%d'),
        }]
        save_users(default_admin)
        print("[알림] 기본 운영자 계정이 생성됐습니다.")
        print("       아이디: admin / 비밀번호: admin1234")
        print("       로그인 후 비밀번호를 변경하세요!")
        return default_admin

    try:
        with open(USERS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def save_users(users):
    """
    회원 데이터를 JSON 파일에 저장합니다.
    """
    try:
        with open(USERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(users, f, ensure_ascii=False, indent=2)
        return True
    except IOError as e:
        print(f"[저장 오류] {e}")
        return False
