# ==============================================
# requests.py - 불출 신청 관련 API
# ==============================================
# 역활: 생산팀이 불출을 신청하고
#       자재팀이 확인 후 수량 수정하여 확정하는 기능
#
# API 목록:
#    POST   /api/requests          -> 생산팀: 불출 신청
#    GET    /api/requests          -> 자재팀: 신청 목록 조회
#    PUT    /api/requests/<id>     -> 자재팀: 수량 수정 + 불출 확정
#    POST   /api/requests/<id>/reject -> 자재팀: 불출 거절
#    GET    /api/requests/<id>     -> 생산팀: 신청 상세 조회
# ==============================================

from flask import Blueprint, request, jsonify, session
from database import load_data, save_data
import time

requests_bp = Blueprint('requests', __name__)

@requests_bp.route('/api/request', methods=['POST'])
def create_request():
    """
    불출 신청 API (생산팀 전용)

    받는 데이터 (JSON):
        code    : 품번
        name    : 품목명
        qty     : 신청 수량
        date    : 요청 날짜
        note    : 비고 (선택 사항)
    """
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다.'}), 401
    if session.get('team') != 'production':
        return jsonify({'success': False, 'message': '생산팀만 불출 신청이 가능합니다.'}), 403
    
    body = request.get_json()
    if not body:
        return jsonify({'success': False, 'message': '데이터가 없습니다'}), 400
    if not body.get('code'):
        return jsonify({'success': False, 'message': '품번을 입력하세요'}), 400
    if not body.get('qty'):
        return jsonify({'success': False, 'message': '수량을 입력하세요'}), 400
    
    new_request = {
        'id'           : int(time.time() * 1000),
        'kind'         : 'request',           # 불출 신청
        'status'       : 'pending',           # 대기중
        'code'         : body.get('code', ''),
        'name'         : body.get('name', ''),
        'qty'          : body.get('qty', 0),
        'date'         : body.get('date', ''),
        'note'         : body.get('note', ''),
        'requested_by' : session.get('username', ''),  # 신청자
        'requested_name': session.get('name', ''),     # 신청자 이름
        'created'      : time.strftime('%Y-%m-%d'),
        'floor'        : body.get('floor', ''),        # 생산 층수
        'fifo_po' : body.get('fifo_po', ''),
    }

    data = load_data()
    data.append(new_request)
    save_data(data)

    return jsonify({'success': True, 'data': new_request}), 201

@requests_bp.route('/api/requests', methods=['GET'])
def get_requests():
    """
    불출 신청 목록 조회 API (자재팀 전용)

    쿼리 파라미터:
        status : 상태 필터 (pending/confirmed/rejected/all)
    """
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401
    if session.get('team') != 'material' and session.get('role') != 'admin':
        return jsonify({'success': False, 'message': '자재팀만 조회할 수 있습니다'}), 403

    status_filter = request.args.get('status', 'pending')
    date_filter   = request.args.get('date', '')
    data = load_data()

    # 불출 신청 항목만 필터링
    requests_list = [d for d in data if d.get('kind') == 'request']

    # 상태 필터 (all이면 전체)
    if status_filter != 'all':
        requests_list = [r for r in requests_list if r.get('status') == status_filter]

    # 날짜 필터 - 기본값은 오늘
    from datetime import date as _date
    today = _date.today().isoformat()
    if date_filter:
        target_date = date_filter
    else:
        target_date = today

    # pending/confirmed 는 날짜 필터 적용, all 은 필터 없음
    if status_filter != 'all':
        requests_list = [r for r in requests_list if r.get('confirmed_at', r.get('created', '')) == target_date
                         or (status_filter == 'pending' and r.get('created', '') == target_date)
                         or (status_filter == 'completed' and r.get('completed_at', '') == target_date)
                         or (status_filter == 'rejected' and r.get('rejected_at', '') == target_date)]

    # 최신순 정렬
    requests_list = sorted(requests_list, key=lambda x: x.get('created', ''), reverse=True)

    return jsonify({'success': True, 'data': requests_list, 'date': target_date})

@requests_bp.route('/api/request/<int:request_id>', methods=['PUT'])
def confirm_request(request_id):
    """
    불출 확정 API (자재팀 전용)
    수량 수정 후 불출 확정 처리

    받는 데이터 (JSON):
        qty      : 최종 확정 수량 (자재팀이 수정 가능)
        from_id  : 차감할 입고 항목 ID (FIFO)
        from_loc : 불출 위치
    """
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401
    if session.get('team') != 'material' and session.get('role') != 'admin':
        return jsonify({'success': False, 'message': '자재팀만 확정할 수 있습니다'}), 403

    body = request.get_json()
    if not body:
        return jsonify({'success': False, 'message': '데이터가 없습니다'}), 400

    data = load_data()

    # 신청 항목 찾기
    req = next((d for d in data if d.get('id') == request_id and d.get('kind') == 'request'), None)
    if not req:
        return jsonify({'success': False, 'message': '신청 항목을 찾을 수 없습니다'}), 404
    if req.get('status') != 'pending':
        return jsonify({'success': False, 'message': '이미 처리된 신청입니다'}), 400

    # 확정 수량 (자재팀이 수정한 수량)
    final_qty = body.get('qty', req.get('qty', 0))
    from_id   = body.get('from_id')

    # from_id 있으면 입고 항목에서 수량 차감
    if from_id:
        for item in data:
            if item.get('id') == from_id:
                item['qty'] = max(0, (item.get('qty') or 0) - final_qty)
                if item['qty'] <= 0:
                    item['depleted'] = True
                break

    # 신청 상태 업데이트
    req['status']       = 'confirmed'
    req['qty']          = final_qty           # 확정 수량
    req['from_id']      = from_id
    req['from_loc']     = body.get('from_loc', '')
    req['confirmed_by'] = session.get('name', '')   # 확정한 자재팀 이름
    req['confirmed_at'] = time.strftime('%Y-%m-%d')

    save_data(data)
    return jsonify({'success': True, 'data': req})

