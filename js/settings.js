// ===== 전역 변수 =====
let currentUser = null;
let groupId = null;
let groupData = null;
let myRole = null;

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

// 그룹 정보
const groupNameDisplay = document.getElementById('group-name-display');
const groupCreatedDate = document.getElementById('group-created-date');
const totalMembers = document.getElementById('total-members');
const totalRestaurants = document.getElementById('total-restaurants');
const totalMeals = document.getElementById('total-meals');

// 계정 정보
const userIdDisplay = document.getElementById('user-id');
const userCreatedDate = document.getElementById('user-created-date');

// 버튼
const editGroupNameBtn = document.getElementById('edit-group-name-btn');
const deleteGroupBtn = document.getElementById('delete-group-btn');
const logoutBtn = document.getElementById('logout-btn');
const inviteMemberBtn = document.getElementById('invite-member-btn');
const viewInvitesBtn = document.getElementById('view-invites-btn');
const transferOwnerSelect = document.getElementById('transfer-owner-select');
const transferOwnerBtn = document.getElementById('transfer-owner-btn');


// 그룹명 수정 모달
const editModal = document.getElementById('edit-modal');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
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
const emptySentInvitations = document.getElementById('empty-sent-invitations');
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
            // 구버전 데이터 보정: ownerId는 방장으로 자동 등록
            if (groupData?.ownerId && groupData.ownerId === currentUser.uid) {
                await db.collection('groups').doc(groupId)
                    .collection('groupMembers').doc(currentUser.uid)
                    .set({
                        userId: currentUser.uid,
                        role: 'owner',
                        groupId: groupId,
                        joinedAt: timestamp()
                    }, { merge: true });
                myRole = 'owner';
            } else {
                alert('그룹에 접근 권한이 없습니다.');
                window.location.href = 'groups.html';
                return;
            }
        }
// 그룹원 수 카운트
        const membersSnapshot = await db.collection('groups').doc(groupId)
            .collection('groupMembers').get();
        
        // 음식점 수 카운트
        const restaurantsSnapshot = await db.collection('groups').doc(groupId)
            .collection('restaurants').get();
        
        // 식사 기록 수 카운트
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
        
        groupMembers = [];
        snapshot.forEach(doc => {
            groupMembers.push({ id: doc.id, ...doc.data() });
        });
        
        renderGroupMembers();
        
    } catch (error) {
        console.error('멤버 목록 로드 오류:', error);
    }
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
    
    // 방장 권한 체크 - 위험 영역(그룹 삭제)은 방장에게만 표시
    const dangerZone = document.getElementById('danger-zone');
const memberManagement = document.getElementById('member-management');
    if (myRole === 'owner') {
        dangerZone.classList.remove('hidden');
        if (memberManagement) memberManagement.classList.remove('hidden');
    } else {
        dangerZone.classList.add('hidden');
        if (memberManagement) memberManagement.classList.add('hidden');
    }
}


// ===== 방장 위임 후보 로드(방장 전용) =====
async function loadTransferOwnerCandidates() {
    if (!transferOwnerSelect) return;
    transferOwnerSelect.innerHTML = '';

    if (myRole !== 'owner') return;

    try {
        const snap = await db.collection('groups').doc(groupId).collection('groupMembers').get();

        const memberUids = [];
        snap.forEach(doc => {
            if (doc.id && doc.id !== currentUser.uid) memberUids.push(doc.id);
        });

        if (memberUids.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = '위임할 멤버가 없습니다';
            transferOwnerSelect.appendChild(opt);
            transferOwnerSelect.disabled = true;
            if (transferOwnerBtn) transferOwnerBtn.disabled = true;
            return;
        }

        // 표시용 아이디(userId) 조회
        const userDocs = await Promise.all(memberUids.map(uid => db.collection('users').doc(uid).get()));
        const items = userDocs.map((d, i) => {
            const uid = memberUids[i];
            const accountId = d.exists ? (d.data().userId || uid) : uid;
            return { uid, accountId };
        });

        items.sort((a,b)=> String(a.accountId).localeCompare(String(b.accountId)));

        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '멤버를 선택하세요';
        transferOwnerSelect.appendChild(placeholder);

        items.forEach(it => {
            const opt = document.createElement('option');
            opt.value = it.uid;
            opt.textContent = it.accountId;
            transferOwnerSelect.appendChild(opt);
        });

        transferOwnerSelect.disabled = false;
        if (transferOwnerBtn) transferOwnerBtn.disabled = false;
    } catch (e) {
        console.error('방장 위임 후보 로드 오류:', e);
    }
}

