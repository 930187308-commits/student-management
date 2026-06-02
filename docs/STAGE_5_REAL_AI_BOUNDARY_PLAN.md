# 阶段 5：真实 AI 接入边界规划

最后更新：2026-06-02

## 当前结论

阶段 4 已经有 AI 工作台前端、首页入口、本地规则模板和全局隐私隐藏。阶段 5 不建议一上来就让 AI 自动操作系统数据，而是先做“只读生成 + 老师确认 + 日志留痕”的真实 AI 接入。

2026-06-02 更新：阶段 5B 后端 AI API 骨架已完成。当前新增 `/api/ai/status`、`/api/ai/generate`、`/api/ai/tasks`、`/api/agent-logs`，默认 `AI_PROVIDER=disabled`，无密钥时返回本地模板并写入 `ai_tasks`、`agent_logs`。真实模型调用能力已预留为 OpenAI-compatible 接口，但尚未配置密钥，也未启用真实 AI。

2026-06-02 更新：阶段 5D 真实 AI 启用前置配置已完成。服务会自动读取 `/Users/bzx/Data/student-ai-console/ai.env`，`scripts/status-server.sh` 会显示 AI 当前模式和缺失配置。配置模板见 `docs/AI_ENV_TEMPLATE.md`。

2026-06-02 更新：真实 AI 已使用 MiniMax `MiniMax-M2.7-highspeed` 启用并通过 `npm run ai:runtime-check`。当前使用中国区 OpenAI-compatible endpoint：`https://api.minimaxi.com/v1`。真实密钥只保存在 Mac mini 数据目录的 `ai.env`，不进入 GitHub。

第一批真实 AI 能力只解决三类高价值任务：

1. 家长反馈和续费沟通
2. 经营周报和课消分析
3. 招生跟进话术和试听反馈

教研题库、图片公式识别、自动组卷暂不作为第一批重点。

## 核心边界

### 1. 读取边界

AI 可以读取：

- 学员基础信息的必要字段：姓名、年级、状态、班级、入学时间
- 该学员相关成绩、考勤、收费、沟通记录
- 班级基础信息：名称、年级、上课时间、状态、计划课次
- 经营汇总：本周新增、课消、欠费、待续费、意向学员数量
- 意向学员的必要跟进字段：年级、来源、试课状态、成交状态、备注

AI 默认不读取：

- 全量学生列表的完整姓名
- 电话、微信、学校等敏感字段
- 与本次任务无关的收费明细
- 与本次任务无关的沟通全文
- 备份 JSON、数据库文件、日志文件

如果某个任务确实需要敏感字段，前端必须明确提示“本次将带入姓名/电话/微信”等信息，并由用户确认。

### 2. 输出边界

AI 可以输出：

- 文本草稿
- 分析摘要
- 风险提醒
- 跟进建议
- 待办建议
- 可复制的话术

AI 不可以直接执行：

- 删除学员、班级、收费、成绩、考勤
- 修改学员状态
- 修改收费状态
- 自动新增欠费记录
- 自动发送微信/短信/邮件
- 自动发布朋友圈/视频号/抖音

后续如果要让 AI 写入系统，也必须先进入“草稿箱/待确认”状态，由用户点确认后才写入。

### 3. 隐私边界

默认模式：脱敏。

- 学员姓名：使用 `maskStudentName()`，如“张*”“李**”
- 金额：使用 `getPrivacyAmount()`
- 数字统计：使用 `getPrivacyVal()`
- 电话、微信：默认不传给 AI
- 学校：默认不传，除非任务是学校分布分析

可选模式：带姓名生成。

- 只用于家长反馈、续费话术等确实需要姓名的任务
- 前端需要有明确开关或确认提示
- 日志中仍然只保存脱敏摘要，不保存完整输入原文

### 4. 写入边界

第一阶段真实 AI 接入只写入两类非业务数据：

