# =====================================================
# returns.py - 환입 관련 API
# =====================================================
# 역할: 생산 라인에서 사용 후 남은 원자재를 창고로
#       돌려보낼 때 등록하는 기능
#
# API 목록:
#   POST /api/return  -> 환입 등록
#
# 환입 특징:
#   - 불출 선입선출에서 환입이 무조건 1순위
#   - 원단: 소수점 롤수 입력 가능 (예: 2.5롤)
#   - 입고 화면과 동일한 필드 구조
# =====================================================

from flask import Blueprint, request, jsonify, session
from database import add_record, detect_category

returns_bp = Blueprint('returns', __name__)


@returns_bp.route('/api/return', methods=['POST'])
def add_return():
    """
    환입 등록 API

    받는 데이터 (JSON):
        item_type : 품목 유형 ('normal' = 일반, 'fabric' = 원단)
        wh        : 창고 ('D' = D동, 'T' = 천막동)
        loc       : 위치
        name      : 품목명
        code      : 품번
        lot       : Lot No.
        cat       : 카테고리 (없으면 품목명으로 자동 감지)
        qty       : 수량 (일반)
        rolls     : 롤 수 (원단, 소수점 가능 예: 2.5)
        weight    : 무게 kg (원단)
        route     : 루트 번호
        po        : PO 번호
        date      : 환입 날짜
        note      : 비고
    """
    body = request.get_json()

    # 필수 항목 확인
    if not body:
        return jsonify({'success': False, 'message': '데이터가 없습니다'}), 400
    if not body.get('code'):
        return jsonify({'success': False, 'message': '품번을 입력하세요'}), 400
    if not body.get('wh'):
        return jsonify({'success': False, 'message': '창고를 선택하세요'}), 400
    if not body.get('loc'):
        return jsonify({'success': False, 'message': '위치를 입력하세요'}), 400

    # 카테고리 자동 감지
    if not body.get('cat'):
        body['cat'] = detect_category(body.get('name', ''))

    # 담당자 정보 저장
    if not body.get('person'):
        body['person'] = ''

    # 등록자 저장 (수정 권한 체크용)
    body['created_by'] = session.get('useername', '')  # 로그인한

    # 환입 종류 표시
    body['kind']     = 'hwanjip'
    body['depleted'] = False

    record = add_record(body)
    return jsonify({'success': True, 'data': record}), 201
