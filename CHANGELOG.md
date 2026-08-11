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
