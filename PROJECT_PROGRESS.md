# AI 教培工作台项目进度

最后更新：2026-06-02

## 项目定位

这是一个面向个人教培业务的 AI 教培工作台。

当前核心模块是学生管理系统，已经从单机 HTML 原型升级为 Mac mini 本地服务器 + SQLite 数据中心 + 多设备访问的可用系统。后续会逐步扩展为教务、招生、教研、经营分析和 AI Agent 协作平台。

## 当前协作基线

- GitHub 仓库：`930187308-commits/student-management`
- 当前主协作分支：`feature/server-sqlite`
- 当前最新提交：以 GitHub `feature/server-sqlite` 最新 HEAD 为准
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
阶段 5：真实 AI 接入边界与多 Agent 流程
阶段 6：AI 工作台重组、内容生产、题库与资料库
阶段 7：资料库、语料库、题库后端底座
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
- 班级“已结课”和“归档”已拆开：已结课仍显示在班级主列表，归档才移动到“归档班级”入口。
- 班级状态改为已结课时，如仍有关联在读/待续费学员，系统会询问是否批量改为待续费，方便后续续班和续费沟通。
- 班级列表和展开成员会同时显示在读、待续费学员；待续费用黄色圆点标记。
- 归档班级管理支持搜索、展开查看历史学员和上课记录、放回主列表；测试/误建班级可在这里彻底删除，并会先创建服务器备份。
- 正常上课班级不能直接归档，需先改为已结课或组班中，避免误把当前班级收纳。
- 班级归档时会保存历史学员快照，后续学员续费、转班或状态改回在读，不影响归档班级中查看原成员。
- 彻底删除非在读学员前，如果仍有欠费记录，系统会弹出欠费提醒；批量删除同样会汇总欠费人数、条数、课时和金额。
- 数据体检中“已有收费但课时不足”和“上课无收费记录”不重叠显示，避免重复提醒。
- 下一步进入阶段 3B：真正 SQLite 拆表规划。

## 阶段 3：前端逐步接 API

状态：基本完成

已完成：

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
- 后端新增 `PUT /api/batch`，用于一次保存多个相关集合。
- 已将意向学员转正式、组班转正式清理、班级归档、班级成员拉入/移出、收费导入自动新建学员、数据体检安全清理改为模块批量保存。
- 当前只保留导入本地备份、一键清空、重置示例数据等整包覆盖操作继续使用 `/data`。
- 当前 UI 暂不改变，阶段 3 的常用业务模块和联动操作已基本完成 API 拆分。

## 阶段 3B：SQLite 真实拆表规划

状态：已完成运行基线，继续进入阶段 3C

原则：

- 先规划表结构和迁移脚本，不直接动真实数据。
- 继续保留现有 `app_state` 快照作为回退来源，拆表后也要能一键导出完整 JSON。
- 优先拆稳定、边界清楚的表：
  1. students
  2. classes
  3. fees
  4. attendance_sessions / attendance_records
  5. prospects
  6. grades
  7. communications
- 先做只读校验和双写/对账，再切换读路径。
- 每拆一个模块，都要验证数量、引用关系、课消统计、欠费统计和导出结果。

已完成：

- 新增拆表规划文档：`docs/STAGE_3B_SQLITE_SPLIT_PLAN.md`。
- 新增只读对账脚本：`server/reconcile-sqlite-split.js`。
- 新增命令：`npm run sqlite:reconcile`。
- 当前对账脚本只读取 `app_state.data` 和 SQLite 表数量，不写入数据库。
- 新增 dry-run 迁移脚本：`server/migrate-app-state-to-tables.js --dry-run`。
- 新增命令：`npm run sqlite:migrate:dry-run`。
- dry-run 只模拟 JSON 快照到实体表的行转换、引用检查和重复 ID 检查，不写入数据库。
- 迁移脚本已支持 `--apply`，执行前会自动创建服务器备份，并把 `app_state.data` 写入实体表。
- 新增命令：`npm run sqlite:migrate:apply`。
- 已执行一次真实写入，写入前自动备份：
  - `/Users/bzx/Data/student-ai-console/backups/student-console-2026-05-28T14-41-31-121Z.sqlite`
  - `/Users/bzx/Data/student-ai-console/backups/student-console-2026-05-28T14-41-31-121Z.json`
- 写入后 `reconcile` 显示实体表数量已与 `app_state` 快照一致。
- 对账脚本已增强为同时比较统计口径：课消、已缴/欠费记录数、已缴/欠费金额、孤儿引用。
- 后端 `setData()` 已改为双写：保存 `app_state.data` 的同时，在同一个事务内同步 SQLite 实体表。
- 双写阶段仍然保持 API 读路径来自 `app_state.data`，实体表用于对账和后续切读准备。
- 已试切低风险读路径：
  - `GET /api/classes` 从 SQLite `classes.raw_json` 读取。
  - `GET /api/students` 从 SQLite `students.raw_json` 读取。
  - `GET /api/prospects` 从 SQLite `prospects.raw_json` 读取。
  - `GET /api/fees` 从 SQLite `fees.raw_json` 读取。
  - `GET /api/attendance` 从 SQLite `attendance_sessions.raw_json` 读取，保持现有整节课 JSON 结构。
  - `GET /api/grades` 从 SQLite `grades.raw_json` 读取。
  - `GET /api/communications` 从 SQLite `communications.raw_json` 读取。
- `/data` 和其他模块 API 仍继续从 `app_state.data` 读取。
- 新增验证接口 `GET /api/data-sqlite`，从 SQLite 实体表组装完整数据，用于和 `/data` 做并行对比。
- 正式 `/data` 仍不切换。
- 新增安全开关：`STUDENT_READ_FULL_DATA_FROM_SQLITE=1` 时，正式 `/data` 才会从 SQLite 实体表组装读取。
- 新增切换脚本：`scripts/set-sqlite-data-read.sh on|off|status`。
- 新增命令：
  - `npm run sqlite:data-read:on`
  - `npm run sqlite:data-read:off`
  - `npm run sqlite:data-read:status`
- 已开启正式 `/data` SQLite 读路径：launchd 环境变量 `STUDENT_READ_FULL_DATA_FROM_SQLITE=1`。
- 开启后验证 `/data` 与 `/api/data-sqlite` 完全一致，`reconcile` 仍为 `all_tables_match_snapshot`。
- 新增状态接口：`GET /api/sqlite/status`，用于查看当前 `/data` 是否走 SQLite、实体表是否与快照一致、健康统计是否一致。
- 新增运行时检查脚本：`server/check-sqlite-runtime.js`。
- 新增命令：`npm run sqlite:runtime-check`。

下一步：

- 继续运行 reconcile 和业务操作验证。
- 若发现问题，执行 `scripts/set-sqlite-data-read.sh off` 立刻回退到 `app_state.data` 读路径。

