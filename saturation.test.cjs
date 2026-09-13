const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('saturation.js', 'utf8') + '\nglobalThis.calculate = Saturation.calculate;', context);
test('daily target deducts hours and sums project fractions', () => {
  const result = context.calculate({ phrase: 120 }, { phrase: 150 }, 12, { cooking: 2 });
  assert.equal(result.details[0].adjusted, 125);
  assert.ok(Math.abs(result.ratio - 0.96) < 1e-9);
  assert.equal(context.calculate({ phrase: 125 }, { phrase: 150 }, 12, { cooking: 2 }).ratio, 1);
  assert.equal(context.calculate({ phrase: 75, video: 50 }, { phrase: 150, video: 100 }, 14).total, 1);
});
test('missing rates and exhausted time remain explicit', () => {
  assert.equal(context.calculate({ unknown: 1 }, {}, 14).missing.length, 1);
  assert.equal(context.calculate({}, {}, 14, { cooking: 14 }).ratio, null);
  assert.equal(context.calculate({}, {}, 14, { cooking: 15 }).available, 0);
});
test('Worker retains daily snapshots and latest zero deductions', () => {
  const source = fs.readFileSync('cloudflare-worker.mjs', 'utf8');
  const worker = vm.createContext({});
  vm.runInContext(source.slice(0, source.indexOf('export default')), worker);
  const old = { date: '2026-09-13', member: 'test', items: { phrase: 120 }, updated_at: '2026-09-13T10:00:00Z', saturation: { baseHours: 12, rules: { phrase: 150 }, deductions: { cooking: 2 } } };
  const next = { ...old, updated_at: '2026-09-13T11:00:00Z', saturation: { ...old.saturation, deductions: { cooking: 0 } } };
  for (const mode of ['admin', 'records']) {
    const merged = worker.mergeCloudData({ records: { '2026-09-13|test': old } }, { records: { '2026-09-13|test': next } }, mode);
    assert.equal(merged.records['2026-09-13|test'].saturation.deductions.cooking, 0);
    assert.equal(merged.records['2026-09-13|test'].saturation.baseHours, 12);
    assert.equal(merged.records['2026-09-13|test'].saturation.rules.phrase, 150);
  }
});
