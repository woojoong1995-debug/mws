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

# =====================================================
# 재고 대조 API (본사 전산 CSV vs MWS 재고)
# =====================================================
import csv
import io
import re

def _decode_csv_bytes(raw_bytes):
    """엑셀 CSV(cp949/euc-kr/utf-8-sig) 인코딩을 자동으로 판별해 디코딩합니다."""
    for enc in ('utf-8-sig', 'cp949', 'euc-kr', 'utf-8'):
        try:
            return raw_bytes.decode(enc)
        except UnicodeDecodeError:
            continue
    return raw_bytes.decode('utf-8', errors='replace')


def _parse_qty_and_unit(val_str):
    """'460.01 kg', '5,930.00 ea', '57,600.00 set' 등에서 숫자와 정규화된 단위를 분리합니다."""
    s = (val_str or '').strip()
    if not s:
        return 0.0, ''
    m = re.match(r'^([+-]?[\d,]+(?:\.\d+)?)\s*(.*)$', s)
    if not m:
        return 0.0, ''
    num_str = m.group(1).replace(',', '')
    unit_raw = m.group(2).strip().lower()
    try:
        num = float(num_str)
    except ValueError:
        num = 0.0

    # 단위 통일
    if unit_raw in ('kg', 'kgs'):
        unit = 'kg'
    elif unit_raw in ('set', 'sets'):
        unit = 'set'
    elif unit_raw in ('m', 'meter', 'meters'):
        unit = 'm'
    elif unit_raw in ('roll', 'rolls', '롤'):
        unit = 'roll'
    elif unit_raw in ('ea', '개', 'pcs', ''):
        unit = 'ea'
    else:
        unit = unit_raw
    return num, unit


def _parse_hq_csv(text):
    """본사 전산 CSV(제품, 기초 수량 / A열 빈칸 이어받기)를 파싱해 품번별 총합을 반환합니다."""
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return {}

    # 헤더 위치 자동 탐색 (기본: 0열=제품/품번, 1열=기초 수량)
    code_idx, qty_idx = 0, 1
    start_row = 0
    for r_i, row in enumerate(rows[:5]):
        joined = ' '.join(row)
        if '제품' in joined or '품번' in joined or '수량' in joined:
            for c_i, cell in enumerate(row):
                c_clean = cell.strip()
                if c_clean in ('제품', '품번', '품목코드'):
                    code_idx = c_i
                elif '수량' in c_clean or '재고' in c_clean:
                    qty_idx = c_i
            start_row = r_i + 1
            break

    hq_map = {}
    last_code = ''

    for row in rows[start_row:]:
        if not row or len(row) <= qty_idx:
            continue
        raw_code = (row[code_idx] if len(row) > code_idx else '').strip().upper()
        raw_qty  = (row[qty_idx]  if len(row) > qty_idx  else '').strip()

        if raw_code in ('합계', '총계', 'TOTAL', '소계'):
            continue

        if raw_code:
            last_code = raw_code
        code = last_code
        if not code or not raw_qty:
            continue

        val, unit = _parse_qty_and_unit(raw_qty)
        if code not in hq_map:
            hq_map[code] = {'qty': 0.0, 'unit': unit or 'ea'}
        hq_map[code]['qty'] += val
        if unit and hq_map[code]['unit'] == 'ea':
            hq_map[code]['unit'] = unit

    return hq_map


def _parse_mws_csv(text):
    """직접 업로드한 MWS 내보내기 CSV(품번|LotNo|품목명|창고|위치|수량|단위)를 파싱합니다."""
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return {}

    mws_map = {}
    start_row = 1 if rows and ('품번' in rows[0][0] or 'Lot' in ''.join(rows[0])) else 0

    for row in rows[start_row:]:
        if len(row) < 6:
            continue
        code = (row[0] or '').strip().upper()
        name = (row[2] or '').strip()
        val, parsed_unit = _parse_qty_and_unit(row[5])
        unit_col = (row[6] if len(row) > 6 else '').strip().lower()
        unit = 'roll' if unit_col == '롤' else ('ea' if unit_col == '개' else (unit_col or parsed_unit or 'ea'))

        if not code:
            continue
        if code not in mws_map:
            mws_map[code] = {'name': name, 'qty': 0.0, 'unit': unit, 'kg': 0.0, 'rolls': 0.0}
        mws_map[code]['qty'] += val
        if not mws_map[code]['name'] and name:
            mws_map[code]['name'] = name
    return mws_map


