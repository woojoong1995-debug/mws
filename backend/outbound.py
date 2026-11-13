# =====================================================
# outbound.py - 불출 관련 API (원단 단위별 차감 및 1롤 무게 연동)
# =====================================================

from flask import Blueprint, request, jsonify, session
from database import load_data, save_data
from datetime import date, timedelta
import time

outbound_bp = Blueprint('outbound', __name__)


def _item_has_remain(d):
    if d.get('depleted'):
        return False
    if d.get('item_type') == 'fabric':
        fu = d.get('fabric_unit') or 'roll'
        if fu == 'kg':   return (d.get('weight') or 0) > 0
        if fu == 'm':    return (d.get('meters') or 0) > 0
        if fu in ('set', 'ea'): return (d.get('qty') or 0) > 0
        return (d.get('rolls') or 0) > 0 or (d.get('weight') or 0) > 0
    return (d.get('qty') or 0) > 0


@outbound_bp.route('/api/fifo', methods=['GET'])
def get_fifo():
    code = request.args.get('code', '').strip()
    cat  = request.args.get('cat', '').strip()
    if not code and not cat:
        return jsonify({'success': False, 'message': '품번을 입력하세요'}), 400

    data = load_data()

    def _code_match(d):
        if not code:
            return True
        return (d.get('code') or '').upper().endswith(code.upper())

    def _cat_match(d):
        if not cat:
            return True
        return (d.get('cat') or '기타') == cat

    matches = [
        d for d in data
        if d.get('kind') in ('in', 'hwanjip')
        and _code_match(d)
        and _cat_match(d)
        and _item_has_remain(d)
    ]

    def _qty_of(x):
        if x.get('item_type') == 'fabric':
            fu = x.get('fabric_unit') or 'roll'
            if fu == 'kg': return x.get('weight') or 0
            if fu == 'm':  return x.get('meters') or 0
            if fu in ('set', 'ea'): return x.get('qty') or 0
            return x.get('rolls') or 0
        return x.get('qty') or 0

    matches.sort(key=lambda x: (
        0 if x.get('kind') == 'hwanjip' else 1,
        x.get('lot', '') or x.get('date', ''),
        _qty_of(x),
    ))

    return jsonify({'success': True, 'data': matches})


