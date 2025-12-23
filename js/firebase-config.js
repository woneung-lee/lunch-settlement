// Firebase 설정
// Firebase Console에서 프로젝트를 만들고 아래 값을 채워주세요.
// https://console.firebase.google.com/

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);

// Firebase 서비스 초기화
const auth = firebase.auth();
const db = firebase.firestore();

// Firestore 타임스탬프 헬퍼
const timestamp = firebase.firestore.FieldValue.serverTimestamp;
const Timestamp = firebase.firestore.Timestamp;

console.log('Firebase initialized successfully');
