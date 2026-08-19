# My Ledger — App quản lý chi tiêu cá nhân

Web app mobile-first, dùng phương pháp **zero-based envelope budgeting**
(chia tiền vào "lọ"/category trước khi tiêu, giống YNAB).

- **Ngôn ngữ UI:** English
- **Tiền tệ:** VND, định dạng `vi-VN` (dấu chấm phân cách nghìn)
- **Stack:** Next.js 16 (App Router) · React 19 · CSS thuần · Vitest
- **Backend:** Firebase Auth (email/mật khẩu) + Firestore. Cấu hình sổ ở
  `users/{uid}/ledger/state`, mỗi giao dịch là một document riêng ở
  `users/{uid}/txns/{txnId}`. Chỉ chính chủ đọc/ghi được. Xem §10.

---

## 1. Chạy thử

```bash
npm install
npm run dev
```

Mở http://localhost:3000.

| Lệnh | Việc |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm test` | 34 test cho các hàm thuần (số học, chuẩn hoá giao dịch, khoảng query tháng) |
| `npm run lint` | ESLint, gồm rule chặn component lồng nhau |

React và font đều được bundle/self-host lúc build, nên **không cần Internet** để
chạy. Trước đây phụ thuộc CDN cho React + Babel standalone + Google Fonts, mất
mạng là màn hình trắng.

Cần `.env.local` mới chạy được — xem §10.

Lần đầu mở sẽ ra **màn đăng nhập**. Tạo tài khoản bằng email + mật khẩu (≥ 6 ký
tự), rồi được **sổ trống** — không có dữ liệu mẫu. Mọi screen đã có empty state
nên ghi thật được luôn: *+ Add account* → *+ Add category* → tab **+** để ghi
giao dịch.

⚙ Settings có 3 mục **Plan template** · **Money I lent** · **Account**, cộng phần
**Backup** với *Download backup (.json)* và *Restore from backup (.json)*.
*Load sample data* và *Erase everything* vẫn bỏ khỏi UI theo yêu cầu chủ dự án.

*Download backup* từng bị gỡ cùng đợt đó rồi được đưa lại: nó là điều kiện tiên
quyết để tách `txns` sang subcollection — một migration ghi lại dữ liệu thật thì
phải có đường lùi nằm ngoài Firestore.

Bản một-file gốc vẫn giữ ở `legacy/quan-ly-chi-tieu.html` để đối chiếu pixel khi
sửa UI. Nó cần Internet để chạy (CDN) và không còn dùng chung dữ liệu với bản mới.

---

## 2. Quy trình sử dụng (workflow gốc của chủ dự án)

1. Cuối tháng, lương về tài khoản. Lúc này các lọ còn số dư của tháng trước.
2. Chạy **Close month**: chốt số dư từng lọ → kết chuyển sang tháng mới.
3. Nhập lương tháng mới.
4. Phân bổ lương vào các lọ, lấy **Plan template** làm điểm xuất phát.
5. Phần dư sau phân bổ đi vào lọ do người dùng chọn.
6. Trong tháng: mỗi khoản chi/thu/chuyển đều được log ngay.

**Bất biến số học quan trọng nhất:**

```
Tổng "Start" của tháng mới  =  Tổng số dư kết chuyển  +  Thu nhập
```

Số dư kết chuyển **đã nằm sẵn trong từng lọ**, nên **chỉ thu nhập** là nguồn được
đem đi phân bổ. Cộng số dư cũ vào pool phân bổ là **đếm hai lần** — đây là bug đã
từng xảy ra và đã sửa. Đừng làm lại.

---

## 3. Tính năng

| Màn hình | Vào từ | Nội dung |
|---|---|---|
| **Categories** | Tab 1 | Tài khoản → category. Start / Out / In / Remaining, thanh mức. Nút **Close month** |
| Category detail | Chạm 1 category | Level 2. Số dư, Start/Out/In, danh sách giao dịch của tháng |
| **Calendar** | Tab 2 | Lưới tháng kiểu Apple Calendar. Chạm 1 ngày → danh sách giao dịch ngay dưới |
| **Add transaction** | Tab 3 (FAB) | Expense / Income / Transfer · amount · name · category · tag · date |
| **Report** | Tab 4 | Net + Income/Expense kèm delta tháng trước · chi theo ngày · donut theo tag · bảng theo category |
| **Installments** | Tab 5 | Khoản **tôi nợ**. Tổng, số kỳ, tiền/kỳ, lịch kỳ, đánh dấu đã trả |
| **Close month** | Categories | Level 2. Wizard 3 bước |
| **Plan template** | ⚙ Settings | Level 2. Template phân bổ hàng tháng |
| **Money I lent** | ⚙ Settings | Level 2. Khoản **người khác nợ tôi** |

### Close month — wizard 3 bước

1. **Ending balances** — số dư cuối kỳ từng lọ, tick chọn *carry over* hoặc *reset về 0*.
   Lọ âm (tiêu lố) kết chuyển số âm — khoản lố đi theo người dùng, không bốc hơi.
2. **Income** — nhập lương. Hiện rõ: đã kết chuyển bao nhiêu / cần phân bổ bao nhiêu.
3. **Allocate** — template chỉ là *prepopulate*. Sửa số, đổi category, thêm dòng
   tự tạo (*Your own splits*) để chia phần dư theo ý mình. Thanh phân bổ 7px ở
   footer + số dư còn lại bám đáy màn hình.

**Hai chặn cứng trước khi chốt:** dòng đang tick mà chưa có category · còn dư mà chưa chọn nơi chứa.

### Installments vs Loans — khác biệt cốt lõi

| | Installments | Loans |
|---|---|---|
| Bản chất | Tôi nợ người khác | Người khác nợ tôi |
| Sinh giao dịch | **Không** (chủ dự án chọn tách riêng) | **Có, tự động** |
| Lý do | Tiền chưa rời lọ khi đánh dấu | Cho vay = tiền rời lọ thật ngay lúc đó |

Loans: tạo khoản → sinh giao dịch **chi** (`Lent · <tên>`). Đánh dấu 1 kỳ đã nhận →
sheet hỏi số tiền / ngày / category nhận → sinh giao dịch **thu** (`Repaid · <tên>`).
Hoàn tác kỳ → xoá giao dịch thu đó. Xoá khoản vay → xoá tất cả giao dịch liên quan.

---

## 4. Kiến trúc

2918 dòng JSX/JS chia 21 module, 303 dòng CSS, 314 dòng test.

```
app/
├─ layout.tsx          html/body · next/font self-host 2 font
├─ page.tsx            'use client' — RANH GIỚI CLIENT DUY NHẤT của toàn app
└─ globals.css         342 dòng, gốc copy nguyên khối từ bản một-file
src/
├─ App.jsx             376  shell, routing, auth gating, confirm dialog, toast,
│                           thao tác txn (txw), backup, màn chặn khi xung đột rev
├─ lib/
│  ├─ format.js         18  uid, pad, ymOf, money, shortM, mLabel…
│  ├─ constants.js      12  TAG_COLORS, ACC_COLORS, GROUPS, DOW…
│  ├─ ask.js             6  cầu nối confirm dialog (thay window.confirm)
│  ├─ authErrors.js     20  dịch error code Firebase sang câu người đọc được
│  ├─ firebase.js       31  init app / auth / db từ biến môi trường
│  ├─ storage.js       355  Firestore: state (debounce + rev) · txns (subcollection)
│  │                        · meta · migration · backup/restore · dịch lỗi ghi
│  ├─ state.js         168  migrate, normalizeTxn, emptyState, seed, parseBackup
│  └─ derive.js         65  jarStats, monthSummary, computeOpenings, loanStat…
└─ components/
   ├─ AuthGate.jsx     113  đăng nhập / tạo tài khoản / reset mật khẩu
   ├─ AccountPage.jsx   99  level-2: đổi mật khẩu · sign out
   ├─ Icon.jsx          50  dictionary 43 SVG path
   ├─ ui.jsx           346  Brand · PasswordInput · Vessel · Sheet · MoneyInput
   │                        TagPicker · Field · JarSelect · TxRow · useDragList
   ├─ TxSheet.jsx       74  bottom sheet ghi/sửa giao dịch
   └─ screens/
      ├─ CloseMonth.jsx    271  (gồm AllocLine)
      ├─ JarsScreen.jsx    341  (gồm CatPage, AccountReorderCard)
      ├─ LoansPage.jsx     224
      ├─ ReportScreen.jsx  183
      ├─ Installments.jsx  137
      ├─ PlanSetup.jsx     122
      └─ CalendarScreen.jsx 75
