# 🍱 점심 정산 웹앱

총무를 위한 간편한 점심 관리 서비스

## 📋 기술 스택

- **Frontend**: HTML, CSS, JavaScript
- **Backend**: Firebase (Authentication, Firestore)
- **배포**: Vercel
- **버전 관리**: GitHub

## 🚀 시작하기

### 1. Firebase 프로젝트 설정

1. [Firebase Console](https://console.firebase.google.com/)에 접속
2. **새 프로젝트 만들기** 클릭
3. 프로젝트 이름 입력 (예: lunch-settlement)
4. Google Analytics는 선택사항 (필요없으면 비활성화)
5. 프로젝트 생성 완료

### 2. Firebase Authentication 설정

1. Firebase Console에서 좌측 메뉴 **Authentication** 클릭
2. **시작하기** 버튼 클릭
3. **Sign-in method** 탭 선택
4. **이메일/비밀번호** 활성화
   - 첫 번째 옵션(이메일/비밀번호)만 활성화
   - 이메일 링크는 비활성화 상태 유지
5. **저장** 클릭

### 3. Firestore Database 설정

1. Firebase Console에서 좌측 메뉴 **Firestore Database** 클릭
2. **데이터베이스 만들기** 버튼 클릭
3. **프로덕션 모드로 시작** 선택
4. 위치는 `asia-northeast3 (Seoul)` 선택 (한국 서버)
5. **사용 설정** 클릭
6. **규칙** 탭으로 이동하여 다음 규칙 설정:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 인증된 사용자만 접근 가능
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

7. **게시** 버튼 클릭

### 4. Firebase 설정 값 가져오기

1. Firebase Console 홈에서 **웹 앱 추가** (</> 아이콘) 클릭
2. 앱 닉네임 입력 (예: lunch-settlement-web)
3. Firebase Hosting은 체크하지 않음 (Vercel 사용)
4. **앱 등록** 클릭
5. SDK 설정 코드가 나타남 - 이 값들을 복사

### 5. 프로젝트에 Firebase 설정 적용

`js/firebase-config.js` 파일을 열어서 Firebase Console에서 받은 값으로 수정:

```javascript
const firebaseConfig = {
    apiKey: "여기에_복사한_값",
    authDomain: "여기에_복사한_값",
    projectId: "여기에_복사한_값",
    storageBucket: "여기에_복사한_값",
    messagingSenderId: "여기에_복사한_값",
    appId: "여기에_복사한_값"
};
```

### 6. GitHub에 코드 업로드

```bash
git init
git add .
git commit -m "Initial commit: 1단계 완료"
git branch -M main
git remote add origin https://github.com/사용자명/저장소명.git
git push -u origin main
```

### 7. Vercel 배포

1. [Vercel](https://vercel.com)에 로그인 (GitHub 계정으로 로그인 권장)
2. **Add New** → **Project** 클릭
3. GitHub 저장소 선택
4. **Import** 클릭
5. 프로젝트 설정:
   - Framework Preset: **Other**
   - Root Directory: `./` (기본값)
   - Build Command: (비워둠)
   - Output Directory: `./` (기본값)
6. **Deploy** 클릭
7. 배포 완료! 생성된 URL로 접속 가능

## 📁 프로젝트 구조

```
lunch-settlement/
├── index.html              # 로그인/회원가입 페이지
├── groups.html             # 그룹 목록 페이지 (2단계)
├── home.html               # 캘린더 홈 페이지 (2단계)
├── css/
│   └── style.css           # 메인 스타일시트
├── js/
│   ├── firebase-config.js  # Firebase 설정
│   └── auth.js             # 인증 로직
├── vercel.json             # Vercel 배포 설정
├── .gitignore              # Git 무시 파일 목록
└── README.md               # 프로젝트 문서
```

## ✅ 1단계 완료 체크리스트

- [x] 기본 프로젝트 구조 생성
- [x] 도시락 감성 디자인 시스템 구축
- [x] 로그인/회원가입 페이지 UI
- [x] Firebase 설정 파일 준비
- [x] 회원가입/로그인 로직 구현
- [x] Vercel 배포 설정
- [ ] Firebase 프로젝트 생성 및 설정
- [ ] GitHub 업로드
- [ ] Vercel 배포

## 🔜 다음 단계

2단계에서는 그룹 목록 페이지를 만들 예정입니다.

## 📞 문제 해결

### Firebase 설정 오류
- `firebase-config.js`의 설정값이 정확한지 확인
- Firebase Console에서 Authentication과 Firestore가 활성화되어 있는지 확인

### 로그인/회원가입 오류
- 브라우저 콘솔(F12)에서 에러 메시지 확인
- Firebase Authentication 규칙이 올바른지 확인

### Vercel 배포 오류
- GitHub 저장소가 public인지 확인
- `vercel.json` 파일이 저장소에 포함되어 있는지 확인
