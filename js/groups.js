// ===== DOM 요소 =====
const logoutBtn = document.getElementById('logout-btn');
const fabBtn = document.getElementById('fab-btn');

// ===== 탭/맛집 DOM =====
const tabBtnGroups = document.getElementById('tab-btn-groups');
const tabBtnFoodspots = document.getElementById('tab-btn-foodspots');
const tabContentGroups = document.getElementById('tab-content-groups');
const tabContentFoodspots = document.getElementById('tab-content-foodspots');

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
const createFirstGroupBtn = document.getElementById('create-first-group-btn');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const groupsContainer = document.getElementById('groups-container');
const groupsGrid = document.getElementById('groups-grid');

// 모달 요소
const createGroupModal = document.getElementById('create-group-modal');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
const groupNameInput = document.getElementById('group-name');
const groupNameError = document.getElementById('group-name-error');
const cancelBtn = document.getElementById('cancel-btn');
const createGroupBtn = document.getElementById('create-group-btn');

// 지점 선택 요소
const branchSearchInput = document.getElementById('branch-search');
const branchSearchResults = document.getElementById('branch-search-results');
const branchList = document.getElementById('branch-list');
const selectedBranch = document.getElementById('selected-branch');
const selectedBranchName = document.getElementById('selected-branch-name');
const selectedBranchParent = document.getElementById('selected-branch-parent');
const changeBranchBtn = document.getElementById('change-branch-btn');
const branchError = document.getElementById('branch-error');

// ===== 전역 변수 =====
let currentUser = null;
let branches = [];
// ===== 지점 데이터 인덱싱(하위조직 드롭다운용) =====
let branchById = new Map();          // id -> branch
let childrenByParentId = new Map();  // parentId -> [child branches]
let hqBranch = null;                // level0(본점)
let level1Branches = [];            // level1(영업본부들)

function indexBranches() {
    branchById = new Map();
    childrenByParentId = new Map();
    hqBranch = null;
    level1Branches = [];

    (branches || []).forEach(b => {
        if (!b || !b.id) return;

        // level 정규화(없으면 fullPath 기반으로 추정)
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

    // 본점이 명확하지 않으면 parentId가 null인 노드를 본점으로 간주
    if (!hqBranch) {
        hqBranch = (branches || []).find(b => b && (b.parentId === null || b.parentId === undefined)) || null;
    }

    // level1(영업본부) 목록: parentId == 본점 또는 level==1
    level1Branches = (branches || []).filter(b => {
        if (!b || !b.id) return false;
        if (b.level === 1) return true;
        if (hqBranch && b.parentId === hqBranch.id) return true;
        return false;
    });

    level1Branches.sort((a, b) => (a.name || '').localeCompare((b.name || ''), 'ko'));
}

function escapeAttr(value) {
    return String(value ?? '').replace(/"/g, '&quot;');
}

// sharedRestaurants용: branchId 기반으로 상위조직(본점/영업본부 동급 상위조직) 산출
function getTop1BranchIdFromBranchId(branchId) {
    const b = branchById.get(branchId);
    if (!b) return null;
    if (b.level === 0) return b.id;          // 본점
    if (b.level === 1) return b.id;          // 영업본부
    return b.parentId || null;               // 센터/지점 등(level2~)은 상위 영업본부가 상위조직
}

function getTop1BranchNameFromBranchId(branchId) {
    const top1Id = getTop1BranchIdFromBranchId(branchId);
    const b = top1Id ? branchById.get(top1Id) : null;
    return b?.name || '';
}

function getBranchDisplayName(branchId) {
    const b = branchById.get(branchId);
    if (!b) return '';
    if (b.level === 0 || b.level === 1) return b.name || '';
    const p = b.parentId ? branchById.get(b.parentId) : null;
    return p ? `${p.name || ''} > ${b.name || ''}` : (b.name || '');
}
let sharedRestaurantsAll = [];
let foodspotsLoaded = false;
let currentMainTab = 'groups';
let selectedBranchData = null;

// ===== 인증 상태 확인 =====
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = user;
    
    // 사용자 정보 가져오기
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            currentUser.userData = userDoc.data();
        }
    } catch (error) {
        console.error('사용자 정보 로드 오류:', error);
    }
    
    // 지점 목록 로드
    await loadBranches();
    
    // 그룹 목록 로드
    setupMainTabs();

    loadGroups();
    loadReceivedInvitations();
});