## 阶段 3C：SQLite 字段化读取准备

状态：第一批已完成

目标：

- 在保留 `raw_json` 回退能力的前提下，逐步把高价值字段拆成真正的 SQLite 列。
- 先做字段覆盖检查，不直接改真实表结构。
- 优先处理会影响查询、统计、筛选和后续 AI 分析的字段。

已完成：

- 新增只读字段覆盖检查脚本：`server/check-sqlite-field-coverage.js`。
- 新增命令：`npm run sqlite:field-coverage`。
- 检查脚本只输出字段名、覆盖数量和候选字段，不输出真实学生姓名、电话、学校等数据内容。
- 已给以下表补充高价值字段列，并继续保留 `raw_json`：
  - `classes`：计划课次、归档状态、归档时间、归档学员快照。
  - `students`：首次入学时间、跟进状态、创建时间、转入/转出课次标记。
  - `prospects`：年级、微信、所属组班。
  - `fees`、`grades`、`communications`：学员显示名。
- 已同步更新双写逻辑和迁移脚本，后续保存会同时写入实体列和 `raw_json`。
- 已执行迁移 apply 补齐当前实体表字段，执行前自动创建服务器备份。
- 字段覆盖检查结果：
  - 班级、学员、意向学员、收费、考勤、成绩、沟通的当前真实字段 `rawOnlyFieldCount` 均为 0。
- 新增字段化读取一致性检查脚本：`server/check-sqlite-field-read-parity.js`。
- 新增命令：`npm run sqlite:field-read-parity`。
- 该脚本只比较实体列与 `raw_json` 中同名业务字段是否一致，不输出真实字段值。
- 新增字段化读路径旁路接口：`GET /api/data-sqlite-columns`。
- 新增字段化读路径运行时检查：`server/check-sqlite-column-read-runtime.js`。
- 新增命令：`npm run sqlite:column-read-check`。
- 当前正式 `/data` 不直接切换到字段化读路径，先通过旁路接口与 `GET /api/data-sqlite` 做全量 JSON 对比。
- 新增字段化正式读路径开关：
  - `scripts/set-sqlite-column-read.sh on|off|status`
  - `npm run sqlite:column-read:on`
  - `npm run sqlite:column-read:off`
  - `npm run sqlite:column-read:status`
- 字段化正式读路径已开启：
  - 当前 `SQLite /data read: ON`
  - 当前 `SQLite column /data read: ON`
  - 字段化读路径与 `raw_json` 读路径全量 JSON 对比一致。
  - 如发现异常，可执行 `scripts/set-sqlite-column-read.sh off` 回退到 SQLite `raw_json` 读路径。
- 新增 SQLite 字段列指标模块：`server/sqlite-metrics.js`。
- 新增指标接口：`GET /api/sqlite/metrics`。
- 新增指标对账脚本：`server/check-sqlite-metrics-runtime.js`。
- 新增命令：`npm run sqlite:metrics-check`。
- 指标对账会比较 `app_state` 快照算法与 SQLite 字段列算法，确保班级/学员/收费/考勤/成绩/沟通等基础指标一致。
- 新增报表汇总接口：`GET /api/reports/summary`。
- 新增报表汇总检查脚本：`server/check-reports-summary-runtime.js`。
- 新增命令：`npm run reports:summary-check`。
- 统计报表页已接入后端汇总接口：
  - 前端优先读取 `GET /api/reports/summary`。
  - 接口异常时自动退回原本浏览器本地计算，不影响页面使用。
  - 数据保存后会清空报表缓存，避免统计页显示旧数据。
- 新增首页统计汇总接口：`GET /api/dashboard/summary`。
- 新增首页统计检查脚本：`server/check-dashboard-summary-runtime.js`。
- 新增命令：`npm run dashboard:summary-check`。
- 首页顶部统计卡已接入后端汇总接口：
  - 前端优先读取 `GET /api/dashboard/summary`。
  - 接口异常时自动退回原本浏览器本地计算。
  - 数据保存后会清空首页统计缓存，避免显示旧数据。
- 首页班级概览和欠费提醒已接入同一个后端汇总接口：
  - 班级概览包含当前人数、满班人数、计划课次、已进行课次。
  - 欠费提醒使用后端返回的 pending fees。
  - 接口异常时继续使用本地数据兜底。
- 运行时验证仍通过：
  - 实体表数量与快照一致。
  - 课消、已缴/欠费数量和金额统计一致。
  - 正式 `/data` 与 SQLite 组装数据一致。

下一步：

- 继续规划“字段化读取”：先让后端在查询和统计中使用实体列，保留 `raw_json` 作为返回结构兜底。
- 优先从低风险读取开始：
  - 班级筛选/状态统计。
  - 学员状态、班级、年级筛选。
  - 意向学员状态、来源、组班筛选。

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

<<<<<<< HEAD
状态：进行中（第四轮完成）

### 第四轮完成内容（2026-06-02）

**目标**：首页工作台重排 + AI 工作台收尾 + 全局隐私隐藏。

#### A. 全局隐私隐藏按钮
- 工具栏新增 👁/🔒 按钮，点击隐藏/显示敏感数字
- localStorage 持久化，下次打开保持上次选择
- 覆盖顶部统计卡片（课时、金额、人数）、首页欠费金额、AI 工作台快照数字

#### B. 首页今日工作台重排
- "今日工作台"区域整合工作提醒 + 快捷操作
- 班级概览上移，欠费提醒精简为摘要（前3条 + "还有X条"）
- 统计卡片保留在顶部（全局隐私隐藏生效）

#### C. 工作提醒优化
- 今日教务：显示今日课次数，点击跳到考勤
- 续费/欠费：显示待续费/欠费人数，点击跳到收费记录
- 招生跟进：显示待跟进意向数量，点击跳到意向学员
- AI 工作台：显示"本地"，点击跳到 AI 工作台
- 数字来自 getTodayWorkData()，隐私隐藏时显示 ***

#### D. 快捷操作优化
- 6 个常用按钮：+学员、+缴费、+成绩、考勤、体检、AI
- 紧凑按钮组，放在工作台右侧

#### E. 待办/备忘录
- localStorage 存储，不写数据库
- 支持新增（分类：教务/招生/续费/其他）、勾选完成、删除
- 显示最近 5 条未完成 + 3 条已完成
- 页面刷新后保留

#### F. 欠费提醒优化
- 首页只显示摘要（前3条 + 超过显示"还有X条"）
- 点击"去收费记录"跳转
- 隐私隐藏时金额显示 ***

#### G. AI 工作台文案统一简体
- 所有繁体字改为简体（經營 → 经营，學員 → 学员 等）
- "本地占位分析/模板"统一改为"本地规则"
- "后续接入 AI 后可..."统一改为"后续接入 AI 后可..."
- 不出现"AI 已生成"等误导文案

