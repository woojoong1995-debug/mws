// 품목 유형 토글 (일반/원단)
// prefix: 'in'=입고, 'dp'=불출, 'hj'=환입
// ═══════════════════════════════════════════
function setType(prefix, type) {
  // 버튼 스타일 업데이트
  document.getElementById(prefix + '-type-normal').classList.toggle('on', type === 'normal');
  document.getElementById(prefix + '-type-fabric').classList.toggle('on', type === 'fabric');

  // 유형 상태 저장
  if (prefix === 'in') inType = type;
  else if (prefix === 'dp') dpType = type;
  else hjType = type;

  // 수량 입력 필드 전환
  var normalDiv = document.getElementById(prefix + '-qty-normal');
  var fabricDiv = document.getElementById(prefix + '-qty-fabric');
  if (normalDiv) normalDiv.style.display = type === 'normal' ? 'block' : 'none';
  if (fabricDiv) fabricDiv.style.display = type === 'fabric' ? 'block' : 'none';
}


// ═══════════════════════════════════════════
// 창고 변경 시 렉 최대 번호 업데이트
// D동: 1~14, 천막동: 1~10
// ═══════════════════════════════════════════
function updateWh(p) {
  var wh = document.getElementById(p + '-wh').value;
  var rl = document.getElementById(p + '-rack-label');
  var rn = document.getElementById(p + '-rn');
  var st = document.getElementById(p + '-st');

  if (wh === 'T') {
    // 천막동: 자동으로 바닥 보관으로 전환
    if (st) st.value = 'floor';
    updateStorage(p);
    // 구역 A~D로 전환
    var zoneEl = document.getElementById(p + '-zone');
    if (zoneEl) {
      zoneEl.innerHTML = '<option value="">-</option><option>A</option><option>B</option><option>C</option><option>D</option>';
    }
    // 천막동 전용 열 입력 필드 표시
    var tFloor = document.getElementById(p + '-t-fields');
    var tFloc  = document.getElementById(p + '-floor-fields');
    if (tFloor) tFloor.style.display = 'block';
    if (tFloc)  tFloc.style.display  = 'none';
  } else {
    // D동: 자동으로 렉 보관으로 전환
    if (st) st.value = 'rack';
    updateStorage(p);
    var zoneEl = document.getElementById(p + '-zone');
    if (zoneEl) {
      zoneEl.innerHTML = '<option value="">-</option><option>A</option><option>B</option><option>C</option><option>D</option><option>E</option><option>F</option>';
    }
    if (rl) rl.textContent = '렉 번호 (1~14)';
    if (rn) rn.max = 14;
  }  
  updateLocPreview(p);
}


// ═══════════════════════════════════════════
// 보관 방식 변경 시 필드 전환
// ═══════════════════════════════════════════
function updateStorage(p) {
  var v  = document.getElementById(p + '-st').value;
  var wh = document.getElementById(p + '-wh').value;
  var rf = document.getElementById(p + '-rack-fields');
  var ff = document.getElementById(p + '-floor-fields');
  var tf = document.getElementById(p + '-t-fields');
  if (rf) rf.style.display = v === 'rack'  ? 'block' : 'none';
  // 천막동이면 floor-fields 숨기고 t-fields 표시
  if (wh === 'T') {
    if (ff) ff.style.display = 'none';
    if (tf) tf.style.display = 'block';
  } else {
    if (ff) ff.style.display = v === 'floor' ? 'block' : 'none';
    if (tf) tf.style.display = 'none';
  }
  updateLocPreview(p);
}


