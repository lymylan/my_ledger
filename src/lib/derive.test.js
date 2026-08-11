import { describe, it, expect } from 'vitest';
import {
  jarStats, monthSummary, monthTxns, computeOpenings, loanStat, buildLoanPeriods,
} from './derive';

/* State tối thiểu: 3 lọ trên 1 tài khoản. Chỉ điền field mà hàm dẫn xuất đọc. */
const mk = (over = {}) => ({
  jars: [{ id: 'j1', accountId: 'a1', name: 'Living' },
         { id: 'j2', accountId: 'a1', name: 'Bills' },
         { id: 'j3', accountId: 'a1', name: 'Savings' }],
  accounts: [{ id: 'a1', name: 'VCB' }],
  openings: { '2026-08': { j1: 1000, j2: 2000, j3: 5000 } },
  txns: [],
  tags: [],
  ...over,
});

const tx = (o) => ({ id: 'x', date: '2026-08-10', tagIds: [], note: '', ...o });

describe('jarStats', () => {
  it('left = open + in − out', () => {
    const st = mk({ txns: [
      tx({ type: 'expense', amount: 300, jarId: 'j1' }),
      tx({ type: 'income', amount: 500, jarId: 'j1' }),
    ]});
    const s = jarStats(st, '2026-08');
    expect(s.j1).toMatchObject({ open: 1000, in: 500, out: 300, left: 1200 });
  });

  it('transfer tính out ở lọ nguồn VÀ in ở lọ đích', () => {
    const st = mk({ txns: [tx({ type: 'transfer', amount: 400, fromJarId: 'j1', toJarId: 'j2' })] });
    const s = jarStats(st, '2026-08');
    expect(s.j1).toMatchObject({ out: 400, in: 0, left: 600 });
    expect(s.j2).toMatchObject({ in: 400, out: 0, left: 2400 });
    // transfer không tạo/hủy tiền: tổng left không đổi
    expect(s.j1.left + s.j2.left + s.j3.left).toBe(8000);
  });

  it('bỏ qua giao dịch trỏ tới lọ đã bị xoá', () => {
    const st = mk({ txns: [
      tx({ type: 'expense', amount: 999, jarId: 'da-xoa' }),
      tx({ type: 'transfer', amount: 999, fromJarId: 'j1', toJarId: 'da-xoa' }),
    ]});
    const s = jarStats(st, '2026-08');
    expect(s['da-xoa']).toBeUndefined();
    expect(s.j1.out).toBe(999);   // phía nguồn vẫn trừ
  });

  it('chỉ đếm giao dịch trong tháng đang xem', () => {
    const st = mk({ txns: [
      tx({ date: '2026-07-31', type: 'expense', amount: 700, jarId: 'j1' }),
      tx({ date: '2026-08-01', type: 'expense', amount: 100, jarId: 'j1' }),
    ]});
    expect(monthTxns(st, '2026-08')).toHaveLength(1);
    expect(jarStats(st, '2026-08').j1.out).toBe(100);
  });

  it('lọ tiêu lố cho ra left âm — khoản lố không bốc hơi', () => {
    const st = mk({ txns: [tx({ type: 'expense', amount: 1500, jarId: 'j1' })] });
    expect(jarStats(st, '2026-08').j1.left).toBe(-500);
  });
});

describe('monthSummary', () => {
  it('net = thu − chi, và transfer KHÔNG tính vào thu/chi', () => {
    const st = mk({ txns: [
      tx({ type: 'income', amount: 9000, jarId: 'j1' }),
      tx({ type: 'expense', amount: 2000, jarId: 'j2' }),
      tx({ type: 'transfer', amount: 5000, fromJarId: 'j1', toJarId: 'j3' }),
    ]});
    const s = monthSummary(st, '2026-08');
    expect(s).toMatchObject({ inc: 9000, out: 2000, net: 7000, open: 8000 });
    expect(s.left).toBe(8000 + 9000 - 2000);
  });
});

/* ============================================================
   BẤT BIẾN SỐ HỌC — phép kiểm README §9 gọi là "bắt buộc".
   Bug từng làm tổng Start tháng mới lệch 38.5tr do đếm số dư
   kết chuyển hai lần trong pool phân bổ.
   ============================================================ */
