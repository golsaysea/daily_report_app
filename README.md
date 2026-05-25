# 小组报数日记

这是一个可以部署到 Vercel 的静态网页版本。网页本身只放界面代码，实际数据由成员在浏览器里选择同一个 Google Drive 桌面版同步文件夹来读写。

## 数据同步方式

1. 团队负责人在 Google Drive 里创建一个共享文件夹。
2. 每个成员电脑安装 Google Drive 桌面版，并同步这个共享文件夹。
3. 打开网页后点击“云端文件夹”。
4. 选择本机 Google Drive 里的同一个共享文件夹。
5. 应用会在该文件夹里创建或读取 `report_data.json`。

Vercel 不保存报数记录，不上传内部数据文件。数据文件仍在 Google Drive 共享文件夹里。

## Vercel 部署

在 Vercel 导入 GitHub 仓库后使用这些设置：

- Framework Preset: Other
- Build Command: 留空
- Output Directory: `.`
- Install Command: 可留空
- Root Directory: 仓库根目录

本项目已经包含 `vercel.json` 和 `.vercelignore`，部署时只上传：

- `index.html`
- `app.js`
- `styles.css`
- `vercel.json`

## 本地打开

可以直接双击 `run_web_app.bat`，或用 Chrome / Edge 打开 `index.html`。

推荐浏览器：

- Chrome
- Microsoft Edge

原因是网页需要浏览器支持文件夹选择权限，才能直接读写 Google Drive 本地同步文件夹。

## 注意

- 首次使用需要输入默认密码 `999`。
- 管理员可以在后台修改密码、成员、项目、定额和审核文案。
- 管理员可以在“同步与备份”里点击“提升高级管理员权限”，加载多个来源文件夹，按“当前文件夹 / 全部汇总 / 单个来源”切换整体预览。
- 高级管理员选择汇总文件夹后，可以把多个来源文件夹的 `report_data.json` 二次汇总写入总文件夹。
- 整体预览的成员达标表按组折叠显示；效率分析明细使用顶部成员标签切换，避免一次展开所有成员。
- 多人协作时建议每个成员只编辑自己的记录。
- 如果两个人同时修改同一天同一成员记录，最后保存的人会覆盖该记录。

## GitHub 安全构建

仓库包含 `.github/workflows/release.yml`。推送 `v*` 标签后，GitHub Actions 会：

- 执行 `npm run check`
- 执行 `npm audit --audit-level=moderate`
- 打包静态网页 zip
- 使用 `actions/attest-build-provenance@v2` 生成构建证明
- 由 `github-actions[bot]` 创建 Release 并上传产物
