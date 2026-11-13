// ═══════════════════════════════════════════
// 품목 유형 토글 (일반/원단)
// ═══════════════════════════════════════════
function setType(prefix, type) {
  var btnNorm = document.getElementById(prefix + '-type-normal');
  var btnFab  = document.getElementById(prefix + '-type-fabric');
  if (btnNorm) btnNorm.classList.toggle('on', type === 'normal');
  if (btnFab)  btnFab.classList.toggle('on', type === 'fabric');

  if (prefix === 'in') inType = type;
  else if (prefix === 'dp') dpType = type;
  else hjType = type;

  var normalDiv = document.getElementById(prefix + '-qty-normal');
  var fabricDiv = document.getElementById(prefix + '-qty-fabric');
  if (normalDiv) normalDiv.style.display = type === 'normal' ? 'block' : 'none';
  if (fabricDiv) fabricDiv.style.display = type === 'fabric' ? 'block' : 'none';

  var catNormal = document.getElementById(prefix + '-cat-normal');
  var catFabric = document.getElementById(prefix + '-cat-fabric');
  if (catNormal && catFabric) {
    catNormal.style.display = type === 'normal' ? 'grid' : 'none';
    catFabric.style.display = type === 'fabric' ? 'grid' : 'none';
    var catHidden = document.getElementById(prefix + '-cat');
    if (catHidden) catHidden.value = '';
    document.querySelectorAll('.cat-choice[data-p="' + prefix + '"]').forEach(function(el){
      el.classList.remove('on');
    });
  }
}

// ═══════════════════════════════════════════
// 원단 관리 단위 선택
// ═══════════════════════════════════════════
function setFabricUnit(prefix, unit) {
  var hidden = document.getElementById(prefix + '-fabric-unit');
  if (hidden) hidden.value = unit;

  document.querySelectorAll('.funit-btn[data-p="' + prefix + '"]').forEach(function(btn){
    btn.classList.toggle('on', btn.dataset.u === unit);
  });

  if (prefix === 'in') {
    var rollBox  = document.getElementById('in-fbox-roll');
    var otherBox = document.getElementById('in-fbox-other');
    var otherLbl = document.getElementById('in-fbox-other-label');
    if (unit === 'roll') {
      if (rollBox)  rollBox.style.display  = 'block';
      if (otherBox) otherBox.style.display = 'none';
    } else {
      if (rollBox)  rollBox.style.display  = 'none';
      if (otherBox) otherBox.style.display = 'block';
      var lblMap = { set: '입고 수량 (SET)', m: '입고 길이 (m)', ea: '입고 개수 (개)' };
      if (otherLbl) otherLbl.textContent = lblMap[unit] || '수량';
    }
  } else if (prefix === 'hj') {
    var hjLbl = document.getElementById('hj-fabric-qty-label');
    var hjMap = { kg: '환입 무게 (kg)', set: '환입 수량 (SET)', m: '환입 길이 (m)', ea: '환입 개수 (개)' };
    if (hjLbl) hjLbl.textContent = hjMap[unit] || '환입 수량';
  }
}

// ═══════════════════════════════════════════
// 원단 규격 기반 1롤당 무게 & 총 무게 실시간 자동 계산
// 예: 46 x 195 x 2500 -> 22.425kg / 2000으로 고치면 -> 17.94kg 즉시 재계산
// ═══════════════════════════════════════════
function calcFabricWeight(prefix) {
  var w = parseFloat((document.getElementById(prefix + '-spec-w') || {}).value) || 0;
  var l = parseFloat((document.getElementById(prefix + '-spec-l') || {}).value) || 0;
  var m = parseFloat((document.getElementById(prefix + '-spec-m') || {}).value) || 0;
  var uwInput = document.getElementById(prefix + '-unit-weight');
  var tipEl   = document.getElementById(prefix + '-unit-weight-tip');

  var uw = parseFloat((uwInput || {}).value) || 0;
  if (w > 0 && l > 0 && m > 0) {
    uw = Math.round(((w * l * m) / 1000000.0) * 1000000) / 1000000;
    if (uwInput) uwInput.value = uw;
    if (tipEl) tipEl.textContent = '✓ 1롤당 무게: ' + uw + ' kg (' + w + ' × ' + l + ' × ' + m + ' ÷ 1,000,000)';
  } else if (uw > 0) {
    if (tipEl) tipEl.textContent = '✓ 1롤당 무게: ' + uw + ' kg';
  } else {
    if (tipEl) tipEl.textContent = '1롤당 무게: 규격을 입력하면 자동 계산됩니다';
  }

  var rolls = parseFloat((document.getElementById(prefix + '-rolls') || {}).value) || 0;
  var weightEl = document.getElementById(prefix + '-weight');
  if (uw > 0 && rolls > 0 && weightEl) {
    weightEl.value = Math.round(rolls * uw * 1000) / 1000;
  }
}