describe('computeOpenings — bất biến Σ openings == carried + income', () => {
  const jars = mk().jars;
  const stats = { j1: { left: 1200 }, j2: { left: 800 }, j3: { left: -300 } };
  const carryAll = { j1: true, j2: true, j3: true };
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

  it('khớp khi mọi dòng đang tick đều đã có category', () => {
    const income = 10000;
    const items = [
      { id: 'p1', checked: true, jarId: 'j1', amount: 4000 },
      { id: 'p2', checked: true, jarId: 'j2', amount: 3000 },
      { id: 'p3', checked: false, jarId: 'j3', amount: 9999 },   // bỏ tick -> không tính
    ];
    const allocated = items.filter(i => i.checked).reduce((a, b) => a + b.amount, 0);
    const remainder = income - allocated;
    const carried = jars.reduce((a, j) => a + stats[j.id].left, 0);

    const o = computeOpenings({ jars, carry: carryAll, stats, items, restJar: 'j3', remainder });

    expect(carried).toBe(1700);
    expect(remainder).toBe(3000);
    expect(sum(o)).toBe(carried + income);
    expect(sum(o)).toBe(11700);
  });

  it('lọ âm kết chuyển số âm, không bị kẹp về 0', () => {
    const o = computeOpenings({
      jars, carry: carryAll, stats, items: [], restJar: null, remainder: 0,
    });
    expect(o.j3).toBe(-300);
    expect(sum(o)).toBe(1700);
  });

  it('lọ bỏ tick carry thì reset về 0, không kết chuyển', () => {
    const o = computeOpenings({
      jars, carry: { j1: true, j2: false, j3: false }, stats,
      items: [], restJar: null, remainder: 0,
    });
    expect(o).toEqual({ j1: 1200, j2: 0, j3: 0 });
  });

  it('phần dư âm (phân bổ lố hơn lương) trừ vào lọ chứa', () => {
    const income = 5000;
    const items = [{ id: 'p1', checked: true, jarId: 'j1', amount: 8000 }];
    const remainder = income - 8000;                    // −3000
    const o = computeOpenings({ jars, carry: carryAll, stats, items, restJar: 'j3', remainder });
    expect(remainder).toBe(-3000);
    expect(o.j3).toBe(-300 - 3000);
    expect(sum(o)).toBe(1700 + income);                 // bất biến vẫn đúng
  });

  it('GHI CHÚ CƠ CHẾ: dòng tick mà KHÔNG có category làm vỡ bất biến — đây là lý do CloseMonth chặn cứng `unassigned > 0`', () => {
    const income = 10000;
    const items = [
      { id: 'p1', checked: true, jarId: 'j1', amount: 4000 },
      { id: 'p2', checked: true, jarId: null, amount: 3000 },   // thiếu category
    ];
    // allocated tính CẢ dòng thiếu category, nên remainder bị trừ đi phần đó...
    const allocated = items.filter(i => i.checked).reduce((a, b) => a + b.amount, 0);
    const remainder = income - allocated;                        // 3000
    const carried = 1700;

    const o = computeOpenings({ jars, carry: carryAll, stats, items, restJar: 'j3', remainder });

    // ...nhưng computeOpenings bỏ qua dòng đó -> 3000 bốc hơi khỏi tổng.
    expect(sum(o)).toBe(carried + income - 3000);
    expect(sum(o)).not.toBe(carried + income);
    // Nếu ai đó bỏ guard `unassigned > 0` trong CloseMonth, test này giải thích
    // tiền sẽ mất ở đâu. Đừng bỏ guard đó.
  });
});

describe('loanStat', () => {
  it('cộng kỳ đã nhận, tính còn lại và kỳ kế tiếp', () => {
    const g = { total: 9000, periods: 3, payments: [
      { i: 1, paid: true, amount: 3000 },
      { i: 2, paid: true, amount: 2500 },
      { i: 3, paid: false, amount: 3000 },
    ]};
    expect(loanStat(g)).toMatchObject({ paidN: 2, got: 5500, left: 3500, leftN: 1 });
    expect(loanStat(g).next.i).toBe(3);
  });

  it('next là undefined khi đã trả hết', () => {
    const g = { total: 1000, periods: 1, payments: [{ i: 1, paid: true, amount: 1000 }] };
    expect(loanStat(g)).toMatchObject({ left: 0, leftN: 0, next: undefined });
  });
});

describe('buildLoanPeriods', () => {
  it('kỳ đầu đáo hạn 1 tháng sau ngày bắt đầu, chia đều', () => {
    const p = buildLoanPeriods('2026-01-15', 3, 9000, null);
    expect(p.map(x => x.due)).toEqual(['2026-02-15', '2026-03-15', '2026-04-15']);
    expect(p.every(x => x.amount === 3000 && x.paid === false)).toBe(true);
  });

  it('giữ nguyên số tiền của kỳ ĐÃ trả khi tính lại lịch', () => {
    const old = [{ i: 1, paid: true, amount: 2222, paidAt: '2026-02-20', jarId: 'j1', txnId: 't9' }];
    const p = buildLoanPeriods('2026-01-15', 3, 12000, old);
    expect(p[0]).toMatchObject({ amount: 2222, paid: true, jarId: 'j1', txnId: 't9' });
    expect(p[1].amount).toBe(4000);   // kỳ chưa trả nhận số mới
  });
});
