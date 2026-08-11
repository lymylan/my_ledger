/** @type {import('next').NextConfig} */
const nextConfig = {
  /* Bật được sau khi effect loadState ở App.jsx đã có cancelled-guard. */
  reactStrictMode: true,

  /* Badge dev của Next đè lên tab Categories ở bottom nav (mobile 375px),
     làm khó so sánh pixel với legacy/. Chỉ ảnh hưởng dev, không ảnh hưởng build. */
  devIndicators: false,
};

export default nextConfig;
