# =====================================================
# pending.py - 입고 대기 목록 및 파레트별 분할 적치 API
# =====================================================

from flask import Blueprint, request, jsonify, session
from datetime import date
import json, os, time
from database import add_record, detect_category
from catalog import upsert_catalog, load_catalog

pending_bp = Blueprint('pending', __name__)

PENDING_FILE = os.path.join(os.path.dirname(__file__), 'pending_inbound.json')


def load_pending():
    if not os.path.exists(PENDING_FILE):
        return []
    try:
        with open(PENDING_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def save_pending(items):
    try:
        with open(PENDING_FILE, 'w', encoding='utf-8') as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        return True
    except IOError:
        return False


@pending_bp.route('/api/pending', methods=['GET'])
def get_pending():
    items = load_pending()
    active = [i for i in items if float(i.get('remain_qty') or 0) > 0]
    active.sort(key=lambda x: (x.get('due_date') or '9999-99-99', x.get('id', 0)))
    return jsonify({'success': True, 'data': active, 'count': len(active)})


@pending_bp.route('/api/pending', methods=['POST'])
def add_pending():
    """입고 대기 단건 또는 다건(OCR 명세서 일괄) 등록"""
    body = request.get_json()
    if not body:
        return jsonify({'success': False, 'message': '데이터가 없습니다'}), 400

    rows = body.get('items') if isinstance(body.get('items'), list) else [body]
    items = load_pending()
    catalog = load_catalog()
    cat_map = {(c.get('code') or '').strip().upper(): c for c in catalog if c.get('code')}

    existing_ids = {i.get('id') for i in items}
    base_id = int(time.time() * 1000)
    added = 0

    for r in rows:
        code = (r.get('code') or '').strip().upper()
        name = (r.get('name') or '').strip()
        qty  = float(r.get('qty') or 0)
        if not name and code in cat_map:
            name = cat_map[code].get('name', '')
        if not (code or name) or qty <= 0:
            continue

        while base_id in existing_ids:
            base_id += 1
        existing_ids.add(base_id)

        cat_item = cat_map.get(code)
        is_fabric = (r.get('item_type') == 'fabric') or code.startswith('A') or (cat_item and cat_item.get('item_type') == 'fabric')
        cat = r.get('cat') or (cat_item.get('cat') if cat_item else '') or detect_category(name, code)

        items.append({
            'id'           : base_id,
            'code'         : code,
            'name'         : name,
            'cat'          : cat,
            'item_type'    : 'fabric' if is_fabric else 'normal',
            'fabric_unit'  : r.get('fabric_unit') or (cat_item.get('fabric_unit') if cat_item else ('roll' if is_fabric else '')),
            'spec_w'       : float(r.get('spec_w') or (cat_item.get('spec_w') if cat_item else 0) or 0),
            'spec_l'       : float(r.get('spec_l') or (cat_item.get('spec_l') if cat_item else 0) or 0),
            'spec_m'       : float(r.get('spec_m') or (cat_item.get('spec_m') if cat_item else 0) or 0),
            'unit_weight'  : float(r.get('unit_weight') or (cat_item.get('unit_weight') if cat_item else 0) or 0),
            'total_qty'    : qty,
            'received_qty' : 0,
            'remain_qty'   : qty,
            'unit'         : r.get('unit') or ('롤' if is_fabric else '개'),
            'lot'          : (r.get('lot') or '').strip().upper(),
            'po'           : (r.get('po') or '').strip(),
            'supplier'     : (r.get('supplier') or '').strip(),
            'due_date'     : (r.get('due_date') or date.today().isoformat()).strip(),
            'note'         : (r.get('note') or '').strip(),
            'created_by'   : session.get('username', ''),
        })
        added += 1

    if added == 0:
        return jsonify({'success': False, 'message': '등록할 유효한 품목이 없습니다'}), 400

    save_pending(items)
    return jsonify({'success': True, 'added': added}), 201


@pending_bp.route('/api/pending/<int:pending_id>/receive', methods=['POST'])
def receive_pending_part(pending_id):
    """파레트 단위 분할 적치 확정: 입력한 수량만큼 실제 재고로 입고하고 대기 잔량을 차감합니다."""
    body = request.get_json() or {}
    take_qty = float(body.get('qty') or 0)
    wh       = (body.get('wh') or '').strip()
    loc      = (body.get('loc') or '').strip()

    if take_qty <= 0:
        return jsonify({'success': False, 'message': '입고할 수량을 입력하세요'}), 400
    if not wh or not loc:
        return jsonify({'success': False, 'message': '창고와 보관 위치를 모두 선택하세요'}), 400

    items = load_pending()
    target = next((i for i in items if i.get('id') == pending_id), None)
    if not target:
        return jsonify({'success': False, 'message': '입고 대기 항목을 찾을 수 없습니다'}), 404

    remain = float(target.get('remain_qty') or 0)
    if take_qty > remain + 0.0001:
        return jsonify({'success': False, 'message': f'남은 대기 수량({remain})보다 많이 입력할 수 없습니다'}), 400

    is_fabric = target.get('item_type') == 'fabric'
    fu        = target.get('fabric_unit') or 'roll'
    sw        = float(body.get('spec_w') or target.get('spec_w') or 0)
    sl        = float(body.get('spec_l') or target.get('spec_l') or 0)
    sm        = float(body.get('spec_m') or target.get('spec_m') or 0)
    uw        = float(body.get('unit_weight') or target.get('unit_weight') or 0)

    if sw > 0 and sl > 0 and sm > 0:
        uw = round((sw * sl * sm) / 1000000.0, 6)

    rolls = 0
    weight = 0
    meters = 0
    if is_fabric:
        if fu == 'roll':
            rolls  = take_qty
            weight = float(body.get('weight') or 0) or (round(rolls * uw, 3) if uw > 0 else 0)
        elif fu == 'm':
            meters = take_qty
        elif fu == 'kg':
            weight = take_qty

    lot_val  = (body.get('lot') or target.get('lot') or '').strip().upper()
    date_val = (body.get('date') or date.today().isoformat()).strip()
    note_val = (body.get('note') or target.get('note') or '').strip()

    record = {
        'item_type'  : 'fabric' if is_fabric else 'normal',
        'fabric_unit': fu if is_fabric else '',
        'spec_w'     : sw,
        'spec_l'     : sl,
        'spec_m'     : sm,
        'unit_weight': uw,
        'person'     : session.get('name', ''),
        'wh'         : wh,
        'name'       : target.get('name', ''),
        'code'       : target.get('code', ''),
        'loc'        : loc,
        'qty'        : take_qty,
        'rolls'      : rolls,
        'weight'     : weight,
        'meters'     : meters,
        'lot'        : lot_val,
        'cat'        : target.get('cat') or detect_category(target.get('name', ''), target.get('code', '')),
        'po'         : target.get('po', ''),
        'route'      : '',
        'date'       : date_val,
        'note'       : note_val,
        'created_by' : session.get('username', ''),
        'kind'       : 'in',
        'depleted'   : False,
    }

    add_record(record)
    upsert_catalog(record)

    # 대기 잔량 차감
    target['received_qty'] = round(float(target.get('received_qty') or 0) + take_qty, 3)
    target['remain_qty']   = round(max(0.0, remain - take_qty), 3)
    save_pending(items)

    return jsonify({
        'success'   : True,
        'remain_qty': target['remain_qty'],
        'completed' : target['remain_qty'] <= 0
    })


@pending_bp.route('/api/pending/<int:pending_id>', methods=['DELETE'])
def delete_pending(pending_id):
    items = load_pending()
    new_items = [i for i in items if i.get('id') != pending_id]
    if len(new_items) == len(items):
        return jsonify({'success': False, 'message': '항목을 찾을 수 없습니다'}), 404
    save_pending(new_items)
    return jsonify({'success': True, 'message': '삭제 완료'})