async function transferOwnerTo(newOwnerUid) {
    if (myRole !== 'owner') {
        alert('방장만 위임할 수 있습니다.');
        return;
    }
    if (!newOwnerUid) {
        alert('위임할 멤버를 선택해 주세요.');
        return;
    }

    const ok = confirm('선택한 멤버에게 방장 권한을 위임하시겠습니까?\n위임 후 본인은 멤버로 변경됩니다.');
    if (!ok) return;

    try {
        // 그룹 문서 ownerId 변경
        await db.collection('groups').doc(groupId).update({
            ownerId: newOwnerUid,
            updatedAt: timestamp()
        });

        // 권한 업데이트
        await db.collection('groups').doc(groupId).collection('groupMembers').doc(newOwnerUid).set({
            userId: newOwnerUid,
            role: 'owner',
            groupId: groupId
        }, { merge: true });

        await db.collection('groups').doc(groupId).collection('groupMembers').doc(currentUser.uid).set({
            userId: currentUser.uid,
            role: 'member',
            groupId: groupId
        }, { merge: true });

        alert('방장 위임이 완료되었습니다.');
        // 내 역할 갱신
        myRole = 'member';
        await loadTransferOwnerCandidates();
    } catch (e) {
        console.error('방장 위임 오류:', e);
        alert('방장 위임 중 오류가 발생했습니다.');
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
    
    if (!userId) {
        showError(inviteError, '아이디를 입력해주세요.');
        return;
    }
    
    sendInviteBtn.disabled = true;
    sendInviteBtn.textContent = '발송 중...';
    
    try {
        // 사용자 존재 확인
        const usersSnapshot = await db.collection('users')
            .where('userId', '==', userId)
            .get();
        
        if (usersSnapshot.empty) {
            showError(inviteError, '존재하지 않는 사용자입니다.');
            sendInviteBtn.disabled = false;
            sendInviteBtn.textContent = '초대 발송';
            return;
        }
        
        const targetUserDoc = usersSnapshot.docs[0];
        const targetUserId = targetUserDoc.id;
        
        // 이미 그룹 멤버인지 확인
        const memberDoc = await db.collection('groups').doc(groupId)
            .collection('groupMembers').doc(targetUserId).get();
        
        if (memberDoc.exists) {
            showError(inviteError, '이미 그룹에 참여 중인 사용자입니다.');
            sendInviteBtn.disabled = false;
            sendInviteBtn.textContent = '초대 발송';
            return;
        }
        
        // 이미 초대한 사용자인지 확인
        const existingInvite = await db.collection('groupInvitations')
            .where('groupId', '==', groupId)
            .where('invitedUserId', '==', targetUserId)
            .where('status', '==', 'pending')
            .get();
        
        if (!existingInvite.empty) {
            showError(inviteError, '이미 초대한 사용자입니다.');
            sendInviteBtn.disabled = false;
            sendInviteBtn.textContent = '초대 발송';
            return;
        }
        
        // 초대 생성
        await db.collection('groupInvitations').add({
            groupId: groupId,
            groupName: groupData.groupName,
            inviterId: currentUser.uid,
            inviterName: currentUser.email.split('@')[0],
            invitedUserId: targetUserId,
            invitedUserName: userId,
            status: 'pending',
            createdAt: timestamp()
        });
        
        alert('초대를 발송했습니다.');
        closeInviteModal();
        
    } catch (error) {
        console.error('초대 발송 오류:', error);
        showError(inviteError, '초대 발송 중 오류가 발생했습니다.');
    } finally {
        sendInviteBtn.disabled = false;
        sendInviteBtn.textContent = '초대 발송';
    }
});

// ===== 초대 현황 모달 열기 =====
viewInvitesBtn.addEventListener('click', async () => {
    inviteStatusModal.classList.remove('hidden');
    await loadSentInvitations();
});

// 방장 위임(방장 전용)
if (transferOwnerBtn) {
    transferOwnerBtn.addEventListener('click', async () => {
        const newOwnerUid = transferOwnerSelect ? transferOwnerSelect.value : '';
        await transferOwnerTo(newOwnerUid);
    });
}

// ===== 초대 현황 모달 닫기 =====
function closeInviteStatusModal() {
    inviteStatusModal.classList.add('hidden');
}

statusModalClose.addEventListener('click', closeInviteStatusModal);
statusModalOverlay.addEventListener('click', closeInviteStatusModal);
statusCloseBtn.addEventListener('click', closeInviteStatusModal);

// ===== 보낸 초대 목록 로드 =====
async function loadSentInvitations() {
    try {
        const snapshot = await db.collection('groupInvitations')
            .where('groupId', '==', groupId)
            .orderBy('createdAt', 'desc')
            .get();
        
        inviteStatusList.innerHTML = '';
        
        if (snapshot.empty) {
            emptySentInvitations.classList.remove('hidden');
            return;
        }
        
        emptySentInvitations.classList.add('hidden');
        
        snapshot.forEach(doc => {
            const invite = { id: doc.id, ...doc.data() };
            const item = createInvitationItem(invite);
            inviteStatusList.appendChild(item);
        });
        
    } catch (error) {
        console.error('초대 목록 로드 오류:', error);
        alert('초대 목록을 불러오는 중 오류가 발생했습니다.');
    }
}

