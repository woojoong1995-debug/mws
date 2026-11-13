// ═══════════════════════════════════════════
// 환입: 새 품목 (전체 초기화)
// ═══════════════════════════════════════════
function clearReturnForm() {
  ['hj-code','hj-name','hj-lot','hj-lot-fabric','hj-qty','hj-po','hj-rolls','hj-weight','hj-meters','hj-rn','hj-fl','hj-d-fzone','hj-d-fcol','hj-t-zone','hj-col','hj-note'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('hj-cat').value = '';
  document.querySelectorAll('.cat-choice[data-p="hj"]').forEach(function(el){ el.classList.remove('on'); });
  var prev = document.getElementById('hj-loc-preview');
  if (prev) prev.style.display = 'none';
  var lotWrap = document.getElementById('hj-lot-suggest-wrap');
  if (lotWrap) lotWrap.style.display = 'none';
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
  if (!loc)  { showToast('보관 위치를 모두 선택하세요'); return; }

  var catVal = document.getElementById('hj-cat').value;
  if (!catVal) { showToast('카테고리를 선택하세요'); return; }

  var qty = 0, rolls = 0, weight = 0, meters = 0;
  var fabricUnit = '';

  if (hjType === 'fabric') {
    fabricUnit = document.getElementById('hj-fabric-unit').value || 'kg';
    var inputVal = parseFloat(document.getElementById('hj-weight').value) || 0;
    if (!inputVal) { showToast('환입 수량/무게를 입력하세요'); return; }

    if (fabricUnit === 'kg') {
      weight = inputVal;
      qty    = inputVal;
    } else if (fabricUnit === 'm') {
      meters = inputVal;
      qty    = inputVal;
    } else {
      // set 또는 ea
      qty = inputVal;
    }
  } else {
    qty = parseFloat(document.getElementById('hj-qty').value) || 0;
    if (!qty) { showToast('환입 수량을 입력하세요'); return; }
  }

  var name = document.getElementById('hj-name').value.trim();
  var lotVal = hjType === 'fabric'
    ? document.getElementById('hj-lot-fabric').value.trim()
    : document.getElementById('hj-lot').value.trim();

  var body = {
    item_type  : hjType,
    fabric_unit: fabricUnit,
    person     : document.getElementById('hj-person').value,
    wh, code, name, loc, qty, rolls, weight, meters,
    lot        : lotVal,
    cat        : catVal,
    po         : hjType === 'normal' ? document.getElementById('hj-po').value : '',
    route      : '',
    date       : document.getElementById('hj-date').value,
    note       : document.getElementById('hj-note').value,
  };

  try {
    var res  = await fetch(API + '/return', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    var json = await res.json();
    if (json.success) {
      showToast('✓ 환입 등록 완료! 이어서 등록 가능');
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

async function searchPrevReturn() {
  var code  = document.getElementById('hj-code').value.trim();
  var name  = document.getElementById('hj-name').value.trim();
  var query = code || name;
  var list  = document.getElementById('hj-search-list');

  if (!query) { showToast('품번을 입력하세요'); return; }

  try {
    var res   = await fetch(API + '/catalog?q=' + encodeURIComponent(query), { credentials: 'include' });
    var json  = await res.json();
    var items = json.data || [];

    if (!items.length) {
      list.style.display = 'block';
      list.innerHTML = '<div style="padding:12px;font-size:13px;color:var(--txt2);text-align:center">검색 결과 없음</div>';
      return;
    }

    list.style.display = 'block';
    list.innerHTML = items.map(function(item) {
      return '<div class="prev-hj-item" style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px" ' +
        'data-name="'  + (item.name || '') + '" ' +
        'data-code="'  + (item.code || '') + '" ' +
        'data-cat="'   + (item.cat  || '') + '" ' +
        'data-type="'  + (item.item_type || 'normal') + '" ' +
        'data-funit="' + (item.fabric_unit || 'roll') + '">' +
        '<div style="font-weight:600;color:var(--txt)">' + (item.name || '-') + '</div>' +
        '<div style="color:var(--txt2);margin-top:2px">' + (item.code || '') + '</div>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.prev-hj-item').forEach(function(el) {
      el.addEventListener('click', function() {
        var d = this.dataset;
        setType('hj', d.type === 'fabric' ? 'fabric' : 'normal');
        document.getElementById('hj-name').value = d.name;
        document.getElementById('hj-code').value = d.code;
        if (d.cat) pickCat('hj', d.cat);
        if (d.type === 'fabric') {
          var hjUnit = (d.funit && d.funit !== 'roll') ? d.funit : 'kg';
          setFabricUnit('hj', hjUnit);
        }
        list.style.display = 'none';
        onInboundCodeInput('hj');
      });
    });
  } catch(e) {
    showToast('검색 오류');
  }
}

document.addEventListener('click', function(e) {
  var list = document.getElementById('hj-search-list');
  if (list && !list.contains(e.target) && e.target.id !== 'hj-name' && e.target.id !== 'hj-code') {
    list.style.display = 'none';
  }
});