// ===== 전역 변수 =====
let currentUser = null;
let groupId = null;
let groupData = null;
let myRole = null; // 'owner' 또는 'member'

// ===== DOM 요소 =====
const backBtn = document.getElementById('back-btn');
const loadingState = document.getElementById('loading-state');
const settingsContainer = document.getElementById('settings-container');

// 하단 네비게이션
const navHome = document.getElementById('nav-home');
const navMembers = document.getElementById('nav-members');
const navRestaurants = document.getElementById('nav-restaurants');
const navRoulette = document.getElementById('nav-roulette');
const navStats = document.getElementById('nav-stats');
const navSettings = document.getElementById('nav-settings');

// 멤버 관리
const groupMembersList = document.getElementById('group-members-list');
const inviteMemberBtn = document.getElementById('invite-member-btn');
const inviteStatusBtn = document.getElementById('invite-status-btn');

// 그룹 정보
const groupNameDisplay = document.getElementById('group-name-display');
const groupCreatedDate = document.getElementById('group-created-date');
const totalMembers = document.getElementById('total-members');
const totalRestaurants = document.getElementById('total-restaurants');
const totalMeals = document.getElementById('total-meals');

// 계정 정보
const userIdDisplay = document.getElementById('user-id');
const userCreatedDate = document.getElementById('user-created-date');

// 위험 영역
const dangerZone = document.getElementById('danger-zone');
const deleteGroupBtn = document.getElementById('delete-group-btn');
const logoutBtn = document.getElementById('logout-btn');

// 그룹명 수정 모달
const editModal = document.getElementById('edit-modal');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
const editGroupNameBtn = document.getElementById('edit-group-name-btn');
const newGroupNameInput = document.getElementById('new-group-name');
const nameError = document.getElementById('name-error');
const cancelBtn = document.getElementById('cancel-btn');
const saveNameBtn = document.getElementById('save-name-btn');

// 멤버 초대 모달
const inviteModal = document.getElementById('invite-modal');
const inviteModalOverlay = document.getElementById('invite-modal-overlay');
const inviteModalClose = document.getElementById('invite-modal-close');
const inviteUserIdInput = document.getElementById('invite-user-id');
const inviteError = document.getElementById('invite-error');
const inviteCancelBtn = document.getElementById('invite-cancel-btn');
const sendInviteBtn = document.getElementById('send-invite-btn');

// 초대 현황 모달
const inviteStatusModal = document.getElementById('invite-status-modal');
const statusModalOverlay = document.getElementById('status-modal-overlay');
const statusModalClose = document.getElementById('status-modal-close');
const inviteStatusList = document.getElementById('invite-status-list');
const statusCloseBtn = document.getElementById('status-close-btn');

// 삭제 확인 모달
const deleteModal = document.getElementById('delete-modal');
const deleteModalOverlay = document.getElementById('delete-modal-overlay');
const deleteModalClose = document.getElementById('delete-modal-close');
const groupNameConfirm = document.getElementById('group-name-confirm');
const deleteConfirmInput = document.getElementById('delete-confirm-input');
const deleteError = document.getElementById('delete-error');
const deleteCancelBtn = document.getElementById('delete-cancel-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

// ===== URL에서 groupId 가져오기 =====
const urlParams = new URLSearchParams(window.location.search);
groupId = urlParams.get('groupId');

if (!groupId) {
    alert('그룹 정보가 없습니다.');
    window.location.href = 'groups.html';
}

// 하단 네비게이션
if (navHome) navHome.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `home.html?groupId=${groupId}`;
});
if (navMembers) navMembers.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `members.html?groupId=${groupId}`;
});
if (navRestaurants) navRestaurants.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `restaurants.html?groupId=${groupId}`;
});
if (navRoulette) navRoulette.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `roulette.html?groupId=${groupId}`;
});
if (navStats) navStats.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = `stats.html?groupId=${groupId}`;
});
if (navSettings) navSettings.addEventListener('click', (e) => e.preventDefault());

