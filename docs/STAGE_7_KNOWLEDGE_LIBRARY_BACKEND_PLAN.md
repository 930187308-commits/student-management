# 阶段 7：资料库、语料库、题库后端规划

最后更新：2026-06-02

## 当前结论

阶段 6 已经把 AI 工作台前端整理为可试用结构，也已经接入真实 AI。现在真正影响可用性的不是“模型能不能说话”，而是 AI 能不能读取到可靠资料、你的表达风格、题库素材和业务上下文。

阶段 7 的目标是建立一个本地优先、可备份、可逐步扩展的知识底座：

- 风格语料库：让 AI 更像白老师的表达方式。
- 内容素材库：公众号、小红书、视频号、朋友圈可复用素材。
- 资料库/升学情报库：教育咨询、中高考资料、政策资料、家长问题。
- 数学题库素材库：先做人工辅助录入和 AI 分类，不急着做 OCR/公式识别。

核心原则：

- 不把真实业务数据库放回 iCloud。
- 不把 API key、真实学生数据、数据库文件提交 GitHub。
- 不让 AI 自动修改业务数据。
- 资料先可存、可查、可引用，再考虑自动抓取、向量搜索和 OCR。

## 推荐资料存放方式

### 1. Obsidian：长期笔记和风格沉淀

适合放：

- 你的教育观点。
- 家长沟通案例。
- 公众号/小红书/视频号草稿。
- 常用表达、禁用词、标题风格。
- 升学咨询笔记。
- 资料阅读摘要。

建议 Obsidian 目录：

```text
AI教培工作台/
  风格库/
    白老师风格规则.md
    常用表达.md
    禁用词.md
    公众号样例.md
    小红书样例.md
    视频号口播样例.md
    家长沟通样例.md
  资料库/
    小升初/
    中考/
    初中数学/
    家长常见问题/
  内容素材/
    选题库.md
    案例素材.md
    课程亮点.md
```

说明：

- Obsidian 适合你自己长期编辑。
- 后端初期不直接扫描整个 Obsidian，而是先支持手动导入/复制关键文本。
- 后续可以做“读取指定 Obsidian 文件夹”的本地索引，但要先有清晰目录。

### 2. 本地资料文件夹：PDF、Excel、题目、政策资料

建议路径：

```text
/Users/bzx/Data/student-ai-console/resources/
  style-samples/
  content-materials/
  education-resources/
  question-bank/
  imports/
```

适合放：

- PDF 讲义。
- Excel 题目表。
- 政策资料。
- 中高考资料。
- 机构讲义。
- 需要后续导入题库的原始文件。

说明：

- 这些文件不进入 GitHub。
- 只在 SQLite 中记录文件路径、摘要、标签和导入状态。
- 文件原文是否拆分入库，后续分阶段做。

### 3. SQLite：结构化索引和 AI 可引用上下文

SQLite 不应该塞所有大文件原文，但应该记录：

- 资料元信息。
- 摘要。
- 标签。
- 可引用片段。
- 题库字段。
- 风格样本。
- AI 引用记录。

这样 AI 生成时可以先取相关资料，再把少量必要上下文发给模型。

## 后端数据表规划

### 1. `knowledge_sources`

用途：记录资料来源文件或手动录入来源。

建议字段：

```text
id TEXT PRIMARY KEY
title TEXT NOT NULL
source_type TEXT          -- obsidian/manual/file/url
category TEXT             -- style/content/resource/question
sub_category TEXT         -- 小升初/中考/初中数学/公众号/小红书等
file_path TEXT            -- 本地文件路径，可空
source_url TEXT           -- 手动记录链接，可空
status TEXT               -- active/archived/needs_review
trust_level TEXT          -- high/medium/low/unknown
grade TEXT
tags_json TEXT
summary TEXT
raw_text TEXT             -- 初期只存短文本，长文后续拆 chunk
created_at TEXT
updated_at TEXT
```

### 2. `knowledge_chunks`

