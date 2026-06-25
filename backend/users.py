# =====================================================
# users.py - 운영자 직원 관리 API
# =====================================================
# 역할: 운영자만 접근할 수 있는 직원 관리 기능
#
# API 목록:
#   GET    /api/users              -> 전체 직원 목록
#   POST   /api/users/<id>/approve -> 회원가입 승인
#   POST   /api/users/<id>/reject  -> 회원가입 거절
#   POST   /api/users/<id>/deactivate -> 강제 탈퇴
#   POST   /api/users/<id>/activate   -> 계정 복구
#   DELETE /api/users/<id>         -> 직원 완전 삭제
#
# 주의:
#   모든 API는 운영자(admin)만 사용 가능
# =====================================================

from flask import Blueprint, request, jsonify, session
from user_db import load_users, save_users

users_bp = Blueprint('users', __name__)


def require_admin():
    """
    운영자 권한 확인 함수
    운영자가 아니면 오류 반환
    """
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401
    if session.get('role') != 'admin':
        return jsonify({'success': False, 'message': '운영자만 접근할 수 있습니다'}), 403
    return None


@users_bp.route('/api/users', methods=['GET'])
def get_users():
    """
    전체 직원 목록 조회 (운영자 전용)

    반환:
        직원 목록 (비밀번호 제외)
        status: pending=승인대기, active=활성, inactive=강제탈퇴
    """
    err = require_admin()
    if err: return err

    users = load_users()

    # 비밀번호 제외하고 반환
    safe_users = []
    for u in users:
        safe_users.append({
            'id'      : u.get('id'),
            'name'    : u.get('name'),
            'username': u.get('username'),
            'role'    : u.get('role', 'user'),
            'team'    : u.get('team', 'material'),
            'status'  : u.get('status', 'active'),
            'created' : u.get('created', ''),
        })

    return jsonify({'success': True, 'data': safe_users})


@users_bp.route('/api/users/<int:user_id>/approve', methods=['POST'])
def approve_user(user_id):
    """
    회원가입 승인 (운영자 전용)
    pending 상태 → active 상태로 변경
    """
    err = require_admin()
    if err: return err

    users = load_users()
    for user in users:
        if user.get('id') == user_id:
            if user.get('status') != 'pending':
                return jsonify({'success': False, 'message': '승인 대기 중인 계정이 아닙니다'}), 400
            user['status'] = 'active'
            save_users(users)
            return jsonify({'success': True, 'message': f"{user['name']} 계정이 승인됐습니다"})

    return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다'}), 404


@users_bp.route('/api/users/<int:user_id>/reject', methods=['POST'])
def reject_user(user_id):
    """
    회원가입 거절 (운영자 전용)
    pending 상태인 사용자를 삭제
    """
    err = require_admin()
    if err: return err

    users = load_users()
    target = next((u for u in users if u.get('id') == user_id), None)
    if not target:
        return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다'}), 404

    users = [u for u in users if u.get('id') != user_id]
    save_users(users)
    return jsonify({'success': True, 'message': f"{target['name']} 가입이 거절됐습니다"})


@users_bp.route('/api/users/<int:user_id>/deactivate', methods=['POST'])
def deactivate_user(user_id):
    """
    강제 탈퇴 처리 (운영자 전용)
    직원이 퇴사하면 이 API로 로그인 차단
    active → inactive 상태로 변경
    """
    err = require_admin()
    if err: return err

    # 자기 자신은 탈퇴 불가
    if session.get('user_id') == user_id:
        return jsonify({'success': False, 'message': '자신의 계정은 탈퇴시킬 수 없습니다'}), 400

    users = load_users()
    for user in users:
        if user.get('id') == user_id:
            user['status'] = 'inactive'
            save_users(users)
            return jsonify({'success': True, 'message': f"{user['name']} 계정이 비활성화됐습니다"})

    return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다'}), 404


@users_bp.route('/api/users/<int:user_id>/activate', methods=['POST'])
def activate_user(user_id):
    """
    계정 복구 (운영자 전용)
    inactive → active 상태로 복구
    """
    err = require_admin()
    if err: return err

    users = load_users()
    for user in users:
        if user.get('id') == user_id:
            user['status'] = 'active'
            save_users(users)
            return jsonify({'success': True, 'message': f"{user['name']} 계정이 복구됐습니다"})

    return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다'}), 404


@users_bp.route('/api/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    """
    직원 완전 삭제 (운영자 전용)
    데이터에서 완전히 제거됩니다.
    """
    err = require_admin()
    if err: return err

    if session.get('user_id') == user_id:
        return jsonify({'success': False, 'message': '자신의 계정은 삭제할 수 없습니다'}), 400

    users = load_users()
    target = next((u for u in users if u.get('id') == user_id), None)
    if not target:
        return jsonify({'success': False, 'message': '사용자를 찾을 수 없습니다'}), 404

    users = [u for u in users if u.get('id') != user_id]
    save_users(users)
    return jsonify({'success': True, 'message': f"{target['name']} 계정이 삭제됐습니다"})