// ===== 인증 상태 확인 =====
auth.onAuthStateChanged(async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = user;
    await loadSettings();
});

// ===== 설정 로드 =====
async function loadSettings() {
    try {
        showLoading();
        
        // 그룹 정보 로드
        const groupDoc = await db.collection('groups').doc(groupId).get();
        
        if (!groupDoc.exists) {
            alert('그룹을 찾을 수 없습니다.');
            window.location.href = 'groups.html';
            return;
        }
        
        groupData = { id: groupDoc.id, ...groupDoc.data() };
        
        // 내 권한 확인
        const memberDoc = await db.collection('groups').doc(groupId)
            .collection('groupMembers').doc(currentUser.uid).get();
        
        if (memberDoc.exists) {
            myRole = memberDoc.data().role;
        } else {
            myRole = 'none';
        }
        
        // 권한에 따른 UI 표시
        if (myRole === 'owner') {
            dangerZone.classList.remove('hidden');
            editGroupNameBtn.classList.remove('hidden');
        } else {
            dangerZone.classList.add('hidden');
            editGroupNameBtn.classList.add('hidden');
        }
        
        // 멤버 목록 로드
        await loadGroupMembers();
        
        // 통계 정보 로드
        const membersSnapshot = await db.collection('groups').doc(groupId)
            .collection('members').get();
        const restaurantsSnapshot = await db.collection('groups').doc(groupId)
            .collection('restaurants').get();
        const mealsSnapshot = await db.collection('groups').doc(groupId)
            .collection('meals').get();
        
        // 사용자 정보 로드
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        
        // UI 업데이트
        renderSettings(groupData, userData, {
            membersCount: membersSnapshot.size,
            restaurantsCount: restaurantsSnapshot.size,
            mealsCount: mealsSnapshot.size
        });
        
        showSettings();
        
    } catch (error) {
        console.error('설정 로드 오류:', error);
        alert('설정을 불러오는 중 오류가 발생했습니다.');
    }
}

// ===== 멤버 목록 로드 =====
async function loadGroupMembers() {
    try {
        const snapshot = await db.collection('groups').doc(groupId)
            .collection('groupMembers')
            .orderBy('joinedAt', 'desc')
            .get();
        
        groupMembersList.innerHTML = '';
        
        if (snapshot.empty) {
            groupMembersList.innerHTML = '<div class="no-members">멤버가 없습니다</div>';
            return;
        }
        
        snapshot.forEach(doc => {
            const member = { uid: doc.id, ...doc.data() };
            const memberCard = createMemberCard(member);
            groupMembersList.appendChild(memberCard);
        });
        
    } catch (error) {
        console.error('멤버 목록 로드 오류:', error);
    }
}

// ===== 멤버 카드 생성 =====
function createMemberCard(member) {
    const card = document.createElement('div');
    card.className = 'member-card';
    
    const roleBadge = member.role === 'owner' 
        ? '<span class="member-role owner">⭐ 방장</span>'
        : '<span class="member-role member">멤버</span>';
    
    const joinedDate = member.joinedAt ? 
        new Date(member.joinedAt.toDate()).toLocaleDateString('ko-KR') : '-';
    
    card.innerHTML = `
        <div class="member-info">
            <div class="member-name">${escapeHtml(member.userName)}</div>
            ${roleBadge}
        </div>
        <div class="member-joined">가입: ${joinedDate}</div>
    `;
    
    return card;
}

