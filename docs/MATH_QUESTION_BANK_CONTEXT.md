# 数学题库工作台上下文

最后更新：2026-06-09

## 2026-06-09 V2 开发进展

已完成第一轮 V2 闭环：

- 新增后端 `server/question-import-service.js`
- 新增导入批次表 `question_import_batches`
- 新增候选题池表 `question_import_candidates`
- 正式题库 `question_items` 补充 V2 字段：
  - `sub_knowledge_point`
  - `source_json`
  - `answer_status`
  - `quality_flags_json`
  - `import_candidate_id`
  - `internal_no`
- 预留未来扩展表：
  - `student_question_records`
  - `curriculum_plans`
  - `curriculum_units`
  - `source_watch_rules`
  - `source_candidates`
  - `paper_drafts`
  - `paper_items`
- 新增 API：
  - `POST /api/question-import/batches`
  - `GET /api/question-import/batches`
  - `GET /api/question-import/batches/:id`
  - `GET /api/question-import/candidates`
  - `GET /api/question-import/candidates/:id`
  - `PATCH /api/question-import/candidates/:id`
  - `POST /api/question-import/candidates/:id/accept`
  - `POST /api/question-import/candidates/:id/ignore`
- 前端 `question-bank.html` 新增：
  - 导入中心
  - 待确认题目池
  - 候选题校对弹窗
- 前端 `js/question-bank-system.js` 新增：
  - OCR 文本批量导入
  - 候选题加载/筛选
  - 候选题保存
  - 候选题忽略
  - 逐题确认入库
  - 正式题库显示来源、答案状态、质量标记

当前支持程度：

- OCR 文本粘贴：已完成并通过浏览器验证。
- Word `.docx`：后端已保存原文件，并通过解包 `word/document.xml` 做基础文本提取。
- PDF：后端已保存原文件，并尝试基础文本提取；若文本不足，会提示当前不支持扫描版 PDF，建议复制文字或 OCR 后粘贴。

已验证：

- `npm run check` 通过。
- 临时数据库后端闭环通过：文本导入 -> 2 道候选题 -> 1 道确认入库 -> 正式题库生成题目。
- Browser 临时服务验证通过：打开 `/question-bank.html` -> 粘贴两道题 -> 生成 2 道候选题 -> 打开候选题校对 -> 确认入库 -> 正式题库显示题目、来源和“人工已确认”答案状态。
- 输出端已补齐格式入口：
  - 复制
  - 网页打印/PDF
  - 下载 Word HTML（`.doc`，可用 Word/WPS 打开编辑）
  - 下载 Markdown
- 打印/PDF 和 Word HTML 已改为基于题篮结构化数据导出：
  - 保留 `formulaLatex` 公式块
  - 保留题干中的 `\\(...\\)` 行内公式样式
  - 保留 `diagramSvg` SVG 图形
  - `imageUrl` 会作为图片渲染；相对路径转为当前站点绝对 URL，本地 `/Users/...` 路径尽量转为 `file://`
- 导出细节修正：
  - 打印/PDF 版不再额外显示独立 `formulaLatex` 公式块，避免题干里已有公式时重复出现。
  - Word/HTML 版会把常见 LaTeX 命令转成可读数学符号，例如 `\\div` -> `÷`、`\\times` -> `×`、`\\frac{a}{b}` -> `(a)/(b)`。
  - Word/HTML 版会把 SVG 图形转换为 `data:image/svg+xml` 图片，提升下载后显示概率。
  - 新增真正的 `.html` 下载入口，和 Word `.doc` 下载分开。
- 输出新增显示选项：
  - 可选择是否显示题目标签
  - 可选择是否显示知识点标签
  - 可选择是否显示试题来源
  - 来源显示方式支持：不显示 / 简短 / 完整
- 候选题池新增批量操作：
  - 全选 / 取消
  - 批量标记年级、体系、章节、知识点、来源
  - 批量忽略
  - 批量删除
  - 单题删除
- PDF 导入乱码防护：
  - PDF 文本提取质量不足或疑似乱码时，不再生成乱码候选题。
  - 系统保留原 PDF 文件和导入批次 warning。
  - 若同时粘贴了可复制文本，则用粘贴文本继续拆题。

下一步建议：

- 增强候选题批量操作：批量忽略、批量标记来源、批量标记章节/知识点。
- 做来源显示开关：学生版默认隐藏，教师版可选简短/完整来源。
- 小测默认过滤未确认答案题。
- 完善 Word/PDF 文件导入提示和解析质量 warnings。
- 为导入 API 增加专门 runtime check 脚本。

## 窗口分工

AI 教培工作台主窗口负责整体规划、阶段路线、模块边界和跨模块联动。数学题库系统已经拆到专用窗口继续沟通、开发和维护。

题库专用窗口负责以下细节：