legacy/                  bản một-file gốc + sample-data.json
```

**Toàn app chỉ có MỘT `'use client'`**, ở `app/page.tsx`. Trong App Router đó là
*ranh giới* — mọi thứ import xuống dưới tự vào client bundle, không cần thêm
directive ở từng file. `app/api/` để trống, dành cho tính năng cần server sau này.

`lib/` không import gì từ `components/`, nên dùng lại được ở phía server khi cần.

### Components (21)

```
AuthGate                chưa đăng nhập thì App render cái này thay vì cả cây dưới
├─ AccountPage          level 2: đổi mật khẩu, sign out
App                     shell, routing, level-2 chrome, confirm dialog, toast
├─ JarsScreen           tab Categories
│  ├─ CatPage           level 2: chi tiết category
│  └─ AccountReorderCard  một account ở chế độ sắp xếp
├─ CalendarScreen       tab Calendar
├─ ReportScreen         tab Report
├─ Installments         tab Installments
├─ CloseMonth           level 2: wizard chốt sổ
│  └─ AllocLine         1 dòng phân bổ (bước 3)
├─ PlanSetup            level 2: plan template
├─ LoansPage            level 2: khoản cho vay
├─ TxSheet              bottom sheet ghi/sửa giao dịch
└─ dùng chung: Vessel · Sheet · MoneyInput · TagPicker · Field · JarSelect · TxRow
```

> 🚨 **MỌI COMPONENT PHẢI Ở MODULE SCOPE.**
> Định nghĩa component bên trong thân một component khác làm React unmount/remount
> cả cây con mỗi lần render → **input mất focus sau mỗi ký tự**. Bug này đã xảy ra
> một lần (`AllocLine` từng nằm trong `CloseMonth`) và rất khó phát hiện: không có
> lỗi console, không có warning.
>
> Giờ đã có rule `react/no-unstable-nested-components: error` chặn ở `npm run lint`,
> không còn phải nhớ nữa. `AllocLine` và `CatPage` nằm cùng file với component cha
> cho dễ đọc, nhưng vẫn ở module scope.

### Số dư còn lại trong sheet ghi giao dịch

Dưới ô chọn category có dòng nhỏ: số dư của **category** và của cả **account** chứa
nó **SAU KHI** áp số tiền đang nhập (`JarLeft` trong `TxSheet.jsx`). Transfer hiện
dưới cả hai ô From/To. Số âm màu đỏ.

**Cập nhật khi số tiền đã chốt, không phải mỗi ký tự.** `MoneyInput` có prop
`onCommit` (khác `onChange`) — bắn khi rời ô, và khi bấm nút gợi ý / cộng nhanh.
Với nút thì `onCommit` phải nhận giá trị làm tham số: `blur` xảy ra TRƯỚC `click`,
dựa vào blur không thôi sẽ chốt số cũ. `TxSheet` giữ số đã chốt trong state `applied`
riêng, vì `f.amount` đổi mỗi ký tự — số dư nhảy theo từng chữ số vừa nhiễu vừa vô
nghĩa.

Hai chỗ dễ sai:

| Chi tiết | Nếu làm sai |
|---|---|
| Khi **sửa** giao dịch đã có, phải bỏ nó khỏi `jarStats` trước rồi mới áp số mới | Số cũ còn trong số dư, cộng số mới vào là trừ hai lần |
| Chỉ hiện khi **ngày giao dịch nằm trong tháng đang nạp** | `st.txns` chỉ giữ một tháng, `jarStats` cho tháng khác ra số **cao hơn thực tế** vì không có giao dịch nào để trừ. Đổi ngày sang tháng khác thì dòng tự ẩn |

Điều chỉnh phải cộng dồn từ **một map duy nhất** đã áp cả hai chân của transfer:
transfer trong cùng một account thì lọ đi giảm, lọ đến tăng, tổng account không đổi —
chỉ ra đúng khi tính từ cùng một map.

### Vùng chạm của dòng account

```
[ icon | tên account ✎ | N categories ]   [ khoảng trắng   793.000 / Remaining   ⌃ ]
└──────────── Edit account ────────────┘  └────────── gập / mở ──────────────────┘
```

`.acc-edit` **bó sát nội dung** (`flex:0 1 auto`), phần còn lại thuộc `.acc-toggle`
(`flex:1 0 auto`). Trước đây `.acc-edit` là `flex:1` nên nó ăn hết khoảng trắng giữa
"N categories" và số tiền — chạm vào chỗ trống đó ra *Edit account*, không ai đoán
được.

`flex-shrink` hai bên khác nhau có chủ ý: tên account dài thì **chính nó** bị
ellipsis, số tiền không bao giờ bị cắt.

### Sắp xếp lại accounts & categories

Nút ↑↓ cạnh tiêu đề *Accounts & categories* bật chế độ sắp xếp: danh sách dựng
lại ở dạng gọn (bỏ số tiền, vessel, nút sửa), mỗi dòng có tay cầm để kéo. Chevron
gập/mở vẫn còn, **dùng chung state `openAcc` với chế độ thường** nên gập/mở không
bị đặt lại khi vào/ra — gập hết lại là cách dễ nhất để xếp nhiều account, các card
thu về chiều cao đều nhau. Account đổi chỗ với nhau; category đổi chỗ **trong account của
chính nó**. Ra khỏi chế độ này bằng nút text **Apply** ở mép phải — chiếm đúng chỗ
của *+ Add account*, hai nút không bao giờ cùng xuất hiện.

⚠️ Nhãn *Apply* chỉ là **đường ra**, không phải nút lưu: mỗi lần thả là một lần
`set()` nên thứ tự đã vào Firestore ngay. Muốn *Apply* đúng nghĩa "chưa lưu tới khi
bấm" thì phải đệm thứ tự vào state cục bộ và chỉ commit khi bấm — kèm theo phải
quyết định chuyện thoát ngang thì huỷ hay giữ.

**Thứ tự hiển thị chính là thứ tự mảng** — không có field `order` nào. Nên sắp xếp
là sắp lại `st.accounts` / `st.jars`, và nó tự bền qua `saveState()`. Thứ tự này
hiện ra ở cả `JarSelect`, `CloseMonth`, và `ledger/meta` (ghi cùng transaction).

`useDragList` (trong `components/ui.jsx`) tự viết, không thêm thư viện — deps của
project chỉ có firebase/next/react, và mọi thư viện DnD đủ dùng đều nặng hơn cả
tính năng này. Ba điểm không được đổi:

| Chi tiết | Nếu bỏ |
|---|---|
| Pointer Events, **không** HTML5 drag-and-drop | `dragstart`/`dragover` không bắn trên touch → mobile hết kéo được |
| `touch-action:none` trên `.grip` | Safari iOS cuộn trang thay vì kéo |
| `:scope > [data-di]` khi đo | List category lồng trong list account → phép đo của account nhặt luôn dòng category |

`AccountReorderCard` phải là **component** chứ không thể là hàm render nội bộ: nó
cần `useDragList` riêng cho category của chính nó, mà hook không gọi được trong
`.map()`.

Dòng đang kéo **đi theo ngón tay** (`translateY` inline) và **nổi lên** (bóng +
`scale(1.02)`); vạch xanh chỉ nơi nó sẽ hạ xuống. `transform` phải để inline vì
`dy` đổi mỗi `pointermove` — và vì thế `.dl-row` **chỉ** transition `box-shadow`,
thêm transform vào transition là dòng kéo lết sau ngón tay.

**Nắm vào account là card đó tự gập lại** thành một dòng (`accDl.dragging === i`),
bất kể đang mở hay không: một card 5 category cao gần nửa màn hình, kéo đi rất khó
ngắm. Đo thật: 275px → 64px, và cả list co từ 1415px → 1203px. Thả ra thì mở lại
theo `openAcc`.

Năm chi tiết đã sửa từ bug thật, đừng gộp lại:

| Chi tiết | Nếu làm sai |
|---|---|
| `dragging` và vạch đích là **hai điều kiện tách rời** trong `rowClass()` | Từng dùng chung `to !== from` → nắm vào card mà chưa di chuyển thì không nổi lên, tưởng chưa bắt được |
| rect đo ở **frame đầu** (`measure()` trong `tick`), KHÔNG trong `pointerdown` | Việc gập card đang kéo đổi layout — mọi dòng dưới dịch lên. Đo trong `pointerdown` là đo layout cũ rồi tính đích trên số đo lạc hậu |
| rect lưu theo **toạ độ tài liệu** (`+ window.scrollY`) | `getBoundingClientRect` theo viewport; auto-scroll dịch viewport dưới chân nên rect đo lúc đầu sai ngay khi cuộn |
| Auto-scroll là vòng **rAF**, không làm trong `pointermove` | Giữ ngón tay yên ở mép thì không còn event nào bắn — mà đúng lúc đó mới cần cuộn nhất |
| `.card.dl-open{overflow:visible}` khi list con đang kéo | `.card` có `overflow:hidden`, dòng category kéo ra ngoài card bị cắt mất |

`startY` cũng lấy lại trong `measure()` theo `lastY` tại đúng thời điểm đó, nên
`dy = 0` ngay sau khi gập và card không giật một nhịp.

`scale` giữ ở 1.02: rect đo TRƯỚC khi class áp vào nên phóng to không phản hồi ngược
vào phép đo, nhưng lớn hơn thì tay cầm lệch khỏi ngón tay. Vùng auto-scroll dưới
(120px) rộng hơn trên (80px) vì bottom nav 64px phủ mất phần đáy.

### Điều hướng

- **Level 1:** 5 tab ở bottom nav (mobile) / sidebar 222px (desktop ≥960px)
- **Level 2:** ẩn bottom nav, top bar đổi thành `← + tiêu đề`. Ba page: category detail, close month, plan template, money I lent
- Chuyển tab tự thoát level 2

### Lưu trữ

```
Firestore:  users/{uid}/ledger/state   →  { st: <state, KHÔNG có txns>, rev, txnsV, updatedAt }
            users/{uid}/ledger/meta    →  { accounts, jars, tags }        ~700 byte
            users/{uid}/txns/{txnId}   →  một giao dịch = một document
