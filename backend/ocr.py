# =====================================================
# ocr.py - OCR 식별표 분석 API
# =====================================================
from flask import Blueprint, request, jsonify, session
import base64, os, requests

ocr_bp = Blueprint('ocr', __name__)

@ocr_bp.route('/api/ocr', methods=['POST'])
def do_ocr():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': '로그인이 필요합니다'}), 401

    # 서버에 저장된 API 키 사용
    api_key = os.environ.get('GEMINI_API_KEY', '')
    if not api_key:
        return jsonify({'success': False, 'message': 'API 키가 설정되지 않았습니다'}), 500

    data = request.get_json()
    if not data or not data.get('image'):
        return jsonify({'success': False, 'message': '이미지가 없습니다'}), 400

    image_data = data['image']
    mime_type  = data.get('mime_type', 'image/jpeg')

    resp = requests.post(
        # flash 대신 부하가 적은 pro 모델로 변경
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent',
        headers={
            'Content-Type': 'application/json',
            'x-goog-api-key': api_key  # 앞서 해결한 올바른 헤더 형식
        },
        json={
            'contents': [{
                'parts': [
                    { 'inline_data': { 'mime_type': mime_type, 'data': image_data } },
                    { 'text': '창고 물류 식별표 이미지에서 정보를 추출해줘. 아래 JSON 형식으로만 응답하고 다른 텍스트는 절대 포함하지 마:\n{"품목명":"","품번":"","수량":"","롤수":"","무게":"","입고일":"","LotNo":"","규격":"","공급처":"","비고":"","유형":"일반 또는 원단"}\n날짜는 YYYY-MM-DD 형식. 없는 항목은 빈 문자열로.' }
                ]
            }],
            'generationConfig': { 'temperature': 0 }
        },
        timeout=30
    )

    result = resp.json()
    if 'error' in result:
        return jsonify({'success': False, 'message': result['error']['message']}), 500

    text = result['candidates'][0]['content']['parts'][0]['text']
    text = text.replace('```json', '').replace('```', '').strip()

    import json
    ocr_data = json.loads(text)
    return jsonify({'success': True, 'data': ocr_data})