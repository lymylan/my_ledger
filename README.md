# Ledger — App quản lý chi tiêu cá nhân

Web app mobile-first, dùng phương pháp **zero-based envelope budgeting**
(chia tiền vào "lọ"/category trước khi tiêu, giống YNAB).

- **Ngôn ngữ UI:** English
- **Tiền tệ:** VND, định dạng `vi-VN` (dấu chấm phân cách nghìn)
- **Stack:** Next.js 16 (App Router) · React 19 · CSS thuần · Vitest
- **Backend:** chưa có. Toàn bộ dữ liệu nằm trên máy người dùng (`localStorage`).
  Firebase Auth + Firestore là bước kế tiếp — xem §10.

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
| `npm test` | 25 test cho các hàm số học thuần |
| `npm run lint` | ESLint, gồm rule chặn component lồng nhau |

React và font đều được bundle/self-host lúc build, nên **không cần Internet** để
chạy. Trước đây phụ thuộc CDN cho React + Babel standalone + Google Fonts, mất
mạng là màn hình trắng.

Lần đầu mở sẽ có dữ liệu mẫu (3 tài khoản, 7 category, ~31 giao dịch, 3 khoản
trả góp, 1 khoản cho vay). Vào **⚙ → Data** để xoá sạch và bắt đầu thật, hoặc
**Restore from backup (.json)** để nạp lại file đã export trước đó.

Bản một-file gốc vẫn giữ ở `legacy/quan-ly-chi-tieu.html` để đối chiếu hành vi.
Nó cần Internet để chạy (CDN) và sẽ xoá khi Firebase xong.

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

2010 dòng JSX/JS chia 17 module, 289 dòng CSS, 244 dòng test.

```
app/
├─ layout.tsx          html/body · next/font self-host 2 font
├─ page.tsx            'use client' — RANH GIỚI CLIENT DUY NHẤT của toàn app
└─ globals.css         289 dòng, copy nguyên khối từ bản một-file
src/
├─ App.jsx             209  shell, routing, level-2 chrome, confirm dialog, toast
├─ lib/
│  ├─ format.js         18  uid, pad, ymOf, money, shortM, mLabel…
│  ├─ constants.js      12  TAG_COLORS, ACC_COLORS, GROUPS, DOW…
│  ├─ ask.js             6  cầu nối confirm dialog (thay window.confirm)
│  ├─ storage.js        15  loadState / saveState / wipe  ← điểm nối Firebase
│  ├─ state.js         143  migrate, emptyState, seed, parseBackup
│  └─ derive.js         65  jarStats, monthSummary, computeOpenings, loanStat…
└─ components/
   ├─ Icon.jsx          44  dictionary 24 SVG path
   ├─ ui.jsx           152  Vessel · Sheet · MoneyInput · TagPicker · Field
   │                        JarSelect · TxRow
   ├─ TxSheet.jsx       74  bottom sheet ghi/sửa giao dịch
   └─ screens/
      ├─ CloseMonth.jsx    271  (gồm AllocLine)
      ├─ JarsScreen.jsx    260  (gồm CatPage)
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

### Components (18)

```
App                     shell, routing, level-2 chrome, confirm dialog, toast
├─ JarsScreen           tab Categories
│  └─ CatPage           level 2: chi tiết category
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

### Điều hướng

- **Level 1:** 5 tab ở bottom nav (mobile) / sidebar 222px (desktop ≥960px)
- **Level 2:** ẩn bottom nav, top bar đổi thành `← + tiêu đề`. Ba page: category detail, close month, plan template, money I lent
- Chuyển tab tự thoát level 2

### Lưu trữ

```js
window.storage  →  nếu chạy trong Claude artifact
localStorage    →  mọi nơi khác
```

Key: `lo.expense.v1`. Hàm `migrate()` chạy lúc load để nâng cấp dữ liệu cũ.

