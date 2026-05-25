# 安全预检记录

预检日期：2026-05-24

## 当前部署形态

- Vercel 只部署静态网页代码。
- 报数数据不上传 Vercel，不写入仓库。
- 团队数据保存在成员共同选择的 Google Drive 本地同步文件夹里。
- 数据文件名：`report_data.json`。

## 已处理

- `.gitignore` 排除本地数据、备份、日志、密钥和构建产物。
- `.vercelignore` 只允许 Vercel 上传静态网页必需文件。
- `vercel.json` 设置静态部署，无构建命令。
- 本地语法检查使用 `npm run check`。
- `.github/workflows/code-audit.yml` 执行语法检查和 `npm audit`。
- `.github/workflows/codeql.yml` 执行 JavaScript/TypeScript CodeQL 扫描。
- `.github/workflows/release.yml` 在 tag `v*` 上打包 Release zip，并使用 `actions/attest-build-provenance@v2` 生成安全构建证明。
- 高级管理员汇总功能只读取用户显式选择的来源文件夹和汇总文件夹，不会扫描任意本地目录。

## 本次功能变更审计

- 新增“提升高级管理员权限”，需要重新输入管理员密码。
- 高级管理员可加载多个来源文件夹，切换当前文件夹、全部汇总或单个来源文件夹查看。
- 汇总写入只写到用户选择的汇总文件夹 `report_data.json`。
- 整体预览按组折叠展示，降低信息过载。
- 效率分析明细改为顶部成员标签切换，不再一次性展开所有成员明细。

## 注意

浏览器端直接选择文件夹需要 Chrome / Edge 支持 File System Access API。Vercel 不能代替用户读取 Google Drive 账号，也不会保存 Google Drive 内部数据。
