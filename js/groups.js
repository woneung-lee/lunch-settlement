// ===== DOM 요소 =====
const logoutBtn = document.getElementById('logout-btn');
const fabBtn = document.getElementById('fab-btn');
const createFirstGroupBtn = document.getElementById('create-first-group-btn');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const groupsContainer = document.getElementById('groups-container');
const groupsGrid = document.getElementById('groups-grid');

// 받은 초대
const invitationsSection = document.getElementById('invitations-section');
const invitationsList = document.getElementById('invitations-list');
const invitationCount = document.getElementById('invitation-count');
const noGroupsMessage = document.getElementById('no-groups-message');

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
    
    // 대시보드(초대함 + 그룹 목록) 로드
    loadGroups();
});

// ===== 지점 목록 로드 =====
async function loadBranches() {
    try {
        // 2개 이상 orderBy는 복합 인덱스가 필요할 수 있으므로, 1차 조회 후 클라이언트 정렬
        const snapshot = await db.collection('branches')
            .orderBy('level')
            .get();
        
        branches = [];
        snapshot.forEach(doc => branches.push({ id: doc.id, ...doc.data() }));

        // 동일 level 내에서는 이름순 정렬
        branches.sort((a, b) => {
            const la = a.level ?? 0;
            const lb = b.level ?? 0;
            if (la !== lb) return la - lb;
            return String(a.name || '').localeCompare(String(b.name || ''), 'ko');
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

// ===== 대시보드 로드(초대함 + 그룹 목록) =====
async function loadGroups() {
    try {
        showLoading();
        const [invites, groups] = await Promise.all([
            fetchPendingInvitations(),
            fetchMyGroups()
        ]);

        renderInvitations(invites);
        renderGroups(groups);

        if (invites.length === 0 && groups.length === 0) {
            showEmptyState();
            return;
        }

        showGroupsList();
    } catch (error) {
        console.error('대시보드 로드 오류:', error);
        alert('데이터를 불러오는 중 오류가 발생했습니다.');
        showEmptyState();
    }
}

// ===== 받은 초대 로드 =====
async function fetchPendingInvitations() {
    try {
        // (복합 인덱스 요구를 피하기 위해) invitedUserId만 조건으로 조회 후 status는 클라이언트에서 필터
        const snapshot = await db.collection('groupInvitations')
            .where('invitedUserId', '==', currentUser.uid)
            .get();

        const invites = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
            .filter(i => i.status === 'pending');

        invites.sort((a, b) => {
            const at = a.createdAt?.toMillis?.() || 0;
            const bt = b.createdAt?.toMillis?.() || 0;
            return bt - at;
        });

        return invites;
    } catch (e) {
        console.error('받은 초대 로드 오류:', e);
        return [];
    }
}

// ===== 내 그룹 로드(방장/멤버 모두) =====
async function fetchMyGroups() {
    const uid = currentUser.uid;

    const myMembershipByGroupId = new Map();

    // 1) groupMembers(컬렉션그룹)에서 내 멤버십 조회
    try {
        const memberSnap = await db.collectionGroup('groupMembers')
            .where(firebase.firestore.FieldPath.documentId(), '==', uid)
            .get();

        memberSnap.forEach(doc => {
            const groupId = doc.ref.parent.parent.id; // groups/{groupId}/groupMembers/{uid}
            myMembershipByGroupId.set(groupId, { uid, ...(doc.data() || {}) });
        });
    } catch (e) {
        console.warn('groupMembers 컬렉션그룹 조회 실패(환경/권한에 따라 다를 수 있음):', e);
    }

    // 2) 과거 데이터 호환: ownerId 기반으로 생성된 그룹(멤버십 미생성)을 보완
    try {
        const ownedSnap = await db.collection('groups').where('ownerId', '==', uid).get();
        const ownerUserId = currentUser.userData?.userId || (currentUser.email || '').split('@')[0];

        const fixPromises = [];
        ownedSnap.forEach(g => {
            const gid = g.id;
            if (!myMembershipByGroupId.has(gid)) {
                // owner 멤버십 자동 생성(권한/설정 페이지 진입을 위해)
                const memberRef = db.collection('groups').doc(gid).collection('groupMembers').doc(uid);
                fixPromises.push(
                    memberRef.set({
                        role: 'owner',
                        userId: ownerUserId,
                        email: currentUser.email || '',
                        joinedAt: timestamp(),
                        updatedAt: timestamp()
                    }, { merge: true })
                    .then(() => myMembershipByGroupId.set(gid, { role: 'owner', userId: ownerUserId, email: currentUser.email || '' }))
                    .catch(() => {})
                );
            }
        });
        if (fixPromises.length) await Promise.all(fixPromises);
    } catch (e) {
        console.error('ownerId 기반 그룹 보완 조회 오류:', e);
    }

    const groupIds = Array.from(myMembershipByGroupId.keys());
    if (groupIds.length === 0) return [];

    // 3) 그룹 문서 로드
    const groupDocs = await Promise.all(
        groupIds.map(id => db.collection('groups').doc(id).get().catch(() => null))
    );

    const groups = [];
    for (const doc of groupDocs) {
        if (!doc || !doc.exists) continue;
        const data = doc.data() || {};
        const membership = myMembershipByGroupId.get(doc.id) || {};
        groups.push({
            id: doc.id,
            ...data,
            myRole: membership.role || 'member'
        });
    }

    groups.sort((a, b) => {
        const at = a.createdAt?.toMillis?.() || 0;
        const bt = b.createdAt?.toMillis?.() || 0;
        return bt - at;
    });

    return groups;
}

// ===== 받은 초대 렌더링 =====
function renderInvitations(invites) {
    if (!invitationsSection || !invitationsList) return;

    invitationsList.innerHTML = '';

    if (!invites || invites.length === 0) {
        invitationsSection.classList.add('hidden');
        if (invitationCount) invitationCount.classList.add('hidden');
        return;
    }

    invitationsSection.classList.remove('hidden');

    if (invitationCount) {
        invitationCount.textContent = String(invites.length);
        invitationCount.classList.remove('hidden');
    }

    invites.forEach(invite => {
        invitationsList.appendChild(createInviteCard(invite));
    });
}

function createInviteCard(invite) {
    const card = document.createElement('div');
    card.className = 'invite-card';

    const groupName = invite.groupName || '그룹';
    const inviter = invite.inviterName || '방장';
    const created = invite.createdAt ? new Date(invite.createdAt.toDate()).toLocaleDateString('ko-KR') : '';

    card.innerHTML = `
        <div class="invite-info">
            <div class="invite-group-name">${escapeHtml(groupName)}</div>
            <div class="invite-meta">
                <span>초대자: ${escapeHtml(inviter)}</span>
                ${created ? `<span>• ${created}</span>` : ''}
            </div>
        </div>
        <div class="invite-actions">
            <button class="btn-invite btn-invite-accept">수락</button>
            <button class="btn-invite btn-invite-decline">거절</button>
        </div>
    `;

    const acceptBtn = card.querySelector('.btn-invite-accept');
    const declineBtn = card.querySelector('.btn-invite-decline');

    acceptBtn.addEventListener('click', () => acceptInvitation(invite, acceptBtn, declineBtn));
    declineBtn.addEventListener('click', () => declineInvitation(invite, acceptBtn, declineBtn));

    return card;
}

// ===== 초대 수락/거절 =====
async function acceptInvitation(invite, acceptBtn, declineBtn) {
    if (!confirm(`"${invite.groupName || '그룹'}" 초대를 수락하시겠습니까?`)) return;

    acceptBtn.disabled = true;
    declineBtn.disabled = true;
    acceptBtn.textContent = '처리 중...';

    try {
        const invRef = db.collection('groupInvitations').doc(invite.id);
        const groupRef = db.collection('groups').doc(invite.groupId);
        const memberRef = groupRef.collection('groupMembers').doc(currentUser.uid);

        const myUserId = currentUser.userData?.userId || (currentUser.email || '').split('@')[0];

        await db.runTransaction(async (tx) => {
            const invSnap = await tx.get(invRef);
            if (!invSnap.exists) throw new Error('초대장이 존재하지 않습니다.');

            const invData = invSnap.data() || {};
            if (invData.invitedUserId !== currentUser.uid) throw new Error('초대 대상이 아닙니다.');
            if (invData.status !== 'pending') throw new Error('이미 처리된 초대장입니다.');

            const groupSnap = await tx.get(groupRef);
            if (!groupSnap.exists) throw new Error('그룹이 존재하지 않습니다.');

            const memberSnap = await tx.get(memberRef);
            if (!memberSnap.exists) {
                tx.set(memberRef, {
                    role: 'member',
                    userId: myUserId,
                    email: currentUser.email || '',
                    joinedAt: timestamp(),
                    updatedAt: timestamp()
                }, { merge: true });
            }

            tx.update(invRef, { status: 'accepted', respondedAt: timestamp() });
        });

        alert('초대를 수락했습니다.');
        await loadGroups();
    } catch (e) {
        console.error('초대 수락 오류:', e);
        alert('초대 수락 중 오류가 발생했습니다.');
        acceptBtn.disabled = false;
        declineBtn.disabled = false;
        acceptBtn.textContent = '수락';
    }
}

async function declineInvitation(invite, acceptBtn, declineBtn) {
    if (!confirm(`"${invite.groupName || '그룹'}" 초대를 거절하시겠습니까?`)) return;

    acceptBtn.disabled = true;
    declineBtn.disabled = true;
    declineBtn.textContent = '처리 중...';

    try {
        const invRef = db.collection('groupInvitations').doc(invite.id);

        await db.runTransaction(async (tx) => {
            const invSnap = await tx.get(invRef);
            if (!invSnap.exists) throw new Error('초대장이 존재하지 않습니다.');

            const invData = invSnap.data() || {};
            if (invData.invitedUserId !== currentUser.uid) throw new Error('초대 대상이 아닙니다.');
            if (invData.status !== 'pending') throw new Error('이미 처리된 초대장입니다.');

            tx.update(invRef, { status: 'declined', respondedAt: timestamp() });
        });

        alert('초대를 거절했습니다.');
        await loadGroups();
    } catch (e) {
        console.error('초대 거절 오류:', e);
        alert('초대 거절 중 오류가 발생했습니다.');
        acceptBtn.disabled = false;
        declineBtn.disabled = false;
        declineBtn.textContent = '거절';
    }
}

// ===== 그룹 목록 렌더링 =====
function renderGroups(groups) {
    groupsGrid.innerHTML = '';

    if (!groups || groups.length === 0) {
        if (noGroupsMessage) noGroupsMessage.classList.remove('hidden');
        return;
    }

    if (noGroupsMessage) noGroupsMessage.classList.add('hidden');

    groups.forEach(group => {
        const card = createGroupCard(group);
        groupsGrid.appendChild(card);
    });
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

        // 방 멤버십(권한) 생성: 방장은 owner
        // settings.html 등에서 그룹 접근 권한은 groupMembers 기준으로 판단함
        const ownerUserId = currentUser.userData?.userId || currentUser.email.split('@')[0];
        await db.collection('groups').doc(groupRef.id)
            .collection('groupMembers')
            .doc(currentUser.uid)
            .set({
                role: 'owner',
                userId: ownerUserId,
                email: currentUser.email,
                joinedAt: timestamp(),
                updatedAt: timestamp()
            });
        
        // 총무를 그룹원으로 자동 추가
        const userId = ownerUserId;
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


