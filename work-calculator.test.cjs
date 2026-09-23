const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js', 'utf8');
const context = vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function calculateWorkDays('), source.indexOf('function updateWorkCalculator(')), context);
test('sums independent project days without early rounding', () => {
  const result = context.calculateWorkDays([{name:'hook',quantity:122,daily:10},{name:'phrase',quantity:150,daily:150}]);
  assert.equal(result.valid, true);
  assert.equal(context.workDaysText(result.total), '13.2');
  assert.equal(result.details[0].days, 12.2);
});
test('rejects missing, negative, zero-divisor and overflowing inputs', () => {
  for (const row of [{name:'',quantity:1,daily:1},{name:'a',quantity:'',daily:1},{name:'a',quantity:-1,daily:1},{name:'a',quantity:1,daily:0},{name:'a',quantity:1,daily:-1},{name:'a',quantity:1e308,daily:1e-308}]) {
    assert.equal(context.calculateWorkDays([row]).valid, false);
  }
  assert.equal(context.calculateWorkDays([]).valid, false);
  assert.equal(context.calculateWorkDays([{name:'a',quantity:0,daily:10}]).valid, true);
});