#### H. 隐私与脱敏复查
- 所有学员姓名使用 maskStudentName() 脱敏
- maskStudentName(): 单字显示"张*"，两字显示"张*"，三字以上显示"张**"
- 金额、人数、班级名可保留，开启隐私时数字隐藏
- 用户输入内容用 escapeHtml() 转义
- Agent 日志只记录 Agent 名、任务类型、时间，不记录输入内容

#### I. AI 工作台样式整理
- 重复 inline style 提取到 css/style.css
- 新增类：ai-workspace-layout、ai-agent-sidebar、ai-snapshot-*/ai-agent-workspace、ai-log-*
- 移动端 700px 断点自适应

#### J. AI 工作台操作增强
- 新增"复制结果"按钮（无内容时提示"暂无可复制内容"）
- 新增"清空输入"按钮（清空输入框）
- 复制成功 toast 提示"已复制"

#### K. 教务 Agent 本地模板
- 调课冲突检测：汇总班级上课时间，本地规则判断
- 考勤异常处理：今日未录入考勤的学员
- 班级满班预警：已满/接近满班班级
- 续费到期提醒：待续费学员 + 欠费记录

#### L. 教研 Agent 本地模板
- 生成教案：模板框架 + 用户输入内容
- 推荐练习题：模板框架
- 规划学习路径：模板框架
- 试卷分析：模板框架 + 已有成绩记录数

#### M. 首页入口联动
- 今日教务 → 考勤（带当天日期筛选）
- 续费/欠费 → 收费记录
- 招生跟进 → 意向学员
- AI 工作台 → AI 工作台

#### N. 状态口径（Codex 修复）
- 待续费：students.status === 'renewalPending'
- 欠费：fees.status === 'pending'
- 在读：students.status === 'active'

**明确说明**
- **仍未接真实 AI API**，所有输出均为本地规则/模板占位
- 不录入真实数据，不改后端/SQLite/API
- Stage 4 前端基本可用

**下一步建议**
- 由 Codex 设计真实 AI 接入边界：数据脱敏规则、可用上下文、确认流程、日志保存策略
- 建议 AI 输出存入会话日志（独立表），不改业务数据

### 第三轮完成内容（2026-02）

**目标**：让 AI 工作台从"静态空壳"升级为"能读取现有前端数据并生成本地占位建议"的前端原型。

#### A. 基础细节修复
- `index.html` `<title>` 改为 "AI 教培工作台"
- 所有 CSS 色值改为 `var(--text-primary/secondary/muted)` 等 CSS 变量，适配夜间模式
- 左侧 Agent 列表在窄屏（≤700px）下改为横向滚动 + 底部边框高亮
- 表单元素（select/textarea）背景色使用 `var(--input-bg)`

#### B. 数据感知函数
新增 `getAIWorkspaceSummary()`，读取本地 data 计算：
- 在读学员数（status = active + pending）
- 待续费学员数（status = pending）
- 意向学员数
- 欠费记录数和欠费金额
- 本月已消课时（本月所有出勤记录）
- 近一周新增沟通记录数

#### C. 业务快照区域
AI 工作台顶部新增"当前业务快照"卡片：
- 6 个指标格（3×2 布局）+ 底部近一周沟通汇总
- 数字全部来自 `getAIWorkspaceSummary()`
- 无数据时显示 0，不出现 undefined/null/NaN
- 样式与首页统计卡片一致

#### D. 经营分析 Agent 本地占位增强
biz-agent 的 4 个任务类型（生成本周/月经营报告、班级课消分析、欠费预警）改为调用 `generateBizAgentContent()` 生成本地模板化内容，包含真实数据汇总（班级列表、欠费明细、课消余额等），明确标注"本地占位分析"。

#### E. 学情沟通 Agent 本地占位增强
learning-agent 的 3 个任务类型改为调用 `generateLearningAgentContent()` 生成模板化占位文本，学员姓名从输入框第一行读取，不自动带出敏感数据，明确标注"本地占位模板"。

#### F. 招生跟进 Agent 本地占位增强
recruit-agent 的 4 个任务类型改为调用 `generateRecruitAgentContent()` 基于 prospects 数组做简单汇总（待跟进/试课中/组班中/已成交人数），明确标注"本地占位分析"。

#### G. Agent 日志优化
- 日志在点击"生成结果"时才记录，切换 Agent 不记录
- 最多保留 50 条（已有实现）
- 清空日志功能保留

**明确说明**
- **仍未接真实 AI API**，所有输出均为本地规则/模板占位
- 不录入真实数据，不改后端/SQLite/API

### 第二轮完成内容（2026-05-25）

**目标**：首页工作台重排 + AI 工作台收尾 + 全局隐私隐藏。

（内容同第三轮，此处省略详见前版）

### 第一轮完成内容（2026-05-22）

**目标**：AI 工作台基础框架搭建。

（内容同前，此处省略详见前版）

状态：进行中（第四轮完成）

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

## 阶段 5：真实 AI 接入边界与多 Agent 流程

状态：5A 前端壳子已完成，5B 后端 AI API 骨架已完成，5C 前端已接 AI API 壳子，5D 真实 AI 已启用并通过运行检查

阶段 5 详细规划见：

- `docs/STAGE_5_REAL_AI_BOUNDARY_PLAN.md`
- `docs/STAGE_6_AI_WORKBENCH_BLUEPRINT.md`

### 5A 前端壳子完成内容（2026-06-02）

**目标**：搭建真实 AI 接入前的所有前端 UI 和交互，只做前端不做后端。

#### A. AI 工作台增加生成模式显示
- 工作区右上角显示 "本地模板 / 真实 AI（未接入）"
- Agent 状态 badge 显示灰色 "本地模板"，明确标注 "未接入真实 AI"
- 不出现 "AI 已接入" 等误导文案

#### B. AI 任务表单增加隐私模式选择
- 隐私模式选项：脱敏生成（默认）、带姓名生成
- 教研 Agent 和经营 Agent 强制脱敏，锁定带姓名选项
- 带姓名生成选择后弹出二次确认：
  "本次将带入学员姓名用于生成文本。系统不会自动修改任何数据。生成内容需要您确认后使用。"
- 全局隐私隐藏开启时，默认使用脱敏模式

#### C. 输出区域增加"本次读取数据范围"
- 选择任务类型后，在生成按钮上方显示蓝色小区域
- 显示内容：当前 Agent、当前任务、读取范围（对应 taskDescriptions）、是否脱敏
- 示例："本次读取：学员成绩、考勤、课时余额；默认不读取电话/微信"

#### D. AI 工作台任务入口整理
- 第一批（重点）：学情反馈、续费话术、经营周报、招生跟进话术
- 教研 Agent 标注 "后续"：教案、推荐练习题、学习路径、试卷分析
- 招生 Agent 招生文案标注 "后续"
- 优先显示第一批任务，弱化后续任务

