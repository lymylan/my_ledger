import next from 'eslint-config-next';

export default [
  { ignores: ['.next/**', 'out/**', 'legacy/**', 'node_modules/**'] },
  ...next,
  {
    rules: {
      /* Chặn vĩnh viễn bug README đánh dấu 🚨: định nghĩa component trong thân
         component khác làm React unmount/remount cả cây con mỗi render →
         input mất focus sau mỗi ký tự. Đã xảy ra một lần (AllocLine từng nằm
         trong CloseMonth) và không hề có warning nào trong console.
         Rule này thay cho phép grep thủ công ở README §9. */
      'react/no-unstable-nested-components': 'error',

      /* Dưới đây là các vấn đề CÓ SẴN trong bản một-file, không phải do việc
         tách file sinh ra. Hạ xuống 'warn' để lint sạch mà vẫn nhìn thấy,
         thay vì sửa logic trong bước 1 (bước 1 cam kết không đổi hành vi).
         Mỗi cái đã có task theo dõi riêng. */

      // CalendarScreen.jsx:13 — setState trong effect để sync `sel` theo `ym`.
      'react-hooks/set-state-in-effect': 'warn',

      // ReportScreen.jsx:43 — `let acc` cộng dồn trong .map() để tính offset
      // cung donut. Thực tế an toàn (acc reset mỗi render), nhưng React Compiler
      // không chứng minh được. Sửa bằng reduce là xong, để sau.
      'react-hooks/immutability': 'warn',

      /* Dấu nháy đơn trong text JSX. Thuần style, không ảnh hưởng render.
         Tắt thay vì sửa 2 chuỗi — giữ text y hệt bản gốc. */
      'react/no-unescaped-entities': 'off',
    },
  },
];
