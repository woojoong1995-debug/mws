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
from flask import Blueprint, request, jsonify, session

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


# ─────────────────────────────────────────────
# 카탈로그 관리 (운영자 전용)
# ─────────────────────────────────────────────
def _require_admin():
    """운영자 권한 확인. 아니면 오류 응답 반환, 맞으면 None"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401
    if session.get('role') != 'admin':
        return jsonify({'success': False, 'message': '운영자만 접근할 수 있습니다'}), 403
    return None


@catalog_bp.route('/api/catalog/all', methods=['GET'])
def list_catalog_all():
    """
    카탈로그 전체 목록 (운영자 전용, 관리 화면용)
    """
    err = _require_admin()
    if err:
        return err
    catalog = load_catalog()
    catalog.sort(key=lambda x: (x.get('code') or ''))
    return jsonify({'success': True, 'data': catalog})


@catalog_bp.route('/api/catalog/<path:code>', methods=['PUT'])
def update_catalog(code):
    """
    카탈로그 항목 수정 (운영자 전용)
    품번(code)으로 찾아서 품번·품목명·카테고리·유형을 수정.
    ※ 품번 자체도 바꿀 수 있음 (OCR 오인식 교정용)

    받는 데이터(JSON): code, name, cat, item_type (바꿀 값)
    """
    err = _require_admin()
    if err:
        return err

    body = request.get_json() or {}
    catalog = load_catalog()

    target = next((c for c in catalog if (c.get('code') or '') == code), None)
    if not target:
        return jsonify({'success': False, 'message': '해당 품번을 찾을 수 없습니다'}), 404

    new_code = (body.get('code') or '').strip()
    # 품번을 바꾸는 경우, 다른 항목과 중복되면 거절
    if new_code and new_code != code:
        if any((c.get('code') or '') == new_code for c in catalog):
            return jsonify({'success': False, 'message': '이미 있는 품번입니다'}), 400
        target['code'] = new_code

    if 'name' in body:      target['name'] = (body.get('name') or '').strip()
    if 'cat' in body:       target['cat']  = (body.get('cat') or '').strip()
    if 'item_type' in body: target['item_type'] = body.get('item_type') or 'normal'

    save_catalog(catalog)
    return jsonify({'success': True, 'data': target})


@catalog_bp.route('/api/catalog/<path:code>', methods=['DELETE'])
def delete_catalog(code):
    """
    카탈로그 항목 삭제 (운영자 전용)
    잘못 저장된 품번을 목록에서 제거.
    ※ 재고(data.json)는 건드리지 않음. 카탈로그(검색 자동입력)에서만 제거됨.
    """
    err = _require_admin()
    if err:
        return err

    catalog = load_catalog()
    new_catalog = [c for c in catalog if (c.get('code') or '') != code]
    if len(new_catalog) == len(catalog):
        return jsonify({'success': False, 'message': '해당 품번을 찾을 수 없습니다'}), 404

    save_catalog(new_catalog)
    return jsonify({'success': True, 'message': '삭제됐습니다'})
