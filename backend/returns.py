# =====================================================
# returns.py - 환입 관련 API
# =====================================================

from flask import Blueprint, request, jsonify, session
from database import add_record, detect_category
from catalog import upsert_catalog

returns_bp = Blueprint('returns', __name__)


@returns_bp.route('/api/return', methods=['POST'])
def add_return():
    body = request.get_json()

    if not body:
        return jsonify({'success': False, 'message': '데이터가 없습니다'}), 400
    if not body.get('code'):
        return jsonify({'success': False, 'message': '품번을 입력하세요'}), 400
    if not body.get('wh'):
        return jsonify({'success': False, 'message': '창고를 선택하세요'}), 400
    if not body.get('loc'):
        return jsonify({'success': False, 'message': '위치를 입력하세요'}), 400

    if not body.get('cat'):
        body['cat'] = detect_category(body.get('name', ''))

    if not body.get('person'):
        body['person'] = ''

    if body.get('item_type') == 'fabric':
        # 원단 환입: 기본은 'kg' (자투리 무게 환입), 단 SET/m/개수 원단은 해당 단위 유지
        fu = body.get('fabric_unit') or 'kg'
        body['fabric_unit'] = fu

    body['created_by'] = session.get('username', '')
    body['kind']       = 'hwanjip'
    body['depleted']   = False

    record = add_record(body)
    upsert_catalog(body)
    return jsonify({'success': True, 'data': record}), 201