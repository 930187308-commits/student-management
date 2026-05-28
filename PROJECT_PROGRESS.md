# AI 教培工作台项目进度

最后更新：2026-05-28

## 项目定位

这是一个面向个人教培业务的 AI 教培工作台。

当前核心模块是学生管理系统，已经从单机 HTML 原型升级为 Mac mini 本地服务器 + SQLite 数据中心 + 多设备访问的可用系统。后续会逐步扩展为教务、招生、教研、经营分析和 AI Agent 协作平台。

## 当前协作基线

- GitHub 仓库：`930187308-commits/student-management`
- 当前主协作分支：`feature/server-sqlite`
- 当前最新提交：`db876dc`
- 当前稳定标签：`stage-2-real-data-operational`
- Mac mini 项目目录：`/Users/bzx/Projects/student-ai-console`
- Mac mini 数据目录：`/Users/bzx/Data/student-ai-console`
- MacBook 开发目录：`~/Projects/student-ai-console/学生管理系统`
- 当前运行服务：Mac mini Node 服务，端口 `3000`
- 当前访问地址：
  - `http://localhost:3000`
  - `http://bzxdeMac-mini.local:3000`
  - `http://192.168.1.97:3000`
- 已停止旧服务：Python `8080` 同步服务

## 协作分工

- MacBook / Claude Code：前端小功能、UI、录入体验优化、表单和列表交互。
- Mac mini / Codex：架构、后端、SQLite、部署、服务验证、Git 合并验收、阶段规划。
- GitHub：作为唯一代码同步来源，不再使用 iCloud 同步代码或数据库。
- Obsidian：记录学习日记、想法和个人复盘，不存放真实业务数据库。

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

状态：真实数据导入成功，可运行基线已确认

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
- 已新增整包写入防覆盖保护：
  - `GET /data` 返回服务器数据版本号
  - `PUT /data` 必须携带读取时的数据版本号
  - 旧页面、旧缓存、其他设备已更新后的旧数据写入会被拒绝
  - 前端不再用本地缓存自动覆盖服务器数据
  - 已取消 30 秒自动保存，改为用户操作时立即保存
- 已更新 GitHub 稳定基线标签：
  - `stage-2-sync-baseline`
  - 当前指向：`25f429d`
  - 含义：Mac mini 本地服务器同步、前端常用流程、测试数据验证、调课考勤等已通过初步实用验证
- 已新增大规模测试数据与恢复工具：
  - `scripts/node.sh server/generate-test-data.js`
  - `scripts/node.sh server/import-json.js /path/to/test-data.json`
  - `scripts/node.sh server/reset-empty-data.js`
- 已新增测试清单：
  - `TEST_PLAN.md`
- 已完成一批实际使用优化：
  - 班型、年级自定义管理
  - 缴费、成绩、沟通支持搜索选择学员
  - 意向学员、收费、成绩、沟通按日期倒序
  - 学员未分班筛选
  - 沟通记录可编辑并修改状态
  - 新增学员按创建时间优先显示
  - 考勤支持临时调课/临时到课学员
- 已完成真实数据录入第一批优化：
  - 学员新增首次入学时间字段
  - 学校输入支持从系统已有学校联想
  - 意向学员新增年级、微信号
  - 意向学员转正式学员时带入年级、来源、微信和意向信息
  - 首页班级概览“查看学员”可正确跳转并筛选班级
  - 修复相关 HTML 转义和边界问题

已完成真实数据录入第二批、第三批及导入体验优化：

- 意向学员模板补充年级、微信字段。
- 学校分布统计。
- 课消统计口径统一。
- 首页班级概览改为计划课次、已进行课次。
- 组班中逻辑调整为意向学员状态，组班班级可拉入意向学员。
- 班级成员管理支持搜索和按年级分区。
- 考勤课次支持编辑、删除、导入日期标准化。
- 导入流程增加预检查、重复记录处理、汇总提示。
- 学员姓名匹配去空格，避免中文和数字之间空格导致匹配失败。
- 考勤转班显示优化：
  - 转入学生标记“转入”。
  - 转出学生在原班考勤中标记“转出”。
  - 停课学生已有考勤保留，并标记“停课”。
  - 无考勤历史的转班学生不再保留在原班考勤中。
