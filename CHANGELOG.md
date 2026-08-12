# Nhật ký phát triển

Ghi lại các bước lặp chính và **lý do** đằng sau mỗi thay đổi, để người tiếp quản
không lặp lại những ngã rẽ đã bị loại bỏ.

## Giai đoạn 1 — Dựng khung

- Dựng 6 module: checklist, trả góp, jars, log giao dịch, report, calendar
- Thuật ngữ ban đầu: **"lọ"** → sau đổi thành **Category**
- Tên app: Lọ → Sổ → **Ledger**
- UI ban đầu tiếng Việt → dịch **toàn bộ sang tiếng Anh** (~200 chuỗi)

## Giai đoạn 2 — Sửa hệ thống thị giác

| Vấn đề | Cách sửa |
|---|---|
| Card summary trên cùng bị bug (thanh đầy 100% nhưng ghi "Đã dùng 0%") | Bỏ hẳn card |
| Progress bar quá mạnh, phá vỡ nhóm parent-child | 8px → 4px, bỏ viền, bỏ 3 vạch chia, thụt lề 30px |
| Parent row bị chìm | Thử band xám → **sai hướng** (xám = lùi). Đổi sang weight + chiều cao dòng + đường kẻ đậm |
| Icon tài khoản không rõ màu | Tint 8% → **fill đặc, glyph trắng** |
| Nút "Add account" nhìn như disabled | Bug specificity: `.sec-h .sub` (0-2-0) đè `.lnk` (0-1-0) |

## Giai đoạn 3 — Sửa lỗi logic

| Bug | Nguyên nhân |
|---|---|
| Không xoá được tag (và 8 hành động xoá khác) | `window.confirm()` bị chặn trong iframe sandbox, luôn trả `false` |
| Input mất focus mỗi ký tự | Component `AllocLine` định nghĩa trong thân `CloseMonth` → remount mỗi render |
| Tổng start tháng mới lệch 38.5tr | Số dư kết chuyển bị đếm 2 lần trong pool phân bổ |

## Giai đoạn 4 — Tái cấu trúc quy trình

- **Plan** từ "kế hoạch theo tháng có nút Apply" → **template cấu hình thuần**
  (bỏ Apply / Undo / Save as template / checkbox / trạng thái theo tháng)
- Việc nạp tiền vào lọ giờ **chỉ xảy ra ở một chỗ**: wizard chốt sổ
- Thêm **Close month wizard** 3 bước
- Bước Allocate: template chỉ prepopulate, thêm **custom split lines**
- Item nhóm Debt **link được với Installment**, tự điền số tiền/tên/category
- Thêm **Loans** (khoản cho vay) — có sinh giao dịch, khác Installments

## Giai đoạn 5 — Sắp xếp lại điều hướng

| | Trước | Sau |
|---|---|---|
| Tab 5 | Plan (segmented: checklist + installments) | **Installments** |
| Plan template | Tab 5 | **⚙ Settings → level 2** |
| Nút chốt sổ | Đầu tab Plan | **Đầu tab Categories** |
| Calendar | Toggle Month/Week + bottom sheet | **Kiểu Apple Calendar**, danh sách inline, bỏ view Week |
| Category detail | Bottom sheet | **Page level 2** |

## Giai đoạn 6 — Chuyển sang Next.js

Lý do: muốn tích hợp Firebase, mà Firebase SDK v9+ là ESM — `<script type="text/babel">`
không dùng được `import`. Nên build step không còn là tuỳ chọn.

**Vite hay Next.js?** Ban đầu nghiêng Vite: toàn bộ cây render nằm sau
`if(!st) return Loading…` nên SSR không render được gì. Nhưng đổi sang Next.js khi
biết app sẽ có tính năng cần server — **bất kỳ API nào có secret key đều không thể
gọi từ client**. Chi phí thật của Next.js hoá ra rất nhỏ: đúng **một** dòng
`'use client'` ở `app/page.tsx`, vì trong App Router đó là ranh giới, mọi thứ import
xuống dưới tự vào client bundle.

