# 学生管理系统 / AI 教培控制台进度

最后更新：2026-05-25

## 当前协作基线

- GitHub 仓库：`930187308-commits/student-management`
- 当前主协作分支：`feature/server-sqlite`
- Mac mini 项目目录：`/Users/bzx/Projects/student-ai-console`
- Mac mini 数据目录：`/Users/bzx/Data/student-ai-console`
- MacBook 开发目录：`~/Projects/student-ai-console/学生管理系统`
- 当前运行服务：Mac mini Node 服务，端口 `3000`
- 当前访问地址：
  - `http://localhost:3000`
  - `http://bzxdeMac-mini.local:3000`
  - `http://192.168.1.97:3000`
- 已停止旧服务：Python `8080` 同步服务

## 总路线

```text
阶段 0：协作与环境整理
阶段 1：前端清理收尾
阶段 2：Mac mini 服务器化 + SQLite
阶段 3：前端逐步接 API
阶段 4：AI 控制台首页与 AI 工作台
阶段 5：多 Agent 流程
```

## 阶段 0：协作与环境整理

状态：已完成

已完成：

- Mac mini 清理 Downloads 安装包。
- 建立 Mac mini 标准目录：
  - `/Users/bzx/Projects`
  - `/Users/bzx/Data/student-ai-console`
  - `/Users/bzx/Data/student-ai-console/backups`
  - `/Users/bzx/Logs/student-ai-console`
- 项目从 iCloud 迁出，改为 GitHub 同步。
- Mac mini 配置 GitHub SSH key。
- MacBook / Claude Code 与 Mac mini / Codex 分工明确。
- 停止并删除旧 Python `8080` 同步方案。
- 旧同步目录已归档：
  - `/Users/bzx/Data/student-ai-console/backups/legacy-python-sync-2026-05-25.tar.gz`
- `.DS_Store`、`.claude/settings.local.json` 已从 Git 跟踪中移除。

注意：

- iCloud 只用于 Obsidian 笔记、冷备份和资料同步，不再作为代码/数据库目录。
- Mac mini 是服务器与数据中心。
- MacBook 是主要开发入口。

## 阶段 1：前端清理收尾

状态：已完成

已完成：

- 删除 `index.html` 重复的 `tab-classes`、`tab-students` 容器。
- 新增考勤课次默认空记录，不再默认全员出勤。
- 学生删除改为归档/停课，不物理删除。
- 增加 `escapeHtml()`。
- 修复以下模块的展示层转义：
  - `student.js`
  - `fee.js`
  - `grade.js`
  - `communication.js`
  - `prospects.js`
- `.gitignore` 已覆盖：
  - `.DS_Store`
  - `.claude/`
  - 数据库
  - 备份
  - 日志
  - 导出文件

相关提交：

- `dbd67b1` 前端清理基础
- `4a116c0` 前端清理边界修复
- `2a4248c` HTML 转义覆盖
- `5fafe4f` 移除本地专属文件跟踪

## 阶段 2：Mac mini 服务器化 + SQLite

状态：进行中

已完成：

- 创建分支：`feature/server-sqlite`
- 新增 Node 后端骨架：
  - `server/server.js`
  - `server/db.js`
  - `server/config.js`
  - `server/README.md`
- 新增 `package.json`。
- 使用 Node 24 自带 `node:sqlite`。
- SQLite 数据库已创建：
  - `/Users/bzx/Data/student-ai-console/production.sqlite`
- 备份目录已创建：
  - `/Users/bzx/Data/student-ai-console/backups`
- 兼容当前前端的整包数据接口：
  - `GET /data`
  - `PUT /data`
- 新增基础 API：
  - `GET /api/health`
  - `GET /api/meta`
  - `POST /api/backups`
- 前端服务器地址已从写死 IP 改为当前访问源：
  - file 打开时 fallback 到 `http://localhost:3000`
  - 服务器访问时使用 `window.location.origin`
- 已验证：
  - Node 语法检查通过
  - `/api/health` 正常
  - `/data` 正常
  - `/api/backups` 正常
  - 静态首页可访问
- 生产模式已关闭自动生成示例数据。
- 已新增旧 JSON 导入工具：
  - `node server/import-json.js /path/to/backup-or-data.json`
  - 支持 raw data JSON 和 `{ data: ... }` 备份格式
  - 导入前会自动生成备份
- 已新增服务管理脚本：
  - `scripts/start-server.sh`
  - `scripts/stop-server.sh`
  - `scripts/status-server.sh`
- 已新增 launchd 托管脚本：
  - `scripts/run-server.sh`
  - `scripts/install-launchd.sh`
  - `scripts/uninstall-launchd.sh`
- 已新增命令行备份脚本：
  - `node server/create-backup.js manual`

下一步：

- 在 MacBook、Windows、iPad 浏览器验证：
  - `http://bzxdeMac-mini.local:3000`
  - `http://192.168.1.97:3000`
- 规划从整包 `/data` 逐步拆分到模块 API。

## 阶段 3：前端逐步接 API

状态：未开始

计划：

- 保留当前 UI，逐步替换数据读写层。
- 先迁移低风险模块：
  1. 班级
  2. 学生
  3. 收费
  4. 考勤
  5. 沟通
  6. 招生线索
  7. 成绩
  8. 报表

注意：

- 不一次性大改 UI。
- 每迁移一个模块就做增删改查验证。
- 真实数据录入前先完成备份与导入策略。

## 阶段 4：AI 控制台首页与 AI 工作台

状态：未开始

计划模块：

- 首页总览
- 待沟通家长
- 续费提醒
- 招生线索
- 学生风险
- 本周经营报告
- AI 工作台

第一批 AI 按钮：

- 生成学生阶段反馈
- 生成续费沟通话术
- 生成试听前诊断问题
- 生成试听后转化话术
- 生成朋友圈内容
- 生成本周经营报告

注意：

- AI 输出先让老师确认，不自动改收费、考勤、删除类数据。
- AI 输出记录进 `agent_logs` 或后续任务表。

## 阶段 5：多 Agent 流程

状态：未开始

计划 Agent：

- 教务 Agent
- 学情沟通 Agent
- 营销招生 Agent
- 教研 Agent
- 决策 Agent

原则：

- 每个 Agent 必须有明确输入、输出、确认步骤。
- 先建议，后半自动，最后才考虑自动执行。

## 当前风险与注意事项

- 当前前端仍是整份 `/data` 快照读写，还不是模块化 API。
- 当前 SQLite 表结构已预留，但前端尚未使用拆表数据。
- Node 的 `node:sqlite` 在 Node 24 中仍有实验警告，但当前可用。
- MacBook 需要切到 `feature/server-sqlite` 后再协作。
- 不要再启动旧 Python `8080` 服务。
- 不要把数据库、备份、真实学生数据提交到 GitHub。

## 给 Claude Code 的当前状态说明

```text
当前阶段：阶段 2，Mac mini 服务器化 + SQLite
当前主协作分支：feature/server-sqlite
请先只 pull 查看，不要修改后端/数据库。
如需前端配合，等 Codex 明确具体任务范围。
```
