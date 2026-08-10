# =====================================================
# fix_ids.py - 취소가 안 되는 불출 건 ID 고치기 (1회용)
# =====================================================
# 문제:
#   불출 ID를 나노초(time_ns)로 저장한 탓에 숫자가 너무 커서
#   프론트(JS)에서 정밀도가 깨져 "이력을 찾을 수 없습니다"가 뜸.
#
# 해결:
#   JS 안전 정수 한계(9,007,199,254,740,991)를 넘는 'out' 건의 ID를
#   밀리초 단위로 줄여서 다시 저장. (겹치면 +1)
#
# 사용법 (서버 backend 폴더에서, data.json 과 같은 위치에서 실행):
#   python3 fix_ids.py
#
#   ※ 실행 전 data.json 백업 권장:
#     cp data.json data.json.bak
# =====================================================

import json
import os

DB_FILE = os.path.join(os.path.dirname(__file__), 'data.json')
JS_MAX_SAFE = 9007199254740991  # Number.MAX_SAFE_INTEGER

def main():
    if not os.path.exists(DB_FILE):
        print('data.json 을 찾을 수 없습니다. 이 스크립트를 data.json 과 같은 폴더에 두고 실행하세요.')
        return

    with open(DB_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    existing = {d.get('id') for d in data}
    fixed = 0

    for d in data:
        rid = d.get('id')
        # out 건 중 ID가 너무 큰(나노초) 것만 대상
        if d.get('kind') == 'out' and isinstance(rid, int) and rid > JS_MAX_SAFE:
            # 나노초 → 밀리초로 축소
            new_id = rid // 1000000
            while new_id in existing:
                new_id += 1
            existing.discard(rid)
            existing.add(new_id)
            d['id'] = new_id
            fixed += 1

    if fixed:
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f'완료: {fixed}건의 불출 ID를 고쳤습니다. 이제 취소가 정상 동작합니다.')
    else:
        print('고칠 항목이 없습니다. (이미 정상이거나 해당 건이 없음)')

if __name__ == '__main__':
    main()
