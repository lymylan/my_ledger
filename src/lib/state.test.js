import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseBackup, emptyState, migrate, seed } from './state';

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