@outbound_bp.route('/api/outbound', methods=['POST'])
def add_outbound():
    if session.get('role') == 'admin':
        return jsonify({'success': False, 'message': '운영자 계정은 불출할 수 없습니다'}), 403

    body = request.get_json()
    if not body:
        return jsonify({'success': False, 'message': '데이터가 없습니다'}), 400
    if not body.get('code'):
        return jsonify({'success': False, 'message': '품번을 입력하세요'}), 400
    if not body.get('person'):
        return jsonify({'success': False, 'message': '담당자 이름을 입력하세요'}), 400

    data = load_data()
    today_iso = date.today().isoformat()

    from_id  = body.get('from_id')
    from_ids = body.get('from_ids', [])
    if from_id and from_id not in from_ids:
        from_ids = [from_id]

    for fid in from_ids:
        for item in data:
            if item.get('id') == fid:
                if item.get('item_type') == 'fabric' or body.get('item_type') == 'fabric':
                    fu = item.get('fabric_unit') or body.get('fabric_unit') or 'roll'
                    body['fabric_unit'] = fu
                    body['unit_weight'] = item.get('unit_weight') or body.get('unit_weight') or 0

                    if fu == 'kg':
                        # 환입(KG) 원단: 무게(weight)로 차감
                        out_w = float(body.get('weight') or body.get('qty') or 0)
                        item['weight'] = round(max(0.0, float(item.get('weight') or 0) - out_w), 3)
                        item['qty']    = item['weight']
                        body['weight'] = out_w
                        body['qty']    = out_w
                        if item['weight'] <= 0:
                            item['depleted'] = True
                            item['depleted_at'] = today_iso
                    elif fu == 'm':
                        # 길이(m) 원단
                        out_m = float(body.get('meters') or body.get('qty') or 0)
                        item['meters'] = round(max(0.0, float(item.get('meters') or 0) - out_m), 3)
                        item['qty']    = item['meters']
                        body['meters'] = out_m
                        body['qty']    = out_m
                        if item['meters'] <= 0:
                            item['depleted'] = True
                            item['depleted_at'] = today_iso
                    elif fu in ('set', 'ea'):
                        # SET 또는 개수 원단
                        out_q = float(body.get('qty') or 0)
                        item['qty'] = max(0, (item.get('qty') or 0) - out_q)
                        if item['qty'] <= 0:
                            item['depleted'] = True
                            item['depleted_at'] = today_iso
                    else:
                        # 롤+KG 연동형 원단: 롤수 차감 시 1롤당 무게(unit_weight)로 kg 자동 차감
                        out_r = float(body.get('rolls') or body.get('qty') or 0)
                        uw    = float(item.get('unit_weight') or body.get('unit_weight') or 0)
                        if uw <= 0 and (item.get('rolls') or 0) > 0 and (item.get('weight') or 0) > 0:
                            uw = float(item['weight']) / float(item['rolls'])
                        out_w = float(body.get('weight') or 0)
                        if uw > 0 and out_r > 0:
                            out_w = round(out_r * uw, 3)

                        item['rolls']  = round(max(0.0, float(item.get('rolls') or 0) - out_r), 3)
                        item['weight'] = round(max(0.0, float(item.get('weight') or 0) - out_w), 3)
                        item['meters'] = round(max(0.0, float(item.get('meters') or 0) - float(body.get('meters') or 0)), 3)
                        item['qty']    = item['rolls']
                        body['rolls']  = out_r
                        body['weight'] = out_w
                        body['qty']    = out_r
                        if item['rolls'] <= 0:
                            item['depleted'] = True
                            item['depleted_at'] = today_iso
                else:
                    out_q = float(body.get('qty') or 0)
                    item['qty'] = max(0, (item.get('qty') or 0) - out_q)
                    if item.get('qty', 0) <= 0:
                        item['depleted'] = True
                        item['depleted_at'] = today_iso
                break

    body['kind'] = 'out'
    body['time'] = time.strftime('%H:%M')
    new_id = int(time.time() * 1000)
    existing_ids = {d.get('id') for d in data}
    while new_id in existing_ids:
        new_id += 1
    body['id'] = new_id
    data.append(body)
    save_data(data)

    return jsonify({'success': True, 'data': body}), 201


