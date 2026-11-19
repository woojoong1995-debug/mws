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


def detect_category(name, code=''):
    """품번 첫 글자 코드(1순위) 및 품목명(2순위)에서 카테고리를 자동 감지합니다."""
    c = (code or '').strip().upper()
    n = (name or '').lower().replace(' ', '').replace('.', '').replace('-', '')

    if c:
        first = c[0]
        if first == 'A':
            return '손발원단' if ('발' in n or '손' in n or '마스크' in n) else '원단'
        if first == 'B': return '스티커'
        if first == 'C': return '필름'
        if first == 'E': return '단상자'
        if first == 'F': return '인박스'
        if first == 'G': return '카톤'
        if first == 'H': return '튜브'
        if first == 'Q': return '사급제품'

    if '사각캡' in n or '캡' in n: return '사각캡'
    if '필름'   in n: return '필름'
    if '카톤'   in n: return '카톤'
    if '단상자' in n: return '단상자'
    if '인박스' in n: return '인박스'
    if '스티커' in n: return '스티커'
    if '튜브'   in n: return '튜브'
    if '원단' in n and ('발' in n or '손' in n or '마스크' in n): return '손발원단'
    if '원단' in n: return '원단'
    return '기타'


def export_to_csv():
    """전산 대조용 현재 재고 데이터를 엑셀 호환 CSV 문자열로 변환합니다."""
    data = load_data()
    data = [d for d in data if d.get('kind') in ('in', 'hwanjip') and not d.get('depleted')]
    if not data:
        return ''

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['품번', 'LotNo', '품목명', '창고', '위치', '수량', '단위'])

    unit_map = {
        'roll': '롤',
        'kg': 'kg',
        'm': 'm',
        'set': 'SET',
        'ea': '개'
    }

    for d in data:
        if d.get('item_type') == 'fabric':
            fu = d.get('fabric_unit', 'roll')
            if fu == 'kg':
                qty = d.get('weight') or d.get('qty', 0)
            elif fu == 'm':
                qty = d.get('meters') or d.get('qty', 0)
            else:
                qty = d.get('rolls') if d.get('rolls') is not None else d.get('qty', 0)
            unit = unit_map.get(fu, '롤')
        else:
            qty = d.get('qty', 0)
            unit = unit_map.get(d.get('unit', ''), '개')

        writer.writerow([
            d.get('code', ''),
            d.get('lot', ''),
            d.get('name', ''),
            d.get('wh', ''),
            d.get('loc', ''),
            qty,
            unit,
        ])

    return '\ufeff' + output.getvalue()