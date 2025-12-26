// ===== DOM 요소 =====
const logoutBtn = document.getElementById('logout-btn');
const fabBtn = document.getElementById('fab-btn');
const createFirstGroupBtn = document.getElementById('create-first-group-btn');
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const groupsContainer = document.getElementById('groups-container');
const groupsGrid = document.getElementById('groups-grid');

// 초대 알림 요소
const invitationsBtn = document.getElementById('invitations-btn');
const invitationBadge = document.getElementById('invitation-badge');
const invitationsModal = document.getElementById('invitations-modal');
const invitationsModalOverlay = document.getElementById('invitations-modal-overlay');
const invitationsModalClose = document.getElementById('invitations-modal-close');
const closeInvitationsBtn = document.getElementById('close-invitations-btn');
const invitationsList = document.getElementById('invitations-list');
const emptyInvitations = document.getElementById('empty-invitations');

// 모달 요소
const createGroupModal = document.getElementById('create-group-modal');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
const groupNameInput = document.getElementById('group-name');
const groupNameError = document.getElementById('group-name-error');
const cancelBtn = document.getElementById('cancel-btn');
const createGroupBtn = document.getElementById('create-group-btn');

// ===== 전역 변수 =====
let currentUser = null;
let pendingInvitations = [];

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
    
    // 초대 확인
    await checkInvitations();
    
    // 그룹 목록 로드
    loadGroups();
});

// ===== 초대 확인 =====
async function checkInvitations() {
    try {
        const userId = currentUser.userData?.userId || currentUser.email.split('@')[0];
        
        const snapshot = await db.collection('invitations')
            .where('toUserId', '==', userId)
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .get();
        
        pendingInvitations = [];
        snapshot.forEach(doc => {
            pendingInvitations.push({ id: doc.id, ...doc.data() });
        });
        
        // 배지 업데이트
        if (pendingInvitations.length > 0) {
            invitationBadge.textContent = pendingInvitations.length;
            invitationBadge.classList.remove('hidden');
        } else {
            invitationBadge.classList.add('hidden');
        }
    } catch (error) {
        console.error('초대 확인 오류:', error);
    }
}

// ===== 초대 목록 모달 열기 =====
invitationsBtn.addEventListener('click', () => {
    renderInvitations();
    invitationsModal.classList.remove('hidden');
});

// ===== 초대 목록 렌더링 =====
function renderInvitations() {
    invitationsList.innerHTML = '';
    
    if (pendingInvitations.length === 0) {
        emptyInvitations.classList.remove('hidden');
        return;
    }
    
    emptyInvitations.classList.add('hidden');
    
    pendingInvitations.forEach(invitation => {
        const card = createInvitationCard(invitation);
        invitationsList.appendChild(card);
    });
}

// ===== 초대 카드 생성 =====
function createInvitationCard(invitation) {
    const card = document.createElement('div');
    card.className = 'invitation-card';
    
    const createdDate = invitation.createdAt ?
        new Date(invitation.createdAt.toDate()).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : '날짜 정보 없음';
    
    card.innerHTML = `
        <div class="invitation-info">
            <h3>${escapeHtml(invitation.groupName)}</h3>
            <p>초대한 사람: ${escapeHtml(invitation.fromUserId)}</p>
            <p class="invitation-date">${createdDate}</p>
        </div>
        <div class="invitation-actions">
            <button class="btn-accept" data-id="${invitation.id}">수락</button>
            <button class="btn-reject" data-id="${invitation.id}">거절</button>
        </div>
    `;
    
    // 수락 버튼
    card.querySelector('.btn-accept').addEventListener('click', async () => {
        await acceptInvitation(invitation);
    });
    
    // 거절 버튼
    card.querySelector('.btn-reject').addEventListener('click', async () => {
        await rejectInvitation(invitation);
    });
    
    return card;
}

// ===== 초대 수락 =====
async function acceptInvitation(invitation) {
    try {
        const userId = currentUser.userData?.userId || currentUser.email.split('@')[0];
        
        // groupMembers에 추가
        await db.collection('groups').doc(invitation.groupId)
            .collection('groupMembers').doc(userId).set({
                userId: userId,
                userName: userId,
                role: 'member',
                joinedAt: timestamp(),
                invitedBy: invitation.fromUserId
            });
        
        // members에도 추가 (기존 식사 기록용)
        await db.collection('groups').doc(invitation.groupId)
            .collection('members').add({
                name: userId,
                isFrequent: true,
                createdAt: timestamp()
            });
        
        // 초대 상태 업데이트
        await db.collection('invitations').doc(invitation.id).update({
            status: 'accepted',
            respondedAt: timestamp()
        });
        
        // 초대 목록 새로고침
        await checkInvitations();
        renderInvitations();
        
        // 그룹 목록 새로고침
        await loadGroups();
        
        alert('그룹 초대를 수락했습니다!');
    } catch (error) {
        console.error('초대 수락 오류:', error);
        alert('초대 수락 중 오류가 발생했습니다.');
    }
}

