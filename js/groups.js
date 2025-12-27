// ===== DOM 요소 =====
const logoutBtn = document.getElementById('logout-btn');
const fabBtn = document.getElementById('fab-btn');

// ===== 탭/맛집 DOM =====
const tabBtnGroups = document.getElementById('tab-btn-groups');
const tabBtnFoodspots = document.getElementById('tab-btn-foodspots');
const tabContentGroups = document.getElementById('tab-content-groups');
const tabContentFoodspots = document.getElementById('tab-content-foodspots');

const foodspotsScope = document.getElementById('foodspots-scope');
const foodspotsTop1Row = document.getElementById('foodspots-top1-row');
const foodspotsTop1Select = document.getElementById('foodspots-top1');
const foodspotsBranchRow = document.getElementById('foodspots-branch-row');
const foodspotsBranchSelect = document.getElementById('foodspots-branch');
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

    // 필터 이벤트
    if (foodspotsScope) {
        foodspotsScope.addEventListener('change', () => {
            applyFoodspotsScopeUI();
            renderFoodspots();
        });
    }
    if (foodspotsTop1Select) {
        foodspotsTop1Select.addEventListener('change', renderFoodspots);
    }
    if (foodspotsBranchSelect) {
        foodspotsBranchSelect.addEventListener('change', renderFoodspots);
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

function applyFoodspotsScopeUI() {
    const scope = foodspotsScope ? foodspotsScope.value : 'all';

    if (foodspotsTop1Row) foodspotsTop1Row.classList.toggle('hidden', scope !== 'top1');
    if (foodspotsBranchRow) foodspotsBranchRow.classList.toggle('hidden', scope !== 'branch');

    // 기본 선택값 세팅
    if (scope === 'top1' && foodspotsTop1Select) {
        if (!foodspotsTop1Select.value) {
            const firstOpt = [...foodspotsTop1Select.options].find(o => o.value);
            if (firstOpt) foodspotsTop1Select.value = firstOpt.value;
        }
    }
    if (scope === 'branch' && foodspotsBranchSelect) {
        // 선택 강제하지 않음(사용자가 고를 수 있게)
    }
}

async function ensureFoodspotsLoaded() {
    if (foodspotsLoaded) {
        applyFoodspotsScopeUI();
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

        // 1뎁스 선택값 구성
        populateFoodspotsTop1Options();
        // 지점 선택값 구성
        populateFoodspotsBranchOptions();

        foodspotsLoaded = true;

        applyFoodspotsScopeUI();
        renderFoodspots();
    } catch (e) {
        console.error('맛집 목록 로드 오류:', e);
        alert('맛집 목록을 불러오는 중 오류가 발생했습니다.');
        showFoodspotsEmpty();
    }
}

function populateFoodspotsTop1Options() {
    if (!foodspotsTop1Select) return;
    // 초기화
    foodspotsTop1Select.innerHTML = '<option value="">선택</option>';

    const topSet = new Set();
    branches.forEach(b => {
        const t = getTop1NameFromPath(b.fullPath || b.name || '');
        if (t) topSet.add(t);
    });

    // sharedRestaurants에만 있는 경우도 대비
    sharedRestaurantsAll.forEach(r => {
        const t = getTop1NameFromPath(r.branchFullPath || r.branchName || '');
        if (t) topSet.add(t);
    });

    let tops = [...topSet].filter(Boolean);

    // 본점 우선 정렬
    tops.sort((a, b) => {
        if (a === '본점') return -1;
        if (b === '본점') return 1;
        return a.localeCompare(b, 'ko');
    });

    tops.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t;
        opt.textContent = t;
        foodspotsTop1Select.appendChild(opt);
    });
}

function populateFoodspotsBranchOptions() {
    if (!foodspotsBranchSelect) return;

    // 초기화
    foodspotsBranchSelect.innerHTML = '<option value="">지점을 선택하세요</option>';

    // selectable 지점 우선, 없으면 전체
    const selectable = branches.filter(b => b.selectable);
    const list = selectable.length ? selectable : branches;

    // fullPath 기준 정렬
    const sorted = [...list].sort((a, b) => {
        const aa = (a.fullPath || a.name || '');
        const bb = (b.fullPath || b.name || '');
        return aa.localeCompare(bb, 'ko');
    });

    sorted.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.fullPath || b.name;
        foodspotsBranchSelect.appendChild(opt);
    });
}

