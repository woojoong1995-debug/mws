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
                'features': [{'type': 'TEXT_DETECTION', 'maxResults': 1}]
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

    # 텍스트에서 필드 파싱
    ocr_data = parse_label(full_text)
    return jsonify({'success': True, 'data': ocr_data})


def parse_label(text):
    """
    식별표 텍스트에서 필드를 파싱합니다.
    """
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

    # 품번: 영문+숫자 조합 패턴 (예: G21E000270, A15X000208)
    code_match = re.search(r'\b([A-Z]\d{2}[A-Z]\d{6})\b', full)
    if code_match:
        result['품번'] = code_match.group(1)

    # Lot No: 영문+숫자 (예: GE141D, ABC123)
    lot_match = re.search(r'\b([A-Z]{2,3}\d{3,4}[A-Z]?)\b', full)
    if lot_match and lot_match.group(1) != result['품번']:
        result['LotNo'] = lot_match.group(1)

    # 수량: 숫자 + 개/EA/PCS
    qty_match = re.search(r'(\d[\d,]*)\s*(?:개|EA|PCS|pcs)', full, re.IGNORECASE)
    if qty_match:
        result['수량'] = qty_match.group(1).replace(',', '')

    # 롤수: 숫자 + 롤/R
    roll_match = re.search(r'(\d+\.?\d*)\s*(?:롤|R\b)', full, re.IGNORECASE)
    if roll_match:
        result['롤수'] = roll_match.group(1)
        result['유형'] = '원단'

    # 무게: 숫자 + kg/KG
    weight_match = re.search(r'(\d+\.?\d*)\s*(?:kg|KG)', full, re.IGNORECASE)
    if weight_match:
        result['무게'] = weight_match.group(1)
        result['유형'] = '원단'

    # 날짜: YYYY-MM-DD 또는 YYYY.MM.DD
    date_match = re.search(r'(\d{4})[-./](\d{2})[-./](\d{2})', full)
    if date_match:
        result['입고일'] = f"{date_match.group(1)}-{date_match.group(2)}-{date_match.group(3)}"

    # 품목명: "품명" 또는 "품 명" 키워드 다음 텍스트
    skip_keywords = ['품목식별표', '품목 식별표', '식별표', '품명', '품 명',
                     '품번', '품 번', '규격', '수량', '입고일', '생산일', '비고', '공급처', '제조처', '상태', '사용기한']
    name_match = re.search(r'품\s*명\s+(.+)', full)
    if name_match:
        candidate = name_match.group(1).strip()
        candidate = re.sub(r'[A-Z]\d{2}[A-Z]\d{6}.*', '', candidate).strip()
        if candidate:
            result['품목명'] = candidate
    else:
        for line in lines:
            if re.search(r'[가-힣]', line) and len(line) > 2:
                if not any(kw in line for kw in skip_keywords):
                    result['품목명'] = line
                    break

    return result
