# =====================================================
# inbound.py - 입고 관련 API
# =====================================================
# 역할: 물품이 창고에 들어올 때 등록하는 기능
#
# API 목록:
#   POST /api/inbound  -> 입고 등록
# =====================================================

from flask import Blueprint, request, jsonify
from database import add_record, detect_category

# Blueprint: 기능별로 API를 나눠서 관리하는 Flask 기능
inbound_bp = Blueprint('inbound', __name__)


@inbound_bp.route('/api/inbound', methods=['POST'])
def add_inbound():
    """
    입고 등록 API

    받는 데이터 (JSON):
        item_type : 품목 유형 ('normal' = 일반, 'fabric' = 원단)
        wh        : 창고 ('D' = D동, 'T' = 천막동)
        loc       : 위치 (예: 'D동 B구역 5번 렉 2층')
        name      : 품목명 (예: '카톤.스파크패드')
        code      : 품번 (예: 'G21E000270')
        lot       : Lot No. (예: 'GE141D')
        cat       : 카테고리 (자동감지, 없으면 품목명으로 감지)
        qty       : 수량 (일반 품목)
        rolls     : 롤 수 (원단)
        weight    : 무게 kg (원단)
        route     : 루트 번호
        po        : PO 번호
        date      : 입고일 (YYYY-MM-DD)
        note      : 비고
    """
    body = request.get_json()

    # 필수 항목 확인
    if not body:
        return jsonify({'success': False, 'message': '데이터가 없습니다'}), 400
    if not body.get('name'):
        return jsonify({'success': False, 'message': '품목명을 입력하세요'}), 400
    if not body.get('wh'):
        return jsonify({'success': False, 'message': '창고를 선택하세요'}), 400
    if not body.get('loc'):
        return jsonify({'success': False, 'message': '위치를 입력하세요'}), 400

    # 카테고리 자동 감지 (직접 선택 안 했을 경우)
    if not body.get('cat'):
        body['cat'] = detect_category(body.get('name', ''))

    # 담당자 정보 저장
    if not body.get('person'):
        body['person'] = '' 

    # 입고 종류 표시
    body['kind'] = 'in'
    body['depleted'] = False  # 소진 여부 초기값

    # 데이터 저장
    record = add_record(body)
    return jsonify({'success': True, 'data': record}), 201
