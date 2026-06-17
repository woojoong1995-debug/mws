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
    cat   : document.getElementById('hj-cat').value || detectCat(name),
    po    : hjType === 'normal' ? document.getElementById('hj-po').value    : '',
    route : hjType === 'fabric' ? document.getElementById('hj-route').value : '',
    date  : document.getElementById('hj-date').value,
    note  : document.getElementById('hj-note').value,
  };

  try {
    var res  = await fetch(API + '/return', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    var json = await res.json();
    if (json.success) {
      showToast('✓ 환입 등록 완료!');
      ['hj-code','hj-name','hj-lot','hj-qty','hj-po','hj-rolls','hj-weight','hj-meters','hj-route','hj-rn','hj-fl','hj-floc','hj-note'].forEach(function(id){
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('hj-cat').value = '';
      document.getElementById('hj-loc-preview').style.display = 'none';
    } else {
      showToast('오류: ' + json.message);
    }
  } catch(e) {
    showToast('서버 연결 오류');
  }
}

