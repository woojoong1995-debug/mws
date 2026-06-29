// ═══════════════════════════════════════════
// OCR: API 키 저장/불러오기 (Gemini)
// ═══════════════════════════════════════════
function loadApiKey() {
  return localStorage.getItem('cntech_gemini_key') || '';
}
function saveApiKey(key) {
  localStorage.setItem('cntech_gemini_key', key.trim());
}
function updateKeyStatus() {
  var key = loadApiKey();
  var statusEl = document.getElementById('ocr-key-status');
  var inputEl  = document.getElementById('ocr-api-key');
  if (!statusEl) return;
  if (key) {
    statusEl.textContent = '✓ 설정됨';
    statusEl.style.color = '#137333';
    if (inputEl) inputEl.placeholder = '...' + key.slice(-4) + ' (저장됨)';
  } else {
    statusEl.textContent = '미설정';
    statusEl.style.color = '#dc2626';
  }
}


// ═══════════════════════════════════════════
// OCR: 식별표 사진 분석 (Gemini)
// ═══════════════════════════════════════════
async function doOCR(event) {
  var file = event.target.files[0];
  if (!file) return;

  // 미리보기
  var reader = new FileReader();
  reader.onload = function(e) {
    var ocrImg = document.getElementById('ocr-img');
    var ocrPreview = document.getElementById('ocr-preview');
    if (ocrImg) ocrImg.src = e.target.result;
    if (ocrPreview) ocrPreview.style.display = 'block';
  };
  reader.readAsDataURL(file);

  document.getElementById('ocr-status').textContent = 'AI가 식별표를 분석하는 중...';
  document.getElementById('ocr-result').style.display = 'none';

  try {
    // 이미지 압축 후 Base64 변환 (모바일 대용량 사진 대응)
    var b64 = await new Promise(function(resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var maxSize = 600;
        var w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = h * maxSize / w; w = maxSize; }
          else       { w = w * maxSize / h; h = maxSize; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        URL.revokeObjectURL(url);
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = reject;
      img.src = url;
    });

    // 서버 백엔드로 전송 (API 키는 서버에서 관리)
    var resp = await fetch(API + '/ocr', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: b64, mime_type: file.type })
    });

    var json = await resp.json();
    if (!json.success) throw new Error(json.message);
    ocrData = json.data;

    // 추출 결과 표시
    var fields = [
      {k:'품목명',l:'품목명'}, {k:'품번',l:'품번'}, {k:'유형',l:'유형'},
      {k:'수량',l:'수량'}, {k:'롤수',l:'롤 수'}, {k:'무게',l:'무게(kg)'},
      {k:'입고일',l:'입고일'}, {k:'LotNo',l:'Lot No.'}, {k:'비고',l:'비고'}
    ];
    var rows = fields.filter(function(f){ return ocrData[f.k]; }).map(function(f){
      return '<div class="ocr-frow"><span class="ocr-fl">' + f.l + '</span><span class="ocr-fv">' + ocrData[f.k] + '</span></div>';
    }).join('');

    document.getElementById('ocr-fc').innerHTML = rows || '<p style="font-size:13px;color:var(--txt2)">읽지 못했습니다</p>';
    document.getElementById('ocr-result').style.display = 'block';
    document.getElementById('ocr-status').textContent = '추출 완료! 확인 후 버튼을 눌러주세요';

  } catch(e) {
    showToast('OCR 오류: ' + (e.message || 'API 호출 실패'));
  }
}


// ═══════════════════════════════════════════
// OCR 결과를 입고 화면에 자동 입력
// ═══════════════════════════════════════════
function applyOcrToInbound() {
  switchTab('inbound', document.getElementById('nav-inbound'));
  if (ocrData['유형'] === '원단') setType('in', 'fabric');
  else setType('in', 'normal');
  if (ocrData['품목명']) { document.getElementById('in-name').value = ocrData['품목명']; autoCat('in'); }
  if (ocrData['품번'])   document.getElementById('in-code').value   = ocrData['품번'];
  if (ocrData['LotNo'])  { document.getElementById('in-lot').value = ocrData['LotNo']; document.getElementById('in-lot-fabric').value = ocrData['LotNo']; }
  if (ocrData['입고일']) document.getElementById('in-date').value   = ocrData['입고일'];
  if (ocrData['비고'])   document.getElementById('in-note').value   = ocrData['비고'];
  if (ocrData['유형'] === '원단') {
    if (ocrData['롤수']) document.getElementById('in-rolls').value  = ocrData['롤수'];
    if (ocrData['무게']) document.getElementById('in-weight').value = ocrData['무게'];
  } else {
    if (ocrData['수량']) document.getElementById('in-qty').value = ocrData['수량'].replace(/[^0-9.]/g, '');
  }
  showToast('입고 화면에 자동 입력 완료! 창고/위치만 선택해주세요');
}


// ═══════════════════════════════════════════
// OCR 결과를 환입 화면에 자동 입력
// ═══════════════════════════════════════════
function applyOcrToReturn() {
  switchTab('hwanjip', document.getElementById('nav-hwanjip'));
  if (ocrData['유형'] === '원단') setType('hj', 'fabric');
  else setType('hj', 'normal');
  if (ocrData['품목명']) { document.getElementById('hj-name').value = ocrData['품목명']; autoCat('hj'); }
  if (ocrData['품번'])   document.getElementById('hj-code').value   = ocrData['품번'];
  if (ocrData['LotNo'])  document.getElementById('hj-lot').value    = ocrData['LotNo'];
  if (ocrData['유형'] === '원단') {
    if (ocrData['롤수']) document.getElementById('hj-rolls').value  = ocrData['롤수'];
    if (ocrData['무게']) document.getElementById('hj-weight').value = ocrData['무게'];
  } else {
    if (ocrData['수량']) document.getElementById('hj-qty').value = ocrData['수량'].replace(/[^0-9.]/g, '');
  }
  showToast('환입 화면에 자동 입력 완료! 창고/위치만 선택해주세요');
}