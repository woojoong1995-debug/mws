# =====================================================
# ocr.py - OCR 식별표 분석 API (Cloud Vision API)
# =====================================================
from flask import Blueprint, request, jsonify, session
import base64, os, requests, json, re

ocr_bp = Blueprint('ocr', __name__)

@ocr_bp.route('/api/ocr', methods=['POST'])
def do_ocr():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401

    api_key = os.environ.get('VISION_API_KEY', '')
    if not api_key:
        return jsonify({'success': False, 'message': 'API 키가 설정되지 않았습니다'}), 500

    data = request.get_json()
    if not data or not data.get('image'):
        return jsonify({'success': False, 'message': '이미지가 없습니다'}), 400

    image_data = data['image']

    # Cloud Vision API 호출 - TEXT_DETECTION
    resp = requests.post(
        f'https://vision.googleapis.com/v1/images:annotate?key={api_key}',
        headers={'Content-Type': 'application/json'},
        json={
            'requests': [{
                'image': {'content': image_data},
                'features': [{'type': 'DOCUMENT_TEXT_DETECTION', 'maxResults': 1}]
            }]
        },
        timeout=30
    )

    result = resp.json()

    # 오류 처리
    if 'error' in result:
        return jsonify({'success': False, 'message': result['error']['message']}), 500

    responses = result.get('responses', [{}])
    if not responses or 'error' in responses[0]:
        msg = responses[0].get('error', {}).get('message', '텍스트를 인식할 수 없습니다')
        return jsonify({'success': False, 'message': msg}), 500

    # 전체 텍스트 추출
    full_text = responses[0].get('fullTextAnnotation', {}).get('text', '')
    if not full_text:
        return jsonify({'success': False, 'message': '텍스트를 찾을 수 없습니다'}), 400

    ocr_data = parse_label(full_text)
    return jsonify({'success': True, 'data': ocr_data, 'raw': full_text})


def parse_label(text):
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    full = text.replace('\n', ' ')

    result = {
        '품목명': '',
        '품번': '',
        '수량': '',
        '롤수': '',
        '무게': '',
        '입고일': '',
        'LotNo': '',
        '규격': '',
        '공급처': '',
        '비고': '',
        '유형': '일반'
    }

    # 1. 품번 먼저 추출 (품목명 fallback에서 사용하므로)
    code_match = re.search(r'\b([A-Z]\d{2}[A-Z]\d{6})\b', full)
    if code_match:
        result['품번'] = code_match.group(1)

    # 2. 품목명: 품목식별표 다음 줄에서 먼저 찾기
    skip = ['품목식별표', '품명', '품번', '규격', '수량', 'Lot', '식별표']
    for i, line in enumerate(lines):
        if '품목식별표' in line or '식별표' in line:
            for j in range(i+1, min(i+4, len(lines))):
                candidate = lines[j].strip()
                candidate = re.sub(r'[A-Z]\d{2}[A-Z]\d{6}', '', candidate).strip()
                candidate = re.sub(r'\b[A-Z]{2}\d{4}[A-Z]?\b', '', candidate).strip()
                if candidate and not any(k in candidate for k in skip) and re.search(r'[가-힣]', candidate):
                    result['품목명'] = candidate
                    break
        break

    # 위에서 못 찾았으면: "품명" 키워드 오른쪽에서 찾기
    if not result['품목명']:
        name_match = re.search(r'품\s*명\s+(.+?)(?=품\s*번|규\s*격|수\s*량|$)', full)
        if name_match:
            candidate = name_match.group(1).strip()
            candidate = re.sub(r'\s*(수\s*량|품\s*번|규\s*격|Lot).*', '', candidate, flags=re.IGNORECASE)
            if candidate:
                result['품목명'] = candidate

    # 그래도 못 찾았으면: 품번 코드 위로 거슬러 올라가며 찾기
    if not result['품목명'] and result['품번']:
        for i, line in enumerate(lines):
            if result['품번'] in line and i > 0:
                for j in range(i-1, -1, -1):
                    candidate = lines[j].strip()
                    candidate = re.sub(r'[A-Z]\d{2}[A-Z]\d{6}', '', candidate).strip()
                    candidate = re.sub(r'\b[A-Z]{2}\d{4}[A-Z]?\b', '', candidate).strip()
                    candidate = re.sub(r'품목식별표', '', candidate).strip()
                    if candidate and not any(k in candidate for k in skip) and re.search(r'[가-힣]', candidate):
                        result['품목명'] = candidate
                        break
                break

    # 3. 수량
    qty_match = re.search(r'수\s*량\s+(\d[\d,]*)', full)
    if qty_match:
        result['수량'] = qty_match.group(1).replace(',', '')

    # 4. Lot No
    lot_match = re.search(r'Lot\s*No\.?\s+([A-Z0-9]+)', full, re.IGNORECASE)
    if lot_match:
        result['LotNo'] = lot_match.group(1)

    # 5. 입고일
    date_match = re.search(r'입\s*고\s*일\s+(\d{2,4})[-./](\d{2})[-./](\d{2})', full)
    if date_match:
        year = date_match.group(1)
        if len(year) == 2:
            year = '20' + year
        result['입고일'] = f"{year}-{date_match.group(2)}-{date_match.group(3)}"

    # 6. 규격
    spec_match = re.search(r'규\s*격\s+([^\s]+)', full)
    if spec_match:
        result['규격'] = spec_match.group(1)

    # 7. 공급처
    supplier_match = re.search(r'공\s*급\s*처\s+([^\s]+)', full)
    if supplier_match:
        result['공급처'] = supplier_match.group(1).strip()

    # 8. 롤수
    roll_match = re.search(r'(\d+\.?\d*)\s*롤', full)
    if roll_match:
        result['롤수'] = roll_match.group(1)
        result['유형'] = '원단'

    # 9. 무게
    weight_match = re.search(r'(\d+\.?\d*)\s*(?:kg|KG)', full)
    if weight_match:
        result['무게'] = weight_match.group(1)
        result['유형'] = '원단'

    # 10. 원단 자동 감지
    if '원단' in result['품목명'] or '원단' in full:
        result['유형'] = '원단'

    # 11. 비고
    note_match = re.search(r'비\s*고\s+(.+?)(?=\s*$)', full)
    if note_match:
        val = note_match.group(1).strip()
        if val and '적합' not in val:
            result['비고'] = val

    return result