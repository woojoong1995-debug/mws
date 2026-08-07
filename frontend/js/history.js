// ═══════════════════════════════════════════
// 불출 이력 로드 (날짜 필터 포함)
// ═══════════════════════════════════════════
// ★ 이번 업데이트:
//   불출을 출처별로 각각 저장하므로, 이력도 품번으로 묶지 않고
//   "한 건(한 줄)씩 따로" 나열합니다. 각 건마다 취소·전산완료 버튼이 붙어요.
//   각 줄에는 위치 / 루트번호 / 루트(원단) / PO(일반) / 수량이 표시됩니다.
async function loadHistory() {
  var list = document.getElementById('history-list');
  list.innerHTML = '<div class="loading">불러오는 중...</div>';

  var histDate = document.getElementById('hs-date').value;
  var histCode = (document.getElementById('hs-code').value || '').trim().toUpperCase();
  var histKind = document.querySelector('.hist-tab.on')?.dataset.kind || 'out';

  try {
    var params = new URLSearchParams();
    if (histDate) params.set('date', histDate);

    // 전산완료 탭은 불출 중 transfer_done=true 인 것만
    if (histKind === 'transfer') {
      params.set('kind', 'out');
      params.set('transfer_done', 'true');
    } else {
      params.set('kind', histKind);
    }

    var res  = await fetch(API + '/history?' + params, { credentials: 'include' });
    var json = await res.json();
    var outs = json.data || [];

    // 전산완료 탭: transfer_done 인 것만 / 불출 탭: 전산완료 안 된 것만
    if (histKind === 'transfer') {
      outs = outs.filter(function(o){ return o.transfer_done; });
    } else if (histKind === 'out') {
      outs = outs.filter(function(o){ return !o.transfer_done; });
    }

    // 품번 끝자리 필터
    if (histCode) outs = outs.filter(function(o){ return (o.code || '').toUpperCase().endsWith(histCode); });

    document.getElementById('hs-total')   .textContent = json.total    || 0;
    document.getElementById('hs-filtered').textContent = outs.length;

    if (!outs.length) {
      list.innerHTML = '<p style="text-align:center;color:var(--txt2);padding:24px 0;font-size:14px">이력 없음</p>';
      return;
    }

    // 최신순 정렬 (id가 클수록 최신)
    outs.sort(function(a, b){ return (b.id || 0) - (a.id || 0); });

    // ── 한 건(한 줄)씩 카드로 나열 ──
    var html = outs.map(function(item) {
      var isFabric = item.item_type === 'fabric';
      var qtyTxt = isFabric
        ? (item.rolls + '롤/' + item.weight + 'kg' + (item.meters ? '/' + item.meters + 'm' : ''))
        : (item.qty + '개');

      // 위치 (신방식 from_loc, 없으면 loc)
      var locTxt = item.from_loc || item.loc || '-';

      // 루트번호(lot) / 루트(route, 원단) / PO(일반) 배지 줄
      var metaParts = [];
      if (item.lot)   metaParts.push('루트번호:' + item.lot);
      if (item.route) metaParts.push('<span style="background:var(--blue-bg);color:var(--blue);padding:1px 5px;border-radius:4px;font-size:11px;font-weight:600">루트:' + item.route + '</span>');
      if (item.po)    metaParts.push('<span style="background:#fef9c3;color:#854d0e;padding:1px 5px;border-radius:4px;font-size:11px;font-weight:600">PO:' + item.po + '</span>');
      var metaLine = metaParts.length
        ? '<div style="font-size:12px;color:var(--txt2);margin-top:2px">' + metaParts.join(' · ') + '</div>'
        : '';

      // 버튼 (불출 탭에서만 취소·전산완료)
      var btns = '';
      if (histKind === 'out') {
        btns =
          '<button class="cancel-btn" data-id="' + item.id + '" style="margin-top:4px;font-size:11px;padding:3px 10px;border:1px solid #fca5a5;border-radius:6px;background:rgba(220,38,38,0.1);color:#ff453a;cursor:pointer">취소</button>' +
          '<button class="transfer-btn" data-id="' + item.id + '" style="margin-top:4px;font-size:11px;padding:3px 10px;border:1px solid #a78bfa;border-radius:6px;background:rgba(91,33,182,0.1);color:#5b21b6;cursor:pointer">전산 완료</button>';
      }

      return '<div style="background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px 16px;margin-bottom:10px">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
          '<div style="min-width:0;flex:1">' +
            '<div style="font-size:14px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (item.name || '-') + '</div>' +
            '<div style="font-size:12px;color:var(--txt2);margin-top:2px">' + (item.code || '') + '</div>' +
            '<div style="font-size:12px;color:var(--txt2);margin-top:6px">📍 ' + locTxt + '</div>' +
            metaLine +
            '<div style="font-size:12px;margin-top:4px"><b style="color:var(--blue)">' + (item.person || '미입력') + '</b> · ' + (item.date || '') + '</div>' +
            (item.note ? '<div style="font-size:11px;color:var(--txt2);margin-top:2px">📝 ' + item.note + '</div>' : '') +
          '</div>' +
          '<div style="text-align:right;flex-shrink:0;margin-left:8px;display:flex;flex-direction:column;align-items:flex-end">' +
            '<div class="item-qty" style="font-size:15px;font-weight:700">' + qtyTxt + '</div>' +
            btns +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    list.innerHTML = html;

    // 불출 취소 버튼 이벤트
    document.querySelectorAll('.cancel-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        cancelOutbound(parseInt(this.dataset.id));
      });
    });

    // 전산완료 버튼 이벤트
    document.querySelectorAll('.transfer-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = parseInt(this.dataset.id);
        if (!confirm('전산 완료 처리하시겠습니까?')) return;
        fetch(API + '/record/' + id + '/transfer', {
          method: 'POST', credentials: 'include'
        })
        .then(function(r){ return r.json(); })
        .then(function(json){
          if (json.success) {
            showToast('✓ 전산 완료 처리됐습니다');
            // 전산완료 탭으로 이동
            document.querySelectorAll('.hist-tab').forEach(function(b){
              b.style.background = '#f9fafb'; b.style.color = '#6b7280'; b.classList.remove('on');
            });
            var transferTab = document.querySelector('.hist-tab[data-kind="transfer"]');
            if (transferTab) {
              transferTab.style.background = '#1a1a1a'; transferTab.style.color = '#fff'; transferTab.classList.add('on');
            }
            loadHistory();
          } else {
            showToast('오류: ' + json.message);
          }
        })
        .catch(function(){ showToast('서버 연결 오류'); });
      });
    });

  } catch(e) {
    list.innerHTML = '<p style="text-align:center;color:#9b1c1c;padding:24px 0;font-size:14px">서버에 연결할 수 없습니다</p>';
  }
}

// (그룹 펼치기 함수는 더 이상 쓰지 않지만, 다른 곳 호출 대비 남겨둠)
function toggleHistGroup(gi) {
  var detail = document.getElementById('hist-detail-' + gi);
  var arrow  = document.getElementById('hist-arrow-' + gi);
  if (!detail) return;
  var open = detail.style.display === 'block';
  detail.style.display = open ? 'none' : 'block';
  arrow.textContent = open ? '▼ 펼치기' : '▲ 접기';
}
