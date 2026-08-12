import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

/* Toàn bộ sổ của một người nằm trong MỘT document.
   State chỉ ~20KB, giới hạn Firestore là 1MB/doc -> đủ cho ~2.500-3.000 giao
   dịch (6-7 năm). Khi nào chạm ngưỡng thì mới cần tách txns thành subcollection.
   Dùng 1 người, không dùng cùng lúc, nên last-write-wins là chấp nhận được. */
const stateRef = () => {
  const u = auth.currentUser;
  if (!u) throw new Error('Chưa đăng nhập');
  return doc(db, 'users', u.uid, 'ledger', 'state');
};

export async function loadState() {
  if (!auth.currentUser) return null;
  const snap = await getDoc(stateRef());
  if (!snap.exists()) return null;
  return snap.data().st ?? null;
}

/* ---- ghi có debounce ----------------------------------------------------
   App.jsx ghi TOÀN BỘ state mỗi lần đổi: useEffect(...,[st]). Với localStorage
   thì miễn phí, với Firestore thì mỗi lần là một write có tính tiền. Gộp lại
   để một chuỗi thao tác nhanh chỉ tốn 1 write.

   Lỗi ghi đi qua handler đăng ký một lần, cùng kiểu với setAsk() trong
   lib/ask.js — App hiển thị bằng toast. Nếu chỉ .catch() im lặng thì mất
   mạng sẽ trông như đã lưu xong, rất tệ cho sổ chi tiêu. */
const DEBOUNCE_MS = 700;
let timer = null;
let pending = null;
let _onError = null;

export const setSaveErrorHandler = fn => { _onError = fn };

function writeNow() {
  timer = null;
  const s = pending;
  pending = null;
  if (!s || !auth.currentUser) return Promise.resolve();
  return setDoc(stateRef(), { st: s, updatedAt: serverTimestamp() })
    .catch(e => { if (_onError) _onError(e); else console.error(e); });
}

export function saveState(s) {
  pending = s;
  if (timer) clearTimeout(timer);
  timer = setTimeout(writeNow, DEBOUNCE_MS);
}

/* Gọi trước khi đóng tab / đăng xuất, nếu không thì thao tác cuối cùng nằm
   trong debounce sẽ mất. */
export function flushSave() {
  if (!timer) return Promise.resolve();
  clearTimeout(timer);
  return writeNow();
}

/* Huỷ write đang chờ. Cần khi wipe hoặc đăng xuất — không thì state cũ trong
   `pending` sẽ ghi đè lên sau khi đã xoá. */
export function cancelPendingSave() {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = null;
}

export async function wipe() {
  cancelPendingSave();
  if (!auth.currentUser) return;
  await deleteDoc(stateRef());
}