```

**Server-first**: Firestore là nguồn sự thật duy nhất. `localStorage` **không còn
được dùng** — không có cache offline. Đổi lại: mất mạng là không ghi được. Lưới
an toàn là ⚙ → *Download backup (.json)*.

Cả app chỉ chạm storage qua `lib/storage.js`. Không component nào gọi Firestore
trực tiếp — đó là lý do việc chuyển từ localStorage sang Firestore không phải sửa
component nào.

**Vì sao txns tách ra khỏi `state`.** Trước đây toàn bộ sổ nằm trong một document.
Ba vấn đề, xếp theo mức nguy hiểm:

1. `setDoc` ghi đè **cả** document. Chỉ cần có writer thứ hai là giao dịch bị nuốt
   im lặng. Mỗi txn một document thì hai writer chạm hai document khác nhau.
2. Write amplification — thêm một ly cà phê 25k phải upload lại cả sổ.
3. Trần 1 MiB/document. Đo thật: 94 byte/txn, cộng ~1,08 KB mỗi tháng cho
   `plans`/`openings`/`closes` → trần khoảng 9.000–10.000 giao dịch.

Sau khi tách, phần còn lại chỉ tăng ~1,08 KB/tháng ≈ 75 năm.

`ledger/meta` là bản chiếu của accounts/jars/tags, ghi **cùng transaction** với
`state` nên không lệch được. Dành cho client ngoài cần danh sách category mà không
phải kéo cả sổ về.

**txns nạp theo tháng.** `st.txns` trong bộ nhớ chỉ chứa giao dịch của tháng đang
xem, query theo khoảng `date` (`[ym-01, ym-99]` — điều kiện một field nên
Firestore tự đánh index, **không cần composite index**). Nhờ vậy `derive.js` và cả
ba màn hình đọc **không phải sửa dòng nào**: chúng vẫn gọi `monthTxns(st, ym)`.

**Debounce 700ms cho state; giao dịch ghi thẳng.** `saveState()` gộp các thay đổi
state. Giao dịch không đi qua debounce — mỗi cái là một document nhỏ, ghi ngay,
server trước rồi mới cập nhật bộ nhớ.

**Cờ `rev` chống ghi đè.** `ledger/state` mang số phiên bản tăng dần; mọi write đi
qua `runTransaction` và so `rev` client với server. Lệch nghĩa là nơi khác đã sửa
→ **huỷ ghi**, `setStaleHandler()` bắn lên App, App hiện màn chặn bắt reload.

Các chỗ dễ mất dữ liệu, đã xử lý — **đừng gỡ**:

| Cơ chế | Nếu bỏ đi |
|---|---|
| `flushSave()` ở `pagehide`/`visibilitychange` và trước `signOut` | Thao tác cuối còn trong debounce mất im lặng |
| Load lỗi thì để `st = null`, **không** rơi về `emptyState()` | Effect `saveState` sẽ ghi sổ trống đó lên và **xoá sạch dữ liệu thật** |
| `setSaveErrorHandler()` → toast | Mất mạng sẽ trông như đã lưu xong |
| `rev` + `runTransaction` | Hai tab cùng mở, tab cũ ghi đè sạch việc tab kia làm |
| Trong `migrateTxnsOut()`: ghi txns ra subcollection **trước**, gỡ khỏi `state` **sau** | Đảo thứ tự thì một lỗi mạng giữa chừng là mất sạch giao dịch |
| `stripTxns()` trong `saveState()` | txns quay lại nằm trong state doc, hỏng đúng thứ vừa sửa |
| `Sheet` nhớ `scrollY` khi mở và trả lại khi đóng (2 nhịp: ngay + 1 frame) | `body{overflow:hidden}` một mình không đủ trên iOS: chạm ô nhập → bàn phím mở → Safari cuộn cả document để lộ ô focus dù sheet là `position:fixed`, tắt bàn phím thì không trả lại. Đóng sheet là màn hình nhảy đi mất |

`saveState()` **bỏ qua write khi payload không đổi** (so JSON với lần ghi thành
công gần nhất). Không có chốt này thì mỗi lần đổi tháng và mỗi lần mở app là một
lần ghi lại toàn bộ state.

---

## 5. Data model

```js
{
  v: 1,
  accounts:    [{ id, name, kind:'bank'|'cash', color, icon }],
  jars:        [{ id, accountId, name }],              // "category"
  openings:    { "2026-08": { jarId: amount } },       // Start theo từng tháng
  tags:        [{ id, name, color }],
  txns:        [ … ],   // ⚠ KHÔNG lưu ở đây — xem dưới
  template:    [{ id, group:'basic'|'debt'|'save', name, amount, jarId, installmentId }],
  plans:       { "2026-09": { items, appliedAt, income, carried, allocated, remainder } },
  installments:[{ id, name, note, total, periods, per, start, jarId,
                  payments:[{ i, due, amount, paid, paidAt }] }],
  loans:       [{ id, name, note, total, date, jarId, tagIds, txnId, periods,
                  payments:[{ i, due, amount, paid, paidAt, jarId, txnId }] }],
  closes:      { "2026-08": { at, carried, income, allocated, remainder } },
  hiddenJars:  [ jarId ]                               // ẩn khỏi bảng Report
}
```

**`txns` là trường hợp đặc biệt.** Nó tồn tại trong `st` khi app đang chạy và
trong file backup `.json`, nhưng **không** được ghi vào `ledger/state` —
`saveState()` gỡ ra trước mỗi lần ghi. Nguồn thật là subcollection
`users/{uid}/txns/{txnId}`, và `st.txns` chỉ giữ **tháng đang xem**:

```js
users/{uid}/txns/{txnId} = {
  date:"YYYY-MM-DD", type:'expense'|'income'|'transfer',
  amount, jarId, fromJarId, toJarId, tagIds:[], note,
  source:'app'          // ai ghi; chừa chỗ cho client ngoài
}
// id là TÊN document, không lặp lại thành field bên trong
```

`normalizeTxn()` trong `lib/state.js` là cửa duy nhất giữa hai dạng. Nó ép
`undefined` → `null` (Firestore từ chối cả document nếu có một field undefined,
mà giao dịch bản cũ thiếu hẳn key `fromJarId`/`toJarId`) và nâng `tagId` đơn →
mảng `tagIds`. Hàm pure, nằm ở `state.js` chứ không phải `storage.js` để test
được mà không cần biến môi trường Firebase.

Xem `sample-data.json` để có ví dụ đầy đủ (định dạng backup, có `txns`).

### Công thức dẫn xuất

```js
jarStats(st, ym)[jarId] = {
  open:  openings[ym][jarId] || 0,
  in:    Σ income vào lọ  +  Σ transfer đến lọ,
  out:   Σ expense từ lọ  +  Σ transfer đi từ lọ,
  left:  open + in − out
}
```

```js
// lib/derive.js — số dư mở đầu tháng mới, do wizard chốt sổ gọi
computeOpenings({jars, carry, stats, items, restJar, remainder})
```

`plans[ym]` và `closes[ym]` là **bản ghi lịch sử** do wizard chốt sổ tạo ra.
`template` là cấu hình dùng chung, **không** theo tháng.

Multi-tag: giao dịch gắn nhiều tag. Donut trong Report **chia đều** số tiền cho
các tag của giao dịch đó, nên tổng donut luôn khớp tổng chi.

---

## 6. Design system

### Màu

| Token | Hex | Dùng cho |
|---|---|---|
| `--paper` | `#EEF0F6` | Nền trang (xám-xanh lạnh) |
| `--card` | `#FFFFFF` | Nền card, nền bottom sheet |
| `--ink` / `--ink2` / `--muted` | `#14161F` / `#4A5163` / `#868DA1` | Chữ 3 cấp |
| `--line` / `--line2` | `#DCE0EC` / `#EBEEF5` | Viền / đường kẻ nhạt |
| `--indigo` | `#2B3A8F` | Primary, progress bar |
| `--out` / `--in` / `--move` | `#C33F4C` / `#0F7A57` / `#6B54C6` | Chi / Thu / Chuyển |
| `--warn` | `#A96700` | Cảnh báo, cần hành động |