// ═══════════════════════════════════════════
// 위치 문자열 생성
// 예: "D동 B구역 5번 렉 2층"
// ═══════════════════════════════════════════
function buildLoc(p) {
  var wh = (document.getElementById(p + '-wh') || {}).value || '';
  if (!wh) return '';
  var label = wh === 'D' ? 'D동' : '천막동';
  var st = (document.getElementById(p + '-st') || {}).value || 'rack';

  if (st === 'rack') {
    var zone  = (document.getElementById(p + '-zone') || {}).value || '';
    var rn    = (document.getElementById(p + '-rn')   || {}).value || '';
    var fl    = (document.getElementById(p + '-fl')   || {}).value || '';
    var parts = [label, zone ? zone+'구역' : '', rn ? rn+'번 렉' : '', fl ? fl+'층' : ''].filter(Boolean);
    return parts.length > 1 ? parts.join(' ') : '';
  } else {
    // 천막동: 구역 + 열 번호
    if (wh === 'T') {
      var zone = (document.getElementById(p + '-zone') || {}).value || '';
      var col  = (document.getElementById(p + '-col')  || {}).value || '';
      if (zone && col) return label + ' ' + zone + '구역 ' + col + '열';
      return '';
    }
    var floc = (document.getElementById(p + '-floc') || {}).value || '';
    return floc ? label + ' 바닥 ' + floc : '';
  }
}


// ═══════════════════════════════════════════
// 위치 미리보기 업데이트
// ═══════════════════════════════════════════
function updateLocPreview(p) {
  var preview = document.getElementById(p + '-loc-preview');
  if (!preview) return;
  var loc = buildLoc(p);
  if (loc) {
    preview.style.display = 'block';
    preview.textContent = '📍 ' + loc;
  } else {
    preview.style.display = 'none';
  }
}


// ═══════════════════════════════════════════
// 품목명으로 카테고리 자동 감지
// ═══════════════════════════════════════════
function detectCat(name) {
  var n = (name || '').toLowerCase().replace(/[\s.\-_]/g, '');
  if (n.includes('카톤'))   return '카톤';
  if (n.includes('원단'))   return '원단';
  if (n.includes('단상자')) return '단상자';
  if (n.includes('인박스')) return '인박스';
  return '기타';
}

function autoCat(p) {
  var name = document.getElementById(p + '-name').value;
  var cat  = document.getElementById(p + '-cat');
  if (cat && !cat.value) cat.value = detectCat(name);
}


// ═══════════════════════════════════════════
// 토스트 메시지 표시 (2.5초 후 자동 사라짐)
// ═══════════════════════════════════════════
function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 2500);
}


