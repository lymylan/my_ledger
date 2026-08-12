import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro, Bricolage_Grotesque } from 'next/font/google';
import './globals.css';

/* Body font — chọn Be Vietnam Pro vì dựng dấu tiếng Việt chuẩn (xem README §6).
   Không phải variable font nên phải liệt kê weight tĩnh. */
const body = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

/* Font số & tiêu đề. Chỉ subset latin: nó chỉ dùng cho chữ số và heading tiếng Anh,
   còn glyph tiếng Việt đã có Be Vietnam Pro đỡ ở fallback chain trong globals.css. */
const disp = Bricolage_Grotesque({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--font-disp',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'My Ledger — Expense manager',
  description: 'Zero-based envelope budgeting. Dữ liệu nằm trên máy bạn.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${disp.variable}`}>
      <body>
        <div id="root">{children}</div>
      </body>
    </html>
  );
}