// ===== 메인 탭(그룹/맛집) =====
function setupMainTabs() {
    if (!tabBtnGroups || !tabBtnFoodspots) return;

    tabBtnGroups.addEventListener('click', () => switchMainTab('groups'));
    tabBtnFoodspots.addEventListener('click', () => switchMainTab('foodspots'));

    // 필터 이벤트(상위조직/하위조직/검색)
    if (foodspotsTop1Select) {
        foodspotsTop1Select.addEventListener('change', () => {
            populateFoodspotsTop2Options();
            renderFoodspots();
        });
    }
    if (foodspotsTop2Select) {
        foodspotsTop2Select.addEventListener('change', renderFoodspots);
    }
    if (foodspotsSearch) {
        foodspotsSearch.addEventListener('input', () => {
            // 타이핑 중에도 즉시 반영
            renderFoodspots();
        });
    }

    // 기본: 그룹 탭
    switchMainTab('groups');
}

function switchMainTab(tab) {
    currentMainTab = tab;

    // 버튼 active
    if (tabBtnGroups) tabBtnGroups.classList.toggle('active', tab === 'groups');
    if (tabBtnFoodspots) tabBtnFoodspots.classList.toggle('active', tab === 'foodspots');

    // 컨텐츠 표시
    if (tabContentGroups) tabContentGroups.classList.toggle('hidden', tab !== 'groups');
    if (tabContentFoodspots) tabContentFoodspots.classList.toggle('hidden', tab !== 'foodspots');

    // FAB(그룹 생성) 노출 제어
    if (fabBtn) fabBtn.style.display = (tab === 'groups') ? '' : 'none';

    // 맛집 탭 첫 진입 시 로드
    if (tab === 'foodspots') {
        ensureFoodspotsLoaded();
    }
}