- 数据管理新增“一键导出所有学员”。
- 顶部新增“撤回上一步”，支持撤回最近一次保存的修改。
- 意向学员列表调整为以微信、目前成绩、备注为主；备注列表截断显示，鼠标悬停可预览完整内容。
- 导入预检查弹窗支持展开查看失败、跳过、重复、无匹配等明细。
- 收费记录、意向学员、学员管理新增选中后批量导出/删除入口。
- 成绩记录、沟通记录新增选中后批量导出/删除入口。
- 批量操作改为“多选模式”，默认隐藏复选框，点多选后再显示。
- 成绩记录新增年级筛选。
- 防误删、防脏数据、可回退机制继续增强：
  - 后端新增备份列表接口和恢复备份接口。
  - 数据管理新增“备份列表”，支持查看服务器备份、手动创建备份、恢复到指定备份。
  - 恢复备份前会自动创建一份“恢复前备份”。
  - 一键清理、一键清空、重置示例数据、导入本地备份前会自动创建服务器备份。
  - 学员、收费、意向、成绩、沟通的批量删除前会自动创建服务器备份。
- 班级删除改为“归档/已结课”，不再物理删除班级，避免后续考勤历史产生孤儿数据。
- 数据管理新增“数据体检”工具：
  - 检查不存在班级的考勤。
  - 检查考勤记录中不存在的学员 ID。
  - 提示空考勤课次、课时余额为负、在读无已缴课时、超过容量班级。
  - 安全清理只处理不存在班级的考勤和不存在学员 ID 的考勤记录。
  - 课时余额为负、在读无已缴课时支持展开查看具体学员明细。
  - 明细中可点击“补录欠费”，打开收费弹窗并预填欠费状态，由人工确认后保存。
  - 欠费体检口径已调整：
    - 已登记欠费记录的学员不再重复提示补录欠费。
    - “需补欠费记录”只显示已出勤且已缴课时 + 欠费课时仍不足覆盖已消课时的学员。
    - “已缴余额为负”保留为参考口径，不提供补录按钮。
  - 顶部工具栏已新增“数据体检”独立入口，便于日常快速检查。
  - 数据体检按钮新增异常角标，只统计需要处理的项目：
    - 不存在班级的考勤。
    - 不存在学员的考勤记录。
    - 已删除学员的收费记录。
    - 需补欠费记录。
    - 上课无收费记录。
    - 空课次、超容量、已缴余额为负参考不计入角标。
  - 数据体检新增收费记录检查：
    - 已删除学员的收费记录会影响首页已收/欠费统计，纳入安全清理。
    - 停课/退费/毕业学员的收费记录作为历史财务参考，不自动删除。
    - 修复安全清理数量未计入已删除学员收费记录的问题。
  - 数据管理界面做了轻量整理：
    - 数据体检保留在顶部独立入口，数据管理内部不再重复显示。
    - 复制/保存 JSON 收进“高级 JSON 工具”。
    - 顶部说明改为 Mac mini 本地服务器同步口径。
- 2026-05-28 已执行一次真实数据安全清理：
  - 清理不存在班级的考勤 32 条。
  - 清理后不存在学员的考勤记录为 0。
  - 空考勤课次保留，作为提前建课后续录入的正常业务状态。
  - 课时余额为负、在读无已缴课时暂只作为提醒，不自动生成欠费记录。

当前稳定结论：

- 真实数据已基本导入完成。
- 2026-05-28 已创建真实数据可运行基线备份。
- 当前关键数据体检项为 0：
  - 不存在班级的考勤：0
  - 不存在学员的考勤记录：0
  - 已删除学员的收费记录：0
- 欠费提醒已在数据体检中体现，暂不单独新增重复功能。
- 班级管理批量拉入/移出暂不做，当前单点拉入/移出已够用。
- 下一步进入阶段 3：从整包 `/data` 逐步拆分到模块 API。

## 阶段 3：前端逐步接 API

状态：进行中

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
- 迁移前必须确认备份与恢复策略。
- 已录入真实数据后，任何数据结构调整都必须先备份。

阶段 3A 已开始：