#### E. 学员详情页预留 AI 入口
- 学员详情页按钮组新增：
  - "AI 学情反馈"（紫色按钮）→ 跳转 AI 工作台，学情沟通 Agent，生成学情反馈任务
  - "AI 续费话术"（橙色按钮）→ 跳转 AI 工作台，学情沟通 Agent，生成续费沟通话术任务
- 点击后自动跳转并预填学员姓名

#### F. 意向学员预留 AI 入口
- 意向学员列表每行操作列新增 "AI 话术" 按钮（紫色）
- 点击后跳转到 AI 工作台，招生跟进 Agent，意向跟进话术任务

#### G. 文案风险控制
- 所有生成结果前明确标注 "本地规则"
- 不出现 "AI 已自动处理""已发送给家长""已自动更新系统" 等误导文案
- 所有 Agent 输出底部注明 "不会自动修改系统数据，生成内容需老师确认后使用"

**明确说明**
- **未接真实 AI API**，所有输出均为本地规则模板
- **未改后端**，未改 SQLite，未改业务数据
- 学员详情 AI 按钮和意向学员 AI 按钮均为跳转，不发送数据

### 5B 后端 AI API 骨架完成内容（2026-06-02）

**目标**：建立真实 AI 接入前的后端边界、接口、日志和验收基线。当前仍默认关闭真实 AI。

已完成：

- `server/config.js` 新增 AI 配置：
  - `AI_PROVIDER`
  - `AI_API_KEY`
  - `AI_MODEL`
  - `AI_BASE_URL`
  - `AI_TIMEOUT_MS`
  - `AI_LOG_FULL_INPUT`
- 新增 `server/ai-service.js`：
  - 构建任务上下文
  - 按任务白名单读取必要字段
  - 默认脱敏姓名
  - 无密钥时返回本地模板
  - 预留 OpenAI-compatible 真实模型调用
  - 写入 `ai_tasks`
  - 写入 `agent_logs`
- 新增后端接口：
  - `GET /api/ai/status`
  - `POST /api/ai/generate`
  - `GET /api/ai/tasks`
  - `GET /api/agent-logs`
- 新增 `npm run ai:runtime-check`。
- `npm run backend:check` 已纳入 AI API runtime 检查。
- 补齐统计报表后端口径：
  - `renewalPendingCount`
  - `consumptionStatus`
  - `statusText`

**明确说明**

- 当前 `AI_PROVIDER=disabled`，不会调用真实模型。
- AI 结果只写入 `ai_tasks` 和 `agent_logs`，不写入学员、班级、收费、考勤、成绩、沟通、意向学员等业务表。
- 不把整包 `/data` 发给模型。
- 默认日志只记录脱敏摘要和字段范围，不保存完整隐私输入。

### 5C 前端接 AI API 壳子完成内容（2026-06-02）

已完成：

- AI 工作台接入 `/api/ai/status`。
- 生成按钮改为调用 `/api/ai/generate`。
- 输出区显示任务 ID、模式、隐私模式等小字。
- Agent 日志从 `/api/agent-logs` 读取。
- 学员详情和意向学员 AI 入口携带 `relatedType`、`relatedId`。

明确说明：

- 当前真实 AI 仍未启用。
- 后端无密钥时返回 `local-template`。
- 前端失败时回退本地模板。

### 5D 真实 AI 安全配置与启用完成内容（2026-06-02）

已完成：

- 服务启动时自动读取 `/Users/bzx/Data/student-ai-console/ai.env`。
- `/api/ai/status` 返回脱敏 AI 配置状态，包括模式、供应商、缺失配置项。
- `scripts/status-server.sh` 显示 AI mode 和配置文件加载状态。
- 新增 `docs/AI_ENV_TEMPLATE.md`，记录 DeepSeek、OpenAI、自定义 OpenAI-compatible 配置示例。
- 已配置 MiniMax `MiniMax-M2.7-highspeed`。
- 中国区 endpoint 使用 `https://api.minimaxi.com/v1`。
- `npm run ai:runtime-check` 已通过，当前 mode 为 `real-ai`。

明确说明：

- 真实 `AI_API_KEY` 不进入项目目录、不提交 GitHub。
- `AI_LOG_FULL_INPUT=0` 为推荐默认值，不保存完整隐私输入。
- 当前 AI 输出仍然只生成文本，不自动修改业务数据。

### 5C 前端接 AI API 壳子完成内容（2026-06-02）

**目标**：前端对接后端 AI API 接口，只做接口联通，不配置真实 AI 密钥。

#### A. AI 工作台接入 /api/ai/status
- 页面加载时请求 `GET /api/ai/status`
- 根据返回的 mode 显示：
  - `real-ai` + `enabled`：显示绿色"真实 AI" + 提供者名称
  - `local-template`：显示灰色"本地模板" + "真实 AI 未配置"
- 接口失败时回退为本地模板

#### B. 生成按钮改为调用 /api/ai/generate
- `runAgentTask()` 改为 `POST /api/ai/generate`
- 请求字段：`{ agent, task, privacyMode, userInstruction, relatedType, relatedId }`
- 成功后显示 `response.result`
- 显示 `response.mode`（local-template / real-ai）
- 显示 `response.warnings`
- 接口失败时回退到本地模板

#### C. 输出区增加任务记录信息
- 生成结果下方显示小字：`任务ID: xxx · 模式: 本地模板 · 隐私: 脱敏`
- 不显示完整 input_json 或日志详情

#### D. Agent 日志接入 /api/agent-logs
- 页面加载时读取 `GET /api/agent-logs`
- 日志区域显示：时间、Agent 名、action、mode、success/failed
- 不显示敏感输入
- 新增"刷新"按钮

#### E. 学员/意向 AI 跳转优化
- 学员详情"AI 学情反馈" → learning-agent + student-feedback + relatedType=student
- 学员详情"AI 续费话术" → learning-agent + renewal-script + relatedType=student
- 意向学员"AI 话术" → recruit-agent + follow-reminder + relatedType=prospect
- 跳转后预填学员/意向学员姓名

#### F. 隐私模式和二次确认保持
- 脱敏生成默认
- 带姓名生成保留二次确认弹窗
- 全局隐私隐藏时默认脱敏
- 电话/微信/学校不展示到 AI 输出区

#### G. 文案统一
- "接口调用失败，已回退本地模板"（不虚假宣传 AI）
- 不出现"已自动发送""已自动修改系统"

**明确说明**
- **真实 AI 密钥仍未配置**，当前为 local-template 模式
- **未改后端**，**未改 SQLite**，**未改业务表**
- 前端只做接口联通和本地模板模式

计划 Agent：

- 教务 Agent
- 学情沟通 Agent
- 营销招生 Agent
- 教研 Agent
- 决策 Agent