用途：把长资料拆成可检索的小片段。

建议字段：

```text
id TEXT PRIMARY KEY
source_id TEXT NOT NULL
chunk_index INTEGER
title TEXT
content TEXT NOT NULL
summary TEXT
tags_json TEXT
token_estimate INTEGER
created_at TEXT
updated_at TEXT
FOREIGN KEY(source_id) REFERENCES knowledge_sources(id)
```

说明：

- 第一版可以先不做复杂分词，只按段落或固定长度拆。
- 后续如果要做向量检索，可以在这里扩展 embedding 字段或单独建表。

### 3. `style_profiles`

用途：管理生成风格。

建议字段：

```text
id TEXT PRIMARY KEY
name TEXT NOT NULL
description TEXT
rules_text TEXT
forbidden_words_json TEXT
preferred_phrases_json TEXT
platform TEXT             -- general/wechat/xiaohongshu/video/parent
is_default INTEGER DEFAULT 0
created_at TEXT
updated_at TEXT
```

### 4. `style_samples`

用途：保存你的真实表达样本。

建议字段：

```text
id TEXT PRIMARY KEY
profile_id TEXT
title TEXT
sample_type TEXT          -- article/note/script/parent-message/moment
content TEXT NOT NULL
quality TEXT              -- good/ok/avoid
tags_json TEXT
created_at TEXT
updated_at TEXT
FOREIGN KEY(profile_id) REFERENCES style_profiles(id)
```

说明：

- 每个类型先积累 10-30 条样本即可。
- 样本要尽量去除学生隐私信息。

### 5. `question_items`

用途：数学题库主体表。

建议字段：

```text
id TEXT PRIMARY KEY
grade TEXT
system TEXT               -- 校内/小升初/中考/竞赛/机构讲义
chapter TEXT
knowledge_points_json TEXT
question_type TEXT
difficulty TEXT           -- basic/medium/advanced/challenge
source_id TEXT
source_name TEXT
stem TEXT NOT NULL
answer TEXT
solution TEXT
common_mistakes TEXT
error_tags_json TEXT
class_type TEXT
usage_count INTEGER DEFAULT 0
status TEXT               -- draft/active/archived
remark TEXT
created_at TEXT
updated_at TEXT
FOREIGN KEY(source_id) REFERENCES knowledge_sources(id)
```

说明：

- 第一阶段只做文字/Excel 题目。
- 图片、复杂公式、OCR 后续再做。
- AI 分类建议先进入 draft，由老师确认后再 active。

### 6. `ai_context_refs`

用途：记录 AI 每次生成引用了哪些资料，方便追溯。

建议字段：

```text
id TEXT PRIMARY KEY
ai_task_id TEXT NOT NULL
ref_type TEXT             -- source/chunk/style/question/business
ref_id TEXT
title TEXT
summary TEXT
created_at TEXT
FOREIGN KEY(ai_task_id) REFERENCES ai_tasks(id)
```

## API 规划

### 第一批：可存、可查、可被 AI 引用

```text
GET  /api/knowledge/sources
POST /api/knowledge/sources
PUT  /api/knowledge/sources/:id
DELETE /api/knowledge/sources/:id

GET  /api/style/profiles
POST /api/style/profiles
PUT  /api/style/profiles/:id

GET  /api/style/samples
POST /api/style/samples
DELETE /api/style/samples/:id

GET  /api/questions
POST /api/questions
PUT  /api/questions/:id
DELETE /api/questions/:id
```

### 第二批：导入和检索

```text
POST /api/knowledge/import-text
POST /api/knowledge/import-file-meta
POST /api/questions/import-excel
GET  /api/knowledge/search?q=&category=&grade=&tags=
GET  /api/questions/search?q=&grade=&chapter=&difficulty=
```

### 第三批：AI 上下文构建

```text
POST /api/ai/context-preview
POST /api/ai/generate-with-context
GET  /api/ai/tasks/:id/context-refs
```

说明：