// ═══════════════════════════════════════════
// 입고 등록
// ═══════════════════════════════════════════
async function submitInbound() {
  var wh   = document.getElementById('in-wh').value;
  var name = document.getElementById('in-name').value.trim();
  var loc  = buildLoc('in');

  if (!wh)   { showToast('창고를 선택하세요');   return; }
  if (!name) { showToast('품목명을 입력하세요'); return; }
  if (!loc)  { showToast('위치를 입력하세요');   return; }

  var qty = 0, rolls = 0, weight = 0, meters = 0;
  if (inType === 'fabric') {
    rolls  = parseFloat(document.getElementById('in-rolls').value)   || 0;
    weight = parseFloat(document.getElementById('in-weight').value)  || 0;
    meters = parseFloat(document.getElementById('in-meters').value)  || 0;
    qty    = rolls;
  } else {
    qty = parseFloat(document.getElementById('in-qty').value) || 0;
  }

  var body = {
    item_type : inType,
    person: document.getElementById('in-person').value,
    wh, name, loc, qty, rolls, weight, meters,
    code  : document.getElementById('in-code').value.trim(),
    lot   : (inType === 'fabric' ? document.getElementById('in-lot-fabric').value.trim() : document.getElementById('in-lot').value.trim()),
    cat   : document.getElementById('in-cat').value || detectCat(name),
    po    : inType === 'normal' ? document.getElementById('in-po').value    : '',
    route : inType === 'fabric' ? document.getElementById('in-route').value : '',
    date  : document.getElementById('in-date').value,
    note  : document.getElementById('in-note').value,
  };

  try {
    var res  = await fetch(API + '/inbound', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    var json = await res.json();
    if (json.success) {
      showToast('✓ 입고 등록 완료!');
      // 입력 필드 초기화
      ['in-name','in-code','in-lot','in-lot-fabric','in-qty','in-rn','in-fl','in-floc','in-col','in-route','in-po','in-rolls','in-weight','in-meters','in-note'].forEach(function(id){
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.getElementById('in-cat').value = '';
      document.getElementById('in-loc-preview').style.display = 'none';
    } else {
      showToast('오류: ' + json.message);
    }
  } catch(e) {
    showToast('서버 연결 오류');
  }
}



// ═══════════════════════════════════════════
// 입고: 이전 입고 데이터에서 품목 검색 (🔍 버튼)
// ═══════════════════════════════════════════
async function searchPrevInbound() {
  var name = document.getElementById('in-name').value.trim();
  var list = document.getElementById('in-search-list');

  try {
    var res  = await fetch(API + '/inventory?q=' + encodeURIComponent(name), { credentials: 'include' });
    var json = await res.json();
    var items = json.data || [];

    if (!items.length) {
      list.style.display = 'block';
      list.innerHTML = '<div style="padding:12px;font-size:13px;color:var(--txt2);text-align:center">검색 결과 없음</div>';
      return;
    }

    // 품번 기준 중복 제거 (최신 것만)
    var seen = {}, unique = [];
    items.forEach(function(item) {
      var key = item.code || item.name;
      if (!seen[key]) { seen[key] = true; unique.push(item); }
    });

    list.style.display = 'block';
    list.innerHTML = unique.map(function(item) {
      return '<div class="prev-in-item" style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px" ' +
        'data-name="' + (item.name || '') + '" ' +
        'data-code="' + (item.code || '') + '" ' +
        'data-lot="'  + (item.lot  || '') + '" ' +
        'data-wh="'   + (item.wh   || '') + '" ' +
        'data-loc="'  + (item.loc  || '') + '" ' +
        'data-cat="'  + (item.cat  || '') + '" ' +
        'data-po="'   + (item.po   || '') + '" ' +
        'data-type="' + (item.item_type || 'normal') + '">' +
        '<div style="font-weight:600;color:var(--txt)">' + (item.name || '-') + '</div>' +
        '<div style="color:var(--txt2);margin-top:2px">' + (item.code || '') + (item.lot ? ' · Lot:' + item.lot : '') + ' · ' + (item.loc || '') + '</div>' +
      '</div>';
    }).join('');

    // 항목 클릭 시 자동 입력
    list.querySelectorAll('.prev-in-item').forEach(function(el) {
      el.addEventListener('click', function() {
        var d = this.dataset;

        // 품목 유형 설정
        setType('in', d.type === 'fabric' ? 'fabric' : 'normal');

        // 기본 정보 입력
        document.getElementById('in-name').value = d.name;
        document.getElementById('in-code').value = d.code;
        var catEl = document.getElementById('in-cat');
        if (catEl && d.cat) catEl.value = d.cat;
        var poEl = document.getElementById('in-po');
        if (poEl && d.po) poEl.value = d.po;

        // 창고 설정
        var whEl = document.getElementById('in-wh');
        if (whEl && d.wh) {
          whEl.value = d.wh;
          updateWh('in');
        }

        // 위치 파싱해서 자동 입력
        var loc = d.loc || '';
        if (d.wh === 'T') {
          // 천막동: 구역 + 열
          var zoneM = loc.match(/([A-D])구역/);
          var colM  = loc.match(/(\d+)열/);
          var tzEl  = document.getElementById('in-t-zone');
          var colEl = document.getElementById('in-col');
          if (tzEl && zoneM) { tzEl.value = zoneM[1]; document.getElementById('in-zone').value = zoneM[1]; }
          if (colEl && colM) colEl.value = colM[1];
        } else {
          // D동: 구역 + 렉 + 층
          var zoneM  = loc.match(/([A-F])구역/);
          var rackM  = loc.match(/(\d+)번 렉/);
          var floorM = loc.match(/(\d+)층/);
          if (zoneM)  document.getElementById('in-zone').value = zoneM[1];
          if (rackM)  document.getElementById('in-rn').value   = rackM[1];
          if (floorM) document.getElementById('in-fl').value   = floorM[1];
        }

        updateLocPreview('in');
        list.style.display = 'none';
      });
    });

  } catch(e) {
    showToast('검색 오류');
  }
}

// 품목명 입력창 외부 클릭 시 검색 목록 닫기
document.addEventListener('click', function(e) {
  var list = document.getElementById('in-search-list');
  if (list && !list.contains(e.target) && e.target.id !== 'in-name') {
    list.style.display = 'none';
  }
});