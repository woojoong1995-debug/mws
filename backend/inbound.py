# =====================================================
# inbound.py - 입고 관련 API
# =====================================================

from flask import Blueprint, request, jsonify, session
from database import add_record, detect_category
from catalog import upsert_catalog

inbound_bp = Blueprint('inbound', __name__)


@inbound_bp.route('/api/inbound', methods=['POST'])
def add_inbound():
    body = request.get_json()

    if not body:
        return jsonify({'success': False, 'message': '데이터가 없습니다'}), 400
    if not body.get('name'):
        return jsonify({'success': False, 'message': '품목명을 입력하세요'}), 400
    if not body.get('wh'):
        return jsonify({'success': False, 'message': '창고를 선택하세요'}), 400
    if not body.get('loc'):
        return jsonify({'success': False, 'message': '위치를 입력하세요'}), 400

    if not body.get('cat'):
        body['cat'] = detect_category(body.get('name', ''))

    if not body.get('person'):
        body['person'] = ''

    # 원단 규격 기반 1롤 무게 및 총 무게 계산 보정
    if body.get('item_type') == 'fabric':
        fu = body.get('fabric_unit') or 'roll'
        body['fabric_unit'] = fu
        sw = float(body.get('spec_w') or 0)
        sl = float(body.get('spec_l') or 0)
        sm = float(body.get('spec_m') or 0)
        if sw > 0 and sl > 0 and sm > 0:
            uw = round((sw * sl * sm) / 1000000.0, 6)
            body['unit_weight'] = uw
            if fu == 'roll' and float(body.get('rolls') or 0) > 0:
                body['weight'] = round(float(body['rolls']) * uw, 3)

    body['created_by'] = session.get('username', '')
    body['kind']       = 'in'
    body['depleted']   = False

    record = add_record(body)
    upsert_catalog(body)
    return jsonify({'success': True, 'data': record}), 201