@inventory_bp.route('/api/reconcile', methods=['POST'])
def reconcile_inventory():
    """본사 전산 CSV와 MWS 재고(실시간 DB 또는 업로드 CSV)를 품번 기준으로 자동 대조합니다."""
    if 'hq_file' not in request.files:
        return jsonify({'success': False, 'message': '본사 전산 CSV 파일을 첨부해 주세요'}), 400

    hq_file = request.files['hq_file']
    hq_text = _decode_csv_bytes(hq_file.read())
    hq_map  = _parse_hq_csv(hq_text)

    if not hq_map:
        return jsonify({'success': False, 'message': '본사 CSV에서 유효한 품번/수량 데이터를 찾지 못했습니다'}), 400

    # 카탈로그 품목명 매핑용
    catalog = load_catalog()
    cat_names = {(c.get('code') or '').strip().upper(): (c.get('name') or '') for c in catalog}

    # MWS 데이터 소스 결정: 직접 첨부한 MWS CSV가 있으면 사용, 없으면 실시간 DB(data.json) 사용
    mws_file = request.files.get('mws_file')
    use_uploaded_mws = bool(mws_file and mws_file.filename)

    mws_db_map = {}
    if use_uploaded_mws:
        mws_text = _decode_csv_bytes(mws_file.read())
        mws_csv_map = _parse_mws_csv(mws_text)
        for code, info in mws_csv_map.items():
            mws_db_map[code] = {
                'name' : info['name'] or cat_names.get(code, ''),
                'ea'   : info['qty'] if info['unit'] == 'ea' else 0.0,
                'set'  : info['qty'] if info['unit'] == 'set' else 0.0,
                'kg'   : info['qty'] if info['unit'] == 'kg' else 0.0,
                'm'    : info['qty'] if info['unit'] == 'm' else 0.0,
                'roll' : info['qty'] if info['unit'] == 'roll' else 0.0,
                'default_unit': info['unit'],
            }
    else:
        data = load_data()
        for d in data:
            if d.get('kind') not in ('in', 'hwanjip') or d.get('depleted'):
                continue
            code = (d.get('code') or '').strip().upper()
            if not code:
                continue
            if code not in mws_db_map:
                mws_db_map[code] = {
                    'name': d.get('name') or cat_names.get(code, ''),
                    'ea': 0.0, 'set': 0.0, 'kg': 0.0, 'm': 0.0, 'roll': 0.0,
                    'default_unit': 'ea',
                    'is_film': False
                }
            if not mws_db_map[code]['name'] and d.get('name'):
                mws_db_map[code]['name'] = d.get('name')
            if (d.get('cat') or '').strip() == '필름' or '필름' in (d.get('name') or ''):
                mws_db_map[code]['is_film'] = True

            if d.get('item_type') == 'fabric':
                fu = d.get('fabric_unit') or 'roll'
                if fu == 'roll':
                    mws_db_map[code]['roll'] += float(d.get('rolls') or 0)
                    mws_db_map[code]['kg']   += float(d.get('weight') or 0)
                    mws_db_map[code]['default_unit'] = 'kg'
                elif fu == 'kg':
                    mws_db_map[code]['kg']   += float(d.get('weight') or d.get('qty') or 0)
                    mws_db_map[code]['default_unit'] = 'kg'
                elif fu == 'm':
                    mws_db_map[code]['m']    += float(d.get('meters') or d.get('qty') or 0)
                    mws_db_map[code]['default_unit'] = 'm'
                elif fu == 'set':
                    mws_db_map[code]['set']  += float(d.get('qty') or 0)
                    mws_db_map[code]['default_unit'] = 'set'
                else:
                    mws_db_map[code]['ea']   += float(d.get('qty') or 0)
                    mws_db_map[code]['default_unit'] = 'ea'
            else:
                mws_db_map[code]['ea'] += float(d.get('qty') or 0)

    all_codes = sorted(set(hq_map.keys()) | set(mws_db_map.keys()))
    results = []
    summary = {'total': 0, 'match': 0, 'short': 0, 'over': 0}

    for code in all_codes:
        hq_info  = hq_map.get(code)
        mws_info = mws_db_map.get(code)

        unit = hq_info['unit'] if hq_info else (mws_info['default_unit'] if mws_info else 'ea')
        hq_qty = round(hq_info['qty'], 3) if hq_info else 0.0

        if mws_info:
            mws_qty = round(mws_info.get(unit, 0.0), 3)
            # 필름 품목이 기존에 '개'(ea)로 등록된 경우 roll / m 대조 시에도 반영
            if mws_qty == 0 and mws_info.get('is_film') and unit in ('roll', 'm') and mws_info.get('ea', 0) > 0:
                mws_qty = round(mws_info['ea'], 3)
            if mws_qty == 0 and unit == 'ea' and mws_info.get('set', 0) > 0:
                mws_qty = round(mws_info['set'], 3)
        else:
            mws_qty = 0.0

        diff = round(mws_qty - hq_qty, 3)
        # 소수점 미세 오차(0.05 이하)는 일치로 간주
        if abs(diff) <= 0.05:
            diff = 0.0
            status = 'match'
            summary['match'] += 1
        elif diff < 0:
            status = 'short'
            summary['short'] += 1
        else:
            status = 'over'
            summary['over'] += 1

        summary['total'] += 1
        name = (mws_info['name'] if mws_info and mws_info['name'] else cat_names.get(code, '-'))

        results.append({
            'code'   : code,
            'name'   : name,
            'hq_qty' : hq_qty,
            'mws_qty': mws_qty,
            'diff'   : diff,
            'unit'   : unit,
            'status' : status,
        })

    return jsonify({
        'success': True,
        'summary': summary,
        'results': results,
        'source' : '업로드된 MWS CSV' if use_uploaded_mws else 'MWS 실시간 재고'
    })