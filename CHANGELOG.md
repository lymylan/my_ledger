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

## Giai đoạn 9 — Tách `txns` khỏi document state

Xuất phát từ một câu hỏi về trần 1 MiB của Firestore, nhưng đo thật thì trần
không phải vấn đề gần nhất.

### Số đo, không phải ước lượng

Áp đúng công thức size của Firestore lên `legacy/sample-data.json`:

| Chỉ số | Giá trị |
|---|---|
| Một giao dịch | **94 byte** (min 85 / max 116) — trong đó 38 byte là tên field lặp lại |
| Phần cố định (accounts, jars, tags, template, installments, loans) | ~4,6 KB |
| Phần tăng **mỗi tháng** (`plans` 923B + `openings` 85B + `closes` ~70B) | ~1,08 KB |

Trần thật ≈ **9.000–10.000 giao dịch**, không phải 2.500–3.000 như README cũ
ghi. Với 100 giao dịch/tháng là khoảng 8 năm.

### Vì sao vẫn phải làm ngay, dù còn 8 năm

Ba vấn đề nghiêm trọng hơn trần 1 MiB, và đã hiện hữu ở 32 giao dịch:

1. **`setDoc` ghi đè cả document.** Hai tab cùng mở: tab load lúc 9h, tới 10h sửa
   một thứ nhỏ → đè sạch mọi thay đổi tab kia làm từ 9h. Không lỗi, không cảnh
   báo. Lập luận cũ *"không có cache offline nên không cần cờ `rev`"* chỉ đúng cho
   thiết bị khôi phục từ cache, **không** đúng cho hai tab đang sống.
2. **Mở app cũng ghi lại toàn bộ document.** `st` đi từ `null` → object sau khi
   load, effect `saveState` kích hoạt. Chỉ đăng nhập thôi cũng tốn một full write.
3. **Write amplification.** Năm thứ 3 với 100 giao dịch/tháng, document ~400 KB —
   thêm một ly cà phê 25k là upload 400 KB.

### Đã làm

```
users/{uid}/ledger/state   { st: <KHÔNG có txns>, rev, txnsV, updatedAt }
users/{uid}/ledger/meta    { accounts, jars, tags }        ~700 byte
users/{uid}/txns/{txnId}   một giao dịch = một document
```

- **Nạp theo tháng**, query khoảng `date` `[ym-01, ym-99]` — điều kiện một field
  nên index tự động, **không cần composite index**. Cận trên là `-99` chứ không
  phải `-31`: nếu có bản ghi ngày không đệm 0 thì `'2026-08-9' > '2026-08-31'`
  theo thứ tự chuỗi, giao dịch đó sẽ biến mất khỏi màn hình.
- `st.txns` vẫn tồn tại trong bộ nhớ, chỉ chứa tháng đang xem → **`derive.js` và
  cả ba màn hình đọc không phải sửa dòng nào**, vẫn gọi `monthTxns(st, ym)`.
- **Cờ `rev` + `runTransaction`** cho `ledger/state`. Lệch rev → huỷ ghi, App hiện
  màn chặn bắt reload thay vì đè lên.
- **`saveState()` bỏ qua write khi payload không đổi.** Một chốt giải quyết cả
  write thừa lúc load lẫn write thừa mỗi lần đổi tháng.
- **`ledger/meta`** — bản chiếu accounts/jars/tags, ghi cùng transaction với state.
- **Rules không phải sửa dòng nào**: `users/{uid}/{document=**}` đã phủ sẵn.

### Đưa lại *Download backup* trước khi migrate

Nút này bị gỡ ở giai đoạn 7 và chủ dự án đã chấp nhận rủi ro *"quên mật khẩu =
mất data"*. Nhưng migration là thao tác **ghi lại dữ liệu tài chính thật**, và
đánh đổi lúc đó không bao gồm *"không có đường lùi khi migration hỏng"*. Nên đưa
lại trước, chạy một lần, rồi mới tách. Bản backup gộp cả `txns` từ subcollection —
nếu không nó xuất ra sổ thiếu giao dịch, tệ hơn là không có backup.

### Thứ tự trong `migrateTxnsOut()` — đừng đảo