- 导入中心
- 待确认题目池
- 正式题库
- 来源管理
- 答案状态和质量控制
- 重复题处理
- 题篮、小测、讲义、举一反三导出
- 未来学生错题、教学大纲、网络题源发现的扩展基座

主窗口只维护题库与 AI 教培工作台总系统的接口边界和阶段优先级，不承载题库细节实现。

## 项目定位

数学题库工作台是 AI 教培工作台里的独立子工作台，定位为“白老师个人私有数学题库”。

当前阶段只做教师端自己使用，不做学生小程序、不做网络自动采集、不做教学大纲联动，但底层结构需要为这些方向预留。

优先范围：

- 六年级数学
- 初一数学
- 私有精选题，不追求海量
- 题目质量优先于导入速度
- AI 只做建议，不自动确认正式数据

## 当前已存在文件

- `/Users/bzx/Projects/student-ai-console/question-bank.html`
- `/Users/bzx/Projects/student-ai-console/js/question-bank-system.js`
- `/Users/bzx/Projects/student-ai-console/server/db.js`
- `/Users/bzx/Projects/student-ai-console/server/knowledge-service.js`
- `/Users/bzx/Projects/student-ai-console/server/server.js`
- `/Users/bzx/Projects/student-ai-console/docs/STAGE_9_QUESTION_BANK_SYSTEM.md`
- `/Users/bzx/Projects/student-ai-console/docs/STAGE_10_MATH_QUESTION_BANK_PRODUCT_DESIGN.md`

题库专用窗口开始工作前，应先只读检查以上文件，不要直接大改无关模块。

## V2 总体目标

第一阶段完成教师端完整闭环：

```text
Word/PDF/文本导入
-> 保存原文件和原始文本
-> 切分候选题
-> AI 辅助结构化
-> 待确认题目池
-> 人工逐题确认
-> 正式入库
-> 题篮选题
-> 小测/讲义/举一反三输出
```

暂不做：

- 扫描版 PDF
- 图片 OCR
- 手写识别
- 自动几何图识别
- 自动完整公式还原
- 学生端小程序
- 网络题源自动采集
- 教学大纲自动联动

## 导入中心

输入端支持：

- Word `.docx`
- 可复制文字 PDF
- OCR 后文本粘贴

导入流程：

```text
上传文件或粘贴文本
-> 填写本批来源
-> 保存原文件
-> 提取文本
-> 切分候选题
-> AI 辅助结构化
-> AI 答案/解析草稿或答案校验
-> 待确认题目池
```

导入文件和原始文本需要永久保存，方便追溯和重新解析。

## 待确认题目池

候选题校对采用左右对照布局：

- 左侧：原文、来源文件、页码、切分上下文、warnings
- 右侧：结构化字段表单

候选题字段：

- 原始文本
- 识别题干
- 识别答案
- 识别解析
- AI 答案草稿
- AI 解析草稿
- AI 分类建议
- 来源信息
- 页码
- warnings
- 状态：待确认 / 已入库 / 已忽略 / 重复待处理

确认入库最低门槛：

- 题干
- 年级
- 章节

答案和解析可以缺失，但必须标记缺失状态。

支持批量操作：

- 批量忽略
- 批量标记来源
- 批量标记章节/知识点

不允许批量直接入库，正式入库仍逐题确认。

## 正式题库字段

正式题目需要支持：

- 内部自动编号
- 年级
- 体系
- 章节
- 知识点
- 子知识点
- 题型
- 难度：基础 / 中等 / 提高 / 压轴
- 分值
- 预计用时
- 题干
- 选项
- 答案
- 解析
- 易错点
- 错因标签
- LaTeX 公式
- SVG 图形
- 图片/附件路径
- 来源信息
- 原始文本
- AI 说明
- 使用次数
- 状态：草稿 / 已启用 / 归档

标签体系应支持固定标签 + 可新增标签。新增标签进入标签管理，避免同义词混乱。

## 来源管理

每道题永久保存来源。

来源字段：

- 来源类型：中考真题 / 期末测试 / 月考 / 机构讲义 / 自编 / 网页整理 / 错题
- 年份
- 地区
- 区/学校
- 考试名称
- 试卷模块
- 题号
- 来源备注
- 来源文件 ID
- 来源页码

来源显示规则：

- 题库管理页显示简短来源
- 学生版输出默认隐藏来源
- 教师版可选择显示来源
- 真题专题可手动开启来源
- 非自编题外发时提示版权/使用风险

来源显示选项：

```text
不显示来源（默认）
简短来源：2024 深圳中考
完整来源：2024年深圳中考数学 · 第18题
```

## 答案与质量控制

答案状态：

```text
未提供
AI 已生成，待确认
AI 校验一致
疑似不一致
人工已确认
无需答案
```

规则：

- 缺答案题可以入库，但标记“缺答案”
- AI 可以生成答案草稿和解析草稿
- AI 可以校验导入答案是否疑似正确
- AI 不自动确认答案正确
- 小测卷默认过滤未确认答案题
- 讲义可以允许缺答案题，但要提示