Màu tài khoản: 8 lựa chọn, **chỉ áp vào icon chip (fill đặc, glyph trắng)**.
Không áp vào progress bar.

### Typography

- **Body:** Be Vietnam Pro — chọn vì dựng dấu tiếng Việt chuẩn
- **Số & tiêu đề:** Bricolage Grotesque, `font-variant-numeric: tabular-nums`
- Fallback: system font stack (khi Google Fonts không tải được)

### Nguyên tắc đã rút ra qua quá trình làm

| Nguyên tắc | Bối cảnh |
|---|---|
| **Trong UI sáng, xám = lùi ra sau.** Muốn nổi thì dùng weight + không gian + độ đậm đường kẻ | Từng tô band xám cho parent row → parent bị chìm vì màu đó nằm giữa trắng và nền trang |
| **Progress bar nhiều dòng liên tiếp phải rất mỏng** | 8px + viền + vạch chia, lặp 5 dòng → đọc như đường kẻ ngăn, vỡ nhóm parent-child. Giảm còn 4px, bỏ viền, bỏ vạch |
| **Làm nhạt màu thì nâng lightness trong HSL, giữ saturation** | Trộn 50% trắng làm mất 23 điểm saturation → màu đục |
| **Legend đặt cạnh nội dung, không đặt trong chart** | Chấm màu 9px cạnh tiêu đề nhóm → thanh phân bổ ở footer chỉ tốn 7px thay vì 60px |
| **Ẩn con số bằng 0** | Dòng thông tin ngắn hơn, hết bị cắt `…` |
| **Không lồng `<button>` trong `<button>`** | Chia thành 2 button ngang hàng, hoặc dùng `div` + `stopPropagation` |
| **`window.confirm()` bị chặn trong iframe sandbox** | Trả về `false` im lặng → 9 hành động xoá đều không hoạt động. Đã thay bằng dialog tự dựng `ask()` |