原则：

- 每个 Agent 必须有明确输入、输出、确认步骤。
- 先建议，后半自动，最后才考虑自动执行。
- 第一批真实 AI 接入只做“只读生成 + 老师确认 + 日志留痕”。
- 默认脱敏，不把整包 `/data` 或全量学生隐私直接发送给模型。
- 当前后端 AI API 已可用，但真实 AI 仍未启用。


### 6A AI 工作台前端重组完成内容（2026-06-02）

**目标**：把 AI 工作台从"Agent 列表为主"改为"工作中心为主"，突出内容生产、题库建设、资料库、教务经营四大中心。

#### A. AI 工作台结构重组
- 左侧改为 4 个工作中心：内容生产、数学题库、资料库/升学、教务经营
- 学情反馈/续费话术放到"更多"区域，不抢主位
- 任务卡片式选择，点击自动切换 agent 和 task

#### B. 内容生产中心
- 公众号长文草稿（article-draft）
- 小红书笔记草稿（xiaohongshu-note）
- 视频号脚本（video-script）
- 朋友圈招生文案（moment-content）

#### C. 数学题库中心
- 题库建设方案（question-bank-plan）
- 题目分类规则（question-classify）
- 推荐练习题（exercise-recommend）
- 试卷分析（exam-analysis）

#### D. 资料库/升学情报中心
- 升学/中高考资料简报（resource-brief）
- 资料收集计划（research-plan）
- 不自动联网抓取，只生成计划/结构/摘要模板

#### E. 教务经营中心
- 本周/本月经营周报
- 班级课消分析
- 欠费与续费预警
- 考勤异常处理
- 班级满班预警

#### F. 任务选择体验
- 点击任务卡片自动切换 agent
- 自动更新占位符
- 自动更新读取范围
- 聚焦输入框

#### G. 输出结果操作区
- 复制结果
- 重新生成
- 保存为草稿（localStorage）
- 加入待办（localStorage）

#### H. 草稿箱 MVP
- localStorage 存储字段：id、task、title、content、createdAt、source
- 最近 10 条草稿
- 可复制、可删除
- 不写入后端数据库

#### I. 风格选择器
- 白老师风格（默认）
- 公众号长文
- 小红书笔记
- 视频号口播
- 家长沟通
- 教研说明
- 作为前端 options 传给 userInstruction

#### J. 隐藏不成熟功能
- 更多任务折叠到"展开更多"
- 学情反馈/续费话术保留但放次级

#### K. 文案统一
- 不写"AI 自动完成""已自动发布""已自动修改"
- 写"生成草稿""老师确认后使用""可复制""可保存为本地草稿"

#### L. PROJECT_PROGRESS.md 更新
- 本次更新文档记录

**明确说明**
- **真实 AI 已启用**（MiniMax MiniMax-M2.7-highspeed）
- 仍然只生成文本，不自动修改业务数据
- 未改后端逻辑，未改 SQLite



## 当前风险与注意事项

- 阶段 3C 继续推进：
  - 数据体检已增加后端接口 `GET /api/data-health`。
  - 前端数据体检弹窗优先读取后端结果，接口异常时回退本地计算。
  - `scripts/status-server.sh` 已加入 Data health parity 检查。
  - 数据体检仍只提示和安全清理，不自动改动欠费、空课次、容量等业务数据。
  - 集合接口 `/api/classes`、`/api/students`、`/api/fees` 等已改为直接读取 SQLite 字段版结果。
  - 前端启动加载已改为优先并行读取各模块集合，整包 `/data` 只作为兜底。
  - `scripts/status-server.sh` 已加入 Collection API parity 检查。
  - 前端全量保存 `saveData()` 已改为走 `/api/batch` 批量模块保存，`PUT /data` 只保留为兼容兜底通道。
  - 后端已增加实体集合单条记录 API：
    - `POST /api/{collection}`
    - `GET /api/{collection}/{id}`
    - `PUT /api/{collection}/{id}`
    - `PATCH /api/{collection}/{id}`
    - `DELETE /api/{collection}/{id}`
  - 前端已增加单条记录保存/删除辅助函数，后续可按模块逐步切换，不需要一次性重写所有业务代码。
  - 单条 API 运行检查脚本：`server/check-single-item-api-runtime.js`。
  - 前端记录型模块已开始接单条 API：
    - 收费记录：新增/编辑/删除走单条接口。
    - 成绩记录：新增/编辑/删除走单条接口。
    - 沟通记录：新增/编辑/删除走单条接口。
    - 意向学员：新增/编辑/删除走单条接口。
    - 学员管理：新增/编辑、在读改停课、非在读彻底删除走单条接口。
  - 批量删除、导入、转正式等跨记录/跨集合流程仍走集合或批量接口，更符合当前业务一致性。

- 当前正式 `/data` 已开启 SQLite 实体表读路径，`app_state.data` 仍保留为回退快照。
- 当前保存侧为双写：保存 `app_state.data` 的同时同步 SQLite 实体表。
- 可通过 `scripts/status-server.sh` 查看服务状态、SQLite `/data` 读路径和对账健康状态。
- 如 SQLite 读路径异常，可执行 `scripts/set-sqlite-data-read.sh off` 回退到 `app_state.data`。
- 服务器备份 JSON 会跟随当前正式读路径；SQLite `/data` 开启时，备份 JSON 从实体表组装生成。
- Node 的 `node:sqlite` 在 Node 24 中仍有实验警告，但当前可用。
- MacBook 需要切到 `feature/server-sqlite` 后再协作。
- 不要再启动旧 Python `8080` 服务。
- 不要把数据库、备份、真实学生数据提交到 GitHub。
- 不要把真实学生姓名、电话、学校、家长微信、收费明细写入项目进度文件。
- 新开聊天时，先读取本文件，再继续当前阶段任务。

## 给 Claude Code 的当前状态说明

```text
当前项目：AI 教培工作台
当前阶段：阶段 5，AI 工作台前端壳子和后端 AI API 骨架已完成，真实 AI 密钥尚未配置
当前主协作分支：feature/server-sqlite
请先 git pull origin feature/server-sqlite，然后读取 PROJECT_PROGRESS.md。
前端小功能和录入体验优化可以由 Claude Code 做。
后端、SQLite、部署、数据同步、备份恢复、API 拆分、读写路径切换、真实 AI API 接入请交给 Mac mini / Codex。
不要录入真实学生信息到测试数据或 GitHub。
```


## 前端真实使用可用版本

2026-06-02：前端真实使用体验已完成多轮优化，导入导出、数据体检、批量操作、考勤、班级归档、移动端适配已基本可用。下一阶段进入 SQLite 拆表与后端数据结构整理。

## 后端运行验收基线

