# =====================================================
# database.py - 데이터 저장 및 불러오기
# =====================================================
# 역할: 모든 데이터를 data.json 파일에 저장합니다.
#       앱을 껐다 켜도 데이터가 유지됩니다.
#
# 데이터 종류 (kind 값으로 구분):
#   - 'in'       : 입고
#   - 'out'      : 불출
#   - 'hwanjip'  : 환입
# =====================================================

import json
import os
import time

# 데이터 파일 경로 (backend 폴더 안에 data.json 자동 생성)
DB_FILE = os.path.join(os.path.dirname(__file__), 'data.json')


def load_data():
    """
    저장된 데이터를 불러옵니다.
    파일이 없거나 손상된 경우 빈 리스트를 반환합니다.
    """
    if not os.path.exists(DB_FILE):
        return []
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def save_data(data):
    """
    데이터를 JSON 파일에 저장합니다.
    indent=2 로 사람이 읽기 편하게 저장합니다.
    """
    try:
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except IOError as e:
        print(f"[저장 오류] {e}")
        return False


def add_record(record):
    """
    새 레코드를 추가합니다.
    id가 없으면 타임스탬프로 자동 생성합니다.
    """
    data = load_data()
    if 'id' not in record:
        record['id'] = int(time.time() * 1000)
    data.append(record)
    save_data(data)
    return record


def delete_record(record_id):
    """
    ID로 레코드를 삭제합니다.
    삭제 성공 시 True, 없으면 False 반환
    """
    data = load_data()
    new_data = [d for d in data if d.get('id') != record_id]
    if len(new_data) == len(data):
        return False
    save_data(new_data)
    return True


def detect_category(name):
    """
    품목명에서 카테고리를 자동으로 감지합니다.
    예) '카톤스파크패드' -> '카톤'
        '원단.Spunlace' -> '원단'
    """
    # 점, 공백, 특수문자 제거 후 비교
    n = name.lower().replace(' ', '').replace('.', '').replace('-', '')
    if '카톤'   in n: return '카톤'
    if '단상자' in n: return '단상자'
    if '인박스' in n: return '인박스'

    # 원단 중 손발원단 먼저 체크
    if '원단' in n and ('발' in n or '손' in n or '마스크' in n): return '손발원단'
    if '원단'   in n: return '원단'
    return '기타'


def export_to_csv():
    """
    현재 재고 데이터를 CSV 문자열로 변환합니다.
    BOM 포함 UTF-8 -> 엑셀에서 한글 깨짐 방지
    """
    data = load_data()
    # 현재 재고만 (입고+환입 중 소진 안 된 것)
    data = [d for d in data if d.get('kind') in ('in', 'hwanjip') and not d.get('depleted')]
    if not data:
        return ''

    header = '종류,카테고리,유형,품목명,품번,LotNo,창고,위치,수량,롤수,무게(kg),루트,PO,담당자,날짜,비고\n'
    rows = []
    for d in data:
        kind_map = {'in': '입고', 'out': '불출', 'hwanjip': '환입'}
        row = ','.join([
            kind_map.get(d.get('kind', ''), ''),
            d.get('cat', ''),
            '원단' if d.get('item_type') == 'fabric' else '일반',
            d.get('name', ''),
            d.get('code', ''),
            d.get('lot', ''),
            d.get('wh', ''),
            d.get('loc', ''),
            str(d.get('qty', 0)),
            str(d.get('rolls', '')),
            str(d.get('weight', '')),
            d.get('route', ''),
            d.get('po', ''),
            d.get('person', ''),
            d.get('date', ''),
            d.get('note', ''),
        ])
        rows.append(row)

    # \ufeff = BOM, 엑셀 UTF-8 인식용
    return '\ufeff' + header + '\n'.join(rows)