| Việc | Cách làm |
|---|---|
| Tách 1928 dòng JSX → 17 module | Cắt bằng script theo dòng tuyệt đối, **không gõ lại tay**. Script tự dò identifier để sinh import. Body giữ nguyên byte-for-byte |
| 289 dòng CSS | Copy nguyên khối. Chỉ đổi 2 dòng khai báo `--f-body`/`--f-disp` trỏ sang biến `next/font` |
| Bỏ CDN | React bundle sẵn, JSX compile lúc build (**bỏ hẳn Babel standalone**, ~2MB, app cũng nhanh hơn vì không còn compile trong browser), font self-host qua `next/font` |

### Chỗ duy nhất buộc phải đổi code

`let _ask = null` là biến module mutable, và `App` **gán trực tiếp** vào nó. Trong
một file thì chạy tốt, nhưng **ESM cấm gán vào biến import** → `TypeError`. Phải
thêm `setAsk()`. Đây là cầu nối thay `window.confirm()` bị chặn trong iframe, đang
gánh 11 call site (8 nút xoá + 3 hành động ghi đè toàn bộ dữ liệu) — làm sai thì cả
11 im lặng không hoạt động, không báo lỗi gì.

### Đổi thêm ngoài phần cơ học

- **`computeOpenings` trích thành hàm pure** — 4 dòng trong `CloseMonth.commit()`,
  chính là nơi bug lệch 38.5tr từng sống. Giờ test được bằng `npm test`
- 25 test, trong đó có một test **ghi lại cơ chế** thay vì chỉ kết quả: dòng tick mà
  thiếu category làm tiền bốc hơi khỏi tổng → giải thích tại sao guard
  `unassigned > 0` là bắt buộc
- ESLint rule `react/no-unstable-nested-components` — chặn vĩnh viễn bug mất focus,
  thay cho phép grep thủ công. Chạy lần đầu: **0 vi phạm**
- `Restore from backup (.json)` — validate tách vào `parseBackup()` cho test được
- `window.__tt` → `useRef` · StrictMode bật sau khi thêm cancelled-guard cho effect load

### Xác minh

Chạy hết wizard 3 bước trên dev server với lương 30.000.000: carried 38.498.000 →
`Σ openings` = 68.498.000, **lệch 0**. Bản có bug đếm hai lần sẽ ra 106.996.000.

## Giai đoạn 7 — Firebase Auth + Firestore

Bỏ localStorage, chuyển sang Firestore để dùng được trên nhiều thiết bị.

**Ba lựa chọn đều theo hướng đơn giản hơn** (chủ dự án quyết):

| | Chọn | Bỏ |
|---|---|---|
| Đăng nhập | Email + mật khẩu | Google Sign-In · Anonymous |
| Mô hình dữ liệu | Server-first | Local-first |
| Dữ liệu localStorage cũ | Bỏ, bắt đầu trắng | Migrate lên |

Server-first hiểu theo nghĩa: Firestore là nguồn sự thật, không cache offline,
không cần cờ `rev`. React state vẫn cập nhật ngay trong bộ nhớ nên UI giữ cảm
giác tức thì — **không** đổi `set()` thành async, vì làm thế phải sửa ~40 call
site và thêm spinner khắp nơi.

Đánh đổi đã biết trước và chấp nhận: **quên mật khẩu = mất quyền vào dữ liệu**,
**mất mạng = không ghi được**. Lưới an toàn là Download backup (.json).

### Ranh giới không tự động hoá được

- `firebase login` — luồng OAuth trong browser, phải là chủ tài khoản
- **Bật Email/Password provider** — chỉ làm được trong Console. CLI có `firebase
  auth` nhưng chỉ gồm export/import, không bật provider
- **Tạo tài khoản người dùng đầu tiên** — không nhập mật khẩu thay chủ dự án

Phần còn lại (tạo web app, tạo Firestore, viết + deploy rules, toàn bộ code) làm
được bằng `firebase-tools` qua npx.

### Ba chỗ dễ mất dữ liệu

| Cơ chế | Nếu bỏ đi |
|---|---|
| Load lỗi → để `st = null`, KHÔNG rơi về `emptyState()` | Effect `saveState` ghi sổ trống đó lên và **xoá sạch dữ liệu thật** |
| `flushSave()` ở `pagehide` và trước `signOut` | Thao tác cuối trong debounce 700ms mất im lặng |
| `setSaveErrorHandler()` → toast | Mất mạng trông như đã lưu xong |

### Xác minh

