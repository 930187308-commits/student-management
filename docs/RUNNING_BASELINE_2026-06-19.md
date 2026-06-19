# AI 教培工作台运行基线

更新时间：2026-06-19

## 当前定位

这是当前可运行的 AI 教培工作台基线记录，用于后续换设备、回滚、继续开发和验收。

当前主系统负责：

- 学员、班级、收费、考勤、成绩、沟通、意向学员管理。
- AI 系统问答，只读查询和建议。
- 资料库导入、摘要、引用。
- 首页待办、数据体检、经营概览。

数学题库系统已经拆为独立子工作台，不在主窗口承载细节实现。

## 运行入口

- 本机地址：http://localhost:3000
- 局域网地址：http://bzxdeMac-mini.local:3000
- 局域网 IP：http://192.168.1.98:3000
- LaunchAgent：`com.bzx.student-ai-console`
- 启动脚本：`/Users/bzx/Projects/student-ai-console/scripts/install-launchd.sh`
- 状态脚本：`/Users/bzx/Projects/student-ai-console/scripts/status-server.sh`

## 数据与配置

- 项目目录：`/Users/bzx/Projects/student-ai-console`
- 数据目录：`/Users/bzx/Data/student-ai-console`
- SQLite 数据库：`/Users/bzx/Data/student-ai-console/student-console.db`
- 备份目录：`/Users/bzx/Data/student-ai-console/backups`
- AI 配置文件：`/Users/bzx/Data/student-ai-console/ai.env`
- 日志目录：`/Users/bzx/Logs/student-ai-console`
- 默认 Obsidian 资料库：`/Users/bzx/Library/Mobile Documents/com~apple~CloudDocs/ObsidianVaults/AI 教培工作台`

## 当前 AI 规则

- 精确数据查询优先走后端事实查询，不让模型自由猜。
- 常见查询包括：学员学校、班级、年级人数、成绩、收费、欠费、课消、考勤、沟通、意向学员。
- 方案类问题，例如家长会、招生、沟通话术，默认不读取学员名单和系统明细。
- 只有用户明确说“结合我的系统数据/按班级/按学员/基于当前数据”时，方案类问题才读取系统摘要。
- AI 对话只读，不直接新增、修改、删除或发送业务数据。

## 资料库规则

- Obsidian 是资料原库。
- 系统资料库是 AI 实际读取层。
- 只写路径不能让 AI 理解资料正文。
- 已导入并保存摘要/原文的资料，才可被 AI 引用。
- 资料保存或导入后会自动生成 `knowledge_chunks` 片段，用于后续更精确引用。

## 基线冻结方式

本文件所在提交作为 2026-06-19 的当前可运行基线。

这次基线包含前端、后端、AI 问答、资料库和题库子工作台等多项连续改动。后续继续开发时，建议从该基线之后按模块拆分提交：

1. AI 系统问答可信化。
2. 资料库导入与引用。
3. 学员详情聚合与前端体验。
4. 数学题库子工作台相关文件。
5. 项目文档与运行基线。

进入下一轮大改前，需要先检查 `git status --short`，确认是否基于干净工作区继续。

## 验证命令

```bash
npm run check
npm run ai:system-qa-check
scripts/status-server.sh
```

## 当前验收口径

- 服务能在 3000 端口启动。
- SQLite 读取、字段拆分校验、数据体检、首页汇总、统计报表均通过。
- AI 问答回归测试通过。
- 普通建议类问题不误触发学员名单。
- 明确要求结合系统数据时，才读取系统摘要。
- 资料库资料有摘要/原文/分块后，AI 才作为可引用依据。