async function ensureFoodspotsLoaded() {
    if (foodspotsLoaded) {
        populateFoodspotsTop2Options();
        renderFoodspots();
        return;
    }

    try {
        showFoodspotsLoading();

        // sharedRestaurants 전체 로드(최근순)
        const snap = await db.collection('sharedRestaurants')
            .orderBy('sharedAt', 'desc')
            .limit(500)
            .get();

        sharedRestaurantsAll = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 상위조직/하위조직 옵션 구성
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

    // 상위조직: 본점 + 영업본부(동급)
    if (hqBranch) {
        html += `<option value="${escapeAttr(hqBranch.id)}">${escapeHtml(hqBranch.name || '본점')}</option>`;
    }
    (level1Branches || []).forEach(b => {
        // 본점 자체가 level1Branches에 포함되는 경우 중복 방지
        if (hqBranch && b.id === hqBranch.id) return;
        html += `<option value="${escapeAttr(b.id)}">${escapeHtml(b.name || '')}</option>`;
    });

    foodspotsTop1Select.innerHTML = html;

    // 선택값 복원
    const hasPrev = [...foodspotsTop1Select.options].some(o => o.value === prev);
    foodspotsTop1Select.value = hasPrev ? prev : 'ALL';
}

function populateFoodspotsTop2Options() {
    if (!foodspotsTop2Select) return;

    const top1 = foodspotsTop1Select?.value || 'ALL';

    // 1) 상위조직 = 전체 → 하위조직 의미 없음(전체 고정, 비활성)
    if (!top1 || top1 === 'ALL') {
        foodspotsTop2Select.innerHTML = '<option value="ALL">전체</option>';
        foodspotsTop2Select.value = 'ALL';
        foodspotsTop2Select.disabled = true;
        return;
    }

    // 2) 상위조직 = 본점 → 하위조직 없음(본점으로 자동 고정, 비활성)
    if (hqBranch && top1 === hqBranch.id) {
        foodspotsTop2Select.innerHTML =
            `<option value="${escapeAttr(hqBranch.id)}">${escapeHtml(hqBranch.name || '본점')}</option>`;
        foodspotsTop2Select.value = hqBranch.id;   // ✅ 자동 고정
        foodspotsTop2Select.disabled = true;       // ✅ 본점은 하위조직 없음
        return;
    }

    // 3) 상위조직 = 영업본부(또는 본점이 아닌 상위조직) → 하위조직 활성화 + 옵션 구성
    const prev = foodspotsTop2Select.value || 'ALL';
    const options = [];

    // 항상 "전체" 포함
    options.push({ value: 'ALL', label: '전체' });

    // "영업본부 자체"를 따로 선택할 수 있도록 포함(= top2 === top1 이면 본부에 직접 매핑된 맛집만)
    const top1Branch = branchById.get(top1);
    if (top1Branch) {
        options.push({ value: top1Branch.id, label: top1Branch.name || '' });
    }

    // 하위 조직들(지점/센터/지원단/관리단 등)
    const children = (childrenByParentId.get(top1) || []).filter(c => c && c.id);
    children.sort((a, b) => (a.name || '').localeCompare((b.name || ''), 'ko'));
    children.forEach(c => options.push({ value: c.id, label: c.name || '' }));

    foodspotsTop2Select.innerHTML = options
        .map(o => `<option value="${escapeAttr(o.value)}">${escapeHtml(o.label || '')}</option>`)
        .join('');

    // 이전 선택값 복원(가능하면)
    const hasPrev = options.some(o => o.value === prev);
    foodspotsTop2Select.value = hasPrev ? prev : 'ALL';
    foodspotsTop2Select.disabled = false; // ✅ 본점 외에는 활성
}

function splitPath(pathStr) {
    if (!pathStr) return [];
    return pathStr.split('>').map(s => s.trim()).filter(Boolean);
}

function getTop1NameFromPath(fullPath) {
    const parts = splitPath(fullPath);
    return parts[0] || '';
}

function getTop2NameFromPath(fullPath) {
    const parts = splitPath(fullPath);
    return parts[1] || '';
}

function filterFoodspotsBase() {
    const q = (foodspotsSearch?.value || '').trim().toLowerCase();

    const top1 = foodspotsTop1Select?.value || 'ALL';
    const top2 = foodspotsTop2Select?.value || 'ALL';

    let list = [...sharedRestaurantsAll];

    // ---- 상위조직/하위조직 필터(요구사항: 2단계 뎁스) ----
    if (top1 && top1 !== 'ALL') {
        // 상위조직=본점(HQ)
        if (hqBranch && top1 === hqBranch.id) {
            // 하위조직가 특정 영업본부로 선택된 경우에만 필터(=그 영업본부 범위)
            if (top2 && top2 !== 'ALL') {
                list = list.filter(r => getTop1BranchIdFromBranchId(r.branchId) === top2);
            }
        } else {
            // 상위조직=영업본부(레벨1)
            if (!top2 || top2 === 'ALL') {
                // 전체(해당 영업본부 + 하위 조직)
                list = list.filter(r => getTop1BranchIdFromBranchId(r.branchId) === top1);
            } else if (top2 === top1) {
                // 영업본부 자체(레벨1에 직접 매핑된 맛집만)
                list = list.filter(r => r.branchId === top1);
            } else {
                // 특정 하위조직(지점/센터/지원단 등)
                list = list.filter(r => r.branchId === top2);
            }
        }
    }

    // ---- 검색 필터 ----
    if (q) {
        list = list.filter(r => {
            const name = (r.restaurantName || '').toLowerCase();
            const cat = (r.category || '').toLowerCase();
            const reason = (r.reason || '').toLowerCase();
            const groupName = (r.groupName || '').toLowerCase();
            const branch = (r.branchName || '').toLowerCase();
            return name.includes(q) || cat.includes(q) || reason.includes(q) || groupName.includes(q) || branch.includes(q);
        });
    }

    return list;
}

function renderFoodspots() {
    if (!foodspotsLoaded) return;

    // 상위조직 변경 시 하위조직 옵션을 동기화(탭 이동/새로고침에도 안전)
    populateFoodspotsTop2Options();

    const top1 = foodspotsTop1Select?.value || 'ALL';
    const top2 = foodspotsTop2Select?.value || 'ALL';
    const list = filterFoodspotsBase();

    // 빈 화면 메시지
    if (foodspotsEmptyTitle && foodspotsEmptyDesc) {
        foodspotsEmptyTitle.textContent = '공유된 맛집이 없어요';
        foodspotsEmptyDesc.textContent = '음식점 관리에서 ‘소문내기’를 체크하면 여기에 표시됩니다.';
@@ -394,848 +19,18 @@ function renderFoodspots() {

    showFoodspotsContainer();

    // 표시 요약
    if (foodspotsSummary) {
        foodspotsSummary.textContent = `총 ${list.length.toLocaleString()}건`;
    }

    // 그룹 키: 전체/본점일 때는 영업본부 단위로, 특정 영업본부 선택 시에는 지점/조직 단위로
    const map = new Map();
    list.forEach(r => {
        let key = '';
        if (top1 === 'ALL' || (hqBranch && top1 === hqBranch.id)) {
            key = getTop1BranchNameFromBranchId(r.branchId) || r.branchName || '(지점 미상)';
        } else if (top2 === 'ALL') {
            // 해당 영업본부 내에서 지점/조직별로 나열
            key = (branchById.get(r.branchId)?.name) || r.branchName || '(지점 미상)';
        } else {
            key = (branchById.get(r.branchId)?.name) || r.branchName || '(지점 미상)';
        }

        if (!map.has(key)) map.set(key, []);
        map.get(key).push(r);
    });

    const keys = [...map.keys()].sort((a, b) => a.localeCompare(b, 'ko'));
    foodspotsList.innerHTML = '';

    keys.forEach(groupKey => {
        const arr = map.get(groupKey) || [];
        const section = document.createElement('div');
        section.className = 'foodspots-section';

        const title = document.createElement('div');
        title.className = 'foodspots-section-title';
        title.innerHTML = `<span>${escapeHtml(groupKey)}</span><span class="count">${arr.length.toLocaleString()}건</span>`;
        section.appendChild(title);

        arr.forEach(r => {
            const item = document.createElement('div');
            item.className = 'foodspot-item';

            const dt = (r.sharedAt && r.sharedAt.toDate) ? r.sharedAt.toDate() : null;
            const dateText = dt ? formatDate(dt) : '';
            const branchLabel = getBranchDisplayName(r.branchId) || r.branchFullPath || r.branchName || '';

            item.innerHTML = `
                <div class="foodspot-top">
                    <div>
                        <div class="foodspot-name">${escapeHtml(r.restaurantName || '')}</div>
                        <div class="foodspot-meta">
                            ${r.category ? `<span class="badge">${escapeHtml(r.category)}</span>` : ''}
                            ${branchLabel ? `<span class="badge">${escapeHtml(branchLabel)}</span>` : ''}
                            ${r.groupName ? `<span class="badge">소문낸 그룹: ${escapeHtml(r.groupName)}</span>` : ''}
                            ${dateText ? `<span>${escapeHtml(dateText)}</span>` : ''}
                        </div>
                    </div>
                </div>
                ${r.reason ? `<div class="foodspot-reason">${escapeHtml(r.reason)}</div>` : ''}
            `;
            section.appendChild(item);
        });

        foodspotsList.appendChild(section);
    });
}

// ===== 맛집 상태 표시 =====
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

// ===== 날짜 포맷 =====
function formatDate(date) {
    try {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    } catch {
        return '';
    }
}


// ===== 지점 목록 로드 =====
async function loadBranches() {
    // 1) 정적 파일(branches.json) 우선 로드(배포/개발환경 모두 안정적으로 동일 뎁스 보장)
    try {
        const res = await fetch('branches.json', { cache: 'no-store' });
        if (res.ok) {
            branches = await res.json();
            indexBranches();
            console.log(`✅ 지점 목록 로드 완료(branches.json): ${branches.length}개`);
            return;
        }
    } catch (e) {
        // ignore and fallback to Firestore
    }

    // 2) Firestore fallback
    try {
        const snapshot = await db.collection('branches')
            .orderBy('fullPath')
            .get();

        branches = [];
        snapshot.forEach(doc => {
            branches.push({ id: doc.id, ...doc.data() });
        });

        indexBranches();
        console.log(`✅ 지점 목록 로드 완료(Firestore): ${branches.length}개`);
    } catch (error) {
        console.error('지점 목록 로드 오류:', error);
        alert('지점 목록을 불러오는 중 오류가 발생했습니다.');
    }
}

// ===== 지점 검색 =====
branchSearchInput.addEventListener('input', () => {
    const query = branchSearchInput.value.trim();
    
    if (!query) {
        branchSearchResults.classList.add('hidden');
        return;
    }
    
    searchBranches(query);
});

branchSearchInput.addEventListener('focus', () => {
    const query = branchSearchInput.value.trim();
    if (query) {
        searchBranches(query);
    } else {
        // 포커스 시 전체 목록 표시
        showAllSelectableBranches();
    }
});

function searchBranches(query) {
    const lowerQuery = query.toLowerCase();
    
    // 검색: 이름, 상위 조직명에서 검색 (선택 가능한 것만)
    const results = branches.filter(branch => {
        if (!branch.selectable) return false;
        
        const nameMatch = branch.name.toLowerCase().includes(lowerQuery);
        const parentMatch = branch.parentName && branch.parentName.toLowerCase().includes(lowerQuery);
        const pathMatch = branch.fullPath && branch.fullPath.toLowerCase().includes(lowerQuery);
        
        return nameMatch || parentMatch || pathMatch;
    });
    
    renderBranchResults(results);
}

function showAllSelectableBranches() {
    const selectableBranches = branches.filter(b => b.selectable);
    renderBranchResults(selectableBranches);
}

function renderBranchResults(results) {
    branchList.innerHTML = '';
    
    if (results.length === 0) {
        branchList.innerHTML = '<div class="no-results">검색 결과가 없습니다</div>';
        branchSearchResults.classList.remove('hidden');
        return;
    }
    
    // 본점을 맨 위에
    const headquarters = results.filter(b => b.level === 0);
    const others = results.filter(b => b.level !== 0);
    
    const sortedResults = [...headquarters, ...others];
    
    sortedResults.forEach(branch => {
        const item = createBranchItem(branch);
        branchList.appendChild(item);
    });
    
    branchSearchResults.classList.remove('hidden');
}

function createBranchItem(branch) {
    const item = document.createElement('div');
    item.className = 'branch-item';
    
    if (branch.level === 0) {
        item.classList.add('headquarters');
    }
    
    item.innerHTML = `
        <span class="branch-item-name">
            ${escapeHtml(branch.name)}
            <span class="branch-item-type">${escapeHtml(branch.type)}</span>
        </span>
        ${branch.level !== 0 ? `<span class="branch-item-path">${escapeHtml(branch.parentName)}</span>` : '<span class="branch-item-path">최상위 조직</span>'}
    `;
    
    item.addEventListener('click', () => {
        selectBranch(branch);
    });
    
    return item;
}

function selectBranch(branch) {
    selectedBranchData = branch;
    
    // UI 업데이트
    selectedBranchName.textContent = branch.name;
    selectedBranchParent.textContent = branch.level === 0 ? '최상위 조직' : branch.parentName;
    
    selectedBranch.classList.remove('hidden');
    branchSearchInput.value = branch.name;
    branchSearchResults.classList.add('hidden');
    
    hideError(branchError);
}

// ===== 지점 변경 버튼 =====
changeBranchBtn.addEventListener('click', () => {
    selectedBranchData = null;
    selectedBranch.classList.add('hidden');
    branchSearchInput.value = '';
    branchSearchInput.focus();
});

// ===== 로그아웃 =====
logoutBtn.addEventListener('click', async () => {
    try {
        await auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('로그아웃 오류:', error);
        alert('로그아웃 중 오류가 발생했습니다.');
    }
});

// ===== 그룹 목록 로드 =====
async function loadGroups() {
    try {
        showLoading();

        const groupsMap = new Map();

        // (1) 내가 참여한 그룹(방 멤버십 기준)
        // - groups/{groupId}/groupMembers/{uid} 문서에 userId 필드가 있어야 조회 가능
        const membershipSnap = await db.collectionGroup('groupMembers')
            .where('userId', '==', currentUser.uid)
            .get();

        for (const gmDoc of membershipSnap.docs) {
            const groupRef = gmDoc.ref.parent.parent; // groups/{groupId}
            if (!groupRef) continue;

            const gid = groupRef.id;
            groupsMap.set(gid, { id: gid, _membership: gmDoc.data() || {} });
        }

        // (2) 구버전 보정: ownerId == 나 인 그룹은 방장 멤버십이 없을 수 있으므로 보완
        const ownerSnap = await db.collection('groups')
            .where('ownerId', '==', currentUser.uid)
            .get();

        for (const doc of ownerSnap.docs) {
            const gid = doc.id;
            const g = { id: gid, ...doc.data() };
            groupsMap.set(gid, g);

            const gmRef = db.collection('groups').doc(gid).collection('groupMembers').doc(currentUser.uid);
            const gmExists = await gmRef.get();
            if (!gmExists.exists) {
                await gmRef.set({
                    userId: currentUser.uid,
                    role: 'owner',
                    groupId: gid,
                    joinedAt: timestamp()
                }, { merge: true });
            }
        }

        // (3) 그룹 정보 로드(멤버십으로만 잡힌 그룹은 그룹 문서를 추가 조회)
        const groupsArr = [];
        for (const [gid, val] of groupsMap.entries()) {
            if (val.groupName) {
                groupsArr.push(val);
                continue;
            }
            const groupDoc = await db.collection('groups').doc(gid).get();
            if (groupDoc.exists) {
                groupsArr.push({ id: gid, ...groupDoc.data() });
            }
        }

        // createdAt 기준 정렬(클라이언트 정렬로 인덱스 요구 회피)
        groupsArr.sort((a, b) => {
            const at = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
            const bt = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
            return bt - at;
        });

        if (groupsArr.length === 0) {
            showEmptyState();
            return;
        }

        groupsGrid.innerHTML = '';
        groupsArr.forEach(group => {
            const card = createGroupCard(group);
            groupsGrid.appendChild(card);
        });

        showGroupsList();
    } catch (error) {
        console.error('그룹 목록 로드 오류:', error);
        alert('그룹 목록을 불러오는 중 오류가 발생했습니다.');
        showEmptyState();
    }
}


// ===== 받은 초대 로드 =====
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

        if (invites.length === 0) {
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
                    <div class="invite-meta">
                        초대자: ${escapeHtml(inv.inviterUserId || '-')}
                    </div>
                </div>
                <div class="invite-actions">
                    <button class="btn-secondary btn-invite-decline" data-invite-id="${inv.id}">거절</button>
                    <button class="btn-primary btn-invite-accept" data-invite-id="${inv.id}" data-group-id="${escapeHtml(inv.groupId || '')}">수락</button>
                </div>
            `;
            listEl.appendChild(card);
        });

        emptyEl.classList.add('hidden');

        // 이벤트 바인딩
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
        // 받은 초대는 부가 기능이므로, 실패 시 섹션 숨김
        section.classList.add('hidden');
    }
}

async function acceptInvitation(inviteId, gid) {
    try {
        // 방 멤버십 생성
        await db.collection('groups').doc(gid).collection('groupMembers').doc(currentUser.uid).set({
            userId: currentUser.uid,
            role: 'member',
            groupId: gid,
            joinedAt: timestamp()
        }, { merge: true });

        // 초대 상태 변경
        await db.collection('groupInvitations').doc(inviteId).update({
            status: 'accepted',
            respondedAt: timestamp()
        });

        await loadReceivedInvitations();
        await loadGroups();
    loadReceivedInvitations();
    } catch (e) {
        console.error('초대 수락 오류:', e);
        alert('초대 수락 중 오류가 발생했습니다.');
    }
}

async function declineInvitation(inviteId) {
    try {
        await db.collection('groupInvitations').doc(inviteId).update({
            status: 'declined',
            respondedAt: timestamp()
        });

        await loadReceivedInvitations();
    } catch (e) {
        console.error('초대 거절 오류:', e);
        alert('초대 거절 중 오류가 발생했습니다.');
    }
}

// ===== 그룹 카드 생성 =====
function createGroupCard(group) {
    const card = document.createElement('div');
    card.className = 'group-card';
    card.onclick = () => openGroup(group.id);
    
    const createdDate = group.createdAt ? 
        new Date(group.createdAt.toDate()).toLocaleDateString('ko-KR', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }) : '날짜 정보 없음';
    
    card.innerHTML = `
        <div class="group-card-header">
            <div class="group-icon">🍱</div>
        </div>
        <div class="group-name">${escapeHtml(group.groupName)}</div>
        ${group.branchName ? `
        <div class="group-branch">
            <span class="group-branch-icon">📍</span>
            <span>${escapeHtml(group.branchName)}</span>
        </div>
        ` : ''}
        <div class="group-info">
            <div class="group-info-item">
                <span class="group-info-icon">📅</span>
                <span>${createdDate}</span>
            </div>
        </div>
    `;
    
    return card;
}

// ===== HTML 이스케이프 (XSS 방지) =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== 그룹 열기 =====
function openGroup(groupId) {
    window.location.href = `home.html?groupId=${groupId}`;
}

// ===== 상태 표시 함수들 =====
function showLoading() {
    loadingState.classList.remove('hidden');
    emptyState.classList.add('hidden');
    groupsContainer.classList.add('hidden');
}

function showEmptyState() {
    loadingState.classList.add('hidden');
    emptyState.classList.remove('hidden');
    groupsContainer.classList.add('hidden');
}

function showGroupsList() {
    loadingState.classList.add('hidden');
    emptyState.classList.add('hidden');
    groupsContainer.classList.remove('hidden');
}

// ===== 모달 열기/닫기 =====
function openModal() {
    // 초기화
    selectedBranchData = null;
    selectedBranch.classList.add('hidden');
    branchSearchInput.value = '';
    branchSearchResults.classList.add('hidden');
    
    createGroupModal.classList.remove('hidden');
    groupNameInput.value = '';
    groupNameInput.focus();
    hideError(groupNameError);
    hideError(branchError);
}

function closeModal() {
    createGroupModal.classList.add('hidden');
    groupNameInput.value = '';
    branchSearchInput.value = '';
    selectedBranchData = null;
    selectedBranch.classList.add('hidden');
    branchSearchResults.classList.add('hidden');
    hideError(groupNameError);
    hideError(branchError);
}

// 이벤트 리스너
fabBtn.addEventListener('click', openModal);
createFirstGroupBtn.addEventListener('click', openModal);
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !createGroupModal.classList.contains('hidden')) {
        closeModal();
    }
});

// ===== 에러 메시지 표시/숨김 =====
function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
}

function hideError(element) {
    element.textContent = '';
    element.classList.remove('show');
}

// ===== 그룹 생성 =====
createGroupBtn.addEventListener('click', async () => {
    const groupName = groupNameInput.value.trim();
    
    // 그룹명 검증
    if (!groupName) {
        showError(groupNameError, '그룹 이름을 입력해주세요.');
        return;
    }
    
    if (groupName.length > 30) {
        showError(groupNameError, '그룹 이름은 최대 30자까지 가능합니다.');
        return;
    }
    
    // 지점 선택 검증
    if (!selectedBranchData) {
        showError(branchError, '소속 조직을 선택해주세요.');
        branchSearchInput.focus();
        return;
    }
    
    createGroupBtn.disabled = true;
    createGroupBtn.textContent = '생성 중...';
    
    try {
        // Firestore에 그룹 생성
        const groupRef = await db.collection('groups').add({
            groupName: groupName,
            ownerId: currentUser.uid,
            branchId: selectedBranchData.id,
            branchName: selectedBranchData.name,
            branchType: selectedBranchData.type,
            branchLevel: selectedBranchData.level,
            branchFullPath: selectedBranchData.fullPath,
            createdAt: timestamp(),
            updatedAt: timestamp()
        });

        // 방 멤버십(권한) 생성: 방장(owner)
        await db.collection('groups').doc(groupRef.id)
            .collection('groupMembers').doc(currentUser.uid)
            .set({
                userId: currentUser.uid,
                role: 'owner',
                groupId: groupRef.id,
                joinedAt: timestamp()
            }, { merge: true });

        
        // 총무를 그룹원으로 자동 추가
        const userId = currentUser.userData?.userId || currentUser.email.split('@')[0];
        await db.collection('groups').doc(groupRef.id).collection('members').add({
            name: userId,
            createdAt: timestamp()
        });
        
        // 모달 닫기
        closeModal();
        
        // 그룹 목록 새로고침
        setupMainTabs();

    loadGroups();
    loadReceivedInvitations();
        
    } catch (error) {
        console.error('그룹 생성 오류:', error);
        showError(groupNameError, '그룹 생성 중 오류가 발생했습니다.');
        
        createGroupBtn.disabled = false;
        createGroupBtn.textContent = '만들기';
    }
});

// Enter 키로 그룹 생성
groupNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && selectedBranchData) {
        createGroupBtn.click();
    }
});

// ===== Foodspots UI State =====
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

function getBranchName(branchId) {
  const b = branchById?.get ? branchById.get(branchId) : null;
  return b?.name || '';
}

function setFoodspotsState(text, show) {
  const el = document.getElementById('foodspotsState');
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
  el.textContent = text || '';
}

function setFoodspotsCount(n) {
  const el = document.getElementById('foodspotsCount');
  if (!el) return;
  el.textContent = `${(n || 0).toLocaleString()}건`;
}

function applyFoodspotsViewMode() {
  const listEl = document.getElementById('foodspotsList');
  if (!listEl) return;

  listEl.classList.remove('foodspots-grid', 'foodspots-list');
  listEl.classList.add(foodspotsViewMode === 'list' ? 'foodspots-list' : 'foodspots-grid');

  const btnGrid = document.getElementById('foodspotsViewGrid');
  const btnList = document.getElementById('foodspotsViewList');
  if (btnGrid) btnGrid.classList.toggle('active', foodspotsViewMode !== 'list');
  if (btnList) btnList.classList.toggle('active', foodspotsViewMode === 'list');

  localStorage.setItem('foodspotsViewMode', foodspotsViewMode);
}

// 정렬
function sortFoodspots(items, mode) {
  const arr = [...(items || [])];
  const safeName = (x) => (x?.restaurantName || x?.name || '').toString();
  const safeBranch = (x) => getBranchName(x?.branchId || x?.branch || '');
  const safeTime = (x) => {
    const t = x?.sharedAt || x?.createdAt || x?.timestamp || null;
    if (!t) return 0;
    const d = t.toDate ? t.toDate() : new Date(t);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

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

// 검색
function filterFoodspotsBySearch(items, q) {
  const query = (q || '').trim().toLowerCase();
  if (!query) return items || [];
  return (items || []).filter(x => {
    const name = (x?.restaurantName || x?.name || '').toString().toLowerCase();
    const cat = (x?.category || '').toString().toLowerCase();
    const note = (x?.note || x?.reason || x?.comment || '').toString().toLowerCase();
    const branch = getBranchName(x?.branchId || x?.branch || '').toLowerCase();
    return name.includes(query) || cat.includes(query) || note.includes(query) || branch.includes(query);
  });
}

// 실제 렌더링(카드 UI)
function renderFoodspotsUI(itemsRaw) {
  const listEl = document.getElementById('foodspotsList');
  if (!listEl) return;

  // 컨트롤 읽기
  const qEl = document.getElementById('foodspotsSearchInput');
  const sortEl = document.getElementById('foodspotsSortSelect');
  const q = qEl ? qEl.value : '';
  const sortMode = sortEl ? sortEl.value : 'new';

  // 검색 + 정렬
  const items = sortFoodspots(filterFoodspotsBySearch(itemsRaw, q), sortMode);

  applyFoodspotsViewMode();
  setFoodspotsCount(items.length);

  if (!items.length) {
    listEl.innerHTML = '';
    setFoodspotsState('표시할 맛집이 없습니다. 상위조직/하위조직 조건을 변경하거나, 검색어를 확인해 주십시오.', true);
    return;
  }

  setFoodspotsState('', false);

  listEl.innerHTML = items.map(x => {
    const name = escapeHtml((x.restaurantName || x.name || '').toString());
    const category = escapeHtml((x.category || '').toString());
    const branchName = escapeHtml(getBranchName(x.branchId || x.branch || ''));
    const note = escapeHtml((x.note || x.reason || x.comment || '').toString());
    const who = escapeHtml((x.sharedByName || x.sharedById || x.sharedBy || '').toString());
    const dt = formatKoreanDate(x.sharedAt || x.createdAt);

    const badges = [
      branchName ? `<span class="badge badge-branch">${branchName}</span>` : '',
      category ? `<span class="badge badge-category">${category}</span>` : '',
    ].filter(Boolean).join('');

    const noteHtml = note ? `<div class="foodspot-note">${note}</div>` : '';

    return `
      <div class="foodspot-card">
        <div class="foodspot-top">
          <div class="foodspot-name">${name || '(이름 없음)'}</div>
        </div>
        <div class="foodspot-meta">
          ${badges}
        </div>
        ${noteHtml}
        <div class="foodspot-footer">
          <div>${who ? `소문낸 사람: ${who}` : ''}</div>
          <div>${dt ? `등록일: ${dt}` : ''}</div>
        </div>
      </div>
    `;
  }).join('');
}

// 컨트롤 이벤트 연결(한 번만)
(function bindFoodspotsControlsOnce() {
  const qEl = document.getElementById('foodspotsSearchInput');
  const sortEl = document.getElementById('foodspotsSortSelect');
  const btnGrid = document.getElementById('foodspotsViewGrid');
  const btnList = document.getElementById('foodspotsViewList');

  if (qEl && !qEl.dataset.bound) {
    qEl.dataset.bound = '1';
    qEl.addEventListener('input', () => {
      // 기존 필터 결과 배열을 담는 변수가 있다면 그걸 넘기면 됩니다.
      // 여기서는 window.currentFoodspotsFiltered 같은 전역을 쓰는 방식이 가장 간단합니다.
      if (window.currentFoodspotsFiltered) renderFoodspotsUI(window.currentFoodspotsFiltered);
    });
  }

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

  // 초기 모드 반영
  applyFoodspotsViewMode();
})();




