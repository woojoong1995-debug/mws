# =====================================================
# inventory.py - 재고 조회 및 루트번호(Lot) 조회 API
# =====================================================

import time
from flask import Blueprint, request, jsonify, Response, session
from database import load_data, save_data, export_to_csv
from catalog import load_catalog
from datetime import date

inventory_bp = Blueprint('inventory', __name__)


def _has_stock(item):
    if item.get('depleted'):
        return False
    if item.get('item_type') == 'fabric':
        fu = item.get('fabric_unit') or 'roll'
        if fu == 'kg':   return (item.get('weight') or 0) > 0
        if fu == 'm':    return (item.get('meters') or 0) > 0
        if fu in ('set', 'ea'): return (item.get('qty') or 0) > 0
        return (item.get('rolls') or 0) > 0 or (item.get('weight') or 0) > 0
    return (item.get('qty') or 0) > 0


@inventory_bp.route('/api/lots', methods=['GET'])
def get_lots_by_code():
    """품번으로 현재 보유 중인 루트번호(Lot) 목록과 카탈로그 규격 정보를 반환합니다."""
    code = (request.args.get('code') or '').strip().upper()
    if not code:
        return jsonify({'success': True, 'lots': [], 'catalog': None})

    data = load_data()
    lots = []
    seen = set()

    for d in data:
        if d.get('kind') in ('in', 'hwanjip') and not d.get('depleted'):
            c = (d.get('code') or '').strip().upper()
            if c == code or c.endswith(code):
                lot = (d.get('lot') or '').strip()
                if lot and lot not in seen:
                    seen.add(lot)
                    lots.append({
                        'lot': lot,
                        'wh' : d.get('wh', ''),
                        'loc': d.get('loc', ''),
                        'po' : d.get('po', ''),
                    })

    lots.sort(key=lambda x: x['lot'])

    # 카탈로그에서 규격/단위 정보도 함께 찾기
    catalog = load_catalog()
    cat_item = next((c for c in catalog if (c.get('code') or '').strip().upper() == code), None)
    if not cat_item:
        cat_item = next((c for c in catalog if (c.get('code') or '').strip().upper().endswith(code)), None)

    return jsonify({'success': True, 'lots': lots, 'catalog': cat_item})


@inventory_bp.route('/api/inventory', methods=['GET'])
def get_inventory():
    q          = request.args.get('q', '').lower().strip()
    cat        = request.args.get('cat', '')
    date_param = request.args.get('date', '').strip()
    today      = date.today().isoformat()
    data       = load_data()

    items = [d for d in data if d.get('kind') in ('in', 'hwanjip') and not d.get('depleted')]

    if q:
        items = [
            i for i in items
            if q in (i.get('name') or '').lower()
            or q in (i.get('code') or '').lower()
            or q in (i.get('loc')  or '').lower()
            or q in (i.get('lot')  or '').lower()
        ]

    if cat:
        items = [i for i in items if (i.get('cat') or '기타') == cat]

    if date_param:
        items = [i for i in items if i.get('date') == date_param]

    def _qty_of(x):
        if x.get('item_type') == 'fabric':
            fu = x.get('fabric_unit') or 'roll'
            if fu == 'kg': return x.get('weight') or 0
            if fu == 'm':  return x.get('meters') or 0
            if fu in ('set', 'ea'): return x.get('qty') or 0
            return x.get('rolls') or 0
        return x.get('qty') or 0

    items.sort(key=lambda x: (
        x.get('lot', '') or x.get('date', ''),
        _qty_of(x),
    ))

    all_in = [d for d in data if d.get('kind') == 'in']
    all_hj = [d for d in data if d.get('kind') == 'hwanjip']

    return jsonify({
        'success'  : True,
        'data'     : items,
        'total_in' : len(all_in),
        'today_in' : len([d for d in all_in if d.get('date') == today]),
        'total_hj' : len([d for d in all_hj if not d.get('depleted')]),
        'today_hj' : len([d for d in all_hj if d.get('date') == today]),
    })


