function renderFoodspots() {
    if (!foodspotsLoaded) return;

    populateFoodspotsTop2Options();

    const top1 = foodspotsTop1Select?.value || 'ALL';
    const top2 = foodspotsTop2Select?.value || 'ALL';
    const list = filterFoodspotsBase();

    if (foodspotsEmptyTitle && foodspotsEmptyDesc) {
        foodspotsEmptyTitle.textContent = '공유된 맛집이 없어요';
        foodspotsEmptyDesc.textContent = '음식점 관리에서 ‘소문내기’를 체크하면 여기에 표시됩니다.';
    }

    if (!list.length) {
        showFoodspotsEmpty();
        return;
    }

    showFoodspotsContainer();

    // 표시 요약(기존 유지)
    if (foodspotsSummary) {
        foodspotsSummary.textContent = `총 ${list.length.toLocaleString()}건`;
    }

    // ✅✅✅ 여기(바로 이 위치)에 넣는 게 정답
    window.currentFoodspotsFiltered = list;
    renderFoodspotsUI(window.currentFoodspotsFiltered);
    return;

    // ▼▼▼ 아래 기존 “줄글 렌더링” 코드는 이제 실행되면 안 됩니다(카드 UI를 덮어씀)
    // 기존 코드(map 만들고 섹션 만드는 부분)는 삭제하거나 주석 처리하세요.

    // ===== Foodspots UI/UX (Hip Cards) =====
let foodspotsViewMode = (localStorage.getItem('foodspotsViewMode') || 'grid'); // 'grid' | 'list'

// 안전한 날짜 표시
function formatKoreanDate(ts) {
  try {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  } catch {
    return '';
  }
}

// (옵션) 카운트/상태 영역이 있으면 갱신
function setFoodspotsCount(n) {
  const el = document.getElementById('foodspots-count') || document.getElementById('foodspotsCount');
  if (!el) return;
  el.textContent = `${(n || 0).toLocaleString()}건`;
}

function setFoodspotsState(text, show) {
  const el = document.getElementById('foodspots-state') || document.getElementById('foodspotsState');
  if (!el) return;
  el.classList.toggle('hidden', !show);
  el.textContent = text || '';
}

// (옵션) 카드/리스트 토글 UI가 있으면 뷰모드 반영
function applyFoodspotsViewMode() {
  const listEl = document.getElementById('foodspots-list');
  if (!listEl) return;

  const btnGrid = document.getElementById('foodspots-view-grid') || document.getElementById('foodspotsViewGrid');
  const btnList = document.getElementById('foodspots-view-list') || document.getElementById('foodspotsViewList');

  // 토글 UI가 없으면 클래스만 기본 grid로(맛집 느낌)
  if (!btnGrid || !btnList) {
    listEl.classList.add('foodspots-grid');
    listEl.classList.remove('foodspots-list');
    return;
  }

  listEl.classList.remove('foodspots-grid', 'foodspots-list');
  listEl.classList.add(foodspotsViewMode === 'list' ? 'foodspots-list' : 'foodspots-grid');

  btnGrid.classList.toggle('active', foodspotsViewMode !== 'list');
  btnList.classList.toggle('active', foodspotsViewMode === 'list');

  localStorage.setItem('foodspotsViewMode', foodspotsViewMode);
}

// 정렬
function sortFoodspots(items, mode) {
  const arr = [...(items || [])];

  const safeName = (x) => (x?.restaurantName || x?.name || '').toString();
  const safeTime = (x) => {
    const t = x?.sharedAt || x?.createdAt || x?.timestamp || null;
    if (!t) return 0;
    const d = t.toDate ? t.toDate() : new Date(t);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };
  const safeBranch = (x) => (getBranchDisplayName(x?.branchId || x?.branch || '') || x?.branchName || '').toString();

  switch (mode) {
    case 'old':
      arr.sort((a, b) => safeTime(a) - safeTime(b));
      break;
    case 'name':
      arr.sort((a, b) => safeName(a).localeCompare(safeName(b), 'ko'));
      break;
    case 'branch':
      arr.sort((a, b) => safeBranch(a).localeCompare(safeBranch(b), 'ko') || safeName(a).localeCompare(safeName(b), 'ko'));
      break;
    case 'new':
    default:
      arr.sort((a, b) => safeTime(b) - safeTime(a));
      break;
  }
  return arr;
}

function categoryEmoji(category) {
  const c = (category || '').trim();

  // 입력값이 정확히 "한식/중식/일식/양식/분식/기타" 이므로 단순 매핑
  if (c === '한식') return '🍲';
  if (c === '중식') return '🥟';
  if (c === '일식') return '🍣';
  if (c === '양식') return '🍝';
  if (c === '분식') return '🌶️';
  return '🍽️'; // 기타 or 빈값
}

/**
 * ✅ 핵심 요구사항
 * - 소문낸 그룹(groupName) 표시하지 않음
 * - 이유(reason)는 표시
 * - 힙한 카드 UI로 렌더
 */
function renderFoodspotsUI(itemsRaw) {
  const listEl = document.getElementById('foodspots-list');
  if (!listEl) return;

  // (옵션) 정렬 UI가 있으면 적용. 없으면 최신순.
  const sortEl = document.getElementById('foodspots-sort') || document.getElementById('foodspotsSortSelect');
  const sortMode = sortEl ? sortEl.value : 'new';

  const items = sortFoodspots(itemsRaw, sortMode);

  applyFoodspotsViewMode();
  setFoodspotsCount(items.length);

  if (!items.length) {
    listEl.innerHTML = '';
    setFoodspotsState('표시할 맛집이 없습니다. 필터/검색 조건을 변경하여 다시 조회해 주십시오.', true);
    return;
  }
  setFoodspotsState('', false);

  // 그룹별(조직별) 묶음은 “힙한 UI”에서는 오히려 답답해 보일 수 있어 단일 카드 리스트로 출력
  listEl.innerHTML = items.map(x => {
    const name = escapeHtml((x.restaurantName || '').toString());
    const category = escapeHtml((x.category || '').toString());
    const branchLabel = escapeHtml(getBranchDisplayName(x.branchId || x.branch || '') || x.branchFullPath || x.branchName || '');
    const dt = formatKoreanDate(x.sharedAt || x.createdAt);

    // 이유(필드명: reason)
    const reason = escapeHtml((x.reason || '').toString());
    const hasReason = !!(x.reason && String(x.reason).trim());

    return `
      <div class="foodspot-card">
        <div class="foodspot-card-top">
          <div class="foodspot-card-name">${categoryEmoji(category)} ${name || '(이름 없음)'}</div>
          ${dt ? `<div class="foodspot-card-date">${dt}</div>` : ''}
        </div>

        <div class="foodspot-card-badges">
          ${branchLabel ? `<span class="badge badge-branch">${branchLabel}</span>` : ''}
          ${category ? `<span class="badge badge-category">${category}</span>` : ''}
        </div>

        ${hasReason ? `
          <div class="foodspot-card-reason">
            <div class="reason-title">🗣️ 소문낸 이유</div>
            <div>${reason}</div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// 컨트롤 이벤트 연결(한 번만)
// - 원응님 기존 HTML에 해당 요소가 없으면 자동으로 스킵됩니다.
(function bindFoodspotsControlsOnce() {
  const sortEl = document.getElementById('foodspots-sort') || document.getElementById('foodspotsSortSelect');
  const btnGrid = document.getElementById('foodspots-view-grid') || document.getElementById('foodspotsViewGrid');
  const btnList = document.getElementById('foodspots-view-list') || document.getElementById('foodspotsViewList');

  if (sortEl && !sortEl.dataset.bound) {
    sortEl.dataset.bound = '1';
    sortEl.addEventListener('change', () => {
      if (window.currentFoodspotsFiltered) renderFoodspotsUI(window.currentFoodspotsFiltered);
    });
  }

  if (btnGrid && !btnGrid.dataset.bound) {
    btnGrid.dataset.bound = '1';
    btnGrid.addEventListener('click', () => {
      foodspotsViewMode = 'grid';
      if (window.currentFoodspotsFiltered) renderFoodspotsUI(window.currentFoodspotsFiltered);
    });
  }

  if (btnList && !btnList.dataset.bound) {
    btnList.dataset.bound = '1';
    btnList.addEventListener('click', () => {
      foodspotsViewMode = 'list';
      if (window.currentFoodspotsFiltered) renderFoodspotsUI(window.currentFoodspotsFiltered);
    });
  }

  applyFoodspotsViewMode();
})();
}




