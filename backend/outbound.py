# =====================================================
# outbound.py - 불출 관련 API
# =====================================================
# 역할: 창고에서 물품을 꺼낼 때 처리하는 기능
#
# API 목록:
#   GET    /api/fifo?code=품번  -> 선입선출 순서 조회
#   POST   /api/outbound        -> 불출 처리 (재고 자동 차감)
#   DELETE /api/outbound/<id>   -> 불출 취소 (재고 자동 복원)
#   GET    /api/history         -> 불출 이력 조회
#
# 선입선출(FIFO) 규칙:
#   1순위: 환입 항목 (생산 라인에서 돌아온 것)
#   2순위: 입고 날짜 빠른 순
# =====================================================

from flask import Blueprint, request, jsonify
from database import load_data, save_data, add_record
from datetime import date
import time

outbound_bp = Blueprint('outbound', __name__)


@outbound_bp.route('/api/fifo', methods=['GET'])
def get_fifo():
    """
    선입선출(FIFO) 불출 순서 조회 API

    쿼리 파라미터:
        code : 품번 (끝 자리 검색 가능, 예: '0017')

    반환:
        해당 품번의 입고/환입 항목을 불출 우선순위 순으로 반환
        - 환입 항목이 무조건 1순위
        - 그 다음 입고 날짜 빠른 순
        - 소진된 항목(수량 0)은 제외
    """
    code = request.args.get('code', '').strip()
    if not code:
        return jsonify({'success': False, 'message': '품번을 입력하세요'}), 400

    today = date.today().isoformat()
    data = load_data()

    # 해당 품번 입고/환입 항목 필터링
    # - 소진되지 않은 것만
    # - 오늘 소진된 것은 포함 (당일은 소진 표시로 보임)
    matches = [
        d for d in data
        if d.get('kind') in ('in', 'hwanjip')
        and (d.get('code') or '').upper().endswith(code.upper())
        and not d.get('depleted')
        and ((d.get('qty') or 0) > 0 or (d.get('rolls') or 0) > 0)
    ]

    # 정렬: 환입 1순위, 그 다음 입고일 오름차순
    matches.sort(key=lambda x: (
        0 if x.get('kind') == 'hwanjip' else 1,  # 환입=0, 입고=1
        x.get('date', '')                          # 날짜 빠른 순
    ))

    return jsonify({'success': True, 'data': matches})


@outbound_bp.route('/api/outbound', methods=['POST'])
def add_outbound():
    """
    불출 처리 API

    받는 데이터 (JSON):
        code      : 품번
        name      : 품목명
        item_type : 품목 유형 ('normal' 또는 'fabric')
        person    : 담당자 이름 (필수!)
        from_id   : 차감할 입고 항목의 ID
        from_loc  : 불출 위치 (이력에 표시됨)
        qty       : 불출 수량 (일반)
        rolls     : 불출 롤 수 (원단)
        weight    : 불출 무게 (원단)
        date      : 불출 날짜
        note      : 비고

    처리 내용:
        1. from_id 항목에서 수량 차감
        2. 수량 0 되면 depleted=True (소진 처리)
        3. 불출 이력 저장
    """
    body = request.get_json()
    if not body:
        return jsonify({'success': False, 'message': '데이터가 없습니다'}), 400
    if not body.get('code'):
        return jsonify({'success': False, 'message': '품번을 입력하세요'}), 400
    if not body.get('person'):
        return jsonify({'success': False, 'message': '담당자 이름을 입력하세요'}), 400

    data = load_data()
    from_id = body.get('from_id')

    # 선택한 입고 항목에서 수량 차감
    if from_id:
        for item in data:
            if item.get('id') == from_id:
                if body.get('item_type') == 'fabric':
                    # 원단: 롤수와 무게 차감
                    item['rolls']  = max(0, (item.get('rolls')  or 0) - (body.get('rolls')  or 0))
                    item['weight'] = max(0, (item.get('weight') or 0) - (body.get('weight') or 0))
                    item['qty']    = item['rolls']
                else:
                    # 일반: 수량 차감
                    item['qty'] = max(0, (item.get('qty') or 0) - (body.get('qty') or 0))

                # 수량이 0이 되면 소진 처리
                if item.get('qty', 0) <= 0:
                    item['depleted'] = True
                break

    # 불출 이력 저장
    body['kind'] = 'out'
    body['id']   = int(time.time() * 1000)
    data.append(body)
    save_data(data)

    return jsonify({'success': True, 'data': body}), 201


@outbound_bp.route('/api/outbound/<int:record_id>', methods=['DELETE'])
def cancel_outbound(record_id):
    """
    불출 취소 API

    처리 내용:
        1. 불출 이력 삭제
        2. 원본 입고 항목 수량 복원
        3. 소진 해제 (depleted=False)
    
    사용 시점:
        생산라인에서 잘못 주문했을 때 취소
    """
    data = load_data()

    # 취소할 불출 이력 찾기
    out = next((d for d in data if d.get('id') == record_id and d.get('kind') == 'out'), None)
    if not out:
        return jsonify({'success': False, 'message': '불출 이력을 찾을 수 없습니다'}), 404

    # 원본 입고 항목 수량 복원
    from_id = out.get('from_id')
    if from_id:
        for item in data:
            if item.get('id') == from_id:
                if out.get('item_type') == 'fabric':
                    item['rolls']  = (item.get('rolls')  or 0) + (out.get('rolls')  or 0)
                    item['weight'] = (item.get('weight') or 0) + (out.get('weight') or 0)
                    item['qty']    = item['rolls']
                else:
                    item['qty'] = (item.get('qty') or 0) + (out.get('qty') or 0)
                item['depleted'] = False  # 소진 해제
                break

    # 불출 이력 삭제
    new_data = [d for d in data if d.get('id') != record_id]
    save_data(new_data)

    return jsonify({'success': True, 'message': '불출 취소 완료. 재고가 복원됐습니다'})


@outbound_bp.route('/api/history', methods=['GET'])
def get_history():
    """
    불출 이력 조회 API

    쿼리 파라미터:
        from : 시작 날짜 (YYYY-MM-DD)
        to   : 종료 날짜 (YYYY-MM-DD)

    반환:
        불출 기록 (최신순)
        - 날짜 필터 적용
        - 3개월(90일) 이전 이력 자동 삭제
        - 통계: 전체 건수, 필터 적용 건수
    """
    from datetime import timedelta

    today    = date.today()
    today_str = today.isoformat()

    # 3개월(90일) 이전 이력 자동 삭제
    cutoff = (today - timedelta(days=90)).isoformat()
    data   = load_data()
    before = len(data)
    data   = [d for d in data if not (d.get('kind') == 'out' and d.get('date', '') < cutoff)]
    if len(data) < before:
        save_data(data)

    # 불출 항목만 필터링
    outs = [d for d in data if d.get('kind') == 'out']
    total = len(outs)

    # 날짜 필터 적용
    date_filter = request.args.get('date', '')
    kind_filter = request.args.get('kind', 'out')  # 기본값은 'out'

    # 종류 필터 (입고/불출/환입)
    outs = [d for d in data if d.get('kind') == kind_filter]

    if date_filter:
        outs = [o for o in outs if o.get('date', '') == date_filter]

    # 최신순 정렬
    outs = sorted(outs, key=lambda x: x.get('date', ''), reverse=True)

    return jsonify({
        'success' : True,
        'data'    : outs,
        'total'   : total,           # 전체 불출 건수 (필터 없이)
        'filtered': len(outs),       # 필터 적용 후 건수
        'today'   : len([o for o in outs if o.get('date') == today_str])
    })
