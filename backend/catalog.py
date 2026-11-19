# =====================================================
# catalog.py - 품목 카탈로그 (영구 보존 + 원단 규격/단위 저장)
# =====================================================

import json
import os
from flask import Blueprint, request, jsonify, session

catalog_bp = Blueprint('catalog', __name__)

CATALOG_FILE = os.path.join(os.path.dirname(__file__), 'catalog.json')


def load_catalog():
    if not os.path.exists(CATALOG_FILE):
        return []
    try:
        with open(CATALOG_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return []


def save_catalog(items):
    try:
        with open(CATALOG_FILE, 'w', encoding='utf-8') as f:
            json.dump(items, f, ensure_ascii=False, indent=2)
        return True
    except IOError as e:
        print(f"[카탈로그 저장 오류] {e}")
        return False


def upsert_catalog(record):
    """
    입고/환입 등록 시 품번 기준으로 카탈로그를 갱신합니다.
    - 이미 카탈로그에 규격이 등록된 품목은 기존 평균 규격을 유지하고,
      'update_default_spec'이 True이거나 처음 등록되는 품번일 때만 기본 규격을 저장합니다.
    """
    code = (record.get('code') or '').strip()
    if not code:
        return

    name        = (record.get('name') or '').strip()
    cat         = (record.get('cat') or '').strip()
    item_type   = record.get('item_type') or 'normal'
    fabric_unit = record.get('fabric_unit') or ('roll' if item_type == 'fabric' else '')
    spec_w      = float(record.get('spec_w') or 0)
    spec_l      = float(record.get('spec_l') or 0)
    spec_m      = float(record.get('spec_m') or 0)
    unit_weight = float(record.get('unit_weight') or 0)
    update_spec = bool(record.get('update_default_spec', False))

    catalog = load_catalog()

    for item in catalog:
        if (item.get('code') or '').strip() == code:
            if name: item['name'] = name
            if cat:  item['cat']  = cat
            item['item_type'] = item_type
            if fabric_unit and not (record.get('kind') == 'hwanjip' and fabric_unit == 'kg' and item.get('fabric_unit') == 'roll'):
                item['fabric_unit'] = fabric_unit

            has_existing_spec = bool(item.get('spec_w') and item.get('spec_l') and item.get('spec_m'))
            if spec_w and spec_l and spec_m and (not has_existing_spec or update_spec):
                item['spec_w']      = spec_w
                item['spec_l']      = spec_l
                item['spec_m']      = spec_m
                item['unit_weight'] = round((spec_w * spec_l * spec_m) / 1000000.0, 6)
            elif unit_weight and not item.get('unit_weight'):
                item['unit_weight'] = unit_weight

            save_catalog(catalog)
            return

    calc_uw = round((spec_w * spec_l * spec_m) / 1000000.0, 6) if (spec_w and spec_l and spec_m) else unit_weight
    catalog.append({
        'code'       : code,
        'name'       : name,
        'cat'        : cat,
        'item_type'  : item_type,
        'fabric_unit': 'roll' if (record.get('kind') == 'hwanjip' and fabric_unit == 'kg') else fabric_unit,
        'spec_w'     : spec_w,
        'spec_l'     : spec_l,
        'spec_m'     : spec_m,
        'unit_weight': calc_uw,
    })
    save_catalog(catalog)


@catalog_bp.route('/api/catalog', methods=['GET'])
def search_catalog():
    q = (request.args.get('q') or '').strip().lower()
    catalog = load_catalog()
    if q:
        catalog = [
            c for c in catalog
            if q in (c.get('code') or '').lower()
            or q in (c.get('name') or '').lower()
        ]
    catalog.sort(key=lambda x: (x.get('code') or ''))
    return jsonify({'success': True, 'data': catalog})


def _require_admin_or_manager():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401
    if session.get('role') not in ('admin', 'manager'):
        return jsonify({'success': False, 'message': '관리자 이상만 접근할 수 있습니다'}), 403
    return None


@catalog_bp.route('/api/catalog/all', methods=['GET'])
def list_catalog_all():
    err = _require_admin_or_manager()
    if err:
        return err
    catalog = load_catalog()
    catalog.sort(key=lambda x: (x.get('code') or ''))
    return jsonify({'success': True, 'data': catalog})


@catalog_bp.route('/api/catalog/<path:code>', methods=['PUT'])
def update_catalog(code):
    err = _require_admin_or_manager()
    if err:
        return err

    body = request.get_json() or {}
    catalog = load_catalog()

    target = next((c for c in catalog if (c.get('code') or '') == code), None)
    if not target:
        return jsonify({'success': False, 'message': '해당 품번을 찾을 수 없습니다'}), 404

    new_code = (body.get('code') or '').strip()
    if new_code and new_code != code:
        if any((c.get('code') or '') == new_code for c in catalog):
            return jsonify({'success': False, 'message': '이미 있는 품번입니다'}), 400
        target['code'] = new_code

    if 'name' in body:        target['name']        = (body.get('name') or '').strip()
    if 'cat' in body:         target['cat']         = (body.get('cat') or '').strip()
    if 'item_type' in body:   target['item_type']   = body.get('item_type') or 'normal'
    if 'fabric_unit' in body: target['fabric_unit'] = body.get('fabric_unit') or 'roll'
    if 'spec_w' in body:      target['spec_w']      = float(body.get('spec_w') or 0)
    if 'spec_l' in body:      target['spec_l']      = float(body.get('spec_l') or 0)
    if 'spec_m' in body:      target['spec_m']      = float(body.get('spec_m') or 0)

    if target.get('spec_w') and target.get('spec_l') and target.get('spec_m'):
        target['unit_weight'] = round((target['spec_w'] * target['spec_l'] * target['spec_m']) / 1000000.0, 6)
    elif 'unit_weight' in body:
        target['unit_weight'] = float(body.get('unit_weight') or 0)

    save_catalog(catalog)
    return jsonify({'success': True, 'data': target})


@catalog_bp.route('/api/catalog/<path:code>', methods=['DELETE'])
def delete_catalog(code):
    err = _require_admin_or_manager()
    if err:
        return err

    catalog = load_catalog()
    new_catalog = [c for c in catalog if (c.get('code') or '') != code]
    if len(new_catalog) == len(catalog):
        return jsonify({'success': False, 'message': '해당 품번을 찾을 수 없습니다'}), 404

    save_catalog(new_catalog)
    return jsonify({'success': True, 'message': '삭제됐습니다'})

    # cnrk
    