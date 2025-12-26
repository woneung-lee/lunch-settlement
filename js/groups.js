// ===== DOM 요소 =====
const logoutBtn = document.getElementById('logout-btn');
const fabBtn = document.getElementById('fab-btn');
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
    loadGroups();
});

// ===== 지점 목록 로드 =====
async function loadBranches() {
    try {
        const snapshot = await db.collection('branches')
            .orderBy('level')
            .orderBy('name')
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
        
        const snapshot = await db.collection('groups')
            .where('ownerId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            showEmptyState();
            return;
        }
        
        groupsGrid.innerHTML = '';
        
        snapshot.forEach(doc => {
            const group = { id: doc.id, ...doc.data() };
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
        
        // 총무를 그룹원으로 자동 추가
        const userId = currentUser.userData?.userId || currentUser.email.split('@')[0];
        await db.collection('groups').doc(groupRef.id).collection('members').add({
            name: userId,
            createdAt: timestamp()
        });
        
        // 모달 닫기
        closeModal();
        
        // 그룹 목록 새로고침
        loadGroups();
        
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