- `context-preview` 用于生成前给老师看“本次会读取哪些资料”。
- `generate-with-context` 可以先和现有 `/api/ai/generate` 共用，后续再拆。
- 初期可以只在后端内部扩展 `buildAIContext()`，不急着换前端 API。

## AI 调用流程

目标流程：

```text
用户选择任务
  ↓
前端提交 task + 用户补充说明 + 可选资料范围
  ↓
后端判断任务类型
  ↓
检索相关风格规则、样本、资料、题库片段
  ↓
生成 context preview
  ↓
老师确认或直接生成
  ↓
AI 生成结果
  ↓
记录 ai_tasks、agent_logs、ai_context_refs
  ↓
老师复制、保存草稿、加入待办或手动写入业务模块
```

第一版可以简化为：

- 内容生产：读取默认风格规则 + 3 条同平台样本 + 用户输入。
- 资料简报：读取相关资料摘要 + 用户输入。
- 题库分类：读取题库标签体系 + 用户粘贴题目。
- 经营分析：读取业务统计，不读取资料库。

## 分阶段实施建议

### Stage 7A：规划与目录准备

由 Codex 完成：

- 新增本规划文档。
- 明确本地资料目录。
- 明确 SQLite 表和 API。
- 暂不迁移真实资料。

### Stage 7B：后端表结构 MVP

由 Codex 完成：

- 在 SQLite migration 中新增：
  - `knowledge_sources`
  - `knowledge_chunks`
  - `style_profiles`
  - `style_samples`
  - `question_items`
  - `ai_context_refs`
- 新增基础 CRUD helper。
- 新增 runtime check，确保表存在、可写、可读、可删。

### Stage 7C：风格库 MVP

Codex 后端，Claude 前端：

- 后端提供风格配置和样本 API。
- 前端做“风格库管理”页面：
  - 风格规则。
  - 常用表达。
  - 禁用词。
  - 样本列表。
- AI 生成时读取默认风格。

### Stage 7D：资料库 MVP

Codex 后端，Claude 前端：

- 后端支持手动新增资料条目。
- 前端做资料库页面：
  - 标题、分类、年级、来源、摘要、标签。
  - 搜索和筛选。
  - 标记可信度。
- AI 资料简报任务可以引用资料摘要。

### Stage 7E：题库 MVP

Codex 后端，Claude 前端：

- 后端支持题目 CRUD。
- 前端做题库页面：
  - 年级、章节、知识点、题型、难度。
  - 题干、答案、解析、易错点。
  - 搜索和筛选。
- AI 先只做分类建议，不自动写入正式题库。

### Stage 7F：上下文引用与可追溯

由 Codex 完成：

- AI 生成前构建资料引用列表。
- 输出区显示“本次引用资料”。
- 写入 `ai_context_refs`。
- 老师可以知道 AI 是根据哪些资料生成的。

## 暂不做

- 暂不自动联网抓取资料。
- 暂不自动解析复杂 PDF。
- 暂不做图片 OCR 和公式识别。
- 暂不自动发布公众号、小红书、视频号。
- 暂不让 AI 自动修改学员、收费、考勤等业务数据。
- 暂不引入飞书、Notion、Airtable 等外部系统作为核心数据源。

## 给 Claude 的前端边界

Claude 可以做：

- 资料库管理页面 UI。
- 风格库管理页面 UI。
- 题库管理页面 UI。
- AI 工作台里“资料来源说明”和“本次引用资料”展示。
- 搜索、筛选、表格、弹窗、空状态。

Claude 暂不做：

- SQLite migration。
- 文件解析。
- AI 上下文检索逻辑。
- API key 配置。
- 真实资料自动扫描。
- 自动写入业务数据。

## 推荐下一步

先做 Stage 7B：后端表结构 MVP。

理由：

- 现在前端已经能试用 AI 工作台。
- 但没有后端资料表，Claude 做资料库页面也只能是假 UI。
- 先把表建出来，后面前端才能逐步接真实资料库。