---

## 7. Việc còn thiếu

> Đã xong: **chạy offline** (bỏ CDN, bundle React + self-host font), **import
> backup `.json`**, **version control**, **sync đa thiết bị** (Firebase, §10).

### 🔴 Ưu tiên cao

| Việc | Vì sao |
|---|---|
| ~~**Không còn cách export dữ liệu**~~ | ✅ Đã xong — ⚙ Settings → **Backup** có lại *Download backup* / *Restore from backup*. Bản backup gộp cả `txns` từ subcollection |
| **Chặn ghi vào tháng đã chốt** | `openings[next]` đóng băng lúc chốt sổ. Giao dịch backdate vào tháng đã có trong `closes` làm số dư đầu tháng sau sai mà không báo gì. UI chưa chặn — mới chỉ ghi lại trong §10 |
| **Xác minh email** | Tài khoản tạo xong dùng được ngay, `emailVerified` vẫn `false`. Nghĩa là gõ sai email khi đăng ký thì không nhận được link reset mật khẩu → mất quyền vào dữ liệu |
| **Chỉ báo trạng thái sync** | Hiện không có gì cho biết "đã lưu chưa". Lỗi ghi có toast, nhưng lúc bình thường thì im lặng |
| **Cài lên home screen (PWA)** | Đã thử Serwist rồi gỡ: Serwist chạy qua webpack plugin, Next 16 mặc định Turbopack, chưa tương thích (serwist#54). Và precache manifest không chứa document `/` nên reload offline vẫn ra trang lỗi. Cần cách khác |

### 🟡 Ưu tiên trung bình

| Việc | Ghi chú |
|---|---|
| **Sinking funds** | Quỹ tích luỹ cho chi phí không đều (Tết, bảo hiểm năm, sửa xe). Cần cờ rollover riêng cho từng lọ |
| **Lọ Surplus tách khỏi Savings** | Hiện phần dư và tiết kiệm có kế hoạch bị trộn → không biết tháng tốt là do kỷ luật hay tình cờ |
| **Tách Fixed / Variable trong nhóm Essentials** | Tiền nhà (không đổi được) đang gộp với ăn uống (đổi được mỗi ngày) |
| **Đối soát Installments vs lọ** | Đánh dấu "đã trả" không trừ lọ → dễ quên log, lọ hiện đủ tiền trong khi tiền đã đi |
| **Hiển thị `closes[ym]`** | Đã ghi `carried / income / allocated / remainder` nhưng chưa hiện ở đâu |

### Report đề xuất thêm (theo thứ tự giá trị)

1. **Trung bình trượt 3 tháng theo lọ** — cho biết *kế hoạch* sai ở đâu, không phải *người dùng* sai ở đâu
2. **Cơ cấu thu nhập** Fixed / Variable / Debt / Save — báo cáo duy nhất chạm tới quyết định lớn
3. Tỷ lệ tiết kiệm theo tháng + xu hướng
4. Gánh nặng nợ & lịch hết nợ
5. Lịch sử tiền dư
6. Đối soát tổng lọ vs số dư thật
7. Nhịp chi tiêu trong tháng (dự đoán ngày hết tiền)

---

## 8. Câu hỏi đang treo

| Câu hỏi | Trạng thái |
|---|---|
| Phân bổ **cộng thêm** lên số dư kế chuyển, hay **top up to target**? | Đang dùng "cộng thêm" (đúng mô tả gốc). "Top up" giữ mức chi ổn định hơn giữa các tháng |
| Delta trong Report so với **1 tháng trước** hay **trung bình 3 tháng**? | Đang dùng 1 tháng trước. Dễ nhiễu nếu tháng đó bất thường |
| ~~Đưa Google Sheet làm nơi lưu trữ?~~ | **Đã chốt: không.** Thay bằng Firebase. Google Sheet bị loại vì lộ credential trong HTML / phải để Sheet public. Firebase không có vấn đề đó — `apiKey` web là **public theo thiết kế**, bảo mật nằm ở Auth + Security Rules chạy phía server |
| Firestore: 1 document hay tách subcollection? | Đang tính dùng **1 document**. State chỉ ~20KB, giới hạn 1MB/doc → đủ cho ~2.500–3.000 giao dịch (6–7 năm). Dùng 1 người, không dùng cùng lúc, nên last-write-wins chấp nhận được |
| Local-first hay server-first? | Chưa chốt. Local-first với Firestore gần như miễn phí (1 dòng `persistentLocalCache`) và giữ được tính chất ghi-là-xong tức thì hiện tại. Đánh đổi: cần cờ `rev` chặn thiết bị cũ ghi đè |
| Donut Report có nên tính cả tag của khoản **thu**? | Hiện chỉ tính khoản chi |
| Định dạng số giữ `vi-VN` hay đổi `en-US`? | Đang `vi-VN` (38.498.000) dù UI tiếng Anh |

---

## 9. Cách xác minh khi sửa code

3 phép kiểm thủ công cũ (compile JSX bằng Babel · đếm ngoặc CSS · grep component
lồng nhau) giờ đã thành lệnh:

```bash
npm test        # 25 test — gồm bất biến số học, trước đây phải kiểm bằng mắt
npm run lint    # 0 error. Có rule chặn component lồng nhau
npm run build   # bắt lỗi cú pháp + type
```

**Bất biến số học** — trước đây README gọi là "kiểm tra bắt buộc" và phải tự tính:

```
Σ openings[tháng mới]  ==  Σ carried  +  income
```

Giờ nằm trong `src/lib/derive.test.js`. Bất biến này **chỉ đúng khi mọi dòng phân
bổ đang tick đều đã có category** — vì `allocated` đếm cả dòng thiếu category còn
`computeOpenings` thì bỏ qua nó, nên tiền bốc hơi khỏi tổng. Đó chính là lý do
`CloseMonth` chặn cứng `unassigned > 0`. Có một test ghi lại đúng cơ chế này;
**đừng bỏ guard đó.**

### Sau khi sửa UI

Không có test render. So sánh trực tiếp với `legacy/quan-ly-chi-tieu.html` mở
song song ở viewport 375px.

Nếu có sửa `lib/ask.js`, **phải test tay từng hành động phá hoại dữ liệu**. `ask()`
đang gánh **9 call site trên 7 file**, và làm sai thì chúng im lặng không hoạt
động chứ không báo lỗi:

- **8 nút xoá** — tag · giao dịch · dòng plan · trả góp · khoản cho vay ·
  hoàn tác kỳ đã nhận · category · tài khoản
- **2 hành động còn lại** — Sign out, và *Restore from backup* (ghi đè toàn bộ)

*Load sample data* và *Erase everything* vẫn bỏ khỏi UI, nên còn 10 call site.

### 5 warning lint đang chấp nhận

Đều có sẵn từ bản một-file, không phải do chuyển sang Next.js sinh ra. Hạ xuống
`warn` trong `eslint.config.mjs` để lint sạch mà vẫn nhìn thấy:

| Chỗ | Vấn đề |
|---|---|
| `CalendarScreen.jsx:13` | `setState` trong effect để sync `sel` theo `ym` — nên tính bằng derived value |
| `ReportScreen.jsx:43` | `let acc` cộng dồn trong `.map()` để tính offset cung donut — thực tế an toàn, đổi sang `reduce` là hết |
| `ui.jsx:22`, `ReportScreen.jsx:29` | thiếu dependency trong `useEffect` / `useMemo` |

---

## 10. Firebase

Đang chạy trên project **`my-ledger-29e43`**.

| Thành phần | Giá trị |
|---|---|
| Firestore | database `(default)`, region **`asia-southeast1`** (Singapore) — ⚠️ region là **vĩnh viễn**, không đổi được |
| Auth | Email/Password. Bật bằng tay trong Console — `firebase auth` của CLI chỉ có export/import, **không bật provider được** |
| Rules | `firestore.rules`, deploy bằng `npm run rules:deploy` |
| Config | `.env.local` (gitignore). Xem `.env.example` |

### apiKey không phải secret

`NEXT_PUBLIC_FIREBASE_API_KEY` **công khai theo thiết kế** — nó là identifier để
SDK biết gọi project nào, không phải mật khẩu. Bảo mật thật nằm ở Auth +
`firestore.rules` chạy phía server.

Đây chính là lý do Firebase khả thi trong khi Google Sheet bị loại (xem
CHANGELOG): Sheet buộc phải lộ credential thật hoặc để file public.

Dùng `.env` chỉ để mỗi môi trường trỏ được sang project khác nhau.

### Rules

```
users/{uid}/**   →  allow read, write: if request.auth.uid == uid
mọi path khác    →  chặn hết
```

Đã kiểm bằng Firestore REST API với token thật:

| Thao tác | Kết quả |
|---|---|
| Đọc document của mình | 200 |
| Đọc document người khác | 403 |
| Ghi vào document người khác | 403 |
| Đọc không có token | 403 |

### Giới hạn cần biết

- **Trần 1 MiB không còn là vấn đề.** `txns` đã tách thành subcollection; phần còn
  lại trong `ledger/state` tăng ~1,08 KB/tháng → khoảng **75 năm**.
- **Ghi đè chéo đã chặn, nhưng chỉ cho `state`.** Cờ `rev` + `runTransaction` bảo
  vệ `ledger/state`. Hai thiết bị sửa **cùng một giao dịch** thì vẫn last-write-wins
  trên đúng document đó — phạm vi thiệt hại giới hạn ở một giao dịch, không phải cả
  sổ như trước.
- **Đọc toàn bộ lịch sử tốn N document read.** Chỉ có Download backup làm việc này.
  Đừng gọi `loadAllTxns()` trong luồng render. Báo cáo nhiều tháng nên dựa vào
  rollup có sẵn trong `closes[ym]` / `openings[ym]`.
- **Ghi vào tháng đã chốt làm sổ lệch âm thầm.** `openings[next]` là snapshot đóng
  băng lúc chốt ([CloseMonth](src/components/screens/CloseMonth.jsx) `commit()`).
  Giao dịch thêm vào tháng đã có trong `closes` sẽ đổi `jarStats` của tháng đó
  nhưng **không** đổi số dư đầu tháng sau. UI hiện không chặn — bất kỳ đường ghi
  nào từ ngoài vào (API, import) **phải** tự từ chối.
- **Firestore yếu về truy vấn tổng hợp.** Nếu làm "trung bình trượt 3 tháng theo
  lọ" (§7) thì phải tính ở server rồi cache.
- **Mất mạng là không ghi được** (đánh đổi có chủ ý của server-first).

### Đổi sang project khác

```bash
npx -y firebase-tools@latest apps:sdkconfig WEB <appId> --project <projectId>
```

Điền vào `.env.local`, sửa `.firebaserc`, rồi `npm run rules:deploy`.

### Deploy Firebase Hosting Classic

App được static export vào `out/`, sau đó chỉ deploy target Hosting của project
đang chọn trong `.firebaserc`:

```bash
npm run deploy:hosting
```

Lệnh trên tự chạy production build trước khi deploy. Nó không deploy lại
Firestore Rules; khi cần cập nhật Rules, tiếp tục dùng `npm run rules:deploy`.
