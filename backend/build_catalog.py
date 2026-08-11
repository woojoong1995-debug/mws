# =====================================================
# build_catalog.py - 기존 재고로 카탈로그 채우기 (1회용)
# =====================================================
# 역할:
#   지금 data.json 에 들어있는 모든 입고/환입/불출 기록에서
#   품번·품목명·카테고리·유형을 뽑아 catalog.json 을 만든다.
#   → 카탈로그를 처음 도입할 때 한 번만 실행.
#     (이후로는 입고/환입 등록 시 자동으로 쌓임)
#
# 사용법 (data.json 있는 backend 폴더에서):
#   python3 build_catalog.py
# =====================================================

import json
import os

DB_FILE      = os.path.join(os.path.dirname(__file__), 'data.json')
CATALOG_FILE = os.path.join(os.path.dirname(__file__), 'catalog.json')

def main():
    if not os.path.exists(DB_FILE):
        print('data.json 을 찾을 수 없습니다.')
        return

    with open(DB_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 기존 카탈로그가 있으면 이어서, 없으면 새로
    catalog = []
    if os.path.exists(CATALOG_FILE):
        try:
            with open(CATALOG_FILE, 'r', encoding='utf-8') as f:
                catalog = json.load(f)
        except (json.JSONDecodeError, IOError):
            catalog = []

    # 품번 기준 인덱스
    by_code = {}
    for c in catalog:
        code = (c.get('code') or '').strip()
        if code:
            by_code[code] = c

    added = 0
    updated = 0
    for d in data:
        code = (d.get('code') or '').strip()
        if not code:
            continue
        name = (d.get('name') or '').strip()
        cat  = (d.get('cat') or '').strip()
        item_type = d.get('item_type') or 'normal'

        if code in by_code:
            c = by_code[code]
            # 품목명/카테고리가 비어있던 것 채우기
            if name and not c.get('name'): c['name'] = name; updated += 1
            if cat and not c.get('cat'):   c['cat']  = cat
        else:
            entry = {'code': code, 'name': name, 'cat': cat, 'item_type': item_type}
            catalog.append(entry)
            by_code[code] = entry
            added += 1

    with open(CATALOG_FILE, 'w', encoding='utf-8') as f:
        json.dump(catalog, f, ensure_ascii=False, indent=2)

    print(f'완료: 카탈로그 {len(catalog)}개 품목 (신규 {added}, 보완 {updated})')

if __name__ == '__main__':
    main()
