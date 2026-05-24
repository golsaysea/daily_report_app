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

## 注意

浏览器端直接选择文件夹需要 Chrome / Edge 支持 File System Access API。Vercel 不能代替用户读取 Google Drive 账号，也不会保存 Google Drive 内部数据。