// ===== HTML 이스케이프 =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== 설정 렌더링 =====
function renderSettings(group, user, counts) {
    // 그룹 정보
    groupNameDisplay.textContent = group.groupName;
    
    if (group.createdAt) {
        groupCreatedDate.textContent = new Date(group.createdAt.toDate()).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    
    totalMembers.textContent = `${counts.membersCount}명`;
    totalRestaurants.textContent = `${counts.restaurantsCount}곳`;
    totalMeals.textContent = `${counts.mealsCount}회`;
    
    // 계정 정보
    const emailParts = currentUser.email.split('@');
    userIdDisplay.textContent = emailParts[0];
    
    if (user && user.createdAt) {
        userCreatedDate.textContent = new Date(user.createdAt.toDate()).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
}

// ===== 멤버 초대 모달 열기 =====
inviteMemberBtn.addEventListener('click', () => {
    inviteUserIdInput.value = '';
    hideError(inviteError);
    inviteModal.classList.remove('hidden');
    inviteUserIdInput.focus();
});

// ===== 멤버 초대 모달 닫기 =====
function closeInviteModal() {
    inviteModal.classList.add('hidden');
}

inviteModalClose.addEventListener('click', closeInviteModal);
inviteModalOverlay.addEventListener('click', closeInviteModal);
inviteCancelBtn.addEventListener('click', closeInviteModal);

// ===== 멤버 초대 발송 =====
sendInviteBtn.addEventListener('click', async () => {
    hideError(inviteError);
    
    const userId = inviteUserIdInput.value.trim();
    
    // 유효성 검사
    if (!userId) {
        showError(inviteError, '초대할 사용자 아이디를 입력해주세요.');
        return;
    }
    
    if (!/^[a-z0-9_-]{5,20}$/.test(userId)) {
        showError(inviteError, '유효하지 않은 아이디 형식입니다.');
        return;
    }
    
    sendInviteBtn.disabled = true;
    sendInviteBtn.textContent = '초대 보내는 중...';
    
    try {
        // 사용자 존재 여부 확인
        const usersSnapshot = await db.collection('users')
            .where('userId', '==', userId)
            .get();
        
        if (usersSnapshot.empty) {
            showError(inviteError, '존재하지 않는 사용자입니다.');
            sendInviteBtn.disabled = false;
            sendInviteBtn.textContent = '초대 보내기';
            return;
        }
        
        const targetUser = usersSnapshot.docs[0];
        const targetUid = targetUser.id;
        
        // 이미 그룹 멤버인지 확인
        const memberDoc = await db.collection('groups').doc(groupId)
            .collection('groupMembers').doc(targetUid).get();
        
        if (memberDoc.exists) {
            showError(inviteError, '이미 그룹 멤버입니다.');
            sendInviteBtn.disabled = false;
            sendInviteBtn.textContent = '초대 보내기';
            return;
        }
        
        // 이미 초대 발송했는지 확인 (대기중 상태)
        const existingInvite = await db.collection('invitations')
            .where('groupId', '==', groupId)
            .where('toUserId', '==', userId)
            .where('status', '==', 'pending')
            .get();
        
        if (!existingInvite.empty) {
            showError(inviteError, '이미 초대를 보냈습니다.');
            sendInviteBtn.disabled = false;
            sendInviteBtn.textContent = '초대 보내기';
            return;
        }
        
        // 초대 생성
        const myUserId = currentUser.userData?.userId || currentUser.email.split('@')[0];
        
        await db.collection('invitations').add({
            groupId: groupId,
            groupName: groupData.groupName,
            toUserId: userId,
            toUid: targetUid,
            fromUserId: myUserId,
            fromUid: currentUser.uid,
            status: 'pending',
            createdAt: timestamp()
        });
        
        alert(`${userId}님에게 초대를 보냈습니다!`);
        closeInviteModal();
        
    } catch (error) {
        console.error('초대 발송 오류:', error);
        showError(inviteError, '초대 발송 중 오류가 발생했습니다.');
    } finally {
        sendInviteBtn.disabled = false;
        sendInviteBtn.textContent = '초대 보내기';
    }
});

// ===== 초대 현황 보기 =====
inviteStatusBtn.addEventListener('click', async () => {
    try {
        inviteStatusList.innerHTML = '<div class="loading">불러오는 중...</div>';
        inviteStatusModal.classList.remove('hidden');
        
        // 내가 보낸 초대 목록
        const snapshot = await db.collection('invitations')
            .where('groupId', '==', groupId)
            .where('fromUid', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        inviteStatusList.innerHTML = '';
        
        if (snapshot.empty) {
            inviteStatusList.innerHTML = '<div class="no-invites">보낸 초대가 없습니다</div>';
            return;
        }
        
        snapshot.forEach(doc => {
            const invite = { id: doc.id, ...doc.data() };
            const inviteCard = createInviteStatusCard(invite);
            inviteStatusList.appendChild(inviteCard);
        });
        
    } catch (error) {
        console.error('초대 현황 로드 오류:', error);
        inviteStatusList.innerHTML = '<div class="error">불러오기 실패</div>';
    }
});

// ===== 초대 현황 카드 생성 =====
function createInviteStatusCard(invite) {
    const card = document.createElement('div');
    card.className = 'invite-status-card';
    
    let statusBadge = '';
    let statusClass = '';
    let actionBtn = '';
    
    switch (invite.status) {
        case 'pending':
            statusBadge = '<span class="status-badge pending">⏳ 대기중</span>';
            statusClass = 'pending';
            actionBtn = `<button class="btn-cancel-invite" onclick="cancelInvite('${invite.id}')">취소</button>`;
            break;
        case 'accepted':
            statusBadge = '<span class="status-badge accepted">✅ 수락</span>';
            statusClass = 'accepted';
            break;
        case 'rejected':
            statusBadge = '<span class="status-badge rejected">❌ 거절</span>';
            statusClass = 'rejected';
            break;
    }
    
    const createdDate = invite.createdAt ? 
        new Date(invite.createdAt.toDate()).toLocaleDateString('ko-KR') : '-';
    
    card.className = `invite-status-card ${statusClass}`;
    card.innerHTML = `
        <div class="invite-status-header">
            <div class="invite-to">${escapeHtml(invite.toUserId)}</div>
            ${statusBadge}
        </div>
        <div class="invite-date">발송일: ${createdDate}</div>
        ${actionBtn}
    `;
    
    return card;
}

// ===== 초대 취소 =====
window.cancelInvite = async function(inviteId) {
    if (!confirm('초대를 취소하시겠습니까?')) return;
    
    try {
        await db.collection('invitations').doc(inviteId).delete();
        // 현황 모달 닫고 다시 열기 (새로고침)
        closeInviteStatusModal();
        setTimeout(() => inviteStatusBtn.click(), 300);
    } catch (error) {
        console.error('초대 취소 오류:', error);
        alert('취소 중 오류가 발생했습니다.');
    }
};

// ===== 초대 현황 모달 닫기 =====
function closeInviteStatusModal() {
    inviteStatusModal.classList.add('hidden');
}

statusModalClose.addEventListener('click', closeInviteStatusModal);
statusModalOverlay.addEventListener('click', closeInviteStatusModal);
statusCloseBtn.addEventListener('click', closeInviteStatusModal);

// ===== 상태 표시 함수들 =====
function showLoading() {
    loadingState.classList.remove('hidden');
    settingsContainer.classList.add('hidden');
}

function showSettings() {
    loadingState.classList.add('hidden');
    settingsContainer.classList.remove('hidden');
}

// ===== 에러 메시지 표시/숨김 =====
function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
}

function hideError(element) {
    element.textContent = '';
    element.classList.remove('show');
}

// ===== 그룹명 수정 (방장만) =====
if (editGroupNameBtn) {
    editGroupNameBtn.addEventListener('click', () => {
        if (myRole !== 'owner') {
            alert('방장만 수정할 수 있습니다.');
            return;
        }
        newGroupNameInput.value = groupData.groupName;
        editModal.classList.remove('hidden');
        newGroupNameInput.focus();
        hideError(nameError);
    });
}

function closeEditModal() {
    editModal.classList.add('hidden');
}

modalClose.addEventListener('click', closeEditModal);
modalOverlay.addEventListener('click', closeEditModal);
cancelBtn.addEventListener('click', closeEditModal);

saveNameBtn.addEventListener('click', async () => {
    hideError(nameError);
    
    const newName = newGroupNameInput.value.trim();
    
    if (!newName) {
        showError(nameError, '그룹명을 입력해주세요.');
        return;
    }
    
    if (newName.length > 30) {
        showError(nameError, '그룹명은 최대 30자까지 가능합니다.');
        return;
    }
    
    if (newName === groupData.groupName) {
        closeEditModal();
        return;
    }
    
    saveNameBtn.disabled = true;
    saveNameBtn.textContent = '저장 중...';
    
    try {
        await db.collection('groups').doc(groupId).update({
            groupName: newName,
            updatedAt: timestamp()
        });
        
        groupData.groupName = newName;
        groupNameDisplay.textContent = newName;
        
        closeEditModal();
        
    } catch (error) {
        console.error('그룹명 수정 오류:', error);
        showError(nameError, '저장 중 오류가 발생했습니다.');
    } finally {
        saveNameBtn.disabled = false;
        saveNameBtn.textContent = '저장';
    }
});

newGroupNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        saveNameBtn.click();
    }
});

