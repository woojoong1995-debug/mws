// ═══════════════════════════════════════════
// 품목 카탈로그 관리 (운영자 + 관리자 전용)
// ═══════════════════════════════════════════
async function loadCatalog() {
  var list = document.getElementById('catalog-list');
  if (!list) return;
  list.innerHTML = '<div class="loading">불러오는 중...</div>';

  var q = ((document.getElementById('cat-search') || {}).value || '').trim();

  try {
    var res  = await fetch(API + '/catalog/all', { credentials: 'include' });
    var json = await res.json();
    if (!json.success) { list.innerHTML = '<p style="text-align:center;color:#9b1c1c;padding:24px 0">' + (json.message || '오류') + '</p>'; return; }

    var items = json.data || [];

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

    var unitLabels = { roll: '롤+KG', set: 'SET', m: '길이(M)', ea: '개수', kg: 'KG' };

    list.innerHTML = items.map(function(c) {
      var code      = (c.code || '').replace(/"/g, '&quot;');
      var typeLabel = c.item_type === 'fabric'
        ? ('원단 (' + (unitLabels[c.fabric_unit] || '롤+KG') + ')')
        : '일반';
      var specInfo  = (c.item_type === 'fabric' && c.spec_w && c.spec_l && c.spec_m)
        ? (' · 규격: ' + c.spec_w + '×' + c.spec_l + '×' + c.spec_m + ' (' + (c.unit_weight || 0) + 'kg/롤)')
        : '';

      return '<div class="item" data-code="' + code + '">' +
        '<div class="item-top">' +
          '<div style="min-width:0;flex:1">' +
            '<div class="item-name">' + (c.name || '-') + '</div>' +
            '<div class="item-code">' + (c.code || '') + ' · ' + (c.cat || '-') + ' · ' + typeLabel + specInfo + '</div>' +
          '</div>' +
          '<div class="item-right">' +
            '<button class="cat-edit-btn" data-code="' + code + '" style="font-size:11px;padding:4px 8px;border:1px solid var(--border2);border-radius:6px;background:var(--card);color:var(--txt);cursor:pointer;margin-right:4px">수정</button>' +
            '<button class="cat-del-btn" data-code="' + code + '" style="font-size:11px;padding:4px 8px;border:1px solid #fca5a5;border-radius:6px;background:#fef2f2;color:#dc2626;cursor:pointer">삭제</button>' +
          '</div>' +
        '</div>' +
        '<div class="cat-edit-form" id="cat-edit-' + code + '" style="display:none;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">' +
          '<div class="row2">' +
            '<div><label>품번</label><input type="text" class="cat-f-code" value="' + code + '"></div>' +
            '<div><label>품목명</label><input type="text" class="cat-f-name" value="' + (c.name || '').replace(/"/g, '&quot;') + '"></div>' +
          '</div>' +
          '<div class="row2">' +
            '<div><label>카테고리</label><input type="text" class="cat-f-cat" value="' + (c.cat || '').replace(/"/g, '&quot;') + '"></div>' +
            '<div><label>유형</label>' +
              '<select class="cat-f-type">' +
                '<option value="normal"' + (c.item_type !== 'fabric' ? ' selected' : '') + '>일반</option>' +
                '<option value="fabric"' + (c.item_type === 'fabric' ? ' selected' : '') + '>원단</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="row2">' +
            '<div><label>원단 기본 단위</label>' +
              '<select class="cat-f-funit">' +
                '<option value="roll"' + ((c.fabric_unit || 'roll') === 'roll' ? ' selected' : '') + '>롤 + KG</option>' +
                '<option value="set"'  + (c.fabric_unit === 'set' ? ' selected' : '') + '>SET</option>' +
                '<option value="m"'    + (c.fabric_unit === 'm'   ? ' selected' : '') + '>길이(M)</option>' +
                '<option value="ea"'   + (c.fabric_unit === 'ea'  ? ' selected' : '') + '>개수</option>' +
              '</select>' +
            '</div>' +
            '<div><label>1롤 무게 (kg, 자동계산)</label><input type="number" step="any" class="cat-f-uw" value="' + (c.unit_weight || 0) + '" readonly></div>' +
          '</div>' +
          '<label>원단 규격 (가로 × 세로 × 길이 ÷ 1,000,000)</label>' +
          '<div class="row3" style="margin-bottom:10px">' +
            '<div><input type="number" step="any" class="cat-f-sw" placeholder="예: 46" value="' + (c.spec_w || '') + '"></div>' +
            '<div><input type="number" step="any" class="cat-f-sl" placeholder="예: 195" value="' + (c.spec_l || '') + '"></div>' +
            '<div><input type="number" step="any" class="cat-f-sm" placeholder="예: 2500" value="' + (c.spec_m || '') + '"></div>' +
          '</div>' +
          '<div class="row2">' +
            '<button class="cat-save-btn btn btn-dark" data-code="' + code + '" style="margin-top:0;padding:10px !important">저장</button>' +
            '<button class="cat-cancel-btn btn btn-light" data-code="' + code + '" style="margin-top:0;padding:10px !important">취소</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.cat-edit-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        var form = document.getElementById('cat-edit-' + this.dataset.code);
        if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
      });
    });

    list.querySelectorAll('.cat-cancel-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        var form = document.getElementById('cat-edit-' + this.dataset.code);
        if (form) form.style.display = 'none';
      });
    });

    list.querySelectorAll('.cat-save-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        saveCatalogEdit(this.dataset.code, this.closest('.item'));
      });
    });

    list.querySelectorAll('.cat-del-btn').forEach(function(btn){
      btn.addEventListener('click', function(){
        deleteCatalogItem(this.dataset.code);
      });
    });

  } catch(e) {
    list.innerHTML = '<p style="text-align:center;color:#9b1c1c;padding:24px 0;font-size:14px">서버 연결 오류</p>';
  }
}

async function saveCatalogEdit(oldCode, itemEl) {
  if (!itemEl) return;
  var newCode = itemEl.querySelector('.cat-f-code').value.trim();
  var name    = itemEl.querySelector('.cat-f-name').value.trim();
  var cat     = itemEl.querySelector('.cat-f-cat').value.trim();
  var type    = itemEl.querySelector('.cat-f-type').value;
  var funit   = itemEl.querySelector('.cat-f-funit').value;
  var sw      = parseFloat(itemEl.querySelector('.cat-f-sw').value) || 0;
  var sl      = parseFloat(itemEl.querySelector('.cat-f-sl').value) || 0;
  var sm      = parseFloat(itemEl.querySelector('.cat-f-sm').value) || 0;

  if (!newCode) { showToast('품번을 입력하세요'); return; }

  try {
    var res  = await fetch(API + '/catalog/' + encodeURIComponent(oldCode), {
      method     : 'PUT',
      credentials: 'include',
      headers    : { 'Content-Type': 'application/json' },
      body       : JSON.stringify({
        code: newCode, name: name, cat: cat, item_type: type,
        fabric_unit: funit, spec_w: sw, spec_l: sl, spec_m: sm
      })
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

async function deleteCatalogItem(code) {
  if (!confirm('이 품목을 카탈로그에서 삭제할까요?\n(재고 데이터는 그대로 유지됩니다)')) return;
  try {
    var res  = await fetch(API + '/catalog/' + encodeURIComponent(code), {
      method     : 'DELETE',
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