# =====================================================
# database.py - 데이터 저장 및 불러오기
# =====================================================

import json
import os
import time
import csv
import io

DB_FILE = os.path.join(os.path.dirname(__file__), 'data.json')


def load_data():
    if not os.path.exists(DB_FILE):
        return []
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def save_data(data):
    try:
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except IOError as e:
        print(f"[저장 오류] {e}")
        return False


def add_record(record):
    """새 레코드를 추가합니다. ID 중복을 완벽히 방지합니다."""
    data = load_data()
    if 'id' not in record:
        new_id = int(time.time() * 1000)
        existing = {d.get('id') for d in data}
        while new_id in existing:
            new_id += 1
        record['id'] = new_id
    data.append(record)
    save_data(data)
    return record


def delete_record(record_id):
    data = load_data()
    new_data = [d for d in data if d.get('id') != record_id]
    if len(new_data) == len(data):
        return False
    save_data(new_data)
    return True


def detect_category(name):
    """품목명에서 카테고리를 자동으로 감지합니다."""
    n = (name or '').lower().replace(' ', '').replace('.', '').replace('-', '')
    if '사각캡' in n or '캡' in n: return '사각캡'
    if '필름'   in n: return '필름'
    if '카톤'   in n: return '카톤'
    if '단상자' in n: return '단상자'
    if '인박스' in n: return '인박스'

    if '원단' in n and ('발' in n or '손' in n or '마스크' in n): return '손발원단'
    if '원단' in n: return '원단'
    return '기타'


def export_to_csv():
    """현재 재고 데이터를 엑셀 호환 CSV 문자열로 변환합니다."""
    data = load_data()
    data = [d for d in data if d.get('kind') in ('in', 'hwanjip') and not d.get('depleted')]
    if not data:
        return ''

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        '종류', '카테고리', '유형', '원단단위', '품목명', '품번', '규격',
        'LotNo', '창고', '위치', '수량/SET/개수', '롤수', '무게(kg)', '길이(m)',
        '루트', 'PO', '담당자', '날짜', '비고'
    ])

    kind_map = {'in': '입고', 'out': '불출', 'hwanjip': '환입'}
    unit_map = {'roll': '롤+KG', 'kg': 'KG(환입)', 'm': '길이(m)', 'set': 'SET', 'ea': '개수'}

    for d in data:
        spec_txt = ''
        if d.get('spec_w') and d.get('spec_l') and d.get('spec_m'):
            spec_txt = f"{d.get('spec_w')}x{d.get('spec_l')}x{d.get('spec_m')}"
        writer.writerow([
            kind_map.get(d.get('kind', ''), ''),
            d.get('cat', ''),
            '원단' if d.get('item_type') == 'fabric' else '일반',
            unit_map.get(d.get('fabric_unit', ''), '') if d.get('item_type') == 'fabric' else '개',
            d.get('name', ''),
            d.get('code', ''),
            spec_txt,
            d.get('lot', ''),
            d.get('wh', ''),
            d.get('loc', ''),
            d.get('qty', 0),
            d.get('rolls', ''),
            d.get('weight', ''),
            d.get('meters', ''),
            d.get('route', ''),
            d.get('po', ''),
            d.get('person', ''),
            d.get('date', ''),
            d.get('note', ''),
        ])

    return '\ufeff' + output.getvalue()