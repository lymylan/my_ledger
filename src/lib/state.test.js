import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseBackup, emptyState, migrate, normalizeTxn, seed } from './state';

describe('parseBackup', () => {
  it('đọc được sample-data.json thật của project', () => {
    const raw = readFileSync(new URL('../../legacy/sample-data.json', import.meta.url), 'utf8');
    const st = parseBackup(raw);
    expect(st.accounts.length).toBeGreaterThan(0);
    expect(st.jars.length).toBeGreaterThan(0);
    expect(Array.isArray(st.txns)).toBe(true);
    // migrate() đã chuẩn hoá: mọi giao dịch phải có tagIds là mảng
    expect(st.txns.every(t => Array.isArray(t.tagIds))).toBe(true);
  });

  it('vòng tròn export -> import giữ nguyên dữ liệu', () => {
    const original = seed();
    const restored = parseBackup(JSON.stringify(original, null, 2));
    expect(restored.txns.length).toBe(original.txns.length);
    expect(restored.jars).toEqual(original.jars);
    expect(restored.openings).toEqual(original.openings);
    expect(restored.installments).toEqual(original.installments);
  });

  it('điền key thiếu từ backup bản cũ thay vì để undefined', () => {
    const old = { accounts: [{ id: 'a1', name: 'VCB' }], jars: [], txns: [] };
    const st = parseBackup(JSON.stringify(old));
    for (const k of Object.keys(emptyState())) expect(st[k]).toBeDefined();
    expect(st.loans).toEqual([]);
    expect(st.closes).toEqual({});
    expect(st.hiddenJars).toEqual([]);
  });

  it('nâng cấp tagId đơn (bản cũ) thành mảng tagIds', () => {
    const old = { accounts: [], jars: [], txns: [
      { id: 't1', date: '2026-08-01', type: 'expense', amount: 100, jarId: 'j1', tagId: 'tag9' },
    ]};
    const st = parseBackup(JSON.stringify(old));
    expect(st.txns[0].tagIds).toEqual(['tag9']);
    expect(st.txns[0].tagId).toBeUndefined();
  });

  it.each([
    ['không phải JSON',        'day khong phai json',        /valid JSON/],
    ['JSON nhưng là mảng',     '[1,2,3]',                    /Not a Ledger backup/],
    ['JSON nhưng là số',       '42',                         /Not a Ledger backup/],
    ['thiếu txns',             '{"accounts":[],"jars":[]}',  /missing: txns/],
    ['accounts sai kiểu',      '{"accounts":{},"jars":[],"txns":[]}', /missing: accounts/],
  ])('từ chối %s với message đọc được', (_label, input, pattern) => {
    expect(() => parseBackup(input)).toThrow(pattern);
  });
});

describe('migrate', () => {
  it('idempotent — chạy hai lần cho cùng kết quả', () => {
    const once = migrate(seed());
    const twice = migrate(JSON.parse(JSON.stringify(once)));
    expect(twice).toEqual(once);
  });
});

/* normalizeTxn là cửa duy nhất giữa giao dịch trong bộ nhớ và document Firestore.
   Nó hỏng thì hoặc write bị Firestore từ chối (undefined), hoặc dữ liệu vào sổ
   sai hình dạng và các màn hình đọc ra rác. */
describe('normalizeTxn', () => {
  it('KHÔNG để lọt undefined — Firestore từ chối cả document nếu có', () => {
    /* Giao dịch expense thật sự thiếu hẳn key fromJarId/toJarId, đúng như dữ
       liệu do seed() và các bản cũ sinh ra. */
    const t = normalizeTxn({ id: 'x1', date: '2026-08-01', type: 'expense', amount: 25000, jarId: 'j6' });
    for (const [k, v] of Object.entries(t)) expect(v, k).not.toBe(undefined);
    expect(t.fromJarId).toBe(null);
    expect(t.toJarId).toBe(null);
  });

  it('nâng cấp tagId đơn (bản rất cũ) thành mảng tagIds', () => {
    expect(normalizeTxn({ id: 'x', tagId: 'tag9' }).tagIds).toEqual(['tag9']);
    expect(normalizeTxn({ id: 'x' }).tagIds).toEqual([]);
    expect(normalizeTxn({ id: 'x', tagIds: ['a', 'b'] }).tagIds).toEqual(['a', 'b']);
  });

  it('idempotent — chạy lại trên kết quả của chính nó không đổi gì', () => {
    const once = normalizeTxn({ id: 'x1', date: '2026-08-01', type: 'expense', amount: 25000, jarId: 'j6' });
    expect(normalizeTxn(once)).toEqual(once);
  });

  it('giữ nguyên source khi đã có, mặc định là app', () => {
    expect(normalizeTxn({ id: 'x' }).source).toBe('app');
    expect(normalizeTxn({ id: 'x', source: 'shortcut' }).source).toBe('shortcut');
  });

  it('mọi giao dịch của seed() đi qua được', () => {
    for (const t of seed().txns) {
      const n = normalizeTxn(t);
      expect(Object.values(n).every(v => v !== undefined)).toBe(true);
      expect(n.id).toBe(t.id);
      expect(n.amount).toBe(t.amount);
    }
  });
});

/* Giao dịch giờ nằm ở subcollection và nạp theo tháng bằng khoảng chuỗi
   [ym-01, ym-99]. Nếu khoảng này sai thì giao dịch không biến mất khỏi database
   — nó biến mất khỏi MÀN HÌNH, và số dư tháng đó im lặng tính thiếu. */
describe('khoảng query một tháng (storage.loadMonthTxns)', () => {
  const inRange = (date, ym) => date >= ym + '-01' && date <= ym + '-99';

  it('nhận mọi ngày trong tháng, kể cả 31', () => {
    for (const d of ['01', '09', '10', '28', '29', '30', '31']) {
      expect(inRange('2026-08-' + d, '2026-08'), d).toBe(true);
    }
  });

  it('loại mọi ngày ngoài tháng, kể cả tháng liền kề và cùng tháng khác năm', () => {
    for (const d of ['2026-07-31', '2026-09-01', '2025-08-15', '2027-08-15']) {
      expect(inRange(d, '2026-08'), d).toBe(false);
    }
  });

  it('bắt được cả ngày không đệm 0 — lý do cận trên là -99 chứ không phải -31', () => {
    expect(inRange('2026-08-9', '2026-08')).toBe(true);
    expect('2026-08-9' <= '2026-08-31').toBe(false);   // đây là cái bẫy
  });

  it('mọi giao dịch của seed() rơi đúng vào tháng của chính nó', () => {
    for (const t of seed().txns) {
      const ym = t.date.slice(0, 7);
      expect(inRange(t.date, ym), t.date).toBe(true);
    }
  });
});