1. ghi txns ra subcollection → 2. mới gỡ txns khỏi `ledger/state`

Bước 1 hỏng giữa chừng thì hàm ném lỗi trước khi tới bước 2, state cũ còn nguyên,
lần load sau chạy lại. Ghi lại cùng `txnId` là idempotent nên không sinh bản
trùng. Đảo thứ tự thì một lỗi mạng là mất sạch giao dịch.

### Đã kiểm trên Firestore thật

Thêm giao dịch → reload thấy còn (đúng là ở subcollection) → sang tháng khác thì
mất, quay lại thì có → xoá. Tag round-trip đúng. Đếm request thật bằng hook
XHR/fetch: **đổi tháng = 3 `Listen`, 0 `Write`**; thêm/xoá tag = `Listen` (query
`array-contains`) + đúng 1 `Write`.

### Còn treo

`openings[next]` là snapshot đóng băng lúc chốt sổ. Giao dịch backdate vào tháng
đã có trong `closes` đổi `jarStats` tháng đó nhưng **không** đổi số dư đầu tháng
sau → sổ lệch âm thầm. UI chưa chặn. Bất kỳ đường ghi nào từ ngoài vào **phải**
tự từ chối.

## Giai đoạn 10 — Sắp xếp lại accounts & categories bằng kéo-thả

Nút ↑↓ cạnh tiêu đề *Accounts & categories* bật chế độ sắp xếp.

**Không thêm field `order`.** Thứ tự hiển thị vốn đã là thứ tự mảng `st.accounts`
/ `st.jars`, nên sắp xếp = sắp lại mảng và tự bền qua `saveState()`. Thứ tự đó
hiện ra luôn ở `JarSelect`, `CloseMonth`, và `ledger/meta` (ghi cùng transaction
với state).

**Category sắp trong account của chính nó.** `d.jars` là mảng phẳng trộn mọi
account, nên thay TẠI CHỖ đúng các vị trí account đó đang chiếm, thay vì gom lại
cuối mảng — gom lại sẽ đổi thứ tự tương đối category của các account khác.

**Chế độ sắp xếp dựng lại danh sách ở dạng gọn** (bỏ số tiền, vessel, nút sửa,
luôn mở hết category). Không chỉ cho đỡ nhiễu: nó khiến không thể vừa kéo vừa bấm
nhầm vào chi tiết category.

### `useDragList` — tự viết, và vì sao từng lựa chọn

| Quyết định | Lý do |
|---|---|
| Pointer Events, **không** HTML5 drag-and-drop | `dragstart`/`dragover` không bắn trên touch, mà app này mobile-first |
| Không thêm thư viện DnD | deps chỉ có firebase/next/react; thư viện đủ dùng nào cũng nặng hơn cả tính năng |
| `touch-action:none` trên `.grip` | Không có nó thì Safari iOS cuộn trang thay vì kéo |
| `:scope > [data-di]` khi đo rect | List category LỒNG trong list account; không scope thì phép đo của account nhặt luôn dòng category |
| `to` lưu trong ref, không đọc state lúc thả | `pointerup` có thể xảy ra cùng frame với `pointermove` cuối, khi đó state chưa cập nhật |
| Container tìm bằng `closest('[data-dl]')` từ event | Ban đầu dùng ref rồi callback ref, cả hai đều bị `react-hooks/refs` của React Compiler chặn ("Cannot access refs during render"). Tìm từ event thì không cần ref, mà còn gọn hơn: nơi gọi khỏi phải nhớ gắn ref |
| Dòng đang kéo **đi theo ngón tay** (`translateY` inline) + nổi lên (bóng, `scale(1.02)`) + vạch đích | Bản đầu chỉ nổi tại chỗ, chủ dự án phản hồi ngay là thiếu cảm giác kéo. `transform` phải inline vì `dy` đổi mỗi event, nên `.dl-row` chỉ transition `box-shadow` — thêm transform vào transition là dòng lết sau ngón tay |
| Auto-scroll khi kéo tới sát mép, bằng vòng **rAF** | Bản đầu không có, 7 account thì không kéo tới cuối list được. Không làm trong `pointermove` được: giữ ngón tay yên ở mép thì hết event, mà đúng lúc đó mới cần cuộn |
| rect theo **toạ độ tài liệu** và đo ở **frame đầu**, không đo trong `pointerdown` | Hai lý do cộng lại: auto-scroll dịch viewport dưới chân, và card đang kéo tự gập lại làm đổi layout. Đo trong `pointerdown` là tính đích trên số đo lạc hậu cả hai chiều |
| Nắm account thì **card tự gập** thành một dòng | Card 5 category cao gần nửa màn hình, kéo rất khó ngắm. Đo thật 275px → 64px, cả list co 1415 → 1203px |
| `.card.dl-open{overflow:visible}` khi list con đang kéo | `.card` có `overflow:hidden` nên dòng category kéo ra ngoài card bị cắt mất |
| `AccountReorderCard` là component ở module scope | Cần `useDragList` riêng cho category của nó, mà hook không gọi được trong `.map()`. Đúng luôn rule `react/no-unstable-nested-components` |

