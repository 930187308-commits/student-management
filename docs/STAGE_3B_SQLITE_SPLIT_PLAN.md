# 阶段 3B：SQLite 真实拆表规划

## 目标

把当前 `app_state.data` 中的整包 JSON，逐步迁移到真实 SQLite 业务表。

本阶段不追求一次性重构完成，目标是：

- 保留现有系统可用性。
- 保留完整 JSON 快照作为回退来源。
- 每拆一个模块，都能对账、回滚、验证统计口径。
- 为后续 AI 控制台和 Agent 提供更稳定的数据基础。

## 当前状态

- 前端保存侧已经基本切到模块 API / 批量 API。
- SQLite 已经有部分业务表结构，但当前权威数据仍来自 `app_state.data`。
- `app_state.data` 继续作为阶段 3B 的回退快照。

## 核心原则

1. 先只读对账，再写迁移脚本。
2. 先双写，再切读路径。
3. 先低风险模块，再复杂联动模块。
4. 每一步都要创建服务器备份。
5. 不在 Git 中提交真实数据库、备份、学生隐私数据。

## 推荐拆分顺序

1. `students`
   - 学员基础信息最核心。
   - 需要保留 `raw_json` 存扩展字段，如学校历史、转班标记、归档快照关联。

2. `classes`
   - 班级状态、归档状态、历史学员快照需要补齐字段。
   - 归档和已结课必须继续区分。

3. `fees`
   - 收费与欠费提醒、课时余额相关。
   - 迁移时重点校验 `student_id` 引用。

4. `attendance_sessions` / `attendance_records`
   - 当前 JSON 中一节课包含多个 records。
   - 拆表后每个考勤格变成独立记录。
   - 重点校验课消统计是否一致。

5. `prospects`
   - 意向学员与组班、转正式联动。

6. `grades`
   - 成绩记录与学员、班级弱关联。

7. `communications`
   - 沟通记录与主题配置联动。

8. 配置类数据
   - `communicationTopics`
   - `prospectSources`
   - `classTypes`
   - `gradeOptions`

## 必须补齐的表字段

当前已有表结构偏早，需要补字段或继续依赖 `raw_json`。

优先补齐：

- `classes.archived`
- `classes.archived_at`
- `classes.archived_student_snapshot`
- `classes.planned_sessions`
- `students.first_enroll_date`
- `students.follow_up_status`
- `students.class_join_sessions`
- `students.class_leave_sessions`
- `prospects.grade`
- `prospects.wechat`
- `prospects.class_id`
- `attendance_sessions.temporary_students`

短期可以先把这些字段留在 `raw_json`，等迁移稳定后再决定是否实体化。

## 迁移策略

### 第一步：只读对账

使用：

```bash
scripts/node.sh server/reconcile-sqlite-split.js
```

对账内容：

- JSON 快照各模块数量。
- SQLite 实体表数量。
- 班级、学员、收费、考勤引用关系。
- 课消统计。
- 欠费记录统计。

### 第二步：生成迁移脚本，但默认 dry-run

计划脚本：

```bash
scripts/node.sh server/migrate-app-state-to-tables.js --dry-run
```

先只打印将写入多少数据，不落库。

### 第三步：写入实体表

前置条件：

- 创建服务器备份。
- 对账脚本无严重错误。
- 迁移脚本 dry-run 输出符合预期。

执行后继续保留 `app_state.data`。

### 第四步：双写

模块 API 保存时：

- 继续更新 `app_state.data`。
- 同时更新对应业务表。

此阶段读路径仍然从 `app_state.data` 来，避免影响真实使用。

### 第五步：切换读路径

每次只切一个模块：

- `GET /api/students` 从 `students` 表读。
- 对账和 UI 验证通过后，再切下一个模块。

## 每步验收标准

- 数量一致。
- 引用关系无孤儿数据。
- 课消统计一致。
- 欠费统计一致。
- 导出 Excel 结果合理。
- 真实业务操作不少于一轮测试：
  - 新增
  - 编辑
  - 删除/归档
  - 导入
  - 导出
  - 多设备刷新

## 回退策略

任何一步出现问题：

1. 停止切换读路径。
2. 用服务器备份恢复。
3. 或重新从 `app_state.data` 生成实体表。
4. 前端继续使用现有模块 API，不影响日常使用。

## 暂不做

- 不直接删除 `app_state.data`。
- 不一次性把所有 API 改成表读写。
- 不把 AI Agent 写入业务数据的能力提前接入。
- 不在没有对账脚本的情况下迁移真实数据。