- `ai_tasks`：记录 AI 任务状态、任务类型、关联对象、输出文本
- `agent_logs`：记录 Agent 行为摘要、是否成功、耗时、错误信息

不写入业务表：

- `students`
- `classes`
- `fees`
- `attendance`
- `grades`
- `communications`
- `prospects`

如果用户复制 AI 结果后手动粘贴到沟通记录，那属于用户主动录入，不算 AI 自动写入。

## 第一批真实 AI 功能

### F1：学情反馈生成

入口：

- 学员详情页
- AI 工作台：学情沟通 Agent

读取数据：

- 单个学员基本信息
- 最近 5-10 条成绩
- 最近 1-2 个月考勤
- 最近沟通记录摘要
- 当前班级和课时余额

输出：

- 发给家长的阶段反馈
- 学习表现
- 进步点
- 薄弱点
- 后续建议

默认处理：

- 前端显示“带姓名生成 / 脱敏生成”选项
- 结果只展示、复制，不自动保存

### F2：续费沟通话术

入口：

- 学员详情页
- 数据体检中的课时不足/无收费记录提示
- AI 工作台：学情沟通 Agent

读取数据：

- 已缴课时
- 已消课时
- 剩余课时
- 当前班级进度
- 最近表现摘要

输出：

- 温和版话术
- 直接版话术
- 后续跟进建议

注意：

- 不直接创建收费/欠费记录
- 不改变学员状态

### F3：经营周报

入口：

- 首页今日工作台
- AI 工作台：经营分析 Agent

读取数据：

- 本周新增学员
- 本周新增意向
- 本周课消
- 本周收费
- 欠费摘要
- 待续费摘要
- 班级进度

输出：

- 本周经营摘要
- 风险提醒
- 下周建议
- 可执行清单

默认脱敏：

- 只输出数量和趋势
- 明细名单默认脱敏

### F4：招生跟进话术

入口：

- 意向学员模块
- AI 工作台：招生跟进 Agent

读取数据：

- 意向学员年级
- 来源
- 试课状态
- 当前成绩/备注
- 最近沟通摘要

输出：

- 跟进话术
- 试听邀约
- 试课后转化话术
- 家长顾虑回应

注意：

- 电话、微信默认不发给 AI
- 不自动变更成交状态

## API 建议

### 配置

新增环境变量，全部放在本机 `.env` 或 launchd 环境中，不提交 GitHub：

```text
AI_PROVIDER=disabled
AI_API_KEY=
AI_MODEL=
AI_BASE_URL=
AI_TIMEOUT_MS=30000
AI_LOG_FULL_INPUT=0
```

默认 `AI_PROVIDER=disabled`，没有密钥时前端仍继续使用本地规则模板。

Mac mini 当前推荐使用数据目录配置文件：

```text
/Users/bzx/Data/student-ai-console/ai.env
```

该文件不放在项目目录，不提交 GitHub。

### 后端接口

第一批只需要一个统一生成接口：

```text
POST /api/ai/generate
```

请求：

```json
{
  "agent": "learning-agent",
  "task": "student-feedback",
  "relatedType": "student",
  "relatedId": "student-id",
  "privacyMode": "masked",
  "options": {
    "tone": "normal",
    "range": "recent"
  },
  "userInstruction": "重点说明最近计算题进步"
}
```

响应：

```json
{
  "success": true,
  "taskId": "ai-task-id",
  "mode": "real-ai",
  "result": "生成内容...",
  "warnings": []
}
```

如果未配置真实 AI：

```json
{
  "success": true,
  "taskId": "ai-task-id",
  "mode": "local-template",
  "result": "本地模板内容...",
  "warnings": ["AI_PROVIDER 未启用，已使用本地模板。"]
}
```

### 日志接口

后续可加：

```text
GET /api/ai/tasks
GET /api/ai/tasks/:id
GET /api/agent-logs
```