2026-06-02：进入后端阶段后，新增统一后端运行检查命令 `npm run backend:check`。该命令会串联验证 SQLite 读路径、字段覆盖、字段读取一致性、指标、报表、首页汇总、数据体检、集合 API、单条 API，作为后续 SQLite 拆表和后端改动前后的固定验收基线。

2026-06-02：考勤读取继续拆表推进。新增 `npm run sqlite:attendance-record-read-parity`，用于验证 `attendance_sessions` + `attendance_records` 是否能还原当前前端使用的考勤 JSON 结构。当前真实数据已验证一致，字段化 `/data` 读路径中的考勤已改为从考勤记录表还原，仍保留每节课 `raw_json` 作为结构兜底。

2026-06-02：新增后端跨集合动作接口，把意向转正式、班级结课、归档/放回、彻底删除归档班级、数据体检安全清理收进后端事务。新增 `npm run actions:runtime-check`，用临时记录验证动作接口闭环，并纳入 `npm run backend:check`。

2026-06-02：前端已开始接入后端动作接口。意向学员转正式、班级归档/放回、彻底删除归档班级、数据体检安全清理已从前端多集合拼接保存，改为调用后端事务动作，减少跨设备同步和中途失败导致的数据不一致风险。

2026-06-02：班级保存也接入后端事务动作。新增/编辑班级、组班转正常/已结课时清理意向学员所属组班、结课时按用户确认批量改待续费，均改为后端统一处理，前端只负责表单收集和确认。

2026-06-02：阶段 5B 后端 AI API 骨架完成。新增 AI 配置读取、`server/ai-service.js`、`POST /api/ai/generate`、AI 任务记录、Agent 日志记录、`npm run ai:runtime-check`。真实模型调用按 OpenAI-compatible 接口预留，默认关闭；当前不会把 AI 输出写入业务表。

2026-06-02：阶段 5D 真实 AI 安全配置与启用完成。服务支持从 `/Users/bzx/Data/student-ai-console/ai.env` 读取 AI 配置，状态脚本可显示 AI 模式和缺失配置；新增 `docs/AI_ENV_TEMPLATE.md`。MiniMax `MiniMax-M2.7-highspeed` 已启用并通过 `npm run ai:runtime-check`。

2026-06-02：阶段 6 蓝图建立。AI 工作台后续重点从“生成家长反馈/跟进话术”扩展为内容生产、数学题库建设、资料库/升学中高考情报整理和教务经营总控。详细规划见 `docs/STAGE_6_AI_WORKBENCH_BLUEPRINT.md`。

2026-06-02：后端 AI 任务能力补齐。修复前端 task 与后端 `TASK_NAMES` 不匹配问题，新增前端 alias 兼容；增加公众号长文、小红书笔记、视频号脚本、题库建设、题目分类、资料简报、资料收集计划等任务类型；后端 prompt 增加“白老师默认风格”。

### 5C/5D 前端体验优化完成内容（2026-06-02）

**目标**：AI 工作台前端体验优化，8 个任务 A-H。

#### A. AI 配置状态显示
- AI 工作台新增 `ai-config-status` 区域
- 显示：模式（本地模板/真实 AI）、供应商名称、配置文件是否加载、缺失配置字段
- 颜色编码：绿色=真实 AI，灰色=本地模板，红色=配置缺失
- 数据来源：`GET /api/ai/status`

#### B. AI 任务历史列表
- 新增"最近生成记录"卡片，显示最近 10 条 AI 任务
- 每条记录显示：时间、任务标题、状态 badge、模式、关联类型
- 点击任务可展开查看详细信息（关联对象 ID 等）
- 支持刷新按钮重新加载

#### C. Agent 日志优化
- 日志列表显示：时间、Agent 名、action 类型、操作模式、成功/失败 badge
- 状态 badge 颜色：成功=绿色，失败=红色
- 不显示敏感输入内容

#### D. AI 输出区域优化
- 生成结果上方显示警告提示区域（ai-warnings）
- 输出区底部显示模式提示："本地模板生成" 或 "真实 AI 生成"
- 不出现"AI 已自动处理"等误导文案

#### E. 学员/意向跳转 AI 工作台修复
- 学员详情"AI 学情反馈"和"AI 续费话术"按钮正确跳转并预填姓名
- 意向学员"AI 话术"按钮正确跳转并预填姓名
- 跳转函数正确传递 relatedType 和 relatedId

#### F. 关联对象提示
- 从学员/意向学员跳转 AI 工作台后，显示关联对象提示（ai-related-hint）
- 提示内容：来源类型（学员/意向学员）+ 对象 ID
- 黄色背景，边框样式醒目
- 切换 Agent 或清除后自动隐藏

#### G. 隐私模式最终复查
- 脱敏生成（maskStudentName）作为默认选项
- 带姓名生成需二次确认弹窗确认
- 全局隐私隐藏开启时，默认使用脱敏模式
- 学员详情 AI 按钮和意向学员 AI 按钮均携带关联信息

#### H. PROJECT_PROGRESS.md 更新
- 本次更新文档记录

**明确说明**
- **真实 AI 密钥仍未配置**，当前为 local-template 模式
- **未改后端逻辑**，未改 SQLite，未改业务数据
- 前端只做 UI 优化和接口联通



### 5E 真实 AI 前端体验优化完成内容（2026-06-02）

**目标**：真实 AI 已启用（MiniMax MiniMax-M2.7-highspeed），优化前端使用体验。

#### A. 真实 AI 生成体验复查
- AI 工作台显示"真实 AI · minimax"（绿色）
- 生成结果时 mode=real-ai 明确显示"本次由真实 AI 生成，内容需老师确认后使用。"
- 生成失败仍保留回退本地模板逻辑

#### B. 真实 AI 输出结果排版优化
- 正文在前，任务信息（任务ID、模式、隐私）在底部小字
- 复制按钮在输出区右上角，不抢占正文位置
- 警告提示显示在结果上方

#### C. AI 生成中状态
- 点击生成后按钮显示"生成中..."，禁用重复点击
- 成功/失败后恢复按钮状态
- 超过 30 秒显示"生成较慢，请稍后重试或使用本地模板"

#### D. 学员反馈真实 AI 场景优化
- 学员详情 → AI 学情反馈，relatedType=student、relatedId 正确传递
- 输入框自动提示："已关联当前学员，可补充本次想重点反馈的内容"
- 生成结果不自动写入沟通记录，只能复制

#### E. 续费话术真实 AI 场景优化
- 学员详情 → AI 续费话术，显示读取范围（课时余额、班级进度、收费摘要）
- 生成结果标注"话术草稿"
- 不自动新增收费/欠费记录

#### F. 意向学员跟进真实 AI 场景优化
- 意向学员 → AI 话术，确保 relatedType=prospect、relatedId 传递正常
- 输出结果标注"跟进话术草稿"
- 不改变成交状态