**Cả app chỉ chạm storage qua 3 hàm trong `lib/storage.js`** (`loadState` /
`saveState` / `wipe`). Không component nào gọi `localStorage` trực tiếp. Đây là lý
do chuyển sang Firestore chỉ cần đổi ruột 1 file, không phải sửa component nào.

⚠️ `useEffect(()=>{if(st)saveState(st)},[st])` trong `App.jsx` ghi **toàn bộ**
state mỗi lần đổi. Với localStorage thì miễn phí; với Firestore sẽ cần debounce
và một cờ `rev` để chặn thiết bị cũ ghi đè thiết bị mới.

---

## 5. Data model

```js
{
  v: 1,
  accounts:    [{ id, name, kind:'bank'|'cash', color, icon }],
  jars:        [{ id, accountId, name }],              // "category"
  openings:    { "2026-08": { jarId: amount } },       // Start theo từng tháng
  tags:        [{ id, name, color }],
  txns:        [{ id, date:"YYYY-MM-DD", type:'expense'|'income'|'transfer',
                  amount, jarId, fromJarId, toJarId, tagIds:[], note }],
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

Xem `sample-data.json` để có ví dụ đầy đủ.

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

> Cả 3 việc ưu tiên cao cũ đã xong: **chạy offline** (bỏ CDN, bundle React +
> self-host font), **import backup `.json`**, **version control** (git + branch).

### 🔴 Ưu tiên cao

| Việc | Vì sao |
|---|---|
| **Sync đa thiết bị (Firebase)** | Dùng trên cả điện thoại và máy tính, hiện mỗi máy một bản `localStorage` riêng, không có cách hợp nhất. Xem §10 |
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
đang gánh **11 call site trên 7 file**, và làm sai thì chúng im lặng không hoạt
động chứ không báo lỗi:

- **8 nút xoá** — tag · giao dịch · dòng plan · trả góp · khoản cho vay ·
  hoàn tác kỳ đã nhận · category · tài khoản
- **3 hành động ghi đè toàn bộ** — Restore from backup · Load sample data ·
  Erase everything

### 5 warning lint đang chấp nhận

Đều có sẵn từ bản một-file, không phải do chuyển sang Next.js sinh ra. Hạ xuống
`warn` trong `eslint.config.mjs` để lint sạch mà vẫn nhìn thấy:

| Chỗ | Vấn đề |
|---|---|
| `CalendarScreen.jsx:13` | `setState` trong effect để sync `sel` theo `ym` — nên tính bằng derived value |
| `ReportScreen.jsx:43` | `let acc` cộng dồn trong `.map()` để tính offset cung donut — thực tế an toàn, đổi sang `reduce` là hết |
| `ui.jsx:22`, `ReportScreen.jsx:29` | thiếu dependency trong `useEffect` / `useMemo` |

---

## 10. Bước kế tiếp — Firebase

Kiến trúc đã chốt, chưa code:

- **Firebase Auth** (Google Sign-In) — không để dữ liệu tài chính không có auth
- **Firestore 1 document** tại `users/{uid}/ledger/state`, đổi ruột `lib/storage.js`,
  **không sửa component nào**
- **Security Rules**: `allow read, write: if request.auth.uid == uid`
- **Debounce `saveState`** + cờ `rev` chặn thiết bị cũ ghi đè thiết bị mới

Lý do chọn **Next.js chứ không phải Vite**: các tính năng dự kiến sau này cần
server — gọi API có secret key (không thể để trong bundle client), cron nhắc đóng
sổ cuối tháng, chia sẻ sổ read-only qua link. Route handler nằm cùng codebase,
dùng chung type với client. Với Vite sẽ phải dựng Cloud Functions riêng, deploy
riêng, và cần Blaze plan trả phí để gọi mạng ra ngoài.

Firestore yếu về truy vấn tổng hợp. Nếu làm "trung bình trượt 3 tháng theo lọ"
(§7) thì phải tính ở server rồi cache, không query trực tiếp được.