function getTop1NameFromPath(fullPath) {
    if (!fullPath) return '';
    // '본점 > 자본시장영업본부 > ...' / '본점>...' 등 대응
    const parts = fullPath.split('>').map(s => s.trim()).filter(Boolean);
    return parts[0] || '';
}

function filterFoodspotsBase() {
    const q = (foodspotsSearch?.value || '').trim().toLowerCase();
    const scope = foodspotsScope ? foodspotsScope.value : 'all';

    let list = [...sharedRestaurantsAll];

    // scope 필터
    if (scope === 'top1') {
        const top1 = foodspotsTop1Select?.value || '';
        if (top1) {
            list = list.filter(r => {
                const top = getTop1NameFromPath(r.branchFullPath || r.branchName || '');
                return top === top1;
            });
        }
    } else if (scope === 'branch') {
        const bid = foodspotsBranchSelect?.value || '';
        if (bid) {
            list = list.filter(r => r.branchId === bid);
        } else {
            // 지점이 선택되지 않았으면 안내용으로 빈 처리
            list = [];
        }
    }

    // 검색 필터
    if (q) {
        list = list.filter(r => {
            const name = (r.restaurantName || '').toLowerCase();
            const cat = (r.category || '').toLowerCase();
            const reason = (r.reason || '').toLowerCase();
            const branch = (r.branchName || '').toLowerCase();
            const groupName = (r.groupName || '').toLowerCase();
            return name.includes(q) || cat.includes(q) || reason.includes(q) || branch.includes(q) || groupName.includes(q);
        });
    }

    return list;
}

function renderFoodspots() {
    if (!foodspotsLoaded) return;

    const scope = foodspotsScope ? foodspotsScope.value : 'all';
    const list = filterFoodspotsBase();

    // 빈 화면 메시지(스코프별)
    if (foodspotsEmptyTitle && foodspotsEmptyDesc) {
        if (scope === 'branch' && !(foodspotsBranchSelect?.value || '')) {
            foodspotsEmptyTitle.textContent = '지점을 선택해주세요';
            foodspotsEmptyDesc.textContent = '지점별로 공유된 맛집을 확인할 수 있습니다.';
        } else {
            foodspotsEmptyTitle.textContent = '공유된 맛집이 없어요';
            foodspotsEmptyDesc.textContent = '음식점 관리에서 ‘소문내기’를 체크하면 여기에 표시됩니다.';
        }
    }

    // 스코프별 안내
    if (foodspotsSummary) {
        let text = '';
        if (scope === 'all') text = `전체 공유 맛집 ${list.length.toLocaleString()}건`;
        if (scope === 'top1') text = `1뎁스 필터 기준 ${list.length.toLocaleString()}건`;
        if (scope === 'branch') text = `지점 필터 기준 ${list.length.toLocaleString()}건`;
        foodspotsSummary.textContent = text;
    }

    if (!list.length) {
        showFoodspotsEmpty();
        return;
    }

    showFoodspotsContainer();

    // 지점별로 묶어서 렌더
    const map = new Map();
    list.forEach(r => {
        const key = r.branchName || '(지점 미상)';
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(r);
    });

    const keys = [...map.keys()].sort((a, b) => a.localeCompare(b, 'ko'));
    foodspotsList.innerHTML = '';

    keys.forEach(branchName => {
        const arr = map.get(branchName) || [];
        const section = document.createElement('div');
        section.className = 'foodspots-section';

        const title = document.createElement('div');
        title.className = 'foodspots-section-title';
        title.innerHTML = `<span>${escapeHtml(branchName)}</span><span class="count">${arr.length.toLocaleString()}건</span>`;
        section.appendChild(title);

        arr.forEach(r => {
            const item = document.createElement('div');
            item.className = 'foodspot-item';

            const dt = (r.sharedAt && r.sharedAt.toDate) ? r.sharedAt.toDate() : null;
            const dateText = dt ? formatDate(dt) : '';

            item.innerHTML = `
                <div class="foodspot-top">
                    <div>
                        <div class="foodspot-name">${escapeHtml(r.restaurantName || '')}</div>
                        <div class="foodspot-meta">
                            ${r.category ? `<span class="badge">${escapeHtml(r.category)}</span>` : ''}
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
    try {
        const snapshot = await db.collection('branches')
            .orderBy('fullPath')
            .get();
        
        branches = [];
        snapshot.forEach(doc => {
            branches.push({ id: doc.id, ...doc.data() });
        });
        
        console.log(`✅ 지점 목록 로드 완료: ${branches.length}개`);
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


