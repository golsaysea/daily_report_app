const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
const appSource = fs.readFileSync('app.js', 'utf8');
vm.runInContext(appSource.slice(0, appSource.indexOf('const defaultData =')) + '\nglobalThis.calculate = Saturation.calculate;', context);
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
test('saturation grades use 50, 80 and 100 percent boundaries', () => {
  for (const [amount, level, passed] of [[0,'low',false],[49.9,'low',false],[50,'danger',false],[79.9,'danger',false],[80,'near',false],[99.9,'near',false],[100,'qualified',true],[150,'qualified',true]]) {
    const result = context.calculate({ item: amount }, { item: 100 }, 14);
    assert.equal(result.level, level); assert.equal(result.passed, passed);
  }
  assert.equal(context.calculate({ unknown: 200 }, {}, 14).passed, false);
});
test('product suggestions use actual mix, five-unit rounding and manual daily capacity', () => {
  vm.runInContext('globalThis.productQuota = Saturation.productQuota;', context);
  const snapshot = { baseHours: 12, deductions: { cooking: 2 }, rules: { a: 200, b: 100, ai: 100 }, productRules: { a: { video: 1 }, b: { video: 1 }, ai: { video: 0, ai: 1 } }, productQuota: null };
  assert.equal(context.productQuota({ a: 100, b: 50 }, snapshot), 125);
  assert.equal(context.productQuota({ a: 100 }, { ...snapshot, deductions: {} }), 200);
  assert.equal(context.productQuota({}, snapshot), null);
  assert.equal(context.productQuota({ ai: 50 }, snapshot), null);
  assert.equal(context.productQuota({}, { ...snapshot, productQuota: 205 }), 175);
  assert.equal(context.productQuota({ a: 100 }, { ...snapshot, rules: { a: 201 }, deductions: {} }), 205);
  assert.equal(context.productQuota({ a: 1 }, { ...snapshot, deductions: { x: 12 } }), 0);
  assert.equal(context.productQuota({ unknown: 1 }, snapshot), null);
  assert.equal(context.productQuota({ a: 100 }, { ...snapshot, dailyProductQuota: 203 }), 205);
  assert.equal(context.productQuota({ a: 100 }, { ...snapshot, dailyProductQuota: 0 }), 0);
  const mix = { baseHours: 14, deductions: {}, rules: { hook: 22, phrase: 140 }, productRules: { hook: { video: 1 }, phrase: { video: 1 } }, productQuota: null };
  assert.equal(context.productQuota({ hook: 10, phrase: 80 }, mix), 90);
  assert.equal(context.productQuota({ hook: 10, phrase: 80 }, { ...mix, deductions: { other: 10 } }), 30);
});
test('saved records use updated project day rates without mutating archived snapshots', () => {
  const record = { saturation: { rules: { rolling: 50 }, baseHours: 12, deductions: { cooking: 2 }, dailyProductQuota: 205 }, items: { rolling: 48 } };
  const resolved = context.resolvedSaturation(record, { totalConversionRules: { rolling: 100 } });
  assert.equal(context.calculate(record.items, resolved.rules, resolved.baseHours, resolved.deductions).total, 0.48);
  assert.equal(record.saturation.rules.rolling, 50);
  assert.equal(resolved.dailyProductQuota, 205);
});
test('personal defaults use latest member setting and keep members separate', () => {
  const report = { records: {
    a: { member: 'A', saturation: { personalDefaults: { hours: 12, quota: 200, updated_at: '2026-09-12T12:00:00Z' } } },
    b: { member: 'A', saturation: { personalDefaults: { hours: 10, quota: 205, updated_at: '2026-09-14T12:00:00Z' } } },
    c: { member: 'B', saturation: { personalDefaults: { hours: 8, quota: 100, updated_at: '2026-09-15T12:00:00Z' } } }
  } };
  assert.equal(context.personalDefaultValues('A', report).hours, 10);
  assert.equal(context.personalDefaultValues('A', report).quota, 205);
  assert.equal(context.personalDefaultValues('B', report).quota, 100);
  assert.equal(context.personalDefaultValues('C', report), null);
});
test('overview quotas inherit defaults without records and preserve daily overrides', () => {
  const report = { saturationSettings: { productQuotas: { A: 100, B: 50 } }, records: {
    '2026-09-12|A': { member: 'A', saturation: { personalDefaults: { quota: 200, updated_at: '2026-09-12' } } },
    '2026-09-14|A': { member: 'A', saturation: { dailyProductQuota: 205 } },
    '2026-09-15|A': { member: 'A', saturation: { dailyProductQuota: 0 } }
  } };
  const before = JSON.stringify(report);
  assert.equal(context.suggestedProductQuota('A', ['2026-09-13'], report), 200);
  assert.equal(context.suggestedProductQuota('A', ['2026-09-14'], report), 205);
  assert.equal(context.suggestedProductQuota('A', ['2026-09-15'], report), 0);
  assert.equal(context.suggestedProductQuota('A', ['2026-09-13', '2026-09-14'], report), 405);
  assert.equal(context.suggestedProductQuota('B', ['2026-09-13'], report), 50);
  assert.equal(context.suggestedProductQuota('C', ['2026-09-13'], report), null);
  assert.equal(JSON.stringify(report), before);
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
