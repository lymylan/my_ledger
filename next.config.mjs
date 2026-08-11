/** @type {import('next').NextConfig} */
const nextConfig = {
  /* TẮT CÓ CHỦ Ý ở bước 1.
     StrictMode gọi effect 2 lần trong dev. Effect load state ở App.jsx:
       useEffect(()=>{(async()=>{const s=await loadState();setSt(migrate(s||seed()))})()},[])
     không có abort guard, nên chạy 2 lần sẽ seed 2 lần với uid khác nhau (Math.random)
     rồi race nhau ghi vào storage. Bước 1 cam kết không đổi hành vi, nên tắt tạm.
     TODO: thêm cancelled-guard cho effect này rồi bật lại — bật StrictMode là việc
     nên làm, nó bắt được lỗi thật. */
  reactStrictMode: false,

  /* Badge dev của Next đè lên tab Categories ở bottom nav (mobile 375px),
     làm khó so sánh pixel với legacy/. Chỉ ảnh hưởng dev, không ảnh hưởng build. */
  devIndicators: false,
};

export default nextConfig;
