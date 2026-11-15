// =====================================================
// reconcile.js - SAP(본사) CSV vs MWS(화성공장) 재고 자동 대조
// =====================================================

var _reconcileData = [];
var _reconcileFilter = 'all';

document.addEventListener('DOMContentLoaded', function() {
  var navRec = document.getElementById('nav-reconcile');
  if (navRec) {
    navRec.addEventListener('click', function() {
      switchTab('reconcile', navRec);
    });
  }
});

async function runReconcile() {
  var hqInput  = document.getElementById('rec-hq-file');
  var mwsInput = document.getElementById('rec-mws-file');

  if (!hqInput || !hqInput.files || !hqInput.files.length) {
    showToast('SAP(본사) CSV 파일을 먼저 선택하세요');
    return;
  }

  var btn = document.getElementById('btn-run-reconcile');
  var origTxt = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ 데이터 합산 및 대조 중...';

  try {
    var fd = new FormData();
    fd.append('hq_file', hqInput.files[0]);
    if (mwsInput && mwsInput.files && mwsInput.files.length) {
      fd.append('mws_file', mwsInput.files[0]);
    }

    var res  = await fetch(API + '/reconcile', {
      method: 'POST',
      credentials: 'include',
      body: fd
    });
    var json = await res.json();

    if (!json.success) {
      showToast('오류: ' + (json.message || '대조 실패'));
      return;
    }

    _reconcileData = json.results || [];
    var s = json.summary || { total: 0, match: 0, short: 0, over: 0 };

    document.getElementById('rec-cnt-all').textContent   = s.total;
    document.getElementById('rec-cnt-diff').textContent  = (s.short + s.over);
    document.getElementById('rec-cnt-short').textContent = s.short;
    document.getElementById('rec-cnt-over').textContent  = s.over;
    document.getElementById('rec-source-badge').textContent = '✓ 비교 기준: SAP(본사) CSV vs MWS(화성공장) 실시간 재고';

    document.getElementById('rec-result-area').style.display = 'block';
    var defaultFilter = (s.short + s.over) > 0 ? 'diff' : 'all';
    var cardEl = document.querySelector('.rec-stat-card[data-filter="' + defaultFilter + '"]');
    filterReconcile(defaultFilter, cardEl);

    showToast('✓ 총 ' + s.total + '개 품번 대조 완료!');
  } catch (e) {
    showToast('서버 통신 오류가 발생했습니다');
  } finally {
    btn.disabled = false;
    btn.textContent = origTxt;
  }
}

function filterReconcile(filterType, el) {
  _reconcileFilter = filterType;
  document.querySelectorAll('.rec-stat-card').forEach(function(c) {
    c.classList.remove('on');
  });
  if (el) el.classList.add('on');
  renderReconcileTable();
}

function fmtNum(n) {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString('ko-KR', { maximumFractionDigits: 2 });
}

function renderReconcileTable() {
  var tbody = document.getElementById('rec-tbody');
  if (!tbody) return;

  var q = (document.getElementById('rec-search').value || '').trim().toLowerCase();

  var filtered = _reconcileData.filter(function(item) {
    if (_reconcileFilter === 'diff'  && item.status === 'match') return false;
    if (_reconcileFilter === 'short' && item.status !== 'short') return false;
    if (_reconcileFilter === 'over'  && item.status !== 'over')  return false;

    if (q) {
      var codeMatch = (item.code || '').toLowerCase().includes(q);
      var nameMatch = (item.name || '').toLowerCase().includes(q);
      if (!codeMatch && !nameMatch) return false;
    }
    return true;
  });

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:28px;color:var(--txt2)">해당 조건의 품목이 없습니다</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(function(item) {
    var absDiff = Math.abs(item.diff);
    var diffTxt = '0';
    var diffColor = '#16a34a';
    var badgeHtml = '<span class="rec-badge rec-badge-match">일치</span>';

    if (item.status === 'short') {
      // SAP(본사)가 더 많은 경우 (화성공장 부족)
      diffTxt = 'SAP +' + fmtNum(absDiff);
      diffColor = '#dc2626';
      badgeHtml = '<span class="rec-badge rec-badge-short">SAP(본사) 많음</span>';
    } else if (item.status === 'over') {
      // MWS(화성공장)가 더 많은 경우 (화성공장 과다)
      diffTxt = 'MWS +' + fmtNum(absDiff);
      diffColor = '#2563eb';
      badgeHtml = '<span class="rec-badge rec-badge-over">MWS(화성) 많음</span>';
    }

    return '<tr>' +
      '<td style="font-weight:700;color:var(--txt)">' + item.code + '</td>' +
      '<td style="color:var(--txt)">' + (item.name || '-') + '</td>' +
      '<td style="text-align:right;font-weight:600">' + fmtNum(item.hq_qty) + '</td>' +
      '<td style="text-align:right;font-weight:600">' + fmtNum(item.mws_qty) + '</td>' +
      '<td style="text-align:right;font-weight:800;color:' + diffColor + '">' + diffTxt + '</td>' +
      '<td style="color:var(--txt2);font-weight:600">' + item.unit + '</td>' +
      '<td>' + badgeHtml + '</td>' +
    '</tr>';
  }).join('');
}

function downloadReconcileCsv() {
  if (!_reconcileData.length) {
    showToast('다운로드할 대조 결과가 없습니다');
    return;
  }
  var lines = ['\ufeff품번,품목명,SAP(본사),MWS(화성공장),차이수량,단위,구분'];

  _reconcileData.forEach(function(r) {
    var safeName = '"' + (r.name || '').replace(/"/g, '""') + '"';
    var absDiff = Math.abs(r.diff);
    var diffLabel = r.status === 'short' ? ('SAP +' + absDiff) : (r.status === 'over' ? ('MWS +' + absDiff) : '0');
    var statusLabel = r.status === 'short' ? 'SAP(본사) 많음' : (r.status === 'over' ? 'MWS(화성공장) 많음' : '일치');

    lines.push([
      r.code,
      safeName,
      r.hq_qty,
      r.mws_qty,
      diffLabel,
      r.unit,
      statusLabel
    ].join(','));
  });

  var blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url;
  a.download = 'SAP_MWS_재고대조_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}