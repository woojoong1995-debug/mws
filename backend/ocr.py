from flask import Blueprint, request, jsonify, session
import os, requests, json, re
from database import detect_category
from catalog import load_catalog

ocr_bp = Blueprint('ocr', __name__)


def _clean_ocr_row(code, raw_name, raw_unit):
    """품목명의 '카트' 오타만 '카톤'으로 안전 보정하고, 단위(트->톤 치환 없음)를 정리합니다."""
    name = (raw_name or '').strip()
    if code.startswith('G') or name.startswith(('카트.', '카트 ', '공용카트')):
        name = re.sub(r'^(공용)?카트(?=[\s.\(/]|$)', r'\1카톤', name)

    u = (raw_unit or '').strip()
    low = u.lower()
    if low in ('ea', 'pcs', '개'): return name, '개'
    if low in ('roll', '롤'):     return name, '롤'
    if low in ('set', '세트'):    return name, 'SET'
    if low in ('m', '미터'):      return name, 'm'
    if low in ('kg', '키로'):     return name, 'kg'
    if low in ('ton', 't', '톤'): return name, '톤'
    if low in ('box', '박스'):    return name, '박스'
    if low in ('plt', '파레트'):  return name, '파레트'
    return name, (u or '개')


@ocr_bp.route('/api/ocr', methods=['POST'])
def do_ocr():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401

    api_key = os.environ.get('GEMINI_API_KEY', '')
    if not api_key:
        return jsonify({'success': False, 'message': 'API 키가 설정되지 않았습니다'}), 500

    data = request.get_json()
    if not data or not data.get('image'):
        return jsonify({'success': False, 'message': '이미지가 없습니다'}), 400

    image_data = data['image']
    mime_type = data.get('mime_type', 'image/jpeg')

    resp = requests.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        headers={
            'Content-Type': 'application/json',
            'x-goog-api-key': api_key
        },
        json={
            'contents': [{
                'parts': [
                    {'inline_data': {'mime_type': mime_type, 'data': image_data}},
                    {'text': '창고 물류 식별표 이미지에서 정보를 추출해줘. 아래 JSON 형식으로만 응답하고 다른 텍스트는 절대 포함하지 마:\n{"품목명":"","품번":"","수량":"","롤수":"","무게":"","입고일":"","LotNo":"","규격":"","공급처":"","비고":"","유형":"일반 또는 원단"}\n날짜는 YYYY-MM-DD 형식. 없는 항목은 빈 문자열로.'}
                ]
            }],
            'generationConfig': {'temperature': 0}
        },
        timeout=30
    )

    result = resp.json()
    if 'error' in result:
        return jsonify({'success': False, 'message': result['error']['message']}), 500

    text = result['candidates'][0]['content']['parts'][0]['text']
    text = text.replace('```json', '').replace('```', '').strip()

    ocr_data = json.loads(text)
    return jsonify({'success': True, 'data': ocr_data})


@ocr_bp.route('/api/ocr/statement', methods=['POST'])
def do_ocr_statement():
    """거래명세서 / 입하통지서 이미지에서 여러 품목 행을 일괄 추출합니다."""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401

    api_key = os.environ.get('GEMINI_API_KEY', '')
    if not api_key:
        return jsonify({'success': False, 'message': 'API 키가 설정되지 않았습니다'}), 500

    data = request.get_json()
    if not data or not data.get('image'):
        return jsonify({'success': False, 'message': '이미지가 없습니다'}), 400

    prompt = (
        "거래명세서 또는 납품서 또는 입하통지서 이미지에서 공급처, 날짜, 그리고 표에 적힌 모든 품목 행을 추출해줘.\n"
        "표에 'Lot No' 또는 '동종 재고 ID'가 있으면 반드시 'LotNo' 필드에 넣어줘 (없으면 빈 문자열).\n"
        "반드시 아래 JSON 형식으로만 응답하고 다른 설명은 절대 쓰지 마:\n"
        '{"공급처":"","입고예정일":"YYYY-MM-DD","items":[{"품번":"","품목명":"","수량":0,"단위":"개","LotNo":"","PO":"","비고":""}]}'
    )

    resp = requests.post(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
        headers={
            'Content-Type': 'application/json',
            'x-goog-api-key': api_key
        },
        json={
            'contents': [{
                'parts': [
                    {'inline_data': {'mime_type': data.get('mime_type', 'image/jpeg'), 'data': data['image']}},
                    {'text': prompt}
                ]
            }],
            'generationConfig': {'temperature': 0}
        },
        timeout=45
    )

    result = resp.json()
    if 'error' in result:
        return jsonify({'success': False, 'message': result['error']['message']}), 500

    text = result['candidates'][0]['content']['parts'][0]['text']
    text = text.replace('```json', '').replace('```', '').strip()
    parsed = json.loads(text)

    # 카탈로그 대조 및 품번 코드 기반 카테고리/유형 자동 보정
    catalog = load_catalog()
    cat_map = {(c.get('code') or '').strip().upper(): c for c in catalog if c.get('code')}

    supplier = (parsed.get('공급처') or '').strip()
    due_date = (parsed.get('입고예정일') or '').strip()
    cleaned_items = []

    for row in parsed.get('items', []):
        code = (row.get('품번') or '').strip().upper()
        name, unit = _clean_ocr_row(code, row.get('품목명'), row.get('단위'))
        try:
            qty = float(str(row.get('수량') or 0).replace(',', ''))
        except ValueError:
            qty = 0

        cat_item = cat_map.get(code)
        if cat_item and cat_item.get('name'):
            name = cat_item['name']

        is_fabric = (code.startswith('A')) or (cat_item and cat_item.get('item_type') == 'fabric')
        cat = (cat_item.get('cat') if cat_item else '') or detect_category(name, code)

        cleaned_items.append({
            'code'       : code,
            'name'       : name,
            'cat'        : cat,
            'item_type'  : 'fabric' if is_fabric else 'normal',
            'fabric_unit': (cat_item.get('fabric_unit') if cat_item else ('roll' if unit == '롤' else 'kg')) if is_fabric else '',
            'spec_w'     : cat_item.get('spec_w', 0) if cat_item else 0,
            'spec_l'     : cat_item.get('spec_l', 0) if cat_item else 0,
            'spec_m'     : cat_item.get('spec_m', 0) if cat_item else 0,
            'unit_weight': cat_item.get('unit_weight', 0) if cat_item else 0,
            'qty'        : qty,
            'unit'       : unit,
            'lot'        : (row.get('LotNo') or row.get('동종재고ID') or '').strip().upper(),
            'po'         : (row.get('PO') or '').strip(),
            'supplier'   : supplier,
            'due_date'   : due_date,
            'note'       : (row.get('비고') or '').strip(),
        })

    return jsonify({
        'success' : True,
        'supplier': supplier,
        'due_date': due_date,
        'items'   : cleaned_items
    })