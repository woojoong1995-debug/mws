# =====================================================
# catalog.py - 품목 카탈로그 (영구 보존)
# =====================================================
# 역할:
#   입고/환입으로 한 번이라도 들어온 품목의 기본 정보를
#   재고와 별도로 계속 저장한다.
#   → 재고가 0이 되어 사라져도, 품번으로 검색하면
#     품목명·카테고리·유형이 자동으로 채워진다. (OCR 재촬영 불필요)
#
# 저장 항목 (품번 기준):
#   code(품번), name(품목명), cat(카테고리), item_type(유형)
#   ※ 위치·루트번호·수량은 매번 바뀌므로 저장하지 않음
#
# 저장 파일: backend/catalog.json (자동 생성)
#
# API:
#   GET /api/catalog?q=검색어  -> 카탈로그 검색 (품번/품목명)
# =====================================================

import json
import os
from flask import Blueprint, request, jsonify

catalog_bp = Blueprint('catalog', __name__)

CATALOG_FILE = os.path.join(os.path.dirname(__file__), 'catalog.json')


def load_catalog():
    """카탈로그 전체 불러오기 (파일 없으면 빈 리스트)"""
    if not os.path.exists(CATALOG_FILE):
        return []
    try:
        with open(CATALOG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def save_catalog(items):
    """카탈로그 전체 저장"""
    try:
        with open(CATALOG_FILE, 'w', encoding='utf-8') as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        return True
    except IOError as e:
        print(f"[카탈로그 저장 오류] {e}")
        return False


def upsert_catalog(record):
    """
    입고/환입 등록 시 호출.
    품번(code) 기준으로 카탈로그에 추가하거나 최신 정보로 갱신한다.
    품번이 없으면 아무것도 안 함.
    """
    code = (record.get('code') or '').strip()
    if not code:
        return

    name      = (record.get('name') or '').strip()
    cat       = (record.get('cat') or '').strip()
    item_type = record.get('item_type') or 'normal'

    catalog = load_catalog()

    # 이미 있으면 갱신
    for item in catalog:
        if (item.get('code') or '').strip() == code:
            if name: item['name'] = name        # 새 정보로 업데이트
            if cat:  item['cat']  = cat
            item['item_type'] = item_type
            save_catalog(catalog)
            return

    # 없으면 새로 추가
    catalog.append({
        'code'     : code,
        'name'     : name,
        'cat'      : cat,
        'item_type': item_type,
    })
    save_catalog(catalog)


@catalog_bp.route('/api/catalog', methods=['GET'])
def search_catalog():
    """
    카탈로그 검색 API
    쿼리 파라미터:
        q : 검색어 (품번 끝자리 또는 품목명 일부)
    반환:
        일치하는 품목 목록 (code, name, cat, item_type)
    """
    q = (request.args.get('q') or '').strip().lower()
    catalog = load_catalog()

    if q:
        catalog = [
            c for c in catalog
            if q in (c.get('code') or '').lower()
            or q in (c.get('name') or '').lower()
        ]

    # 품번 오름차순
    catalog.sort(key=lambda x: (x.get('code') or ''))

    return jsonify({'success': True, 'data': catalog})
