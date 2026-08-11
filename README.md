# Ledger — App quản lý chi tiêu cá nhân

Web app một file, mobile-first, dùng phương pháp **zero-based envelope budgeting**
(chia tiền vào "lọ"/category trước khi tiêu, giống YNAB).

- **Ngôn ngữ UI:** English
- **Tiền tệ:** VND, định dạng `vi-VN` (dấu chấm phân cách nghìn)
- **Stack:** 1 file HTML · React 18 · Babel standalone · CSS thuần
- **Backend:** không có. Toàn bộ dữ liệu nằm trên máy người dùng.

---

## 1. Chạy thử

Mở `quan-ly-chi-tieu.html` bằng trình duyệt. Không cần build, không cần cài gì.

> ⚠️ **Hiện tại CẦN Internet** để tải React / Babel / Google Fonts từ CDN.
> Mất mạng là màn hình trắng. Xem mục *Việc còn thiếu* để biết cách khắc phục.

Lần đầu mở sẽ có dữ liệu mẫu (3 tài khoản, 7 category, ~31 giao dịch, 3 khoản
trả góp, 1 khoản cho vay). Vào **⚙ → Data** để xoá sạch và bắt đầu thật.

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

Một file, ba khối: `<style>` (287 dòng CSS) · `<script type="text/babel">` (1927 dòng JSX) · không có build step.

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

### 🔴 Ưu tiên cao

| Việc | Vì sao |
|---|---|
| **Chạy offline** | Đang phụ thuộc CDN cho React/Babel. Cần nhúng React + biên dịch sẵn JSX (bỏ Babel) → ~250KB, 0 request |
| **Import backup `.json`** | Đã có export nhưng **chưa có import**. Không có cách chuyển dữ liệu giữa hai môi trường |
| **Version control** | Chưa có git repo. Chưa có lịch sử phiên bản |

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
| Đưa Google Sheet làm nơi lưu trữ? | Đã phân tích: chỉ Apps Script Web App là khả thi, bảo mật 🟡 (URL = mật khẩu). Cần kiến trúc local-first + sync nền |
| Donut Report có nên tính cả tag của khoản **thu**? | Hiện chỉ tính khoản chi |
| Định dạng số giữ `vi-VN` hay đổi `en-US`? | Đang `vi-VN` (38.498.000) dù UI tiếng Anh |

---

## 9. Cách xác minh khi sửa code

Không có test suite. Nhưng có 3 phép kiểm nhanh đã dùng suốt quá trình phát triển:

```bash
# 1. JSX có compile được không (bắt lỗi cú pháp trước khi mở browser)
npm i @babel/core @babel/preset-react
# tách <script type="text/babel"> ra file .jsx rồi:
node -e "require('@babel/core').transformFileSync('app.jsx',
  {presets:[[require('@babel/preset-react'),{runtime:'classic'}]]})"

# 2. CSS có cân ngoặc không
python3 -c "css=open('...').read(); print(css.count('{')==css.count('}'))"

# 3. Không còn component lồng trong component
grep -nE '^\s+const [A-Z]\w*\s*=\s*\(?\{' app.jsx
```

**Kiểm tra số học bắt buộc** sau khi sửa logic chốt sổ:

```
Σ openings[tháng mới]  ==  Σ carried  +  income
```
