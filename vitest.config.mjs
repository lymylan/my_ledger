import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /* Toàn bộ hàm dẫn xuất đều pure (nhận state, trả kết quả) nên không cần
       jsdom — chạy thuần node, rất nhanh. */
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
});
