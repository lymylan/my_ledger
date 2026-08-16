import {
  collection, doc, getDoc, getDocs, query, where, writeBatch, runTransaction,
  deleteDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { normalizeTxn } from './state';

/* ---- bố cục dữ liệu ------------------------------------------------------

     users/{uid}/ledger/state   { st: <state KHÔNG có txns>, rev, txnsV, updatedAt }
     users/{uid}/ledger/meta    { accounts, jars, tags }        ~700 byte
     users/{uid}/txns/{txnId}   một giao dịch = một document

   Trước đây TOÀN BỘ sổ nằm trong `ledger/state`, kể cả mảng txns. Ba lý do phải
   tách ra, xếp theo mức độ nguy hiểm:

     1. setDoc ghi đè cả document. Chỉ cần có writer thứ hai (thiết bị khác, hay
        API ngoài ghi vào sổ) là giao dịch bị nuốt im lặng — không lỗi, không
        cảnh báo. Mỗi txn một document thì hai writer chạm hai document khác
        nhau, không đè nhau được.
     2. Write amplification. Thêm một ly cà phê 25k phải upload lại cả sổ.
     3. Giới hạn 1 MiB/document. Đo thật: 94 byte/txn + ~1.08 KB mỗi tháng cho
        plans/openings/closes -> trần khoảng 9.000-10.000 giao dịch. Sau khi tách,
        phần còn lại chỉ tăng ~1.08 KB/tháng, tức khoảng 75 năm.

   `ledger/meta` là bản chiếu (projection) của accounts/jars/tags — thứ mà một
   client ngoài cần để cho người dùng chọn category. Đọc nó tốn ~700 byte thay vì
   kéo cả sổ về. Ghi CÙNG transaction với state nên không bao giờ lệch nhau. */

const uidOf = () => {
  const u = auth.currentUser;
  if (!u) throw new Error('Chưa đăng nhập');
  return u.uid;
};
const stateRef = () => doc(db, 'users', uidOf(), 'ledger', 'state');
const metaRef  = () => doc(db, 'users', uidOf(), 'ledger', 'meta');
const txnsCol  = () => collection(db, 'users', uidOf(), 'txns');
const txnRef   = id => doc(db, 'users', uidOf(), 'txns', id);

/* writeBatch tối đa 500 thao tác. Chừa biên. */
const BATCH = 450;

/* Firestore không tự bỏ cuộc khi mạng treo — nó cứ retry. Không có mốc dừng thì
   app mắc ở màn Loading vô thời hạn mà người dùng không biết vì sao. */
const LOAD_TIMEOUT_MS = 12000;

function withTimeout(p, ms) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(
      Object.assign(new Error('Took too long to reach the server.'), { code: 'app/timeout' })
    ), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

const stripTxns = s => { const o = { ...s }; delete o.txns; return o };
const projectMeta = s => ({
  accounts: s.accounts || [], jars: s.jars || [], tags: s.tags || [],
});

/* id là TÊN document, không lặp lại thành field bên trong. */
const toDoc = t => { const o = normalizeTxn(t); delete o.id; return o };
const fromDoc = d => ({ id: d.id, ...d.data() });

/* ---- trạng thái phiên ---------------------------------------------------- */

/* `rev` là số phiên bản của ledger/state, tăng mỗi lần ghi. Ghi luôn đi qua
   runTransaction và so rev client với rev server; lệch nghĩa là nơi khác đã sửa
   -> huỷ ghi thay vì đè lên. Đây là thứ chặn kịch bản: hai tab cùng mở, tab cũ
   sửa một thứ nhỏ và ghi đè mọi thay đổi của tab kia. */
let rev = null;

/* JSON của lần ghi thành công gần nhất. Dùng để BỎ QUA write không có gì đổi.
   Quan trọng hơn vẻ ngoài: App gọi saveState mỗi lần `st` đổi, mà `st` đổi cả
   khi chỉ nạp txns của tháng khác. Không có chốt này thì mỗi lần bấm mũi tên
   chuyển tháng là một lần ghi lại toàn bộ state, và mỗi lần mở app cũng vậy. */
let lastSaved = null;
let lastMeta = null;

/* Đã phát hiện xung đột rev -> ngừng ghi hẳn. Ghi tiếp bằng dữ liệu trong bộ nhớ
   chính là hành vi làm mất dữ liệu mà rev sinh ra để chặn. */
let stale = false;

const DEBOUNCE_MS = 700;
let timer = null;
let pending = null;
let pendingJson = null;
let _onError = null;
let _onStale = null;

export const setSaveErrorHandler = fn => { _onError = fn };
export const setStaleHandler = fn => { _onStale = fn };

function remember(base) {
  lastSaved = JSON.stringify(base);
  lastMeta = JSON.stringify(projectMeta(base));
}

/* Đặt lại toàn bộ trạng thái phiên. Gọi khi đăng xuất / đổi tài khoản — nếu
   không thì rev và lastSaved của người trước sẽ áp lên người sau. */
export function resetSession() {
  cancelPendingSave();
  rev = null; lastSaved = null; lastMeta = null; stale = false;
}

/* ---- đọc ----------------------------------------------------------------- */

export async function loadState() {
  if (!auth.currentUser) return null;
  const snap = await withTimeout(getDoc(stateRef()), LOAD_TIMEOUT_MS);
  stale = false;
  if (!snap.exists()) { rev = 0; lastSaved = null; lastMeta = null; return null }

  const data = snap.data();
  rev = data.rev || 0;
  const raw = data.st ?? null;
  if (!raw) { lastSaved = null; lastMeta = null; return null }

  /* Sổ bản cũ: txns còn nằm trong state. Chuyển sang subcollection ngay tại đây,
     một lần duy nhất. */
  if (Array.isArray(raw.txns) && raw.txns.length) {
    return await migrateTxnsOut(raw);
  }
  const base = stripTxns(raw);
  remember(base);
  return base;
}

/* Giao dịch của một tháng. Query theo khoảng `date` — chuỗi ISO so sánh từ điển
   đúng thứ tự thời gian, và đây là điều kiện trên MỘT field nên Firestore tự
   đánh index, không cần khai composite index.

   Cận trên là '-99' chứ không phải '-31': nếu có bản ghi cũ nào ngày không đệm 0
   ("2026-08-9"), so sánh chuỗi sẽ cho '2026-08-9' > '2026-08-31' và giao dịch đó
   biến mất khỏi tháng. '-99' phủ hết mà không thể lọt sang tháng khác, vì tiền
   tố "YYYY-MM-" đã quyết định thứ tự trước khi tới phần ngày. */
export async function loadMonthTxns(ym) {
  if (!auth.currentUser) return [];
  const q = query(txnsCol(), where('date', '>=', ym + '-01'), where('date', '<=', ym + '-99'));
  const snap = await withTimeout(getDocs(q), LOAD_TIMEOUT_MS);
  return snap.docs.map(fromDoc).map(normalizeTxn);
}

export async function getTxn(id) {
  if (!id || !auth.currentUser) return null;
  const snap = await getDoc(txnRef(id));
  return snap.exists() ? normalizeTxn(fromDoc(snap)) : null;
}

/* Đọc TOÀN BỘ giao dịch. Tốn N document read nên chỉ dùng cho Download backup —
   một thao tác thủ công, thỉnh thoảng mới chạy. Không gọi trong luồng render. */
export async function loadAllTxns() {
  if (!auth.currentUser) return [];
  const snap = await getDocs(query(txnsCol()));
  return snap.docs.map(fromDoc).map(normalizeTxn)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/* ---- ghi giao dịch ------------------------------------------------------- */

const guard = () => {
  if (stale) throw Object.assign(new Error('Ledger changed elsewhere.'), { code: 'app/stale' });
};

export async function putTxn(t) {
  guard();
  await setDoc(txnRef(t.id), toDoc(t));
}

export async function putTxns(list) {
  guard();
  for (let i = 0; i < list.length; i += BATCH) {
    const b = writeBatch(db);
    list.slice(i, i + BATCH).forEach(t => b.set(txnRef(t.id), toDoc(t)));
    await b.commit();
  }
}

export async function deleteTxn(id) {
  guard();
  await deleteDoc(txnRef(id));
}

export async function deleteTxns(ids) {
  guard();
  const list = ids.filter(Boolean);
  for (let i = 0; i < list.length; i += BATCH) {
    const b = writeBatch(db);
    list.slice(i, i + BATCH).forEach(id => b.delete(txnRef(id)));
    await b.commit();
  }
}

/* Xoá một tag khỏi MỌI giao dịch, kể cả tháng không hiển thị. Trước đây là
   d.txns.forEach trên mảng trong bộ nhớ; giờ phải hỏi server vì bộ nhớ chỉ giữ
   tháng đang xem. array-contains là điều kiện một field -> index tự động. */
export async function stripTagFromTxns(tagId) {
  guard();
  const snap = await getDocs(query(txnsCol(), where('tagIds', 'array-contains', tagId)));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH) {
    const b = writeBatch(db);
    docs.slice(i, i + BATCH).forEach(d => {
      b.update(d.ref, { tagIds: (d.data().tagIds || []).filter(x => x !== tagId) });
    });
    await b.commit();
  }
  return docs.length;
}

/* ---- ghi state ----------------------------------------------------------

   App ghi TOÀN BỘ state mỗi lần đổi: useEffect(...,[st]). Gộp lại bằng debounce
   để một chuỗi thao tác nhanh chỉ tốn 1 write.

   Lỗi ghi đi qua handler đăng ký một lần, cùng kiểu với setAsk() trong
   lib/ask.js — App hiển thị bằng toast. Nếu chỉ .catch() im lặng thì mất mạng
   sẽ trông như đã lưu xong, rất tệ cho sổ chi tiêu. */

async function commitState(base, metaJson) {
  let newRev;
  await runTransaction(db, async trx => {
    const snap = await trx.get(stateRef());          // đọc trước, ghi sau — bắt buộc
    const serverRev = snap.exists() ? (snap.data().rev || 0) : 0;
    if (rev !== null && serverRev !== rev) {
      throw Object.assign(new Error('Ledger changed elsewhere.'), { code: 'app/stale' });
    }
    newRev = serverRev + 1;
    trx.set(stateRef(), { st: base, rev: newRev, txnsV: 2, updatedAt: serverTimestamp() });
    if (metaJson !== lastMeta) {
      trx.set(metaRef(), { ...projectMeta(base), updatedAt: serverTimestamp() });
    }
  });
  rev = newRev;
  lastMeta = metaJson;
}

async function writeNow() {
  timer = null;
  const base = pending, json = pendingJson;
  pending = null; pendingJson = null;
  if (!base || !auth.currentUser || stale) return;
  try {
    await commitState(base, JSON.stringify(projectMeta(base)));
    lastSaved = json;
  } catch (e) {
    if (e && e.code === 'app/stale') {
      stale = true;
      if (_onStale) _onStale(); else console.error(e);
      return;
    }
    if (_onError) _onError(e); else console.error(e);
  }
}

export function saveState(s) {
  if (stale) return;
  const base = stripTxns(s);
  const json = JSON.stringify(base);
  if (json === lastSaved) return;      // không có gì đổi -> không ghi
  pending = base; pendingJson = json;
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
  pendingJson = null;
}

/* ---- migration / backup / wipe ------------------------------------------- */

/* Thứ tự ở đây là chỗ dễ mất dữ liệu nhất trong cả file, ĐỪNG ĐẢO:
     1. ghi txns ra subcollection
     2. mới gỡ txns khỏi ledger/state
   Nếu bước 1 hỏng giữa chừng thì hàm ném lỗi trước khi tới bước 2, state cũ còn
   nguyên, lần load sau chạy lại. Ghi lại cùng txnId là idempotent nên chạy lại
   không sinh bản trùng. Đảo thứ tự thì một lỗi mạng là mất sạch giao dịch. */
async function migrateTxnsOut(raw) {
  const list = (raw.txns || []).map(normalizeTxn);
  for (let i = 0; i < list.length; i += BATCH) {
    const b = writeBatch(db);
    list.slice(i, i + BATCH).forEach(t => b.set(txnRef(t.id), toDoc(t)));
    await b.commit();
  }
  const base = stripTxns(raw);
  await commitState(base, JSON.stringify(projectMeta(base)));
  lastSaved = JSON.stringify(base);
  return base;
}

async function deleteAllTxns() {
  const snap = await getDocs(query(txnsCol()));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH) {
    const b = writeBatch(db);
    docs.slice(i, i + BATCH).forEach(d => b.delete(d.ref));
    await b.commit();
  }
}