@inventory_bp.route('/api/cleanup', methods=['POST'])
def cleanup():
    from datetime import timedelta
    today  = date.today()
    cutoff = (today - timedelta(days=3)).isoformat()
    data   = load_data()
    before = len(data)

    # 소진된 날짜(depleted_at, 없으면 date) 기준으로 3일 지난 항목 정리
    cleaned = [
        d for d in data
        if not (
            d.get('depleted')
            and d.get('kind') in ('in', 'hwanjip')
            and (d.get('depleted_at') or d.get('date') or '') < cutoff
        )
    ]

    removed = before - len(cleaned)
    if removed > 0:
        save_data(cleaned)

    return jsonify({'success': True, 'removed': removed})


@inventory_bp.route('/api/export', methods=['GET'])
def export_csv():
    csv_content = export_to_csv()
    if not csv_content:
        return jsonify({'success': False, 'message': '내보낼 데이터가 없습니다'}), 404

    filename = f"warehouse_{date.today().strftime('%Y-%m-%d')}.csv"
    return Response(
        csv_content,
        mimetype='text/csv; charset=utf-8',
        headers={'Content-Disposition': f"attachment; filename={filename}"}
    )


@inventory_bp.route('/api/record/<int:record_id>', methods=['PUT'])
def update_record(record_id):
    body = request.get_json()
    if not body:
        return jsonify({'success': False, 'message': '데이터가 없습니다'}), 400

    current_user = session.get('username', '')
    current_role = session.get('role', 'user')

    data = load_data()
    found = False
    for i, item in enumerate(data):
        if item.get('id') == record_id:
            # 총괄(admin)과 관리자(manager)는 누구의 항목이든 수정 가능
            if current_role not in ('admin', 'manager') and item.get('created_by', '') != current_user:
                return jsonify({'success': False, 'message': '본인이 등록한 항목만 수정할 수 있습니다'}), 403
            data[i].update(body)
            data[i]['id'] = record_id
            found = True
            break

    if not found:
        return jsonify({'success': False, 'message': '항목을 찾을 수 없습니다'}), 404

    save_data(data)
    return jsonify({'success': True, 'data': data[i]})


@inventory_bp.route('/api/record/<int:record_id>', methods=['DELETE'])
def remove_record(record_id):
    """레코드 삭제 API - 관리자(manager) 및 운영자(admin)는 모든 항목 삭제 가능"""
    current_user = session.get('username', '')
    current_role = session.get('role', 'user')

    data = load_data()
    target = next((d for d in data if d.get('id') == record_id), None)
    if not target:
        return jsonify({'success': False, 'message': '항목을 찾을 수 없습니다'}), 404

    if current_role not in ('admin', 'manager') and target.get('created_by', '') != current_user:
        return jsonify({'success': False, 'message': '본인이 등록한 항목만 삭제할 수 있습니다'}), 403

    new_data = [d for d in data if d.get('id') != record_id]
    save_data(new_data)
    return jsonify({'success': True, 'message': '삭제 완료'})


@inventory_bp.route('/api/reset-data', methods=['POST'])
def reset_data():
    if session.get('role') != 'admin':
        return jsonify({'success': False, 'message': '운영자만 가능합니다'}), 403
    body = request.get_json()
    password = (body.get('password') or '').strip()
    from user_db import load_users, hash_password
    users = load_users()
    me = next((u for u in users if u.get('id') == session['user_id']), None)
    if not me or me.get('password') != hash_password(password):
        return jsonify({'success': False, 'message': '비밀번호가 틀렸습니다'}), 401
    save_data([])
    return jsonify({'success': True, 'message': '전체 데이터가 초기화됐습니다'})


@inventory_bp.route('/api/record/<int:record_id>/transfer', methods=['POST'])
def transfer_record(record_id):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401

    data = load_data()
    item = next((d for d in data if d.get('id') == record_id), None)
    if not item:
        return jsonify({'success': False, 'message': '항목을 찾을 수 없습니다'}), 404

    item['transfer_done'] = True
    item['transfer_by']   = session.get('name', '')
    item['transfer_at']   = time.strftime('%Y-%m-%d')
    save_data(data)
    return jsonify({'success': True, 'message': '전산 완료 처리됐습니다'})