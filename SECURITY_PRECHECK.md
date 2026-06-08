# 安全预检报告

## 项目信息

- 项目名称：daily_report_app
- GitHub 地址：https://github.com/secure-artifacts/daily_report_app
- 预检时间：2026-06-08
- 预检文档：https://tpscsm-docs.pages.dev/ai/pre-check
- 预检结果：代码侧已修复并通过本地检查；GitHub 告警明细 API 需要仓库权限 Token 才能最终确认。

## 本次修复

- 移除代码内置弱默认密码，项目不再提供硬编码默认登录口令。
- Vercel 团队同步接口只接受 `TEAM_SYNC_TOKEN` 或 `APP_PASSWORD`，不再接受 `CLOUD_BACKUP_TOKEN` / `BACKUP_TOKEN`。
- Vercel 云同步不再把 `APP_PASSWORD` 环境变量写入团队数据 JSON，避免把服务端密钥回传到客户端。
- 本地开发服务器不再把旧弱口令当作兜底密码。
- 输入时增加保护窗口：用户正在输入时，后台轮询不会立刻拉取并重绘页面，降低“吞字”风险。
- Vercel 响应新增 CSP、`X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer`、`Permissions-Policy`、`X-Frame-Options: DENY`。
- 新增 `.github/dependabot.yml`，每周检查 npm 依赖和 GitHub Actions。
- `npm run check` 纳入 `server.cjs` 语法检查。
- README 更新 Vercel 数据安全说明，要求使用强随机口令。

## Vercel 数据安全说明

- 数据库连接串和访问口令应只存在于 Vercel Environment Variables。
- Postgres 中保存的是应用数据 JSONB 和历史快照，不保存数据库连接串。
- 团队实时同步口令和云备份口令已分离，避免一个备份口令同时具备团队数据读写权限。
- 云端数据是否“安全”还取决于 Vercel 账号、GitHub 仓库权限、Postgres 供应商权限、环境变量保护和口令强度；建议立即轮换旧的弱口令，使用至少 16 位随机口令。

## 检查结果明细

### 1. CI 构建 & Attestation

- 状态：已配置
- CI Workflow：`.github/workflows/release.yml`
- 产物：tag `v*` 触发 zip 打包
- Attestation：使用 `actions/attest-build-provenance@v2`
- 本次说明：当前提交需要推送后由 GitHub Actions 重新运行；本地已确认 workflow 文件存在。

### 2. Code Scanning

- 状态：已配置
- Workflow：`.github/workflows/codeql.yml`
- 扫描引擎：CodeQL JavaScript/TypeScript
- 本次修复：移除硬编码默认密码和跨接口口令混用风险。
- 告警 API：匿名访问 `code-scanning/alerts` 返回 401，需要仓库权限 Token 才能读取 open 告警数量。

### 3. Secret Scanning

- 状态：仓库侧需权限确认
- 本地修复：移除 README 中弱默认密码建议；避免服务端环境变量进入同步数据。
- 告警 API：匿名访问 `secret-scanning/alerts` 返回 401，需要仓库权限 Token。

### 4. Dependabot

- 状态：已配置
- 配置文件：`.github/dependabot.yml`
- 本地依赖审计：`npm audit --audit-level=moderate` 通过，0 个漏洞。
- 告警 API：匿名访问 `dependabot/alerts` 返回 401，需要仓库权限 Token。

## 本地验证

| 检查项 | 结果 |
| --- | --- |
| `npm run check` | 通过 |
| `npm audit --audit-level=moderate` | 通过，0 vulnerabilities |
| 硬编码默认密码断言 | 通过 |
| 云同步/备份口令分离断言 | 通过 |
| Vercel 安全头断言 | 通过 |
| Dependabot 配置断言 | 通过 |

## 执行步骤记录

| 步骤 | 操作内容 | 状态 |
| --- | --- | --- |
| Step 0 | 环境准备，确认本地仓库、远端、工具可用性 | 完成 |
| Step 1 | 确认代码已同步到 GitHub 远端 | 完成 |
| Step 2 | 检查并补齐 CI、CodeQL、Dependabot、Vercel 安全头 | 完成 |
| Step 3 | 检查 Release/Attestation workflow 配置 | 已配置，推送后由 GitHub Actions 运行 |
| Step 4 | 开启安全扫描配置 | CodeQL/Dependabot 已配置；Secret Scanning 需仓库设置权限确认 |
| Step 5 | 查询 GitHub 安全告警 | API 需要鉴权，当前环境匿名访问 401 |
| Step 6 | 修复发现的安全问题 | 完成 |
| Step 7 | 最终本地验证 | 完成 |
| Step 8 | 生成预检报告 | 完成 |

## 后续需要人工确认

1. 在 GitHub 仓库 Security 页确认 Code Scanning、Secret Scanning、Dependabot 均已启用。
2. 推送本次提交后，等待 GitHub Actions / CodeQL 完成。
3. 使用有权限的 GitHub Token 查询三类 open alerts，确认 Critical/High 均为 0。
4. 在 Vercel 重新部署后，轮换旧 `TEAM_SYNC_TOKEN` / `APP_PASSWORD` / `CLOUD_BACKUP_TOKEN`，不要继续使用弱口令。