### Verify trên dev server

Kéo TPBank lên đầu → 2 category của nó đi theo, các account khác không xáo. Kéo
*TPB Saving 3* lên trên *TPB Quỹ để dành* → đúng, và category của Techcombank /
Vietcombank / TPB Saving giữ nguyên thứ tự. Reload: thứ tự còn nguyên. Dropdown
*Deduct from category* đọc ra đúng thứ tự mới.

Đo số trong lúc đang kéo: nắm vào là `translateY(0) scale(1.02)` (không giật),
card 275px → 64px, list 1415px → 1203px, không có vạch đích khi `to === from`.
Đẩy ngón tay xuống sát đáy rồi GIỮ YÊN: `scrollY` 0 → 140 → 1330, `translateY`
708 → 1884 — tức card vẫn nằm dưới ngón tay khi trang tự cuộn. Chiều lên cũng
vậy, về `scrollY: 0` và đích thành index 0.

⚠️ Bài học khi verify: **đừng mô phỏng kéo-thả bằng synthetic PointerEvent trên dữ
liệu thật.** Kịch bản "đưa ngón tay về chỗ cũ rồi thả để không commit" tính sai vì
`getBoundingClientRect` của phần tử đang kéo đã bị `transform` dời đi, nên nó
commit thật và đảo thứ tự account của chủ dự án hai lần (đã trả lại). Muốn kiểm mà
không đổi dữ liệu thì nhấn giữ **giữa viewport và không di chuyển** — `dy` giữ 0,
`to === from`, thả không commit.

34 test pass · build OK · lint 0 error (đúng 5 warning có sẵn).

## Giai đoạn 11 — Giữ vị trí cuộn khi đóng bottom sheet

Báo lỗi: edit category xong, sheet đóng, màn hình nhảy đi đâu mất.

**Không tái hiện được trong browser pane** — đo qua cả mở/Save/đóng ở 1280x800 và
375x812 thì `scrollY` giữ đúng 1400, `body.overflow` chuyển `hidden` rồi về rỗng
đúng như mong đợi. Nguyên nhân nằm ở thứ môi trường này không có: **bàn phím ảo
iOS**. Sheet edit category không có `autoFocus`, nên bàn phím chỉ mở khi người dùng
chạm vào ô — khớp với "edit *xong*" mới bị. Khi bàn phím mở mà `body` đang
`overflow:hidden`, Safari cuộn cả document để lộ ô đang focus (dù sheet là
`position:fixed`), và bàn phím tắt thì không trả lại vị trí cũ.

Cách chữa: đừng phụ thuộc vào hành vi browser. `Sheet` nhớ `window.scrollY` lúc mở
và `scrollTo` lại lúc đóng. Trả **hai nhịp** — ngay lập tức và một lần nữa ở frame
sau — vì bàn phím iOS tắt có animation, reflow của nó có thể xảy ra SAU cleanup và
đè mất lần trả đầu. Hai frame quá ngắn để người dùng kịp cuộn tay nên không giành
nhau.

Vì fix nằm trong `Sheet`, mọi bottom sheet đều được: giao dịch, category, account,
plan, loan, Settings.

### Verify