// ===== 그룹 삭제 (방장만) =====
if (deleteGroupBtn) {
    deleteGroupBtn.addEventListener('click', () => {
        if (myRole !== 'owner') {
            alert('방장만 삭제할 수 있습니다.');
            return;
        }
        groupNameConfirm.textContent = groupData.groupName;
        deleteConfirmInput.value = '';
        deleteModal.classList.remove('hidden');
        deleteConfirmInput.focus();
        hideError(deleteError);
    });
}

function closeDeleteModal() {
    deleteModal.classList.add('hidden');
}

deleteModalClose.addEventListener('click', closeDeleteModal);
deleteModalOverlay.addEventListener('click', closeDeleteModal);
deleteCancelBtn.addEventListener('click', closeDeleteModal);

confirmDeleteBtn.addEventListener('click', async () => {
    hideError(deleteError);
    
    const confirmName = deleteConfirmInput.value.trim();
    
    if (confirmName !== groupData.groupName) {
        showError(deleteError, '그룹명이 일치하지 않습니다.');
        return;
    }
    
    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = '삭제 중...';
    
    try {
        const batch = db.batch();
        
        // 서브컬렉션 삭제
        const collectionsToDelete = ['members', 'restaurants', 'meals', 'groupMembers'];
        
        for (const collectionName of collectionsToDelete) {
            const snapshot = await db.collection('groups').doc(groupId)
                .collection(collectionName).get();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
        }
        
        // 그룹 삭제
        batch.delete(db.collection('groups').doc(groupId));
        
        await batch.commit();
        
        // 관련 초대 삭제
        const invitesSnapshot = await db.collection('invitations')
            .where('groupId', '==', groupId)
            .get();
        
        const inviteBatch = db.batch();
        invitesSnapshot.forEach(doc => {
            inviteBatch.delete(doc.ref);
        });
        await inviteBatch.commit();
        
        alert('그룹이 삭제되었습니다.');
        window.location.href = 'groups.html';
        
    } catch (error) {
        console.error('그룹 삭제 오류:', error);
        showError(deleteError, '삭제 중 오류가 발생했습니다.');
    } finally {
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = '삭제';
    }
});

// ===== 로그아웃 =====
logoutBtn.addEventListener('click', async () => {
    if (!confirm('로그아웃 하시겠습니까?')) return;
    
    try {
        await auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('로그아웃 오류:', error);
        alert('로그아웃 중 오류가 발생했습니다.');
    }
});

// ===== ESC 키로 모달 닫기 =====
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!editModal.classList.contains('hidden')) closeEditModal();
        if (!deleteModal.classList.contains('hidden')) closeDeleteModal();
        if (!inviteModal.classList.contains('hidden')) closeInviteModal();
        if (!inviteStatusModal.classList.contains('hidden')) closeInviteStatusModal();
    }
});

// ===== 뒤로 가기 =====
backBtn.addEventListener('click', () => {
    window.location.href = `home.html?groupId=${groupId}`;
});