function pickCat(prefix, cat) {
  var hidden = document.getElementById(prefix + '-cat');
  if (hidden) hidden.value = cat;
  document.querySelectorAll('.cat-choice[data-p="' + prefix + '"]').forEach(function(el){
    el.classList.toggle('on', el.dataset.cat === cat);
  });
}

function updateWh(p) {
  var wh = document.getElementById(p + '-wh').value;
  var st = document.getElementById(p + '-st');

  if (wh === 'T') {
    if (st) { st.value = 'floor'; st.disabled = true; }
  } else {
    if (st) { st.disabled = false; if (!st.value) st.value = 'rack'; }
  }
  updateStorage(p);
}

function updateStorage(p) {
  var wh = document.getElementById(p + '-wh').value;
  var st = document.getElementById(p + '-st').value;
  var rf = document.getElementById(p + '-rack-fields');
  var ff = document.getElementById(p + '-floor-fields');
  var tf = document.getElementById(p + '-t-fields');

  if (wh === 'T') {
    if (rf) rf.style.display = 'none';
    if (ff) ff.style.display = 'none';
    if (tf) tf.style.display = 'block';
  } else {
    if (tf) tf.style.display = 'none';
    if (rf) rf.style.display = st === 'rack'  ? 'block' : 'none';
    if (ff) ff.style.display = st === 'floor' ? 'block' : 'none';
  }
  updateLocPreview(p);
}

function buildLoc(p) {
  var wh = (document.getElementById(p + '-wh') || {}).value || '';
  if (!wh) return '';
  var st = (document.getElementById(p + '-st') || {}).value || 'rack';

  if (wh === 'T') {
    var tZone = (document.getElementById(p + '-t-zone') || {}).value || '';
    var tCol  = (document.getElementById(p + '-col')    || {}).value || '';
    if (tZone && tCol) return '천막동 ' + tZone + '구역 ' + tCol + '열';
    return '';
  }

  if (st === 'rack') {
    var zone = (document.getElementById(p + '-zone') || {}).value || '';
    var rn   = (document.getElementById(p + '-rn')   || {}).value || '';
    var fl   = (document.getElementById(p + '-fl')   || {}).value || '';
    var parts = ['D동', zone ? zone + '동' : '', rn ? rn + '호' : '', fl ? fl + '층' : ''].filter(Boolean);
    return parts.length >= 2 ? parts.join(' ') : '';
  } else {
    var dZone = (document.getElementById(p + '-d-fzone') || {}).value || '';
    var dCol  = (document.getElementById(p + '-d-fcol')  || {}).value || '';
    if (dZone && dCol) return 'D동 바닥 ' + dZone + '구역 ' + dCol + '열';
    return '';
  }
}

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

function detectCat(name) {
  var n = (name || '').toLowerCase().replace(/[\s.\-_]/g, '');
  if (n.includes('사각캡') || n.includes('캡')) return '사각캡';
  if (n.includes('필름'))   return '필름';
  if (n.includes('카톤'))   return '카톤';
  if (n.includes('단상자')) return '단상자';
  if (n.includes('인박스')) return '인박스';
  if (n.includes('원단') && (n.includes('손') || n.includes('발') || n.includes('마스크'))) return '손발원단';
  if (n.includes('원단'))   return '원단';
  return '기타';
}

function autoCat(p) {
  var name = document.getElementById(p + '-name').value;
  var hidden = document.getElementById(p + '-cat');
  if (!hidden || hidden.value) return;
  var guess = detectCat(name);
  var btn = document.querySelector('.cat-choice[data-p="' + p + '"][data-cat="' + guess + '"]');
  if (btn && btn.closest('div').style.display !== 'none') {
    pickCat(p, guess);
  }
}

function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 2500);
}

