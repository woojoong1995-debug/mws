# =====================================================
# inventory.py - 재고 조회 관련 API
# =====================================================
# 역할: 현재 창고에 있는 재고를 조회하는 기능
#
# API 목록:
#   GET  /api/inventory  -> 재고 목록 조회
#   POST /api/cleanup    -> 소진 항목 자동 정리
#   GET  /api/export     -> 전체 데이터 CSV 다운로드
#   DELETE /api/record/<id> -> 레코드 삭제
#
# 소진 항목 처리 규칙:
#   - 당일 소진: 재고에 취소선+소진 배지로 표시
#   - 다음날: 자동으로 완전 삭제
# =====================================================

from flask import Blueprint, request, jsonify, Response, session
from database import load_data, save_data, delete_record, export_to_csv
from datetime import date

inventory_bp = Blueprint('inventory', __name__)


@inventory_bp.route('/api/inventory', methods=['GET'])
def get_inventory():
    """
    재고 목록 조회 API

    쿼리 파라미터:
        q   : 검색어 (품목명/품번/위치로 검색)
        cat : 카테고리 필터 (카톤/원단/단상자/인박스/기타)

    반환:
        - 입고/환입 항목 목록
        - 오늘 소진된 항목은 포함 (당일은 소진 표시)
        - 어제 이전 소진 항목은 제외
        - 통계: 전체 입고 건수, 오늘 입고 건수
    """
    q     = request.args.get('q', '').lower().strip()
    cat   = request.args.get('cat', '')
    today = date.today().isoformat()
    data  = load_data()

    # 입고/환입 항목만 가져오기
    items = [d for d in data if d.get('kind') in ('in', 'hwanjip')]

    # 어제 이전 소진 항목 제외 (당일 소진은 포함)
    items = [
        i for i in items
        if not (i.get('depleted') and i.get('date', '') < today)
    ]

    # 검색어 필터 (품목명, 품번, 위치 중 하나라도 포함되면 표시)
    if q:
        items = [
            i for i in items
            if q in (i.get('name') or '').lower()
            or q in (i.get('code') or '').lower()
            or q in (i.get('loc')  or '').lower()
        ]

    # 카테고리 필터
    if cat:
        items = [i for i in items if (i.get('cat') or '기타') == cat]

    # 통계 계산 (필터 없이 전체 기준)
    all_in    = [d for d in data if d.get('kind') == 'in']
    total_in  = len(all_in)
    today_in  = len([d for d in all_in if d.get('date') == today])

    return jsonify({
        'success'  : True,
        'data'     : items,
        'total_in' : total_in,
        'today_in' : today_in
    })


@inventory_bp.route('/api/cleanup', methods=['POST'])
def cleanup():
    """
    소진 항목 자동 정리 API

    처리 내용:
        어제 이전 날짜에 소진된 입고/환입 항목을 자동 삭제
        (당일 소진된 항목은 유지 - 취소 가능하도록)

    호출 시점:
        페이지 로드 시 프론트엔드에서 자동 호출
    """
    today   = date.today().isoformat()
    data    = load_data()
    before  = len(data)

    # 소진됐고 날짜가 오늘 이전인 입고/환입 항목 삭제
    cleaned = [
        d for d in data
        if not (
            d.get('depleted')
            and d.get('kind') in ('in', 'hwanjip')
            and d.get('date', '') < today
        )
    ]

    removed = before - len(cleaned)
    if removed > 0:
        save_data(cleaned)

    return jsonify({'success': True, 'removed': removed})


@inventory_bp.route('/api/export', methods=['GET'])
def export_csv():
    """
    전체 데이터 CSV 다운로드 API

    반환:
        엑셀에서 열 수 있는 UTF-8 BOM CSV 파일
        파일명: 창고재고_YYYY-MM-DD.csv
    """
    csv_content = export_to_csv()
    if not csv_content:
        return jsonify({'success': False, 'message': '내보낼 데이터가 없습니다'}), 404

    filename = f"창고재고_{date.today().strftime('%Y-%m-%d')}.csv"
    return Response(
        csv_content,
        mimetype='text/csv; charset=utf-8',
        headers={
            'Content-Disposition': f"attachment; filename*=UTF-8''{filename}"
        }
    )


@inventory_bp.route('/api/record/<int:record_id>', methods=['PUT'])
def update_record(record_id):
    """
    레코드 수정 API
    수량 수정, 위치 이동 등에 사용합니다.
    """
    body = request.get_json()
    if not body:
        return jsonify({'success': False, 'message': '데이터가 없습니다'}), 400

    # 권환 확인: 본인 항목이거나 운영자만 수정 가능
    current_user = session.get('username', '')
    current_role = session.get('role', 'user')

    data = load_data()
    found = False
    for i, item in enumerate(data):
        if item.get('id') == record_id:
            # 운영자거나 본인이 윽록한 항목만 수정가능
            if current_role != 'admin' and item.get('created_by', '') != current_user:
                return jsonify({'success': False, 'message': '본인이 등록한 항목만 수정할 수 있습니다'}), 403
            # 기존 데이터에 수정 내용 덮어쓰기
            data[i] = body
            data[i]['id'] = record_id  # ID 유지
            found = True
            break

    if not found:
        return jsonify({'success': False, 'message': '항목을 찾을 수 없습니다'}), 404

    save_data(data)
    return jsonify({'success': True, 'data': data[i]})


@inventory_bp.route('/api/record/<int:record_id>', methods=['DELETE'])
def remove_record(record_id):
    """
    레코드 삭제 API
    특정 ID의 레코드를 삭제합니다.
    """
    if delete_record(record_id):
        return jsonify({'success': True, 'message': '삭제 완료'})
    return jsonify({'success': False, 'message': '항목을 찾을 수 없습니다'}), 404
