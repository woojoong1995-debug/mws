// ═══════════════════════════════════════════
// 품목 카탈로그 관리 (운영자 전용)
// ═══════════════════════════════════════════
// 잘못 저장된 품번(예: OCR 오인식)을 수정하거나 삭제.
// ※ 카탈로그(검색 자동입력)만 바뀌고, 실제 재고(data.json)는 안 건드림.

// 카탈로그 목록 로드 (검색어 필터 포함)
async function loadCatalog() {
  var list = document.getElementById('catalog-list');
  if (!list) return;
  list.innerHTML = '<div class="loading">불러오는 중...</div>';

  var q = (document.getElementById('cat-search') || {}).value || '';
  q = q.trim();

  try {
    var res  = await fetch(API + '/catalog/all', { credentials: 'include' });
    var json = await res.json();
    if (!json.success) { list.innerHTML = '<p style="text-align:center;color:#9b1c1c;padding:24px 0">' + (json.message || '오류') + '</p>'; return; }

    var items = json.data || [];

    // 검색어 필터 (품번/품목명)
    if (q) {
      var ql = q.toLowerCase();
      items = items.filter(function(c){
        return (c.code || '').toLowerCase().indexOf(ql) >= 0
            || (c.name || '').toLowerCase().indexOf(ql) >= 0;
      });
    }

    if (!items.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--txt2);padding:24px 0;font-size:14px">항목 없음</p>';
      return;
    }

    list.innerHTML = items.map(function(c) {
      var code = (c.code || '').replace(/"/g, '&quot;');
      var typeLabel = c.item_type === 'fabric' ? '원단' : '일반';
      return '<div class="item" data-code="' + code + '">' +
        '<div class="item-top">' +
          '<div style="min-width:0;flex:1">' +
            '<div class="item-name">' + (c.name || '-') + '</div>' +
            '<div class="item-code">' + (c.code || '') + ' · ' + (c.cat || '-') + ' · ' + typeLabel + '</div>' +
          '</div>' +
          '<div class="item-right">' +
            '<button class="cat-edit-btn" data-code="' + code + '" style="font-size:11px;padding:3px 8px;border:1px solid var(--border2);border-radius:6px;background:var(--card);color:var(--txt);cursor:pointer;margin-right:4px">수정</button>' +
            '<button class="cat-del-btn" data-code="' + code + '" style="font-size:11px;padding:3px 8px;border:1px solid #fca5a5;border-radius:6px;background:#fef2f2;color:#dc2626;cursor:pointer">삭제</button>' +
          '</div>' +
        '</div>' +
        '<div class="cat-edit-form" id="cat-edit-' + code + '" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">' +
          '<label style="font-size:12px;color:var(--txt2)">품번</label>' +
          '<input type="text" class="cat-f-code" value="' + code + '" style="width:100%;margin-bottom:6px">' +
          '<label style="font-size:12px;color:var(--txt2)">품목명</label>' +
          '<input type="text" class="cat-f-name" value="' + (c.name || '').replace(/"/g, '&quot;') + '" style="width:100%;margin-bottom:6px">' +
          '<label style="font-size:12px;color:var(--txt2)">카테고리</label>' +
          '<input type="text" class="cat-f-cat" value="' + (c.cat || '').replace(/"/g, '&quot;') + '" style="width:100%;margin-bottom:6px">' +
          '<label style="font-size:12px;color:var(--txt2)">유형</label>' +
          '<select class="cat-f-type" style="width:100%;margin-bottom:8px">' +
            '<option value="normal"' + (c.item_type !== 'fabric' ? ' selected' : '') + '>일반</option>' +
            '<option value="fabric"' + (c.item_type === 'fabric' ? ' selected' : '') + '>원단</option>' +
          '</select>' +
          '<div style="display:flex;gap:6px">' +
            '<button class="cat-save-btn" data-code="' + code + '" style="flex:1;padding:8px;border:none;border-radius:8px;background:var(--txt);color:var(--card);cursor:pointer;font-weight:600">저장</button>' +
            '<button class="cat-cancel-btn" data-code="' + code + '" style="flex:1;padding:8px;border:1px solid var(--border2);border-radius:8px;background:var(--card);color:var(--txt);cursor:pointer">취소</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    // 수정 버튼 → 인라인 폼 열기
    list.querySelectorAll('.cat-edit-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        var form = document.getElementById('cat-edit-' + this.dataset.code);
        if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
      });
    });

    // 취소 버튼 → 폼 닫기
    list.querySelectorAll('.cat-cancel-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        var form = document.getElementById('cat-edit-' + this.dataset.code);
        if (form) form.style.display = 'none';
      });
    });

    // 저장 버튼 → 수정 API
    list.querySelectorAll('.cat-save-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        saveCatalogEdit(this.dataset.code, this.closest('.item'));
      });
    });

    // 삭제 버튼 → 삭제 API
    list.querySelectorAll('.cat-del-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        deleteCatalogItem(this.dataset.code);
      });
    });

  } catch(e) {
    list.innerHTML = '<p style="text-align:center;color:#9b1c1c;padding:24px 0;font-size:14px">서버 연결 오류</p>';
  }
}


// 카탈로그 항목 수정 저장
async function saveCatalogEdit(oldCode, itemEl) {
  if (!itemEl) return;
  var newCode = itemEl.querySelector('.cat-f-code').value.trim();
  var name    = itemEl.querySelector('.cat-f-name').value.trim();
  var cat     = itemEl.querySelector('.cat-f-cat').value.trim();
  var type    = itemEl.querySelector('.cat-f-type').value;

  if (!newCode) { showToast('품번을 입력하세요'); return; }

  try {
    var res  = await fetch(API + '/catalog/' + encodeURIComponent(oldCode), {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: newCode, name: name, cat: cat, item_type: type })
    });
    var json = await res.json();
    if (json.success) {
      showToast('✓ 수정 완료');
      loadCatalog();
    } else {
      showToast('오류: ' + json.message);
    }
  } catch(e) {
    showToast('서버 연결 오류');
  }
}


// 카탈로그 항목 삭제
async function deleteCatalogItem(code) {
  if (!confirm('이 품목을 카탈로그에서 삭제할까요?\n(재고 데이터는 그대로 유지됩니다)')) return;
  try {
    var res  = await fetch(API + '/catalog/' + encodeURIComponent(code), {
      method: 'DELETE',
      credentials: 'include'
    });
    var json = await res.json();
    if (json.success) {
      showToast('✓ 삭제됐습니다');
      loadCatalog();
    } else {
      showToast('오류: ' + json.message);
    }
  } catch(e) {
    showToast('서버 연결 오류');
  }
}
