// ═══════════════════════════════════════════
// 환입: 새 품목 (전체 초기화)
// ═══════════════════════════════════════════
function clearReturnForm() {
  ['hj-code','hj-name','hj-lot','hj-lot-fabric','hj-qty','hj-po','hj-rolls','hj-weight','hj-meters','hj-route','hj-rn','hj-fl','hj-floc','hj-col','hj-note'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('hj-cat').value = '';
  document.querySelectorAll('.cat-choice[data-p="hj"]').forEach(function(el){ el.classList.remove('on'); });
  var prev = document.getElementById('hj-loc-preview');
  if (prev) prev.style.display = 'none';
  showToast('새 품목 입력 준비 완료');
}


// ═══════════════════════════════════════════
// 환입 등록
// ═══════════════════════════════════════════
async function submitReturn() {
  var wh   = document.getElementById('hj-wh').value;
  var code = document.getElementById('hj-code').value.trim();
  var loc  = buildLoc('hj');

  if (!wh)   { showToast('창고를 선택하세요');   return; }
  if (!code) { showToast('품번을 입력하세요');   return; }
  if (!loc)  { showToast('위치를 입력하세요');   return; }

  var catVal = document.getElementById('hj-cat').value;
  if (!catVal) { showToast('카테고리를 선택하세요'); return; }

  var qty = 0, rolls = 0, weight = 0, meters = 0;
  if (hjType === 'fabric') {
    rolls  = parseFloat(document.getElementById('hj-rolls').value)   || 0;
    weight = parseFloat(document.getElementById('hj-weight').value)  || 0;
    meters = parseFloat(document.getElementById('hj-meters').value)  || 0;
    qty    = rolls;
  } else {
    qty = parseFloat(document.getElementById('hj-qty').value) || 0;
  }

  var name = document.getElementById('hj-name').value.trim();
  var body = {
    item_type : hjType,
    person: document.getElementById('hj-person').value,
    wh, code, name, loc, qty, rolls, weight, meters,
    lot   : document.getElementById('hj-lot').value.trim(),
    cat   : catVal,
    po    : hjType === 'normal' ? document.getElementById('hj-po').value    : '',
    route : hjType === 'fabric' ? document.getElementById('hj-route').value : '',
    date  : document.getElementById('hj-date').value,
    note  : document.getElementById('hj-note').value,
  };

  try {
    var res  = await fetch(API + '/return', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    var json = await res.json();
    if (json.success) {
      showToast('✓ 환입 등록 완료! 이어서 등록 가능');
      // 연속 등록: 수량 관련만 비움 (품목·창고·위치·루트번호 유지)
      ['hj-qty','hj-rolls','hj-weight','hj-meters','hj-note'].forEach(function(id){
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
    } else {
      showToast('오류: ' + json.message);
    }
  } catch(e) {
    showToast('서버 연결 오류');
  }
}



// ═══════════════════════════════════════════
// 환입: 이전 데이터에서 품목 검색 (🔍 버튼)
// ═══════════════════════════════════════════
async function searchPrevReturn() {
  // 품번(hj-code)으로 검색. 비어 있으면 품목명으로 폴백.
  var code = document.getElementById('hj-code').value.trim();
  var name = document.getElementById('hj-name').value.trim();
  var query = code || name;
  var list = document.getElementById('hj-search-list');

  if (!query) { showToast('품번을 입력하세요'); return; }

  try {
    var res  = await fetch(API + '/catalog?q=' + encodeURIComponent(query), { credentials: 'include' });
    var json = await res.json();
    var items = json.data || [];

    if (!items.length) {
      list.style.display = 'block';
      list.innerHTML = '<div style="padding:12px;font-size:13px;color:var(--txt2);text-align:center">검색 결과 없음</div>';
      return;
    }

    list.style.display = 'block';
    list.innerHTML = items.map(function(item) {
      return '<div class="prev-hj-item" style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px" ' +
        'data-name="' + (item.name || '') + '" ' +
        'data-code="' + (item.code || '') + '" ' +
        'data-cat="'  + (item.cat  || '') + '" ' +
        'data-type="' + (item.item_type || 'normal') + '">' +
        '<div style="font-weight:600;color:var(--txt)">' + (item.name || '-') + '</div>' +
        '<div style="color:var(--txt2);margin-top:2px">' + (item.code || '') + '</div>' +
      '</div>';
    }).join('');

    // 항목 클릭 시 자동 입력 (품목명·품번·카테고리·유형만)
    list.querySelectorAll('.prev-hj-item').forEach(function(el) {
      el.addEventListener('click', function() {
        var d = this.dataset;
        setType('hj', d.type === 'fabric' ? 'fabric' : 'normal');
        document.getElementById('hj-name').value = d.name;
        document.getElementById('hj-code').value = d.code;
        if (d.cat) pickCat('hj', d.cat);
        list.style.display = 'none';
      });
    });

  } catch(e) {
    showToast('검색 오류');
  }
}

// 외부 클릭 시 목록 닫기
document.addEventListener('click', function(e) {
  var list = document.getElementById('hj-search-list');
  if (list && !list.contains(e.target) && e.target.id !== 'hj-name') {
    list.style.display = 'none';
  }
});
