(function () {
  'use strict';

  /* =========================
     DOM 요소
  ========================= */
  const logoutBtn = document.getElementById('logout-btn');
  const fabBtn = document.getElementById('fab-btn');

  // 탭
  const tabBtnGroups = document.getElementById('tab-btn-groups');
  const tabBtnFoodspots = document.getElementById('tab-btn-foodspots');
  const tabContentGroups = document.getElementById('tab-content-groups');
  const tabContentFoodspots = document.getElementById('tab-content-foodspots');

  // 맛집 DOM (groups.html 기준 ID)
  const foodspotsTop1Select = document.getElementById('foodspots-top1');
  const foodspotsTop2Select = document.getElementById('foodspots-top2');
  const foodspotsSearch = document.getElementById('foodspots-search');

  const foodspotsLoading = document.getElementById('foodspots-loading');
  const foodspotsEmpty = document.getElementById('foodspots-empty');
  const foodspotsEmptyTitle = document.getElementById('foodspots-empty-title');
  const foodspotsEmptyDesc = document.getElementById('foodspots-empty-desc');
  const foodspotsContainer = document.getElementById('foodspots-container');
  const foodspotsList = document.getElementById('foodspots-list');
  const foodspotsSummary = document.getElementById('foodspots-summary');

  // 그룹 DOM
  const createFirstGroupBtn = document.getElementById('create-first-group-btn');
  const loadingState = document.getElementById('loading-state');
  const emptyState = document.getElementById('empty-state');
  const groupsContainer = document.getElementById('groups-container');
  const groupsGrid = document.getElementById('groups-grid');

  // 모달
  const createGroupModal = document.getElementById('create-group-modal');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalClose = document.getElementById('modal-close');
  const groupNameInput = document.getElementById('group-name');
  const groupNameError = document.getElementById('group-name-error');
  const cancelBtn = document.getElementById('cancel-btn');
  const createGroupBtn = document.getElementById('create-group-btn');

  // 지점 선택
  const branchSearchInput = document.getElementById('branch-search');
  const branchSearchResults = document.getElementById('branch-search-results');
  const branchList = document.getElementById('branch-list');
  const selectedBranch = document.getElementById('selected-branch');
  const selectedBranchName = document.getElementById('selected-branch-name');
  const selectedBranchParent = document.getElementById('selected-branch-parent');
  const changeBranchBtn = document.getElementById('change-branch-btn');
  const branchError = document.getElementById('branch-error');

  /* =========================
     전역 변수/헬퍼(로컬 스코프)
  ========================= */
  let currentUser = null;
  let branches = [];

  let branchById = new Map();
  let childrenByParentId = new Map();
  let hqBranch = null;
  let level1Branches = [];

  let sharedRestaurantsAll = [];
  let foodspotsLoaded = false;
  let currentMainTab = 'groups';
  let selectedBranchData = null;

  function ensureFirebaseReady() {
    if (typeof auth === 'undefined' || typeof db === 'undefined') {
      console.error('firebase-config.js 로드 실패: auth/db가 없습니다.');
      alert('초기화 오류: Firebase 설정을 확인해 주세요(firebase-config.js).');
      return false;
    }
    return true;
  }

  // ✅ 전역 충돌 방지: timestamp -> serverTs 로 변경(로컬 함수)
  function serverTs() {
    try {
      return firebase.firestore.FieldValue.serverTimestamp();
    } catch {
      return new Date();
    }
  }

  function withTimeout(promise, ms, label = 'timeout') {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms))
    ]);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }

  function escapeAttr(value) {
    return String(value ?? '').replace(/"/g, '&quot;');
  }

  function splitPath(pathStr) {
    if (!pathStr) return [];
    return String(pathStr).split('>').map(s => s.trim()).filter(Boolean);
  }

  /* =========================
     지점 인덱싱(상/하위조직)
  ========================= */
  function indexBranches() {
    branchById = new Map();
    childrenByParentId = new Map();
    hqBranch = null;
    level1Branches = [];

    (branches || []).forEach(b => {
      if (!b || !b.id) return;

      if (typeof b.level !== 'number') {
        const parts = splitPath(b.fullPath || b.name || '');
        b.level = Math.max(0, parts.length - 1);
      }

      branchById.set(b.id, b);

      const pid = (b.parentId === undefined) ? null : b.parentId;
      if (!childrenByParentId.has(pid)) childrenByParentId.set(pid, []);
      childrenByParentId.get(pid).push(b);

      if (b.level === 0 || b.type === '본점' || b.name === '본점') {
        hqBranch = b;
      }
    });

    if (!hqBranch) {
      hqBranch = (branches || []).find(b => b && (b.parentId === null || b.parentId === undefined)) || null;
    }

    level1Branches = (branches || []).filter(b => {
      if (!b || !b.id) return false;
      if (b.level === 1) return true;
      if (hqBranch && b.parentId === hqBranch.id) return true;
      return false;
    });
    level1Branches.sort((a, b) => (a.name || '').localeCompare((b.name || ''), 'ko'));
  }

  function getTop1BranchIdFromBranchId(branchId) {
    const b = branchById.get(branchId);
    if (!b) return null;
    if (b.level === 0) return b.id;
    if (b.level === 1) return b.id;
    return b.parentId || null;
  }

  function getBranchDisplayName(branchId) {
    const b = branchById.get(branchId);
    if (!b) return '';
    if (b.level === 0 || b.level === 1) return b.name || '';
    const p = b.parentId ? branchById.get(b.parentId) : null;
    return p ? `${p.name || ''} > ${b.name || ''}` : (b.name || '');
  }

  /* =========================
     인증 상태 확인
  ========================= */
  if (ensureFirebaseReady()) {
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = 'index.html';
        return;
      }

      currentUser = user;

      try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) currentUser.userData = userDoc.data();
      } catch (e) {
        console.warn('사용자 정보 로드 실패(계속 진행):', e);
      }

      setupMainTabs();

      await loadBranches();

      try {
        await withTimeout(loadGroups(), 12000, 'loadGroups timeout');
      } catch (e) {
        console.warn(e);
        showEmptyState();
      }

      try {
        await withTimeout(loadReceivedInvitations(), 12000, 'loadInvites timeout');
      } catch (e) {
        console.warn(e);
      }
    });
  }

  /* =========================
     메인 탭(그룹/맛집)
  ========================= */
  function setupMainTabs() {
    if (!tabBtnGroups || !tabBtnFoodspots) return;
    if (tabBtnGroups.dataset.bound === '1') return;

    tabBtnGroups.dataset.bound = '1';
    tabBtnFoodspots.dataset.bound = '1';

    tabBtnGroups.addEventListener('click', () => switchMainTab('groups'));
    tabBtnFoodspots.addEventListener('click', () => switchMainTab('foodspots'));

    if (foodspotsTop1Select && !foodspotsTop1Select.dataset.bound) {
      foodspotsTop1Select.dataset.bound = '1';
      foodspotsTop1Select.addEventListener('change', () => {
        populateFoodspotsTop2Options();
        renderFoodspots();
      });
    }
    if (foodspotsTop2Select && !foodspotsTop2Select.dataset.bound) {
      foodspotsTop2Select.dataset.bound = '1';
      foodspotsTop2Select.addEventListener('change', renderFoodspots);
    }
    if (foodspotsSearch && !foodspotsSearch.dataset.bound) {
      foodspotsSearch.dataset.bound = '1';
      foodspotsSearch.addEventListener('input', renderFoodspots);
    }

    switchMainTab('groups');
  }

  function switchMainTab(tab) {
    currentMainTab = tab;

    if (tabBtnGroups) tabBtnGroups.classList.toggle('active', tab === 'groups');
    if (tabBtnFoodspots) tabBtnFoodspots.classList.toggle('active', tab === 'foodspots');

    if (tabContentGroups) tabContentGroups.classList.toggle('hidden', tab !== 'groups');
    if (tabContentFoodspots) tabContentFoodspots.classList.toggle('hidden', tab !== 'foodspots');

    if (fabBtn) fabBtn.style.display = (tab === 'groups') ? '' : 'none';

    if (tab === 'foodspots') ensureFoodspotsLoaded();
  }

  /* =========================
     맛집 로드/필터/렌더
  ========================= */
 async function ensureFoodspotsLoaded() {
  if (foodspotsLoaded) {
    populateFoodspotsTop2Options();
    renderFoodspots();
    return;
  }

  try {
    showFoodspotsLoading();

    const snap = await db.collection('sharedRestaurants')
      .orderBy('sharedAt', 'desc')
      .limit(500)
      .get();

    // ✅ 이 부분을 추가! (기존 한 줄 삭제하고 아래 코드로 교체)
    const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // restaurantId + groupId 조합으로 중복 제거 (최신 것만 유지)
    const uniqueMap = new Map();
    allDocs.forEach(doc => {
      const key = `${doc.restaurantId}_${doc.groupId}`;
      const existing = uniqueMap.get(key);
      
      // 같은 조합이 없거나, 더 최신 데이터면 업데이트
      if (!existing || (doc.sharedAt && existing.sharedAt && 
          doc.sharedAt.toMillis() > existing.sharedAt.toMillis())) {
        uniqueMap.set(key, doc);
      }
    });
    
    // Map에서 배열로 변환
    sharedRestaurantsAll = Array.from(uniqueMap.values());

    populateFoodspotsTop1Options();
    populateFoodspotsTop2Options();

    foodspotsLoaded = true;
    renderFoodspots();
  } catch (e) {
    console.error('맛집 목록 로드 오류:', e);
    alert('맛집 목록을 불러오는 중 오류가 발생했습니다.');
    showFoodspotsEmpty();
  }
}

  function populateFoodspotsTop1Options() {
    if (!foodspotsTop1Select) return;

    const prev = foodspotsTop1Select.value || 'ALL';
    let html = '<option value="ALL">전체</option>';

    if (hqBranch) {
      html += `<option value="${escapeAttr(hqBranch.id)}">${escapeHtml(hqBranch.name || '본점')}</option>`;
    }
    (level1Branches || []).forEach(b => {
      if (hqBranch && b.id === hqBranch.id) return;
      html += `<option value="${escapeAttr(b.id)}">${escapeHtml(b.name || '')}</option>`;
    });

    foodspotsTop1Select.innerHTML = html;

    const hasPrev = [...foodspotsTop1Select.options].some(o => o.value === prev);
    foodspotsTop1Select.value = hasPrev ? prev : 'ALL';
  }

  function populateFoodspotsTop2Options() {
    if (!foodspotsTop2Select) return;

    const top1 = foodspotsTop1Select?.value || 'ALL';

    if (!top1 || top1 === 'ALL') {
      foodspotsTop2Select.innerHTML = '<option value="ALL">전체</option>';
      foodspotsTop2Select.value = 'ALL';
      foodspotsTop2Select.disabled = true;
      return;
    }

    if (hqBranch && top1 === hqBranch.id) {
      foodspotsTop2Select.innerHTML =
        `<option value="${escapeAttr(hqBranch.id)}">${escapeHtml(hqBranch.name || '본점')}</option>`;
      foodspotsTop2Select.value = hqBranch.id;
      foodspotsTop2Select.disabled = true;
      return;
    }

    const prev = foodspotsTop2Select.value || 'ALL';
    const options = [];

    options.push({ value: 'ALL', label: '전체' });

    const top1Branch = branchById.get(top1);
    if (top1Branch) options.push({ value: top1Branch.id, label: top1Branch.name || '' });

    const children = (childrenByParentId.get(top1) || []).filter(c => c && c.id);
    children.sort((a, b) => (a.name || '').localeCompare((b.name || ''), 'ko'));
    children.forEach(c => options.push({ value: c.id, label: c.name || '' }));

    foodspotsTop2Select.innerHTML = options
      .map(o => `<option value="${escapeAttr(o.value)}">${escapeHtml(o.label || '')}</option>`)
      .join('');

    const hasPrev = options.some(o => o.value === prev);
    foodspotsTop2Select.value = hasPrev ? prev : 'ALL';
    foodspotsTop2Select.disabled = false;
  }

  function filterFoodspotsBase() {
  const q = (foodspotsSearch?.value || '').trim().toLowerCase();
  const top1 = foodspotsTop1Select?.value || 'ALL';
  const top2 = foodspotsTop2Select?.value || 'ALL';

  let list = [...sharedRestaurantsAll];

  if (top1 && top1 !== 'ALL') {
    if (hqBranch && top1 === hqBranch.id) {
      // ✅ 수정: 본점 선택 시 본점 ID를 가진 맛집만 필터링
      list = list.filter(r => r.branchId === hqBranch.id);
    } else {
      if (!top2 || top2 === 'ALL') {
        list = list.filter(r => getTop1BranchIdFromBranchId(r.branchId) === top1);
      } else if (top2 === top1) {
        list = list.filter(r => r.branchId === top1);
      } else {
        list = list.filter(r => r.branchId === top2);
      }
    }
  }

  if (q) {
    list = list.filter(r => {
      const name = (r.restaurantName || '').toLowerCase();
      const cat = (r.category || '').toLowerCase();
      const reason = (r.reason || '').toLowerCase();
      const branch = (r.branchName || '').toLowerCase();
      const full = (r.branchFullPath || '').toLowerCase();
      return name.includes(q) || cat.includes(q) || reason.includes(q) || branch.includes(q) || full.includes(q);
    });
  }
  return list;
}

  function renderFoodspots() {
    if (!foodspotsLoaded) return;

    populateFoodspotsTop2Options();
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

    if (foodspotsSummary) {
      foodspotsSummary.textContent = `총 ${list.length.toLocaleString()}건`;
    }

    renderFoodspotsUI(list);
  }

  function showFoodspotsLoading() {
    if (foodspotsLoading) foodspotsLoading.classList.remove('hidden');
    if (foodspotsEmpty) foodspotsEmpty.classList.add('hidden');
    if (foodspotsContainer) foodspotsContainer.classList.add('hidden');
  }
  function showFoodspotsEmpty() {
    if (foodspotsLoading) foodspotsLoading.classList.add('hidden');
    if (foodspotsEmpty) foodspotsEmpty.classList.remove('hidden');
    if (foodspotsContainer) foodspotsContainer.classList.add('hidden');
  }
  function showFoodspotsContainer() {
    if (foodspotsLoading) foodspotsLoading.classList.add('hidden');
    if (foodspotsEmpty) foodspotsEmpty.classList.add('hidden');
    if (foodspotsContainer) foodspotsContainer.classList.remove('hidden');
  }

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

  function categoryEmoji(category) {
    const c = (category || '').trim();
    if (c === '한식') return '🍲';
    if (c === '중식') return '🥟';
    if (c === '일식') return '🍣';
    if (c === '양식') return '🍝';
    if (c === '분식') return '🌶️';
    return '🍽️';
  }

  // ✅ 그룹명 숨김, reason 노출(힙한 카드 템플릿은 CSS에서 스타일링)
  function renderFoodspotsUI(itemsRaw) {
    if (!foodspotsList) return;

    const items = [...(itemsRaw || [])].sort((a, b) => {
      const at = a?.sharedAt?.toMillis ? a.sharedAt.toMillis() : 0;
      const bt = b?.sharedAt?.toMillis ? b.sharedAt.toMillis() : 0;
      return bt - at;
    });

    foodspotsList.innerHTML = items.map(x => {
      const name = escapeHtml((x.restaurantName || '').toString());
      const category = escapeHtml((x.category || '').toString());
      const branchLabel = escapeHtml(getBranchDisplayName(x.branchId) || x.branchFullPath || x.branchName || '');
      const dt = formatKoreanDate(x.sharedAt || x.createdAt);

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
              <div class="reason-text">${reason}</div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  /* =========================
     지점 목록 로드
  ========================= */
  async function loadBranches() {
    try {
      const res = await fetch('branches.json', { cache: 'no-store' });
      if (res.ok) {
        branches = await res.json();
        indexBranches();
        return;
      }
    } catch {}

    try {
      const snapshot = await db.collection('branches').orderBy('fullPath').get();
      branches = [];
      snapshot.forEach(doc => branches.push({ id: doc.id, ...doc.data() }));
      indexBranches();
    } catch (e) {
      console.error('지점 목록 로드 오류:', e);
      alert('지점 목록을 불러오는 중 오류가 발생했습니다.');
    }
  }

  /* =========================
     지점 검색/선택
  ========================= */
  if (branchSearchInput) {
    branchSearchInput.addEventListener('input', () => {
      const query = branchSearchInput.value.trim();
      if (!query) {
        branchSearchResults?.classList.add('hidden');
        return;
      }
      searchBranches(query);
    });

    branchSearchInput.addEventListener('focus', () => {
      const query = branchSearchInput.value.trim();
      if (query) searchBranches(query);
      else showAllSelectableBranches();
    });
  }

  function searchBranches(query) {
    const lowerQuery = query.toLowerCase();
    const results = (branches || []).filter(branch => {
      if (!branch.selectable) return false;
      const nameMatch = (branch.name || '').toLowerCase().includes(lowerQuery);
      const parentMatch = (branch.parentName || '').toLowerCase().includes(lowerQuery);
      const pathMatch = (branch.fullPath || '').toLowerCase().includes(lowerQuery);
      return nameMatch || parentMatch || pathMatch;
    });
    renderBranchResults(results);
  }

  function showAllSelectableBranches() {
    const selectable = (branches || []).filter(b => b.selectable);
    renderBranchResults(selectable);
  }

  function renderBranchResults(results) {
    if (!branchList || !branchSearchResults) return;
    branchList.innerHTML = '';

    if (!results || results.length === 0) {
      branchList.innerHTML = '<div class="no-results">검색 결과가 없습니다</div>';
      branchSearchResults.classList.remove('hidden');
      return;
    }

    const headquarters = results.filter(b => b.level === 0);
    const others = results.filter(b => b.level !== 0);
    const sorted = [...headquarters, ...others];

    sorted.forEach(branch => {
      const item = document.createElement('div');
      item.className = 'branch-item';
      if (branch.level === 0) item.classList.add('headquarters');

      item.innerHTML = `
        <span class="branch-item-name">
          ${escapeHtml(branch.name)}
          <span class="branch-item-type">${escapeHtml(branch.type)}</span>
        </span>
        ${branch.level !== 0
          ? `<span class="branch-item-path">${escapeHtml(branch.parentName)}</span>`
          : '<span class="branch-item-path">최상위 조직</span>'}
      `;

      item.addEventListener('click', () => selectBranch(branch));
      branchList.appendChild(item);
    });

    branchSearchResults.classList.remove('hidden');
  }

  function selectBranch(branch) {
    selectedBranchData = branch;

    if (selectedBranchName) selectedBranchName.textContent = branch.name || '';
    if (selectedBranchParent) selectedBranchParent.textContent = branch.level === 0 ? '최상위 조직' : (branch.parentName || '');

    selectedBranch?.classList.remove('hidden');
    if (branchSearchInput) branchSearchInput.value = branch.name || '';
    branchSearchResults?.classList.add('hidden');

    hideError(branchError);
  }

  changeBranchBtn?.addEventListener('click', () => {
    selectedBranchData = null;
    selectedBranch?.classList.add('hidden');
    if (branchSearchInput) {
      branchSearchInput.value = '';
      branchSearchInput.focus();
    }
  });

  /* =========================
     로그아웃
  ========================= */
  logoutBtn?.addEventListener('click', async () => {
    try {
      await auth.signOut();
      window.location.href = 'index.html';
    } catch (e) {
      console.error('로그아웃 오류:', e);
      alert('로그아웃 중 오류가 발생했습니다.');
    }
  });

  /* =========================
     그룹 목록 로드
  ========================= */
  async function loadGroups() {
    showLoading();

    try {
      const groupsMap = new Map();

      // 멤버십 기반
      try {
        const membershipSnap = await db.collectionGroup('groupMembers')
          .where('userId', '==', currentUser.uid)
          .get();

        for (const gmDoc of membershipSnap.docs) {
          const groupRef = gmDoc.ref.parent.parent;
          if (!groupRef) continue;
          const gid = groupRef.id;
          groupsMap.set(gid, { id: gid, _membership: gmDoc.data() || {} });
        }
      } catch (e) {
        console.warn('collectionGroup(groupMembers) 실패:', e);
      }

      // 소유 그룹
      const ownerSnap = await db.collection('groups')
        .where('ownerId', '==', currentUser.uid)
        .get();

      for (const doc of ownerSnap.docs) {
        const gid = doc.id;
        groupsMap.set(gid, { id: gid, ...doc.data() });

        const gmRef = db.collection('groups').doc(gid).collection('groupMembers').doc(currentUser.uid);
        const gmExists = await gmRef.get();
        if (!gmExists.exists) {
          await gmRef.set({
            userId: currentUser.uid,
            role: 'owner',
            groupId: gid,
            joinedAt: serverTs()
          }, { merge: true });
        }
      }

      const groupsArr = [];
      for (const [gid, val] of groupsMap.entries()) {
        if (val && val.groupName) {
          groupsArr.push(val);
          continue;
        }
        const groupDoc = await db.collection('groups').doc(gid).get();
        if (groupDoc.exists) groupsArr.push({ id: gid, ...groupDoc.data() });
      }

      groupsArr.sort((a, b) => {
        const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bt - at;
      });

      if (!groupsArr.length) {
        showEmptyState();
        return;
      }

      if (groupsGrid) groupsGrid.innerHTML = '';
      groupsArr.forEach(group => {
        if (groupsGrid) groupsGrid.appendChild(createGroupCard(group));
      });

      showGroupsList();
    } catch (e) {
      console.error('그룹 목록 로드 오류:', e);
      alert('그룹 목록을 불러오는 중 오류가 발생했습니다.');
      showEmptyState();
    }
  }

  /* =========================
     받은 초대
  ========================= */
  async function loadReceivedInvitations() {
    const section = document.getElementById('received-invites-section');
    const listEl = document.getElementById('received-invites-list');
    const emptyEl = document.getElementById('received-invites-empty');
    if (!section || !listEl || !emptyEl) return;

    try {
      const snap = await db.collection('groupInvitations')
        .where('invitedUserId', '==', currentUser.uid)
        .get();

      const invites = [];
      snap.forEach(doc => {
        const inv = { id: doc.id, ...doc.data() };
        if (inv.status === 'pending') invites.push(inv);
      });

      if (!invites.length) {
        section.classList.add('hidden');
        return;
      }

      section.classList.remove('hidden');
      listEl.innerHTML = '';

      invites.sort((a, b) => {
        const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bt - at;
      });

      invites.forEach(inv => {
        const card = document.createElement('div');
        card.className = 'invite-card';
        card.innerHTML = `
          <div class="invite-info">
            <div class="invite-group-name">${escapeHtml(inv.groupName || '그룹')}</div>
            <div class="invite-meta">초대자: ${escapeHtml(inv.inviterUserId || '-')}</div>
          </div>
          <div class="invite-actions">
            <button class="btn-secondary btn-invite-decline" data-invite-id="${inv.id}">거절</button>
            <button class="btn-primary btn-invite-accept" data-invite-id="${inv.id}" data-group-id="${escapeAttr(inv.groupId || '')}">수락</button>
          </div>
        `;
        listEl.appendChild(card);
      });

      emptyEl.classList.add('hidden');

      listEl.querySelectorAll('.btn-invite-accept').forEach(btn => {
        btn.addEventListener('click', async () => {
          const inviteId = btn.dataset.inviteId;
          const gid = btn.dataset.groupId;
          if (!inviteId || !gid) return;
          await acceptInvitation(inviteId, gid);
        });
      });

      listEl.querySelectorAll('.btn-invite-decline').forEach(btn => {
        btn.addEventListener('click', async () => {
          const inviteId = btn.dataset.inviteId;
          if (!inviteId) return;
          await declineInvitation(inviteId);
        });
      });
    } catch (e) {
      console.error('받은 초대 로드 오류:', e);
      section.classList.add('hidden');
    }
  }

  async function acceptInvitation(inviteId, gid) {
    try {
      await db.collection('groups').doc(gid).collection('groupMembers').doc(currentUser.uid).set({
        userId: currentUser.uid,
        role: 'member',
        groupId: gid,
        joinedAt: serverTs()
      }, { merge: true });

      await db.collection('groupInvitations').doc(inviteId).update({
        status: 'accepted',
        respondedAt: serverTs()
      });

      await loadReceivedInvitations();
      await loadGroups();
    } catch (e) {
      console.error('초대 수락 오류:', e);
      alert('초대 수락 중 오류가 발생했습니다.');
    }
  }

  async function declineInvitation(inviteId) {
    try {
      await db.collection('groupInvitations').doc(inviteId).update({
        status: 'declined',
        respondedAt: serverTs()
      });
      await loadReceivedInvitations();
    } catch (e) {
      console.error('초대 거절 오류:', e);
      alert('초대 거절 중 오류가 발생했습니다.');
    }
  }

  /* =========================
     그룹 카드/이동
  ========================= */
  function createGroupCard(group) {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.onclick = () => openGroup(group.id);

    const createdDate = group.createdAt
      ? new Date(group.createdAt.toDate()).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
      : '날짜 정보 없음';

    card.innerHTML = `
      <div class="group-card-header">
        <div class="group-icon">🍱</div>
      </div>
      <div class="group-name">${escapeHtml(group.groupName || '')}</div>
      ${group.branchName ? `
        <div class="group-branch">
          <span class="group-branch-icon">📍</span>
          <span>${escapeHtml(group.branchName)}</span>
        </div>
      ` : ''}
      <div class="group-info">
        <div class="group-info-item">
          <span class="group-info-icon">📅</span>
          <span>${escapeHtml(createdDate)}</span>
        </div>
      </div>
    `;
    return card;
  }

  function openGroup(groupId) {
    window.location.href = `home.html?groupId=${groupId}`;
  }

  /* =========================
     상태 표시
  ========================= */
  function showLoading() {
    loadingState?.classList.remove('hidden');
    emptyState?.classList.add('hidden');
    groupsContainer?.classList.add('hidden');
  }

  function showEmptyState() {
    loadingState?.classList.add('hidden');
    emptyState?.classList.remove('hidden');
    groupsContainer?.classList.add('hidden');
  }

  function showGroupsList() {
    loadingState?.classList.add('hidden');
    emptyState?.classList.add('hidden');
    groupsContainer?.classList.remove('hidden');
  }

  /* =========================
     모달/에러/그룹 생성
  ========================= */
  function openModal() {
    selectedBranchData = null;
    selectedBranch?.classList.add('hidden');
    if (branchSearchInput) branchSearchInput.value = '';
    branchSearchResults?.classList.add('hidden');

    createGroupModal?.classList.remove('hidden');
    if (groupNameInput) {
      groupNameInput.value = '';
      groupNameInput.focus();
    }
    hideError(groupNameError);
    hideError(branchError);
  }

  function closeModal() {
    createGroupModal?.classList.add('hidden');
    if (groupNameInput) groupNameInput.value = '';
    if (branchSearchInput) branchSearchInput.value = '';
    selectedBranchData = null;
    selectedBranch?.classList.add('hidden');
    branchSearchResults?.classList.add('hidden');
    hideError(groupNameError);
    hideError(branchError);
  }

  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
  }

  function hideError(el) {
    if (!el) return;
    el.textContent = '';
    el.classList.remove('show');
  }

  fabBtn?.addEventListener('click', openModal);
  createFirstGroupBtn?.addEventListener('click', openModal);
  modalClose?.addEventListener('click', closeModal);
  modalOverlay?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && createGroupModal && !createGroupModal.classList.contains('hidden')) closeModal();
  });

  createGroupBtn?.addEventListener('click', async () => {
    const groupName = (groupNameInput?.value || '').trim();

    if (!groupName) {
      showError(groupNameError, '그룹 이름을 입력해주세요.');
      return;
    }
    if (groupName.length > 30) {
      showError(groupNameError, '그룹 이름은 최대 30자까지 가능합니다.');
      return;
    }
    if (!selectedBranchData) {
      showError(branchError, '소속 조직을 선택해주세요.');
      branchSearchInput?.focus();
      return;
    }

    createGroupBtn.disabled = true;
    createGroupBtn.textContent = '생성 중...';

    try {
      const groupRef = await db.collection('groups').add({
        groupName: groupName,
        ownerId: currentUser.uid,
        branchId: selectedBranchData.id,
        branchName: selectedBranchData.name,
        branchType: selectedBranchData.type,
        branchLevel: selectedBranchData.level,
        branchFullPath: selectedBranchData.fullPath,
        createdAt: serverTs(),
        updatedAt: serverTs()
      });

      await db.collection('groups').doc(groupRef.id)
        .collection('groupMembers').doc(currentUser.uid)
        .set({
          userId: currentUser.uid,
          role: 'owner',
          groupId: groupRef.id,
          joinedAt: serverTs()
        }, { merge: true });

      const userId = currentUser.userData?.userId || (currentUser.email ? currentUser.email.split('@')[0] : 'owner');
      await db.collection('groups').doc(groupRef.id).collection('members').add({
        name: userId,
        createdAt: serverTs()
      });

      closeModal();
      await loadGroups();
      await loadReceivedInvitations();
    } catch (e) {
      console.error('그룹 생성 오류:', e);
      showError(groupNameError, '그룹 생성 중 오류가 발생했습니다.');
    } finally {
      createGroupBtn.disabled = false;
      createGroupBtn.textContent = '만들기';
    }
  });

  groupNameInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && selectedBranchData) createGroupBtn?.click();
  });

})();






