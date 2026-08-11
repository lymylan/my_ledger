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

## Những hướng đã cân nhắc và loại bỏ

| Ý tưởng | Lý do loại |
|---|---|
| "Thanh lọ có vạch chia" làm signature element | Lặp 5 dòng liên tiếp → rác thị giác. Đã gỡ hoàn toàn |
| Vạch cam "nhịp chi tiêu" | Nằm trên card summary, mất theo card đó. Đáng cân nhắc đưa lại ở Report |
| Band xám cho parent row | Kéo parent về phía màu nền → càng chìm |
| Trộn 50% trắng để làm nhạt màu | Ra màu đục |
| Google Sheet + service account / API key | Lộ credential trong HTML / phải để Sheet public |