@outbound_bp.route('/api/outbound/<int:record_id>', methods=['DELETE'])
def cancel_outbound(record_id):
    if session.get('role') == 'admin':
        return jsonify({'success': False, 'message': '운영자 계정은 불출 취소를 할 수 없습니다'}), 403

    data = load_data()
    out = next((d for d in data if d.get('id') == record_id and d.get('kind') == 'out'), None)
    if not out:
        return jsonify({'success': False, 'message': '불출 이력을 찾을 수 없습니다'}), 404

    def restore_one(fid, info):
        for item in data:
            if item.get('id') == fid:
                if info.get('item_type') == 'fabric' or item.get('item_type') == 'fabric':
                    fu = info.get('fabric_unit') or item.get('fabric_unit') or 'roll'
                    if fu == 'kg':
                        item['weight'] = round((item.get('weight') or 0) + (info.get('weight') or info.get('qty') or 0), 3)
                        item['qty']    = item['weight']
                    elif fu == 'm':
                        item['meters'] = round((item.get('meters') or 0) + (info.get('meters') or info.get('qty') or 0), 3)
                        item['qty']    = item['meters']
                    elif fu in ('set', 'ea'):
                        item['qty'] = (item.get('qty') or 0) + (info.get('qty') or 0)
                    else:
                        item['rolls']  = round((item.get('rolls')  or 0) + (info.get('rolls')  or 0), 3)
                        item['weight'] = round((item.get('weight') or 0) + (info.get('weight') or 0), 3)
                        item['meters'] = round((item.get('meters') or 0) + (info.get('meters') or 0), 3)
                        item['qty']    = item['rolls']
                else:
                    item['qty'] = (item.get('qty') or 0) + (info.get('qty') or 0)
                item['depleted'] = False
                item.pop('depleted_at', None)
                return

        # 원본이 삭제됐으면 재생성
        loc_txt = info.get('from_loc', out.get('from_loc', '')) or info.get('loc', '')
        wh_val  = info.get('wh', out.get('wh', ''))
        if not wh_val:
            if 'D동' in loc_txt: wh_val = 'D'
            elif '천막동' in loc_txt: wh_val = 'T'

        new_item = {
            'id'         : int(time.time() * 1000) + len(data) + 1,
            'kind'       : 'hwanjip' if info.get('fabric_unit') == 'kg' else 'in',
            'item_type'  : info.get('item_type', 'normal'),
            'fabric_unit': info.get('fabric_unit', 'roll' if info.get('item_type') == 'fabric' else ''),
            'unit_weight': info.get('unit_weight', 0),
            'code'       : out.get('code', ''),
            'name'       : out.get('name', ''),
            'cat'        : out.get('cat', ''),
            'lot'        : info.get('lot', out.get('lot', '')),
            'route'      : info.get('route', out.get('route', '')),
            'po'         : info.get('po', out.get('po', '')),
            'wh'         : wh_val,
            'loc'        : loc_txt,
            'date'       : out.get('date', ''),
            'person'     : out.get('person', ''),
            'created_by' : out.get('created_by', ''),
            'depleted'   : False,
        }
        if info.get('item_type') == 'fabric':
            new_item['rolls']  = info.get('rolls')  or 0
            new_item['weight'] = info.get('weight') or 0
            new_item['meters'] = info.get('meters') or 0
            new_item['qty']    = info.get('qty')    or new_item['rolls'] or new_item['weight']
        else:
            new_item['qty'] = info.get('qty') or 0
        data.append(new_item)

    sources = out.get('sources', [])
    if sources:
        for s in sources:
            restore_one(s.get('id'), s)
    else:
        from_ids = out.get('from_ids', [])
        from_id  = out.get('from_id')
        if from_id and from_id not in from_ids:
            from_ids.append(from_id)
        if from_ids:
            for fid in from_ids:
                restore_one(fid, out)
        else:
            restore_one(None, out)

    new_data = [d for d in data if d.get('id') != record_id]
    save_data(new_data)
    return jsonify({'success': True, 'message': '불출 취소 완료. 재고가 복원됐습니다'})


@outbound_bp.route('/api/history', methods=['GET'])
def get_history():
    today     = date.today()
    today_str = today.isoformat()

    cutoff = (today - timedelta(days=60)).isoformat()
    data   = load_data()
    before = len(data)
    data   = [d for d in data if not (d.get('kind') == 'out' and d.get('date', '') < cutoff)]
    if len(data) < before:
        save_data(data)

    all_outs    = [d for d in data if d.get('kind') == 'out']
    date_filter = request.args.get('date', '')
    kind_filter = request.args.get('kind', 'out')

    items = [d for d in data if d.get('kind') == kind_filter]
    if date_filter:
        items = [o for o in items if o.get('date', '') == date_filter]

    transfer_filter = request.args.get('transfer_done', '')
    if transfer_filter == 'true':
        items = [o for o in items if o.get('transfer_done')]

    items = sorted(items, key=lambda x: (x.get('date', ''), x.get('id', 0)), reverse=True)

    return jsonify({
        'success' : True,
        'data'    : items,
        'total'   : len(all_outs),
        'filtered': len(items),
        'today'   : len([o for o in all_outs if o.get('date') == today_str]),
    })