#### G. 最近生成记录优化
- status=done 显示"已完成"，status=failed 显示"失败"
- mode=real-ai 显示"真实 AI"，mode=local-template 显示"本地模板"
- 不显示 output_text 全文

#### H. Agent 日志优化
- 日志显示：时间、Agent、任务、real-ai/local-template、success/failed
- 不显示 input_json，不显示学生隐私字段
- 可折叠显示避免页面太长

#### I. 隐私安全复查
- 脱敏生成默认
- 带姓名生成仍需二次确认
- 全局隐私隐藏开启时默认脱敏
- 不展示电话、微信、学校、完整收费细节
- 不出现"已自动发送""已自动修改系统"等文案

#### J. PROJECT_PROGRESS.md 更新
- 本次更新文档记录

**明确说明**
- **真实 AI 已启用**（MiniMax MiniMax-M2.7-highspeed）
- 仍然只生成文本，不自动修改业务数据
- 未改后端逻辑，未改 SQLite

### 6B AI 工作台真实使用体验优化完成内容（2026-06-02）

**目标**：AI 工作台前端真实使用体验优化，14 个任务 A-N。

#### A. Markdown 安全渲染
- `renderMarkdown(text)` 函数：使用 `escapeHtml()` 转义 + 正则替换实现 Markdown 渲染
- 支持：标题（###）、加粗（**）、斜体（*）、列表（- / 1.）、代码块（```）、分割线（---）
- 不使用 `innerHTML = raw AI output`，防止 XSS
- 标题转 `<h4>` 避免与页面 h1/h2/h3 冲突

#### B. AI 输出结果操作区
- 输出区右上角 6 个操作按钮：复制全文、复制纯文本、保存草稿、加入待办、重新生成、清空
- 复制全文：复制带 Markdown 格式的完整结果
- 复制纯文本：去除 Markdown 标记后复制
- 保存草稿：保存到 localStorage 草稿箱
- 加入待办：保存到 localStorage 待办列表
- 重新生成：保留当前输入重新调用 AI
- 清空：清空输出区域，不清输入框

#### C. 草稿箱 MVP 增强
- localStorage 存储：id、task、title、content、createdAt、source、center
- 搜索：标题和内容的模糊搜索
- 按中心筛选：全部 / 内容生产 / 数学题库 / 资料库 / 教务经营
- 最多保存 20 条，超出自动删除最旧条目
- 支持继续编辑（填充到输入框）、复制内容、删除草稿
- 导出功能：Markdown 格式导出所有草稿

#### D. 内容生产工作流模式
- 5 种工作流模式：头脑风暴、列提纲、写完整草稿、润色修改、标题优化
- 通过高级选项选择，默认普通模式
- 不同模式影响输入框提示文本

#### E. 高级选项动态显示
- 内容生产类任务：显示风格选择 + 工作流模式
- 数学题库类任务：显示难度选择 + 题型选择
- 资料库/升学任务：显示年级选择 + 资料类型
- 教务经营类任务：显示周期选择（周/月）+ 班级筛选

#### F. 题目分类助手增强
- 高级选项增加难度和题型选择
- 输出内容格式化为结构化字段

#### G. 资料简报增强
- 输出增加"可信度评估"维度
- 自动生成"关键结论"和"可用于哪些内容"字段

#### H. 风格设置 MVP
- 点击"风格设置"按钮，打开风格配置弹窗
- 5 种预设风格可编辑文本框
- 保存到 localStorage，重置默认值恢复预填内容

#### I. 白老师风格默认文本
- 默认风格包含：语气特点、常用开头、常用结尾、禁止行为、内容偏好

#### J. 任务卡片 AI Badge
- 内容生产、数学题库、资料库、招生跟进、经营报告类任务显示紫色"AI"标签
- 本地规则任务不显示 AI badge

#### K. 输入区优化
- 输入框 placeholder 动态更新，基于当前选中的 task

#### L. 草稿箱与任务记录联动
- 草稿保存时记录 task 和 center
- 切换 center 时正确更新任务列表

#### M. 移动端体验优化
- 工作中心切换按钮横向滚动
- 输出操作按钮在小屏设备换行为两排

#### N. PROJECT_PROGRESS.md 更新
- 本次更新文档记录

**明确说明**
- **真实 AI 已启用**（MiniMax MiniMax-M2.7-highspeed）
- 仍然只生成文本，不自动修改业务数据
- 未改后端逻辑，未改 SQLite，未配置新密钥

**下一步**
- Stage 6C：风格库进阶
- Stage 6D：题库 MVP

### 6C AI 工作台布局与可用性重构完成内容（2026-06-02）

**目标**：AI 工作台从"所有功能挤在一个页面"改为"AI 工作台首页 + 四个工作区"结构。

#### A. 任务选择稳定性复查
- 每个工作中心默认选中第一个任务（`selectWorkCenter` 调用时自动选中）
- 任务卡有点击选中态（蓝色边框 + 浅蓝背景 `.selected`）
- 生成按钮旁显示当前任务名称（`#currentTaskHint`）
- 未选任务时页面内显示警告黄色提示区 `#noTaskWarning`（不只是 toast）
- 外部跳转（学员/意向学员）正确预填姓名并选中对应任务

#### B. AI 工作台页面重构
- 三列布局：`工作中心列表（90px）| 主工作区（1fr）| 右侧记录区（280px）`
- 业务快照从常驻大卡片改为：点击"数据参考"按钮折叠显示
- 主工作区左侧是任务卡 + 输入区
- 右侧改为 tab 面板：草稿箱 / 最近生成 / 日志
- 工作区与右侧记录区顶部对齐，布局不乱

#### C. 内容生产工作区优化
- 保留公众号文章、小红书笔记、视频号脚本、朋友圈文案
- 工作流选择：选题 / 大纲 / 初稿 / 润色 / 标题优化（普通模式为默认）
- 输出后操作区：复制全文、复制纯文本、保存草稿、加入待办、重新生成

#### D. 题库工作区优化
- 前端入口设计：题库建设方案、题目分类规则、题目标签设计、练习题生成/改编
- 页面文案明确标注"当前为 AI 辅助整理，前端入口设计阶段，暂不接正式题库数据库"

#### E. 资料库/升学情报工作区设计
- 资料来源说明区：Obsidian 笔记、本地资料文件夹、后续 SQLite 资料库
- 暂不接文件上传
- 文案重点：后续会从资料库检索后再生成，不是只靠网页当前数据

#### F. 草稿箱和记录区整理
- 从三个大卡片上下堆叠改为右侧 tab 切换
- 三个 tab：📁 草稿箱 / 📋 最近 / 📝 日志
- 移动端时右侧 panel 固定在底部，tab 横向排列