第一阶段可以只写入，暂时不做复杂日志管理页面。

## 后端实现原则

1. 后端负责组装 prompt，前端不拼完整敏感 prompt。
2. 每个任务有白名单字段，不允许把整包 `/data` 发给模型。
3. 每次调用前创建 `ai_tasks` 记录。
4. 调用成功后写 `output_text`、`status=done`。
5. 调用失败后写 `status=failed` 和错误摘要。
6. `agent_logs.input_json` 默认只保存脱敏摘要和字段清单，不保存完整学生隐私。
7. 超时默认 30 秒。
8. API key 只在服务器环境变量里，不进入前端、不进入 GitHub。

## 前端实现原则

1. 保留现有本地规则模板作为兜底。
2. AI 按钮旁边显示状态：本地模板 / 真实 AI。
3. 生成前显示数据范围说明。
4. 生成后只提供复制、清空、重新生成。
5. 不提供“自动写入系统”的按钮。
6. 如果用户选择带姓名生成，显示二次确认。
7. 隐私隐藏开启时，默认使用脱敏模式。

## 推荐执行顺序

### 5A：边界和前端壳子

适合 Claude Code：

- AI 工作台增加“生成模式”显示
- AI 任务表单增加隐私模式选择
- 输出区域显示“本次读取数据范围”
- 学员详情/意向学员详情预留 AI 入口按钮
- 所有按钮先调用现有本地模板，不接后端 AI

### 5B：后端 AI API 骨架

适合 Codex：

- 新增 AI 配置读取
- 新增 `/api/ai/generate`
- 新增 prompt 上下文构建器
- 写入 `ai_tasks` 和 `agent_logs`
- 无密钥时返回本地模板/禁用提示
- 增加 `npm run ai:runtime-check`

状态：已完成。

已完成：

- `server/config.js` 新增 AI 配置项。
- `server/ai-service.js` 新增 AI 任务上下文、脱敏、本地模板、OpenAI-compatible 调用预留、任务和日志写入。
- `server/server.js` 新增 AI API 路由。
- `server/check-ai-runtime.js` 新增运行检查。
- `npm run backend:check` 已纳入 AI API runtime 检查。

### 5C：第一批真实调用

适合 Codex 主导，Claude 配合前端：

- 先接经营周报或学情反馈中的一个
- 使用脱敏模式
- 验证日志、超时、错误处理
- 确认没有写入业务表

### 5D：使用反馈后扩展

适合 Claude Code：

- 文案风格选择
- 复制体验
- 历史生成记录查看
- 更多入口按钮

### 5D 前置：真实 AI 安全启用配置

适合 Codex：

- 让服务读取 Mac mini 数据目录下的 AI 配置文件。
- 状态脚本显示 AI 模式和缺失配置。
- 不提交真实密钥。
- 保持 `AI_LOG_FULL_INPUT=0`。

状态：已完成前置配置，真实密钥尚未填写。

## 暂不做的事

- 不接微信自动发送
- 不接飞书自动流转
- 不做自动收费/自动改状态
- 不做题库图片公式识别
- 不把所有学生数据整包发给模型
- 不把 AI 结果直接写入沟通记录

## 验收标准

阶段 5A 完成标准：

- 前端能清楚显示当前是本地模板还是真实 AI
- 用户能选择脱敏/带姓名生成
- 生成前能看到数据范围说明
- 无后端密钥时系统仍可正常使用

阶段 5B 完成标准：

- `/api/ai/generate` 可用
- 未配置密钥时返回可读错误或本地模板
- 已配置密钥时能生成文本
- `ai_tasks` 和 `agent_logs` 有记录
- `npm run backend:check` 不受影响
- 新增 AI runtime check 通过

阶段 5C 完成标准：

- 至少一个真实 AI 任务可用
- 默认脱敏
- 不自动写业务数据
- 生成结果可复制
- 失败时有清晰提示