Giả lập đúng việc iOS làm — dời `scrollY` sang 240 trong lúc sheet đang mở, rồi
đóng: trả về 1400 ngay, và vẫn 1400 ở frame sau.

### Phát hiện kèm theo, CHƯA sửa

Vào trang level-2 từ danh sách đang cuộn thì trang mới mở ra ở vị trí cuộn cũ (bị
kẹp về max của trang đó). Đo: Categories ở `scrollY 1400` → mở *Plan template* →
`scrollY 130.5`, đúng bằng max scroll của trang đó. **Có sẵn từ trước**, không do
fix này (trước đây browser giữ 1400 rồi cũng kẹp về 130 y hệt). Chỉ lộ ra ở trang
level-2 đủ dài để cuộn — *category detail* thì `max_scroll = 0` nên tự về 0.
Sửa là một dòng `window.scrollTo(0,0)` khi vào level-2, nhưng đổi hành vi ở 5 đường
điều hướng nên để chủ dự án quyết.

## Giai đoạn 12 — Chia lại vùng chạm của dòng account

`.acc-edit` từng là `flex:1`, nên nó ăn hết khoảng trắng giữa "N categories" và số
tiền. Chạm vào vùng trống ở giữa dòng ra *Edit account* — không có gì báo hiệu, và
đó là vùng rộng nhất của cả dòng.

Sửa bằng CSS, không đổi markup:

```
[ icon | tên ✎ | N categories ]  [ khoảng trắng   793.000 / Remaining   ⌃ ]
└────────── Edit ──────────────┘  └───────────── gập / mở ───────────────┘
```

- `.acc-edit{flex:0 1 auto}` — bó sát nội dung, co lại được
- `.acc-toggle{flex:1 0 auto;justify-content:flex-end}` — chiếm phần còn lại, không co

`flex-shrink` khác nhau có chủ ý: tên account dài thì chính nó bị ellipsis, số tiền
không bao giờ bị cắt.

### Verify

Đo `getBoundingClientRect` của hai nút trên 3 account: vùng Edit rộng 136 / 185 /
191px đúng theo độ dài tên (tức là hug thật), vùng gập/mở lấy phần còn lại tới mép
phải, hai vùng liền mạch không có kẽ hở.

`elementFromPoint` dọc theo dòng: icon · chữ "Cash" · "3 categories" · bút chì →
`acc-edit`; ngay sau title (+10px) · khoảng trắng · số tiền · "Remaining" · chevron
→ `acc-toggle`.

Chạm thật: khoảng trắng giữa → `aria-expanded=false`, 0 dòng category, không mở
sheet. Chạm vào chữ "Cash" → sheet *Edit account* với ô tên điền "Cash".

## Giai đoạn 13 — Hiện số dư sau giao dịch khi đang ghi

Dưới ô chọn category: dòng nhỏ *Category X · <tên account> Y*, là số dư **sau khi**
áp số tiền đang nhập. Transfer hiện dưới cả hai ô From/To. Số âm màu đỏ.

`jarStats` tính một lần ở `TxSheet` bằng `useMemo` rồi truyền xuống — gọi trong
`JarLeft` là quét lại toàn bộ txns cho từng ô chọn.

### Chốt số khi rời ô, không phải mỗi ký tự

`MoneyInput` có thêm prop `onCommit`, khác `onChange`. Bắn khi rời ô và khi bấm nút
gợi ý / cộng nhanh. Với nút thì `onCommit` **phải nhận giá trị làm tham số**: `blur`
xảy ra TRƯỚC `click`, nếu chỉ dựa vào blur thì chốt đúng cái số cũ trước khi nút kịp
đổi.

`TxSheet` giữ số đã chốt trong state `applied` riêng thay vì đọc `f.amount` — `f.amount`
đổi mỗi ký tự, số dư nhảy theo từng chữ số (gõ "25" thấy 2 rồi 25) vừa nhiễu vừa vô
nghĩa.

### Sửa giao dịch đã có: phải loại nó ra trước

`jarStats` tính trên `st.txns`, mà giao dịch đang sửa nằm trong đó. Áp thẳng số mới
là trừ hai lần. Nên lọc nó ra trước: `{...st, txns: st.txns.filter(t => t.id !== f.id)}`.