// ===== 초대 거절 =====
async function rejectInvitation(invitation) {
    try {
        await db.collection('invitations').doc(invitation.id).update({
            status: 'rejected',
            respondedAt: timestamp()
        });
        
        // 초대 목록 새로고침
        await checkInvitations();
        renderInvitations();
        
        alert('그룹 초대를 거절했습니다.');
    } catch (error) {
        console.error('초대 거절 오류:', error);
        alert('초대 거절 중 오류가 발생했습니다.');
    }
}

// ===== 초대 모달 닫기 =====
function closeInvitationsModal() {
    invitationsModal.classList.add('hidden');
}

invitationsModalClose.addEventListener('click', closeInvitationsModal);
invitationsModalOverlay.addEventListener('click', closeInvitationsModal);
closeInvitationsBtn.addEventListener('click', closeInvitationsModal);

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

// ===== 그룹 목록 로드 (권한 시스템 적용) =====
async function loadGroups() {
    try {
        showLoading();
        
        const userId = currentUser.userData?.userId || currentUser.email.split('@')[0];
        const groups = [];
        
        // 1. 내가 만든 그룹
        const ownedSnapshot = await db.collection('groups')
            .where('ownerId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        ownedSnapshot.forEach(doc => {
            groups.push({ 
                id: doc.id, 
                ...doc.data(),
                myRole: 'owner'
            });
        });
        
        // 2. 내가 멤버인 그룹
        const allGroupsSnapshot = await db.collection('groups').get();
        
        for (const groupDoc of allGroupsSnapshot.docs) {
            const groupId = groupDoc.id;
            
            // 이미 owner로 추가된 그룹은 스킵
            if (groups.some(g => g.id === groupId)) continue;
            
            // groupMembers 확인
            const memberDoc = await db.collection('groups').doc(groupId)
                .collection('groupMembers').doc(userId).get();
            
            if (memberDoc.exists) {
                groups.push({
                    id: groupId,
                    ...groupDoc.data(),
                    myRole: 'member'
                });
            }
        }
        
        if (groups.length === 0) {
            showEmptyState();
            return;
        }
        
        // 그룹 카드 렌더링
        groupsGrid.innerHTML = '';
        
        groups.forEach(group => {
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

// ===== 그룹 카드 생성 (역할 배지 추가) =====
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
    
    // 역할 배지
    const roleBadge = group.myRole === 'owner' 
        ? '<span class="role-badge owner">⭐ 방장</span>'
        : '<span class="role-badge member">멤버</span>';
    
    card.innerHTML = `
        <div class="group-card-header">
            <div class="group-icon">🍱</div>
            ${roleBadge}
        </div>
        <div class="group-name">${escapeHtml(group.groupName)}</div>
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
    createGroupModal.classList.remove('hidden');
    groupNameInput.value = '';
    groupNameInput.focus();
    hideError(groupNameError);
}

function closeModal() {
    createGroupModal.classList.add('hidden');
    groupNameInput.value = '';
    hideError(groupNameError);
}

fabBtn.addEventListener('click', openModal);
createFirstGroupBtn.addEventListener('click', openModal);
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

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

// ===== 그룹 생성 (groupMembers 추가) =====
createGroupBtn.addEventListener('click', async () => {
    const groupName = groupNameInput.value.trim();
    
    if (!groupName) {
        showError(groupNameError, '그룹 이름을 입력해주세요.');
        return;
    }
    
    if (groupName.length > 30) {
        showError(groupNameError, '그룹 이름은 최대 30자까지 가능합니다.');
        return;
    }
    
    createGroupBtn.disabled = true;
    createGroupBtn.textContent = '생성 중...';
    
    try {
        const userId = currentUser.userData?.userId || currentUser.email.split('@')[0];
        
        // 그룹 생성
        const groupRef = await db.collection('groups').add({
            groupName: groupName,
            ownerId: currentUser.uid,
            createdAt: timestamp(),
            updatedAt: timestamp()
        });
        
        // groupMembers에 방장 추가
        await db.collection('groups').doc(groupRef.id)
            .collection('groupMembers').doc(userId).set({
                userId: userId,
                userName: userId,
                role: 'owner',
                joinedAt: timestamp()
            });
        
        // members에도 추가 (기존 식사 기록용)
        await db.collection('groups').doc(groupRef.id)
            .collection('members').add({
                name: userId,
                isFrequent: true,
                createdAt: timestamp()
            });
        
        closeModal();
        loadGroups();
        
    } catch (error) {
        console.error('그룹 생성 오류:', error);
        showError(groupNameError, '그룹 생성 중 오류가 발생했습니다.');
        
        createGroupBtn.disabled = false;
        createGroupBtn.textContent = '만들기';
    }
});

groupNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        createGroupBtn.click();
    }
});