@requests_bp.route('/api/request/<int:request_id>/reject', methods=['POST'])
def reject_request(request_id):
    """
    불출 신청 반려 API (자재팀 전용)

    받는 데이터 (JSON):
        reason : 반려 사유
    """
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401
    if session.get('team') != 'material' and session.get('role') != 'admin':
        return jsonify({'success': False, 'message': '자재팀만 반려할 수 있습니다'}), 403

    body = request.get_json()
    reason = (body.get('reason') or '').strip() if body else ''
    if not reason:
        return jsonify({'success': False, 'message': '반려 사유를 입력하세요'}), 400

    data = load_data()

    # 신청 항목 찾기
    req = next((d for d in data if d.get('id') == request_id and d.get('kind') == 'request'), None)
    if not req:
        return jsonify({'success': False, 'message': '신청 항목을 찾을 수 없습니다'}), 404
    if req.get('status') != 'pending':
        return jsonify({'success': False, 'message': '이미 처리된 신청입니다'}), 400

    # 반려 처리
    req['status']      = 'rejected'
    req['reason']      = reason
    req['rejected_by'] = session.get('name', '')
    req['rejected_at'] = time.strftime('%Y-%m-%d')

    save_data(data)
    return jsonify({'success': True, 'data': req})

@requests_bp.route('/api/my-requests', methods=['GET'])
def get_my_requests():
    """
    내 신청 현황 조회 API (생산팀 전용)
    본인이 신청한 목록만 반환
    """
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401

    from datetime import date, timedelta
    today   = date.today()
    cutoff  = (today - timedelta(days=30)).isoformat()

    data = load_data()
    my_username = session.get('username', '')

    # 30일 이전 신청 자동 삭제
    before = len(data)
    data = [
        d for d in data
        if not (
            d.get('kind') == 'request'
            and d.get('created', '') < cutoff
        )
    ]
    if len(data) < before:
        save_data(data)

    # 날짜 필터
    date_filter = request.args.get('date', '')

    # 본인 신청 항목만 필터링
    my_requests = [
        d for d in data
        if d.get('kind') == 'request'
        and d.get('requested_by') == my_username
    ]

    # 날짜 필터 적용
    if date_filter:
        my_requests = [r for r in my_requests if r.get('created', '') == date_filter]

    # 최신순 정렬
    my_requests = sorted(my_requests, key=lambda x: x.get('created', ''), reverse=True)

    return jsonify({'success': True, 'data': my_requests})

@requests_bp.route('/api/request/<int:request_id>/cancel', methods=['POST'])
def cancel_request(request_id):
    """불출 신청 취소 (생산팀 - 대기중만)"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401
    data = load_data()
    req = next((d for d in data if d.get('id') == request_id and d.get('kind') == 'request'), None)
    if not req:
        return jsonify({'success': False, 'message': '신청 항목을 찾을 수 없습니다'}), 404
    if req.get('status') != 'pending':
        return jsonify({'success': False, 'message': '대기중인 신청만 취소할 수 있습니다'}), 400
    if req.get('requested_by') != session.get('username'):
        return jsonify({'success': False, 'message': '본인 신청만 취소할 수 있습니다'}), 403
    data = [d for d in data if d.get('id') != request_id]
    save_data(data)
    return jsonify({'success': True, 'message': '신청이 취소됐습니다'})


@requests_bp.route('/api/request/<int:request_id>/undo', methods=['POST'])
def undo_confirm(request_id):
    """불출 확정 취소 (자재팀 - 재고 복원)"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401
    if session.get('team') != 'material' and session.get('role') != 'admin':
        return jsonify({'success': False, 'message': '자재팀만 취소할 수 있습니다'}), 403
    data = load_data()
    req = next((d for d in data if d.get('id') == request_id and d.get('kind') == 'request'), None)
    if not req:
        return jsonify({'success': False, 'message': '신청 항목을 찾을 수 없습니다'}), 404
    if req.get('status') != ('confirmed', 'completed'):
        return jsonify({'success': False, 'message': '확정 또는 전산완료 상태만 취소할 수 있습니다'}), 400
    from_id = req.get('from_id')
    if from_id:
        for item in data:
            if item.get('id') == from_id:
                item['qty'] = (item.get('qty') or 0) + (req.get('qty') or 0)
                item['depleted'] = False
                break
    data = [d for d in data if d.get('id') != request_id]
    save_data(data)
    return jsonify({'success': True, 'message': '확정이 취소되고 재고가 복원됐습니다'})


@requests_bp.route('/api/request/<int:request_id>/complete', methods=['POST'])
def complete_request(request_id):
    """전산 이동 완료 처리 (자재팀)"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401
    if session.get('team') != 'material' and session.get('role') != 'admin':
        return jsonify({'success': False, 'message': '자재팀만 완료 처리할 수 있습니다'}), 403
    data = load_data()
    req = next((d for d in data if d.get('id') == request_id and d.get('kind') == 'request'), None)
    if not req:
        return jsonify({'success': False, 'message': '신청 항목을 찾을 수 없습니다'}), 404
    if req.get('status') != 'confirmed':
        return jsonify({'success': False, 'message': '확정된 신청만 완료 처리할 수 있습니다'}), 400
    req['status']       = 'completed'
    req['completed_by'] = session.get('name', '')
    req['completed_at'] = time.strftime('%Y-%m-%d')
    save_data(data)
    return jsonify({'success': True, 'message': '전산 이동 완료 처리됐습니다'})