Điều chỉnh cũng phải cộng dồn từ **một map duy nhất** đã áp cả hai chân của transfer —
transfer trong cùng account thì lọ đi giảm, lọ đến tăng, tổng account không đổi, chỉ
ra đúng khi tính từ cùng map.

### Cái bẫy do việc tách txns tạo ra

`st.txns` giờ chỉ giữ **một tháng** (giai đoạn 9). Nên `jarStats(st, thángKhác)` trả
về số **cao hơn thực tế**: `openings` có, mà không có giao dịch nào để trừ. Sheet lại
cho đổi ngày sang tháng bất kỳ.

Chọn: chỉ hiện khi `ymOfDate(f.date) === ym` (tháng đang nạp), đổi ngày sang tháng
khác thì dòng tự ẩn. Thà không hiện còn hơn hiện số sai — đây là app sổ chi tiêu,
một con số sai ở đúng chỗ người ta đang quyết định chi tiêu thì tệ hơn là không có
số nào.

Phương án khác đã loại: nạp txns của tháng đó để tính. Thành async trong sheet, phải
thêm trạng thái loading cho một dòng phụ trợ.

### Verify

Đối chiếu với danh sách phía sau sheet: sheet mới mở hiện *Xăng 300.000 / Cash
593.000*, danh sách hiện Gửi xe 93.000 + Xăng 300.000 + Tiền ăn Cash 200.000 =
593.000 đúng bằng dòng account. Đổi category trong ô chọn thì cả hai số và tên
account đổi theo. Đổi ngày sang 2026-09 → dòng ẩn; về 2026-08 → hiện lại.

Chốt số (chạm thật, không synthetic): gõ 120.000 mà chưa rời ô → vẫn 4.292.000 /
8.098.000; rời ô → 4.172.000 / 7.978.000 (đúng −120.000 cả hai). Đổi sang Income →
4.412.000 / 8.218.000 (đúng +120.000). Nhập 5.000.000 → Category −708.000 màu
`--out`, account 3.098.000 màu thường.

Sửa giao dịch đã có: category *Xăng* còn 300.000 với đúng một khoản chi 100.000. Mở
khoản đó ra → dòng hiện 300.000, tức bằng số thật. Không phải 200.000 (trừ hai lần)
cũng không phải 400.000 (chưa loại ra).

⚠️ Bài học verify, lần thứ hai trong ngày: **synthetic event không thay được chạm
thật.** `el.focus()` không ăn khi document không có focus nên `blur()` thành no-op và
test tưởng là blur không chốt số. `.click()` lên nút X khi có scrim thì không đóng
sheet như chạm thật. Và toạ độ `getBoundingClientRect` KHÁC hệ toạ độ click của
browser tool (~1.39×) nên bấm lệch sang dòng bên cạnh. Dùng chạm thật cho những gì
liên quan tới focus và toạ độ; JS click chỉ dùng cho điều hướng không bị che.

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
| Collection tạm `shortcutExpenseLogs` cho log ghi từ ngoài | Buộc phải viết code reconcile (đọc staging → append vào sổ → xoá staging), và chính cửa sổ merge đó là nơi race condition sống. Một collection `txns` + field `source`/`status` cho cùng kết quả với một query path, không migration, và giao dịch giữ nguyên id từ lúc sinh ra |
| `transactions/{id}` phẳng ở root | Đặt dưới `users/{uid}/txns/` thì `firestore.rules` hiện tại phủ sẵn. Ở root phải viết rule mới và tự mang `ownerId` vào mọi query — thêm bề mặt lỗi bảo mật, không được gì |
| Normalize luôn accounts/jars/tags thành collection riêng | Chúng có vài chục phần tử và được đọc ở mọi render. Tách ra chỉ đổi 1 read thành N read. Phần còn lại của `ledger/state` tăng ~1,08 KB/tháng ≈ 75 năm, không cần đụng tới |
| Thêm field `ym` vào txn để query theo tháng | Query khoảng trên chính `date` cho cùng kết quả, cùng index tự động, mà không phải giữ đồng bộ một field dư thừa |