// ===== 초대 아이템 생성 =====
function createInvitationItem(invite) {
    const item = document.createElement('div');
    item.className = 'invitation-item';
    
    const statusText = invite.status === 'pending' ? '대기 중' : 
                      invite.status === 'accepted' ? '수락됨' : '거절됨';
    const statusClass = invite.status === 'pending' ? 'pending' :
                       invite.status === 'accepted' ? 'accepted' : 'rejected';
    
    const createdDate = invite.createdAt ? 
        new Date(invite.createdAt.toDate()).toLocaleDateString('ko-KR') : '';
    
    item.innerHTML = `
        <div class="invitation-info">
            <div class="invitation-user">${escapeHtml(invite.invitedUserName)}</div>
            <div class="invitation-date">${createdDate}</div>
        </div>
        <div class="invitation-status ${statusClass}">${statusText}</div>
    `;
    
    if (invite.status === 'pending') {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn-cancel-invite';
        cancelBtn.textContent = '취소';
        cancelBtn.addEventListener('click', () => cancelInvitation(invite.id));
        item.appendChild(cancelBtn);
    }
    
    return item;
}

// ===== 초대 취소 =====
async function cancelInvitation(inviteId) {
    if (!confirm('초대를 취소하시겠습니까?')) {
        return;
    }
    
    try {
        await db.collection('groupInvitations').doc(inviteId).delete();
        await loadSentInvitations();
    } catch (error) {
        console.error('초대 취소 오류:', error);
        alert('초대 취소 중 오류가 발생했습니다.');
    }
}

// ===== HTML 이스케이프 =====
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===== 상태 표시 함수들 =====
function showLoading() {
    loadingState.classList.remove('hidden');
    settingsContainer.classList.add('hidden');
}

function showSettings() {
    loadingState.classList.add('hidden');
    settingsContainer.classList.remove('hidden');
}

// ===== 그룹명 수정 모달 열기 =====
editGroupNameBtn.addEventListener('click', () => {
    newGroupNameInput.value = groupData.groupName;
    editModal.classList.remove('hidden');
    newGroupNameInput.focus();
    hideError(nameError);
});

// ===== 그룹명 수정 모달 닫기 =====
function closeEditModal() {
    editModal.classList.add('hidden');
}

modalClose.addEventListener('click', closeEditModal);
modalOverlay.addEventListener('click', closeEditModal);
cancelBtn.addEventListener('click', closeEditModal);

// ===== 에러 메시지 표시/숨김 =====
function showError(element, message) {
    element.textContent = message;
    element.classList.add('show');
}

function hideError(element) {
    element.textContent = '';
    element.classList.remove('show');
}

// ===== 그룹명 저장 =====
saveNameBtn.addEventListener('click', async () => {
    hideError(nameError);
    
    const newName = newGroupNameInput.value.trim();
    
    // 유효성 검사
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
        
        saveNameBtn.disabled = false;
        saveNameBtn.textContent = '저장';
    }
});

// ===== Enter 키로 저장 =====
newGroupNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        saveNameBtn.click();
    }
});

// ===== 그룹 삭제 모달 열기 =====
deleteGroupBtn.addEventListener('click', () => {
    groupNameConfirm.textContent = groupData.groupName;
    deleteConfirmInput.value = '';
    deleteModal.classList.remove('hidden');
    deleteConfirmInput.focus();
    hideError(deleteError);
});

// ===== 그룹 삭제 모달 닫기 =====
function closeDeleteModal() {
    deleteModal.classList.add('hidden');
}

deleteModalClose.addEventListener('click', closeDeleteModal);
deleteModalOverlay.addEventListener('click', closeDeleteModal);
deleteCancelBtn.addEventListener('click', closeDeleteModal);

// ===== 그룹 삭제 확인 =====
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
    
    // 🆕 공유 맛집 삭제 (sharedRestaurants 컬렉션에서)
    const sharedRestaurantsSnapshot = await db.collection('sharedRestaurants')
        .where('groupId', '==', groupId)
        .get();
    sharedRestaurantsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    
    // 그룹 삭제
    batch.delete(db.collection('groups').doc(groupId));
    
    await batch.commit();
        
        alert('그룹이 삭제되었습니다.');
        window.location.href = 'groups.html';
        
    } catch (error) {
        console.error('그룹 삭제 오류:', error);
        showError(deleteError, '삭제 중 오류가 발생했습니다.');
        
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.textContent = '삭제';
    }
});

// ===== 로그아웃 =====
logoutBtn.addEventListener('click', async () => {
    if (!confirm('로그아웃 하시겠습니까?')) {
        return;
    }
    
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
        if (!editModal.classList.contains('hidden')) {
            closeEditModal();
        }
        if (!deleteModal.classList.contains('hidden')) {
            closeDeleteModal();
        }
    }
});

// ===== 뒤로 가기 =====
backBtn.addEventListener('click', () => {
    window.location.href = `home.html?groupId=${groupId}`;
});