- 后端新增模块级整表 API：
  - `GET /api/classes`
  - `PUT /api/classes`
  - `GET /api/students`
  - `PUT /api/students`
- 模块 API 仍以当前整包数据为底层来源，只替换指定数组，保留 `/data` 兜底。
- 模块 API 沿用数据版本号校验，避免旧页面覆盖新数据。
- 前端新增模块访问函数：
  - `loadClassesFromApi()`
  - `saveClassesToApi(classes)`
  - `loadStudentsFromApi()`
  - `saveStudentsToApi(students)`
- 已将班级新增、编辑、导入的保存路径切到 `/api/classes`。
- 班级归档、组班转正式清理、班级成员拉入/移出仍保留整包保存，因为会联动意向学员或学员数据。
- 已将学员新增、编辑、删除、批量处理、导入的保存路径切到 `/api/students`。
- 后端新增 `/api/prospects` 模块 API。
- 已将意向学员新增、编辑、删除、批量删除、导入的保存路径切到 `/api/prospects`。
- 意向学员转正式、班级成员拉入/移出仍保留整包保存，因为会联动多个模块。
- 后端新增 `/api/fees` 模块 API。
- 已将收费新增、编辑、删除、批量删除保存路径切到 `/api/fees`。
- 收费导入在不自动新建学员时走 `/api/fees`；如果选择自动新建学员，继续保留整包保存。
- 后端新增 `/api/attendance` 模块 API。
- 已将考勤课次新增、编辑、删除，考勤格修改，临时学员添加/移除，考勤导入保存路径切到 `/api/attendance`。
- 后端新增 `/api/grades`、`/api/communications` 模块 API。
- 已将成绩新增、编辑、删除、批量删除、导入保存路径切到 `/api/grades`。
- 已将沟通记录新增、编辑、删除、批量删除保存路径切到 `/api/communications`。
- 后端新增配置类模块 API：
  - `/api/communicationTopics`
  - `/api/prospectSources`
  - `/api/classTypes`
  - `/api/gradeOptions`
- 已将沟通主题、招生渠道、班型、年级管理切到对应配置 API。
- 当前 UI 暂不改变，阶段 3 的常用业务模块已基本完成模块 API 拆分。

## 后续业务规则规划

状态：待设计，不在当前第二批前端优化中直接实现

### 学校历史记录

- 当前不做复杂结构，仅继续兼容 `school` 字段。
- 未来学员应支持 `schoolHistory`，记录小学、初中等不同学段的学校经历。
- 示例：
  - 小学：A 学校
  - 初中：B 学校
  - 或小学、初中均为同一所学校
- 旧数据 `school` 字段不能丢，后续可作为当前学校或默认学校经历迁移。
- 学校分布统计短期按当前 `school` 字段统计，后续再明确是否按当前学校或全部学校经历统计。

### 自动升年级

- 当前不做静默自动修改。
- 未来结合学期/学年设置，提供“一键预览 -> 用户确认 -> 批量升年级”流程。
- 必须保留操作记录，避免误改真实数据。

### 欠费与续费提醒

- 当前不自动生成欠费记录。
- 未来先统一概念：
  - 已缴课时
  - 已消课时
  - 请假课时
  - 剩余课时
  - 欠费金额
  - 续费提醒阈值
- 系统可以先生成提醒，不直接创建收费记录。

### 首页备忘录 / 待办

- 当前不做。
- 未来作为 AI 控制台的一部分，和招生跟进、待沟通、续费提醒、经营周报联动。

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
- 不要把真实学生姓名、电话、学校、家长微信、收费明细写入项目进度文件。
- 新开聊天时，先读取本文件，再继续当前阶段任务。

## 给 Claude Code 的当前状态说明

```text
当前项目：AI 教培工作台
当前阶段：阶段 2，Mac mini 服务器化 + SQLite，可用基线已确认
当前主协作分支：feature/server-sqlite
请先 git pull origin feature/server-sqlite，然后读取 PROJECT_PROGRESS.md。
前端小功能和录入体验优化可以由 Claude Code 做。
后端、SQLite、部署、数据同步、备份恢复、API 拆分请交给 Mac mini / Codex。
不要录入真实学生信息到测试数据或 GitHub。
```