质量状态：

- 缺答案
- 缺解析
- 缺知识点
- 缺来源
- 疑似公式损坏
- 疑似切题错误
- 疑似重复题
- 含图但无附件

题库首页第一屏优先显示待处理任务：

- 待确认题目
- 重复待处理
- 缺答案/解析
- 最近导入
- 来源缺失
- 公式/图形待校对

## 重复题处理

导入时检测疑似重复。

检测依据：

- 题干相似度
- 答案相同
- 来源相同
- 题号相同
- 知识点相同
- 公式相似

重复处理方式：

- 忽略新题
- 保留新题
- 替换旧题
- 合并来源
- 标记为变式题

默认不自动覆盖、不自动跳过，进入重复待处理。

## 输出端

输出类型：

- 小测卷
- 专题讲义
- 举一反三练习
- 错题复练草稿

导出版本：

- 学生版：无答案解析，默认隐藏来源
- 教师版：含答案、解析、易错点，可显示来源

导出格式：

- 网页打印 PDF
- HTML Word 下载
- Markdown 复制

输出模板：

- 第一阶段内置预设模板
- 后续支持保存自定义模板
- 不一开始做复杂模板编辑器

## 未来扩展基座

当前不做，但底层预留。

学生错题入口：

- 预留 `student_question_records`
- 预留错题来源、错因、掌握状态、复练次数
- 后续可做学生提交错题入口

教学大纲联动：

- 预留 `curriculum_plans`
- 预留 `curriculum_units`
- 预留题目和教学单元绑定关系
- 后续可按教学进度生成讲义和小测

网络题源发现：

- 预留 `source_watch_rules`
- 预留 `source_candidates`
- 后续做搜索提醒 + 人工确认，不直接自动爬取入库

试卷/讲义草稿：

- 预留 `paper_drafts`
- 预留 `paper_items`
- 后续保存历史组卷和讲义版本

## 测试计划

导入：

- Word 讲义能生成候选题
- 可复制文字 PDF 能生成候选题
- OCR 文本粘贴能批量拆题
- 原文件和原始文本能追溯
- 扫描版 PDF 提示当前不支持

候选题池：

- 左右对照校对正常
- 候选题可编辑
- 题干 + 年级 + 章节齐全才能确认入库
- 缺答案/解析可入库但标记缺失
- 批量忽略和批量标记可用
- 不支持批量直接入库

来源：

- 批量来源可继承到候选题
- 单题来源可单独修改
- 正式题库显示简短来源
- 输出默认隐藏来源
- 开启完整来源后显示考试名和题号
- 非自编题外发时出现提醒

答案校验：

- 缺答案题可生成 AI 答案草稿
- 有答案题可进行 AI 校验
- 答案一致标记为 AI 校验一致
- 答案不一致标记为疑似不一致
- 只有人工确认答案才可进入正式小测默认题池

输出：

- 小测卷学生版无答案
- 小测卷教师版有答案解析
- 讲义包含学习目标、例题、讲解要点、易错提醒
- 举一反三输出变式方向
- 网页打印 PDF 不显示操作按钮
- HTML Word 下载可打开编辑

## 题库专用窗口启动提示词

可以直接把下面这段发给题库专用窗口：

```markdown
请先读取并理解：

- /Users/bzx/Projects/student-ai-console/docs/MATH_QUESTION_BANK_CONTEXT.md
- /Users/bzx/Projects/student-ai-console/docs/STAGE_9_QUESTION_BANK_SYSTEM.md
- /Users/bzx/Projects/student-ai-console/docs/STAGE_10_MATH_QUESTION_BANK_PRODUCT_DESIGN.md
- /Users/bzx/Projects/student-ai-console/question-bank.html
- /Users/bzx/Projects/student-ai-console/js/question-bank-system.js
- /Users/bzx/Projects/student-ai-console/server/db.js
- /Users/bzx/Projects/student-ai-console/server/knowledge-service.js
- /Users/bzx/Projects/student-ai-console/server/server.js

这个窗口专门负责数学题库系统。请不要修改无关模块。

当前目标是实现数学题库工作台 V2：

1. 导入中心：Word、可复制文字 PDF、OCR 文本粘贴。
2. 待确认题目池：左右对照校对、逐题确认入库、批量忽略/批量标记。
3. 正式题库：完善字段、来源、答案状态、质量状态、重复题处理。
4. 输出端：小测、讲义、举一反三，支持学生版/教师版、来源显示开关、网页打印 PDF、HTML Word 下载、Markdown 复制。
5. 底层预留：学生错题、教学大纲、网络题源发现、试卷草稿。

开发前先检查当前分支、git status 和现有代码结构。实现后需要 node --check、npm run check，并用浏览器实际测试 question-bank.html。
```
