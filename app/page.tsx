import App from '../src/App';

/* Ranh giới client DUY NHẤT của toàn app nằm trong src/App.jsx ('use client').
   Mọi component import xuống dưới nó tự động vào client bundle — không cần
   thêm directive ở từng file. app/api/ để trống, dành cho tính năng server sau. */
export default function Page() {
  return <App />;
}