/* Restore từ file backup: thay thế, không trộn. Xoá giao dịch cũ trước, nếu
   không thì những giao dịch đã xoá từ lâu sẽ sống lại lẫn vào bản khôi phục. */
export async function restoreAll(next) {
  cancelPendingSave();
  stale = false;
  const txns = (next.txns || []).map(normalizeTxn);
  await deleteAllTxns();
  await putTxns(txns);
  const base = stripTxns(next);
  await commitState(base, JSON.stringify(projectMeta(base)));
  lastSaved = JSON.stringify(base);
  return base;
}

export async function wipe() {
  cancelPendingSave();
  if (!auth.currentUser) return;
  await deleteAllTxns();
  await deleteDoc(metaRef()).catch(() => {});
  await deleteDoc(stateRef());
  rev = 0; lastSaved = null; lastMeta = null; stale = false;
}

/* ---- lỗi ----------------------------------------------------------------- */

/* Một chỗ duy nhất dịch lỗi Firestore sang câu người đọc được — dùng cho cả
   màn báo lỗi khi load và toast khi ghi hỏng. */
export function readableStoreError(e) {
  const code = (e && e.code) || '';
  const msg = (e && e.message) || '';
  if (code === 'app/timeout') return 'Took too long to reach the server. Check your connection.';
  if (code === 'app/stale') return 'Your ledger was changed somewhere else. Reload to continue.';
  if (code === 'permission-denied') return 'Permission denied for this account.';
  /* Chạm trần 1 MiB của một document. Sau khi tách txns thì gần như không xảy ra
     nữa, nhưng nếu có thì message gốc của Firebase hoàn toàn không đọc được. */
  if (code === 'invalid-argument' && /longer than|exceeds|size/i.test(msg)) {
    return 'This ledger got too large to save in one piece. Download a backup and get in touch.';
  }
  if (/offline|unavailable|network/i.test(code + msg)) return 'You appear to be offline.';
  return msg || 'Unknown error.';
}
