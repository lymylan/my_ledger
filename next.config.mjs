/** @type {import('next').NextConfig} */
const nextConfig = {
  /* App chỉ dùng Firebase client SDK, không có SSR/API route. Xuất toàn bộ thành
     file tĩnh để Firebase Hosting Classic phục vụ trực tiếp từ thư mục out/. */
  output: 'export',

  /* Bật được sau khi effect loadState ở App.jsx đã có cancelled-guard. */
  reactStrictMode: true,

  /* Badge dev của Next đè lên tab Categories ở bottom nav (mobile 375px),
     làm khó so sánh pixel với legacy/. Chỉ ảnh hưởng dev, không ảnh hưởng build. */
  devIndicators: false,

  /* Cho phép mở app từ điện thoại trong cùng WiFi (http://<ip-máy>:3000).
     Next 16 chặn cross-origin dev resource theo mặc định: HTML vẫn về 200 nhưng
     mọi chunk JS bị chặn -> React không hydrate, app treo ở "Loading…".
     Lưu ý: IP do router cấp qua DHCP nên có thể đổi. Đổi rồi thì sửa dòng dưới
     (xem IP hiện tại bằng `ipconfig getifaddr en0`). Chỉ ảnh hưởng dev. */
  allowedDevOrigins: ['192.168.1.12', '192.168.1.*'],
};

export default nextConfig;