Rules kiểm bằng Firestore REST API với token thật: đọc doc của mình 200 · đọc doc
người khác 403 · ghi doc người khác 403 · đọc không token 403.

Firestore là nguồn sự thật — chứng minh bằng cách để `localStorage` còn dữ liệu
mẫu cũ (có Techcombank) trong khi app chỉ hiện tài khoản mới tạo: app không đọc
localStorage nữa.

Debounce kiểm bằng `updateTime` phía server: sau 250ms chưa ghi, sau ~1650ms mới
ghi. (Phép đo đầu bằng cách đếm `fetch` là **sai** — burst trải dài hơn cửa sổ
700ms, và Firestore SDK dùng WebChannel nên số fetch không map 1:1 với write.)

## Giai đoạn 8 — Đổi tên My Ledger, dọn Settings, quản lý account

- Tên app **Ledger → My Ledger**
- **Logo gom vào component `Brand`** dùng chung. Trước đó ba chỗ tự dựng markup
  riêng nên dùng **ba icon khác nhau** (`book` ở sidebar, `book` ở top bar,
  `jar` ở màn đăng nhập). Giờ tất cả dùng icon `wallet`, và không lệch lại được
- **`PasswordInput`** dùng chung, có nút con mắt. State `show` nằm trong chính
  component nên ba ô ở form đổi mật khẩu **độc lập** — bật ô này không lộ ô kia
- Dịch lỗi Firebase chuyển sang `lib/authErrors.js`, dùng chung cho AuthGate và
  AccountPage thay vì mỗi chỗ một bản
- **`AccountPage`** là page **level-2**, cùng pattern với Plan template và Money
  I lent. Cố ý không dùng Sheet-trong-Sheet: `Sheet` set `document.body.overflow`
  và nghe Escape, hai cái lồng nhau sẽ tranh nhau khi đóng cái trong
- Đổi mật khẩu bắt buộc `reauthenticateWithCredential` trước `updatePassword` —
  Firebase yêu cầu, và cũng là lớp chặn người khác đổi khi máy đang mở
- Nhãn `Data` ở sidebar/top bar → `Settings`

### Đã bỏ khỏi UI theo yêu cầu

*Download backup* · *Restore from backup* · *Load sample data* ·
*Erase everything* · bảng đếm Transactions/Categories/Installments.

⚠️ *Download backup* từng là **lưới an toàn duy nhất** cho tình huống quên mật
khẩu / mất email = mất quyền vào dữ liệu. Đã nêu rủi ro trước khi làm. Hàm
`parseBackup()` và 10 test của nó vẫn còn trong `lib/state.js`, nên khôi phục
lại chỉ là thêm 2 nút.

## Những hướng đã cân nhắc và loại bỏ

| Ý tưởng | Lý do loại |
|---|---|
| "Thanh lọ có vạch chia" làm signature element | Lặp 5 dòng liên tiếp → rác thị giác. Đã gỡ hoàn toàn |
| Vạch cam "nhịp chi tiêu" | Nằm trên card summary, mất theo card đó. Đáng cân nhắc đưa lại ở Report |
| Band xám cho parent row | Kéo parent về phía màu nền → càng chìm |
| Trộn 50% trắng để làm nhạt màu | Ra màu đục |
| Google Sheet + service account / API key | Lộ credential trong HTML / phải để Sheet public. Firebase không có vấn đề này: `apiKey` web là public theo thiết kế, bảo mật ở Auth + Rules phía server |
| Vite thay vì Next.js | Gọn hơn, nhưng tính năng tương lai cần server cho secret key. Với Vite phải dựng Cloud Functions riêng + cần Blaze plan trả phí |
| PWA bằng Serwist | Đã cài rồi **gỡ bỏ**. Serwist chạy qua webpack plugin, Next 16 mặc định Turbopack → build lỗi, phải hạ xuống `next build --webpack`. Tệ hơn: precache manifest **không chứa document `/`**, nên tắt server rồi reload vẫn ra trang lỗi chứ không chạy offline. Nếu làm lại, kiểm cái đó trước |
| Chuyển TypeScript ngay ở bước 1 | Gộp với việc tách file thì lỗi phát sinh không biết do đâu. Đã để `tsconfig.json` với `allowJs: true` sẵn, file vẫn `.jsx` — convert dần từ `lib/` được |