var _lotSearchTimer = null;
function onInboundCodeInput(prefix) {
  clearTimeout(_lotSearchTimer);
  var code = (document.getElementById(prefix + '-code') || {}).value.trim();
  var wrap = document.getElementById(prefix + '-lot-suggest-wrap');
  var chips = document.getElementById(prefix + '-lot-chips');

  if (!code || code.length < 3) {
    if (wrap) wrap.style.display = 'none';
    return;
  }

  _lotSearchTimer = setTimeout(async function() {
    try {
      var res  = await fetch(API + '/lots?code=' + encodeURIComponent(code), { credentials: 'include' });
      var json = await res.json();
      if (!json.success) return;

      var catItem = json.catalog;
      if (catItem) {
        var nameEl = document.getElementById(prefix + '-name');
        if (nameEl && !nameEl.value) nameEl.value = catItem.name || '';
        setType(prefix, catItem.item_type === 'fabric' ? 'fabric' : 'normal');
        if (catItem.cat) pickCat(prefix, catItem.cat);

        if (catItem.item_type === 'fabric') {
          if (prefix === 'in') {
            setFabricUnit('in', catItem.fabric_unit || 'roll');
            if (catItem.spec_w) document.getElementById('in-spec-w').value = catItem.spec_w;
            if (catItem.spec_l) document.getElementById('in-spec-l').value = catItem.spec_l;
            if (catItem.spec_m) document.getElementById('in-spec-m').value = catItem.spec_m;
            if (catItem.unit_weight) document.getElementById('in-unit-weight').value = catItem.unit_weight;
            calcFabricWeight('in');
          } else if (prefix === 'hj') {
            var hjUnit = (catItem.fabric_unit && catItem.fabric_unit !== 'roll') ? catItem.fabric_unit : 'kg';
            setFabricUnit('hj', hjUnit);
          }
        }
      }

      var lots = json.lots || [];
      if (!lots.length) {
        if (wrap) wrap.style.display = 'none';
        return;
      }
      if (wrap && chips) {
        wrap.style.display = 'block';
        chips.innerHTML = lots.map(function(l) {
          return '<span class="lot-chip" data-lot="' + l.lot + '" data-po="' + (l.po || '') + '">' +
            l.lot + (l.loc ? ' (' + l.loc + ')' : '') + '</span>';
        }).join('');

        chips.querySelectorAll('.lot-chip').forEach(function(chip) {
          chip.addEventListener('click', function() {
            var lotVal = this.dataset.lot;
            var poVal  = this.dataset.po;
            var lotNorm = document.getElementById(prefix + '-lot');
            var lotFab  = document.getElementById(prefix + '-lot-fabric');
            if (lotNorm) lotNorm.value = lotVal;
            if (lotFab)  lotFab.value  = lotVal;
            var poEl = document.getElementById(prefix + '-po');
            if (poEl && poVal && !poEl.value) poEl.value = poVal;
            showToast('✓ 루트번호 ' + lotVal + ' 입력됨');
          });
        });
      }
    } catch(e) {}
  }, 250);
}

