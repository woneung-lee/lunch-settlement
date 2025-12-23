// ===== 전역 변수 =====
let currentUser = null;
let groupId = null;
let groupData = null;

// ===== DOM 요소 =====
const backBtn = document.getElementById('back-btn');
const loadingState = document.getElementById('loading-state');
const settingsContainer = document.getElementById('settings-container');

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

// 그룹명 수정 모달
const editModal = document.getElementById('edit-modal');
const modalOverlay = document.getElementById('modal-overlay');
const modalClose = document.getElementById('modal-close');
const newGroupNameInput = document.getElementById('new-group-name');
const nameError = document.getElementById('name-error');
const cancelBtn = document.getElementById('cancel-btn');
const saveNameBtn = document.getElementById('save-name-btn');

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
        
        // 그룹원 수 카운트
        const membersSnapshot = await db.collection('groups').doc(groupId)
            .collection('members').get();
        
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
        // 서브컬렉션 삭제 (members, restaurants, meals)
        const batch = db.batch();
        
        // members 삭제
        const membersSnapshot = await db.collection('groups').doc(groupId)
            .collection('members').get();
        membersSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // restaurants 삭제
        const restaurantsSnapshot = await db.collection('groups').doc(groupId)
            .collection('restaurants').get();
        restaurantsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // meals 삭제
        const mealsSnapshot = await db.collection('groups').doc(groupId)
            .collection('meals').get();
        mealsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        
        // 그룹 문서 삭제
        batch.delete(db.collection('groups').doc(groupId));
        
        // 일괄 삭제 실행
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
