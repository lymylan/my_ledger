import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const cfg = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const missing = Object.keys(cfg).filter(k => !cfg[k]);
if (missing.length) {
  throw new Error(
    'Thiếu biến môi trường Firebase: ' + missing.join(', ') +
    '. Copy .env.example thành .env.local rồi điền giá trị (xem README §10).'
  );
}

/* getApps() guard: fast-refresh của Next có thể evaluate module này nhiều lần,
   initializeApp lần hai sẽ throw. */
export const app = getApps().length ? getApp() : initializeApp(cfg);
export const auth = getAuth(app);

/* CHỦ Ý không bật persistentLocalCache: đã chốt server-first — Firestore là
   nguồn sự thật duy nhất, không cache offline, nên không cần cờ rev chống
   thiết bị cũ ghi đè. Đổi lại: mất mạng là không ghi được.
   Lưới an toàn là ⚙ → Download backup (.json). */
export const db = getFirestore(app);