async function submitInbound() {
  var wh   = document.getElementById('in-wh').value;
  var name = document.getElementById('in-name').value.trim();
  var loc  = buildLoc('in');

  if (!wh)   { showToast('창고를 선택하세요');   return; }
  if (!name) { showToast('품목명을 입력하세요'); return; }
  if (!loc)  { showToast('보관 위치를 모두 선택하세요'); return; }

  var catVal = document.getElementById('in-cat').value;
  if (!catVal) { showToast('카테고리를 선택하세요'); return; }

  var qty = 0, rolls = 0, weight = 0, meters = 0;
  var fabricUnit = '', specW = 0, specL = 0, specM = 0, unitWeight = 0;
  var updateDefaultSpec = false;

  if (inType === 'fabric') {
    fabricUnit = document.getElementById('in-fabric-unit').value || 'roll';
    if (fabricUnit === 'roll') {
      specW      = parseFloat(document.getElementById('in-spec-w').value) || 0;
      specL      = parseFloat(document.getElementById('in-spec-l').value) || 0;
      specM      = parseFloat(document.getElementById('in-spec-m').value) || 0;
      unitWeight = parseFloat(document.getElementById('in-unit-weight').value) || 0;
      rolls      = parseFloat(document.getElementById('in-rolls').value)  || 0;
      weight     = parseFloat(document.getElementById('in-weight').value) || 0;
      qty        = rolls;
      var defChk = document.getElementById('in-update-default-spec');
      updateDefaultSpec = defChk ? defChk.checked : false;
      if (!rolls) { showToast('입고 롤 수를 입력하세요'); return; }
    } else if (fabricUnit === 'm') {
      meters = parseFloat(document.getElementById('in-fabric-other-qty').value) || 0;
      qty    = meters;
      if (!meters) { showToast('입고 길이(m)를 입력하세요'); return; }
    } else {
      qty = parseFloat(document.getElementById('in-fabric-other-qty').value) || 0;
      if (!qty) { showToast('입고 수량을 입력하세요'); return; }
    }
  } else {
    qty = parseFloat(document.getElementById('in-qty').value) || 0;
    if (!qty) { showToast('수량을 입력하세요'); return; }
  }

  var body = {
    item_type          : inType,
    fabric_unit        : fabricUnit,
    spec_w             : specW,
    spec_l             : specL,
    spec_m             : specM,
    unit_weight        : unitWeight,
    update_default_spec: updateDefaultSpec,
    person             : document.getElementById('in-person').value,
    wh, name, loc, qty, rolls, weight, meters,
    code               : document.getElementById('in-code').value.trim(),
    lot                : (inType === 'fabric' ? document.getElementById('in-lot-fabric').value.trim() : document.getElementById('in-lot').value.trim()),
    cat                : catVal,
    po                 : inType === 'normal' ? document.getElementById('in-po').value : '',
    route              : '',
    date               : document.getElementById('in-date').value,
    note               : document.getElementById('in-note').value,
  };

  try {
    var res  = await fetch(API + '/inbound', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
    var json = await res.json();
    if (json.success) {
      showToast('✓ 입고 등록 완료! 이어서 등록 가능');
      ['in-qty','in-rolls','in-weight','in-fabric-other-qty','in-note'].forEach(function(id){
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      var defChk = document.getElementById('in-update-default-spec');
      if (defChk) defChk.checked = false;
    } else {
      showToast('오류: ' + json.message);
    }
  } catch(e) {
    showToast('서버 연결 오류');
  }
}

function clearInboundForm() {
  ['in-name','in-code','in-lot','in-lot-fabric','in-qty','in-rn','in-fl','in-d-fzone','in-d-fcol','in-t-zone','in-col','in-po','in-rolls','in-weight','in-spec-w','in-spec-l','in-spec-m','in-fabric-other-qty','in-note'].forEach(function(id){
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('in-unit-weight').value = '0';
  document.getElementById('in-unit-weight-tip').textContent = '1롤당 무게: 규격을 입력하면 자동 계산됩니다';
  var defChk = document.getElementById('in-update-default-spec');
  if (defChk) defChk.checked = false;
  document.getElementById('in-cat').value = '';
  document.querySelectorAll('.cat-choice[data-p="in"]').forEach(function(el){ el.classList.remove('on'); });
  var prev = document.getElementById('in-loc-preview');
  if (prev) prev.style.display = 'none';
  var lotWrap = document.getElementById('in-lot-suggest-wrap');
  if (lotWrap) lotWrap.style.display = 'none';
  showToast('새 품목 입력 준비 완료');
}

async function searchPrevInbound() {
  var code  = document.getElementById('in-code').value.trim();
  var name  = document.getElementById('in-name').value.trim();
  var query = code || name;
  var list  = document.getElementById('in-search-list');

  if (!query) { showToast('품번 또는 품목명을 입력하세요'); return; }

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
      var specTxt = (item.spec_w && item.spec_l && item.spec_m) ? (' · 규격:' + item.spec_w + '×' + item.spec_l + '×' + item.spec_m + ' (' + item.unit_weight + 'kg/롤)') : '';
      return '<div class="prev-in-item" style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);font-size:13px" ' +
        'data-name="' + (item.name || '') + '" ' +
        'data-code="' + (item.code || '') + '" ' +
        'data-cat="'  + (item.cat  || '') + '" ' +
        'data-type="' + (item.item_type || 'normal') + '" ' +
        'data-funit="' + (item.fabric_unit || 'roll') + '" ' +
        'data-sw="' + (item.spec_w || 0) + '" ' +
        'data-sl="' + (item.spec_l || 0) + '" ' +
        'data-sm="' + (item.spec_m || 0) + '" ' +
        'data-uw="' + (item.unit_weight || 0) + '">' +
        '<div style="font-weight:600;color:var(--txt)">' + (item.name || '-') + '</div>' +
        '<div style="color:var(--txt2);margin-top:2px">' + (item.code || '') + specTxt + '</div>' +
      '</div>';
    }).join('');

    list.querySelectorAll('.prev-in-item').forEach(function(el) {
      el.addEventListener('click', function() {
        var d = this.dataset;
        setType('in', d.type === 'fabric' ? 'fabric' : 'normal');
        document.getElementById('in-name').value = d.name;
        document.getElementById('in-code').value = d.code;
        if (d.cat) pickCat('in', d.cat);
        if (d.type === 'fabric') {
          setFabricUnit('in', d.funit || 'roll');
          document.getElementById('in-spec-w').value = d.sw > 0 ? d.sw : '';
          document.getElementById('in-spec-l').value = d.sl > 0 ? d.sl : '';
          document.getElementById('in-spec-m').value = d.sm > 0 ? d.sm : '';
          document.getElementById('in-unit-weight').value = d.uw || 0;
          calcFabricWeight('in');
        }
        list.style.display = 'none';
        onInboundCodeInput('in');
      });
    });
  } catch(e) {
    showToast('검색 오류');
  }
}

document.addEventListener('click', function(e) {
  var list = document.getElementById('in-search-list');
  if (list && !list.contains(e.target) && e.target.id !== 'in-name' && e.target.id !== 'in-code') {
    list.style.display = 'none';
  }
});