#### G. 移动端复查
- 900px 断点：右侧记录区隐藏
- 700px 断点：左侧变横向滚动，任务卡片 2 列，数据参考 2 列，右侧 panel 移到底部固定
- 390px 断点：任务卡片单列显示
- 无横向溢出

#### H. PROJECT_PROGRESS.md 更新
- 本次更新文档记录

**明确说明**
- **真实 AI 已启用**（MiniMax MiniMax-M2.7-highspeed）
- 仍然只生成文本，不自动修改业务数据
- 未改后端逻辑，未改 SQLite，未配置新密钥

**下一步**
- Stage 6C 收尾：风格库进阶 + 样本积累
- Stage 6D：题库 MVP（Excel 导入 + AI 分类）

### Stage 7 资料库、语料库、题库后端规划完成内容（2026-06-02）

**目标**：为 AI 工作台建立真正可持续使用的本地知识底座，让内容生产、资料整理、题库建设不再只依赖临时输入。

#### A. 规划文档
- 新增 `docs/STAGE_7_KNOWLEDGE_LIBRARY_BACKEND_PLAN.md`
- 明确资料库、语料库、题库的后端目标、边界、数据表、API 和实施顺序

#### B. 资料存放分工
- Obsidian：长期笔记、表达风格、内容样本、教育观点、资料阅读摘要
- 本地资料文件夹：PDF、Excel、题目、政策资料、机构讲义等原始文件
- SQLite：资料索引、摘要、标签、风格样本、题库字段、AI 引用记录

#### C. 后端表结构规划
- `knowledge_sources`：资料来源
- `knowledge_chunks`：资料片段
- `style_profiles`：风格配置
- `style_samples`：表达样本
- `question_items`：题库题目
- `ai_context_refs`：AI 生成引用记录

#### D. API 规划
- 第一批：资料库、风格库、题库基础 CRUD
- 第二批：导入和检索
- 第三批：AI 上下文预览和引用追溯

#### E. 边界确认
- 暂不自动联网抓取资料
- 暂不处理复杂 PDF/OCR/公式识别
- 暂不让 AI 自动修改业务数据
- 暂不把飞书、Notion、Airtable 等外部工具作为核心数据源

**下一步**
- Stage 7B：Codex 新增 SQLite 表结构和 runtime check
- Stage 7C：风格库 MVP
- Stage 7D：资料库 MVP
- Stage 7E：题库 MVP

### Stage 7B 资料库后端表结构 MVP 完成内容（2026-06-03）

**目标**：为后续网页端资料库、风格库、题库页面提供真实 SQLite 表结构和基础 API。

#### A. SQLite 表结构
- 新增 `knowledge_sources`：资料来源、摘要、标签、文件路径、可信度
- 新增 `knowledge_chunks`：资料片段，为后续长文拆分和检索准备
- 新增 `style_profiles`：风格规则、禁用词、常用表达、平台类型
- 新增 `style_samples`：风格样本，用于积累白老师表达语料
- 新增 `question_items`：数学题库题目、知识点、难度、答案、解析、易错点
- 新增 `ai_context_refs`：AI 生成时引用资料的追溯记录

#### B. 后端服务
- 新增 `server/knowledge-service.js`
- 支持资料库、风格库、题库、AI 引用记录的基础 CRUD
- 支持简单搜索和筛选：
  - `q`
  - `category`
  - `grade`
  - `profileId`
  - `sourceId`

#### C. API
- `GET/POST /api/knowledge/sources`
- `GET/POST /api/knowledge/chunks`
- `GET/POST /api/style/profiles`
- `GET/POST /api/style/samples`
- `GET/POST /api/questions`
- `GET/POST /api/ai/context-refs`
- `GET /api/knowledge/summary`
- 单条记录支持 `GET/PUT/PATCH/DELETE`

#### D. Runtime Check
- 新增 `server/check-knowledge-runtime.js`
- 新增 `npm run knowledge:runtime-check`
- `npm run backend:check` 已纳入知识库检查
- 当前 `backend:check` 14 项全部通过

**明确说明**
- 本阶段只做后端表结构和基础 API
- 不扫描 Obsidian
- 不解析 PDF/Excel
- 不做 OCR/公式识别
- 不让 AI 自动修改业务数据

**下一步**
- Claude 可开始做网页端风格库、资料库、题库管理页面
- Codex 下一步可继续做 AI 上下文引用：生成时读取风格规则和资料摘要

### 7C 前端知识库/风格库/题库入口完成内容（2026-06-03）

**目标**：前端知识库管理页面（风格库/资料库/题库），只做页面和 API 对接。

#### A. 新增知识库 tab 入口
- 在顶部 tab 添加"知识库"入口（统计报表与 AI 工作台之间）
- 新增 `tab-knowledge` 容器和 `js/knowledge.js`
- `renderKnowledge()` 调用 `GET /api/knowledge/summary` 显示统计：
  - 资料数、风格数、样本数、题目数
- 空状态文案清楚："当前还没有资料，可先从手动新增开始"
- 提示后续 AI 会读取风格库、资料库、题库摘要进行生成，当前先完成资料录入和管理

#### B. 风格库管理
- 对接 `GET/POST /api/style/profiles` 和 `GET/POST /api/style/samples`
- 支持新增/编辑风格：名称、平台、风格规则、禁用词、常用表达、是否默认
- 支持新增/编辑样本：标题、类型（文章/笔记/口播/家长沟通/朋友圈）、内容、质量（好/一般/避免）、标签
- 支持搜索和类型筛选
- 删除前确认

#### C. 资料库管理
- 对接 `GET/POST /api/knowledge/sources`
- 支持新增/编辑资料：标题、来源类型（manual/obsidian/file/url）、分类、子分类、年级、可信度、标签、摘要、原文短文本、文件路径
- 支持搜索 q、分类筛选、年级筛选
- 删除前确认

#### D. 题库管理 MVP
- 对接 `GET/POST /api/questions`
- 支持新增/编辑题目：年级、体系、章节、知识点、题型、难度、题干、答案、解析、易错点、错因标签、状态
- 页面文案注明："当前是题库 MVP，不处理图片公式 OCR"
- 支持搜索、年级、章节、难度筛选

#### E. AI 工作台联动说明
- 知识库页顶部提示：后续 AI 会读取风格库、资料库、题库摘要
- 暂不修改 AI 生成逻辑

#### F. 移动端和空状态
- 390px 不横向溢出
- 统计卡片响应式：4列 → 2列 → 2列
- 每个列表有空状态（图标 + 文案 + 引导按钮）
- 删除操作有 confirm 确认

**明确说明**
- 只做前端页面和 API 对接
- 不改后端、不改 SQLite、不处理真实文件上传、不扫描 Obsidian

**修改文件**
- `index.html` — 新增知识库 tab 和容器
- `js/data.js` — render() 新增 renderKnowledge()
- `js/knowledge.js` — 新建，风格库/资料库/题库管理页面
