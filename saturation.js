/* Daily capacity uses the recorded settings so later edits do not rewrite history. */
const Saturation = (() => {
  const options = ['个人事情时间', '上班时间', '上学时间', '听交通时间', '聚会时间', '值日做饭时间', '买菜时间', '干农活时间'];
  const number = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  function calculate(items, rules, baseHours, deductions = {}) {
    const base = number(baseHours) || 14;
    const deducted = Object.values(deductions).reduce((sum, value) => sum + number(value), 0);
    const available = Math.max(0, base - deducted);
    const target = available / base;
    const missing = [];
    const details = Object.entries(items || {}).map(([name, value]) => {
      const amount = number(value), quota = number(rules?.[name]);
      if (amount && !quota) missing.push(name);
      return { name, amount, quota, value: quota ? amount / quota : 0, adjusted: quota * target };
    });
    const total = details.reduce((sum, row) => sum + row.value, 0);
    const ratio = target ? total / target : null;
    const status = deducted > base ? '杂项时间超出基准' : !available ? '无可用工作时间' : missing.length ? '项目日量未设置' : total + 1e-9 >= target ? '饱和' : '未饱和';
    return { base, deducted, available, target, total, ratio, status, details, missing };
  }
  return { options, calculate };
})();

function saturationSettings() {
  return data.saturationSettings || { memberHours: {}, options: Saturation.options };
}
function archiveLegacyWorkload() {
  if (data.legacyWorkloadArchive) return;
  createBackup('每日饱和统计启用前');
  data.legacyWorkloadArchive = {
    archivedAt: new Date().toISOString(), rules: clone(data.rules),
    workloadQuota: data.workloadQuota, memberWorkloadQuotas: clone(data.memberWorkloadQuotas || {}),
    dailyWorkloadQuotas: clone(data.dailyWorkloadQuotas || {}), totalConversionRules: clone(data.totalConversionRules || {})
  };
}
function saturationRecordInput() {
  const deductions = { ...(currentRecord().saturation?.deductions || {}) };
  document.querySelectorAll('[data-saturation-time]').forEach(input => { deductions[input.dataset.saturationTime] = Number(input.value || 0); });
  const previous = currentRecord().saturation;
  return {
    baseHours: previous?.baseHours ?? saturationSettings().memberHours?.[currentMember] ?? 14,
    rules: previous?.rules || { ...data.totalConversionRules },
    deductions
  };
}
function renderSaturationEntry(record) {
  let box = document.getElementById('saturationEntry');
  if (!box) {
    box = document.createElement('section');
    box.id = 'saturationEntry';
    document.getElementById('entryInputs').after(box);
  }
  const saved = record.saturation;
  const names = [...new Set([...(saturationSettings().options || Saturation.options), ...Object.keys(saved?.deductions || {})])];
  box.innerHTML = `<h3>每日工作饱和量</h3><div id="saturationSummary" role="status"></div><div class="saturation-times">${names.map(name => `<label>${escapeHtml(name)}<input type="number" min="0" max="24" step="0.25" data-saturation-time="${escapeAttr(name)}" value="${Number(saved?.deductions?.[name] || 0)}" aria-label="${escapeAttr(name)}（小时）"></label>`).join('')}</div><details><summary>换算明细</summary><div id="saturationDetails"></div></details>`;
  box.querySelectorAll('input').forEach(input => { input.oninput = () => { preview(); scheduleDraftSave(); }; });
  const refresh = document.createElement('button');
  refresh.type = 'button'; refresh.textContent = '按最新标准重算当天';
  refresh.onclick = () => {
    saveFormSilently();
    const saved = saturationRecordInput();
    currentRecord().saturation = { ...saved, baseHours: saturationSettings().memberHours?.[currentMember] ?? 14, rules: { ...data.totalConversionRules } };
    currentRecord().updated_at = new Date().toISOString();
    markPendingCloudRecord(currentDate, currentMember);
    persistLocal(); scheduleRecordCloudSave(); preview();
  };
  box.appendChild(refresh);
}
function previewSaturation(items) {
  const settings = saturationRecordInput();
  const result = Saturation.calculate(items, settings.rules, settings.baseHours, settings.deductions);
  const box = document.getElementById('saturationSummary');
  if (box) box.textContent = `${result.status} · 饱和量 ${fmt(result.total)} / ${fmt(result.target)} · ${result.ratio === null ? '—' : fmt(result.ratio * 100) + '%'} · 基准 ${fmt(result.base)} 小时 · 杂项 ${fmt(result.deducted)} 小时 · 工作 ${fmt(result.available)} 小时`;
  document.querySelectorAll('[data-saturation-item]').forEach(el => {
    const row = result.details.find(row => row.name === el.dataset.saturationItem);
    el.textContent = row?.quota ? `工作饱和量 ${fmt(row.value)}` : '饱和日量未设置';
  });
  const details = document.getElementById('saturationDetails');
  if (details) details.textContent = result.details.filter(row => row.amount).map(row => `${row.name}：${row.amount} ÷ ${row.quota || '未设置'} = ${fmt(row.value)}；当日目标 ${fmt(row.adjusted)}`).join('；');
  return result;
}
function renderSaturationAdmin() {
  let box = document.getElementById('saturationAdmin');
  if (!box) {
    box = document.createElement('section'); box.id = 'saturationAdmin';
    document.getElementById('rulesBox').after(box);
  }
  const settings = saturationSettings();
  box.innerHTML = `<h3>每日饱和时间设置</h3><div class="saturation-times">${reportMembers(data).map(name => `<label>${escapeHtml(name)} · 基准小时<input type="number" min="0.25" max="24" step="0.25" data-member-hours="${escapeAttr(name)}" value="${settings.memberHours?.[name] ?? 14}"></label>`).join('')}</div><label>杂项时间选项<textarea id="saturationOptions">${escapeHtml((settings.options || Saturation.options).join('\n'))}</textarea></label>`;
  const save = () => {
    archiveLegacyWorkload();
    const memberHours = { ...settings.memberHours };
    box.querySelectorAll('[data-member-hours]').forEach(input => { memberHours[input.dataset.memberHours] = Math.min(24, Math.max(0.25, Number(input.value) || 14)); });
    data.saturationSettings = { memberHours, options: [...new Set(document.getElementById('saturationOptions').value.split(/\r?\n/).map(s => s.trim()).filter(Boolean))] };
    scheduleSave('admin');
  };
  box.querySelectorAll('input,textarea').forEach(input => { input.onchange = save; });
  const backup = document.createElement('button');
  backup.textContent = '导出旧工作量备份';
  backup.onclick = () => downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `工作量备份-${currentDate}.json`);
  box.appendChild(backup);
}
function renderSaturationOverview() {
  const parent = document.getElementById('overviewView');
  if (!parent) return;
  let box = document.getElementById('saturationOverview');
  if (!box) { box = document.createElement('section'); box.id = 'saturationOverview'; parent.appendChild(box); }
  const report = reportData(), range = overviewRangeInfo();
  const groups = new Set(selectedOverviewGroups(report));
  const members = reportMembers(report).filter(name => groups.has(report.memberGroups?.[name] || report.groups[0]));
  const days = buildDateRange(range.start, range.end).reverse();
  const rows = [];
  for (const day of days) for (const member of members) {
    const record = report.records?.[`${day}|${member}`];
    const saved = record?.saturation;
    const result = saved ? Saturation.calculate(record.items, saved.rules, saved.baseHours, saved.deductions) : null;
    rows.push([day, member, result ? fmt(result.available) : '—', result ? fmt(result.total) : '—', result ? fmt(result.target) : '—', result?.ratio != null ? fmt(result.ratio * 100) + '%' : '—', result?.status || '未结算']);
  }
  box.innerHTML = `<h3>每日工作饱和结算</h3><div class="saturation-table"><table><thead><tr>${['日期','成员','工作小时','饱和量','当日目标','饱和度','状态'].map(value => `<th>${value}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${escapeHtml(value)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
