# 学员管理系统 - 项目文档

## 项目概述

个人老师使用的中小学数学学员管理系统，用于管理60人左右、8个班级的学员。

---

## 用户信息

### 个人信息
| 项目 | 内容 |
|------|------|
| 职业 | 中小学数学老师 |
| 教龄 | 5年 |
| 学科 | 中小学数学 |
| 班型 | 10人左右小班课 |
| 年级 | 小学高年级（六年级）、初一 |
| 课程体系 | 小学学而思培优体系，初中深圳桃李未来讲义 |
| 授课特点 | 基础班、奥数班、初中中考、部分自主招生难度 |

### 技术背景
| 项目 | 内容 |
|------|------|
| 编程基础 | 无 |
| Python | 仅用于调用 AI 工具 |
| AI使用习惯 | 高频聊天 AI、AI Agent |
| 计划学习 | Agent工具、Obsidian、Claude Code |
| 知识管理 | Obsidian 记录 AI 学习 |

---

## 技术栈

- **前端**：纯 HTML + CSS + JavaScript（模块化结构，无 ES module，所有 script 标签在 index.html 中）
- **数据存储**：浏览器 localStorage
- **Excel 导出**：SheetJS (CDN: https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js)
- **图表**：Chart.js (CDN: https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js)

---

## 项目结构

```
学员管理系统/
├── index.html          # 主页面（所有模块通过 JS 动态渲染）
├── css/
│   └── style.css       # 样式文件
├── js/
│   ├── app.js          # 应用入口、授权验证
│   ├── data.js         # 数据定义、示例数据、存储读写
│   ├── dashboard.js    # 首页模块
│   ├── class.js        # 班级管理模块
│   ├── student.js      # 学员管理模块
│   ├── fee.js          # 收费记录模块
│   ├── attendance.js   # 考勤记录模块
│   ├── grade.js        # 成绩记录模块
│   ├── communication.js # 沟通记录模块
│   ├── prospects.js    # 意向学员模块
│   ├── statistics.js   # 统计报表模块
│   └── data-management.js # 数据管理（导出、备份、清空）
└── CLAUDE.md           # 项目文档（本文档）
```

---

## 数据结构

### 完整数据结构

```javascript
data = {
    classes: [],         // 班级列表
    students: [],       // 学员列表
    fees: [],          // 收费记录列表
    attendance: [],     // 考勤记录列表
    grades: [],        // 成绩记录列表
    communications: [], // 沟通记录列表
    communicationTopics: [], // 沟通主题分类
    prospects: [],     // 意向学员列表
    prospectSources: [], // 意向来源渠道列表
    classTypes: []     // 班型分类列表
}
```

### 班级 (classes)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识，格式 "c" + 时间戳 |
| name | string | 班级名称，如 "六年级培优A班" |
| type | string | 班型，从 classTypes 中选择 |
| teacher | string | 授课老师 |
| maxStudents | number | 最大人数 |
| status | string | active（进行中）/ forming（组班中）/ completed（已结课） |
| schedule | string | 上课时间，如 "周六 14:00-16:00" |
| createDate | string | 创建日期，YYYY-MM-DD |

### 学员 (students)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识，格式 "s" + 时间戳 |
| name | string | 学员姓名 |
| gender | string | 男 / 女 |
| grade | string | 年级，如 "六年级" / "初一" |
| school | string | 就读学校 |
| phone | string | 联系电话 |
| classId | string | 所属班级 ID |
| teacher | string | 授课老师 |
| status | string | active（在读）/ pending（待续费）/ withdrawn（已退）/ graduated（已毕业） |
| enrollDate | string | 报名日期，YYYY-MM-DD |
| remark | string | 备注 |

### 收费记录 (fees)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| studentId | string | 学员 ID |
| studentName | string | 学员姓名（冗余存储） |
| amount | number | 缴费金额 |
| hours | number | 购买课时数 |
| pricePerHour | number | 单价（元/课时） |
| paymentDate | string | 缴费日期，YYYY-MM-DD |
| paymentMethod | string | 缴费方式：现金 / 转账 / 其他 |
| package | string | 套餐名称 |
| status | string | paid（已缴）/ unpaid（欠费） |
| remark | string | 备注 |

### 考勤记录 (attendance)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| classId | string | 班级 ID |
| date | string | 上课日期，YYYY-MM-DD |
| topic | string | 本次课主题/内容 |
| records | object | 学员考勤状态，格式 { studentId: 1 或 0 } |

**records 取值约定**：
- `1` = 正常出勤（扣1课时）
- `0` = 请假（不扣课时）

### 成绩记录 (grades)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| studentId | string | 学员 ID |
| studentName | string | 学员姓名（冗余） |
| testName | string | 测试名称 |
| testDate | string | 测试日期，YYYY-MM-DD |
| examType | string | school（校内）/ external（校外） |
| score | number | 得分 |
| fullScore | number | 满分 |
| ranking | number | 班级排名 |
| weakPoints | string | 薄弱点 |
| remark | string | 备注 |

### 沟通记录 (communications)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| studentId | string | 学员 ID |
| studentName | string | 学员姓名（冗余） |
| topicId | string | 沟通主题 ID |
| contactType | string | 沟通方式：电话 / 微信 / 面谈 / 其他 |
| contactPerson | string | 沟通对象（家长姓名） |
| contactDate | string | 沟通日期，YYYY-MM-DD |
| status | string | pending（待沟通）/ completed（已完成） |
| content | string | 沟通内容 |
| followUp | string | 后续跟进 |

### 沟通主题 (communicationTopics)
| 字段 | 说明 |
|------|------|
| id | 唯一标识 |
| name | 主题名称：续费沟通 / 学情反馈 / 请假沟通 / 投诉处理 / 其他 |
| color | 主题颜色，用于 UI 显示 |

### 意向学员 (prospects)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 唯一标识 |
| name | string | 姓名 |
| phone | string | 联系电话 |
| source | string | 来源渠道，从 prospectSources 中选择 |
| intent | string | 咨询意向 |
| trialDate | string | 试课日期，YYYY-MM-DD |
| trialStatus | string | pending（待跟进）/ contacted（已联系）/ trial（试课中）/ deal（已成交）/ lost（已流失） |
| dealStatus | string | deal（已成交）/ lost（已流失）/ 空（未成交） |
| remark | string | 备注 |
| createDate | string | 录入日期，YYYY-MM-DD |

### 意向来源 (prospectSources)
字符串数组，如：`["家长推荐", "朋友圈", "抖音", "小红书", "百度", "地推", "其他"]`

### 班型分类 (classTypes)
字符串数组，如：`["基础", "拔高", "奥数", "中考", "自主招生", "短期班"]`

---

## 关键业务逻辑

### 课消计算
- **计算方式**：出勤记录数 × 单价
- **公式**：`已消课时 = 出勤次数`（每出勤一次扣1课时）
- **剩余课时**：`总课时 - 已消课时`
- **判断依据**：考勤记录中 `records[studentId] === 1` 为出勤

### 成绩类型
- **校内 (school)**：学校考试成绩
- **校外 (external)**：机构测试、竞赛等校外成绩
- 学员详情页支持 tab 切换查看两种成绩

### 学员状态流转
- **在读 (active)**：正常在读学员
- **待续费 (pending)**：课时不足需要续费
- **已退 (withdrawn)**：退班学员
- **已毕业 (graduated)**：结业学员

### 班级状态
- **进行中 (active)**：正在上课
- **组班中 (forming)**：正在招募学员
- **已结课 (completed)**：课程结束

### 沟通状态
- **待沟通 (pending)**：待处理的沟通计划
- **已完成 (completed)**：已完成的沟通记录

### 意向学员试课状态
- **待跟进 (pending)** → **已联系 (contacted)** → **试课中 (trial)** → **已成交 (deal)** 或 **已流失 (lost)**

---

## 自动保存机制

| 触发条件 | 说明 |
|----------|------|
| 每30秒 | 定时自动保存 |
| 关闭浏览器前 | beforeunload 事件触发 |
| 页面隐藏时 | visibilitychange 事件触发 |

**localStorage Key**: `studentManagementSystem_v3`

---

## 备份与恢复

| 功能 | 操作 | 说明 |
|------|------|------|
| 导出备份 | 点击「导出备份」按钮 | 下载完整 JSON 文件 |
| 导入备份 | 选择 JSON 文件 | 覆盖当前所有数据 |
| 复制JSON | 数据管理弹窗中 | 复制到剪贴板 |
| 保存JSON | 数据管理弹窗中 | 下载到本地文件 |
| 一键导出Excel | 数据管理弹窗中 | 导出所有模块 Excel |

---

## 数据管理功能

- **一键导出所有Excel**：分别导出收费记录、成绩记录、班级学员、沟通记录、意向学员
- **一键清空所有数据**：双次确认后清空，需提前备份
- **重置为示例数据**：恢复系统内置示例数据

---

## 部署说明

### GitHub Pages 部署
1. 代码推送到 GitHub 仓库
2. 仓库设置 → Pages → Source 选择 main 分支
3. 访问地址：`https://用户名.github.io/仓库名/`
4. 仓库需设置为 **Public** 才能使用 Pages

### 当前部署信息
- **仓库地址**：https://github.com/930187308-commits/student-management
- **在线地址**：https://930187308-commits.github.io/student-management/

---

## 外部依赖

| 库 | 版本 | CDN 地址 |
|----|------|----------|
| SheetJS (Excel) | 0.18.5 | https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js |
| Chart.js | 4.4.0 | https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js |

---

## 命名约定

| 类别 | 约定 | 示例 |
|------|------|------|
| ID 前缀 | 班级 "c"、学员 "s" + 时间戳 | `c1716201234567` |
| 日期格式 | YYYY-MM-DD | `2026-05-21` |
| 状态字段 | 英文常量 | active / pending / paid |
| 布尔含义 | 1=是/出勤，0=否/请假 | attendance.records |

---

## UI 交互规范

| 场景 | 规范 |
|------|------|
| Tab 切换 | 点击 tab 按钮，JS 切换 active 类显示对应内容 |
| 模态框 | 通用 modal 组件，title + body 结构 |
| Toast 提示 | 底部短暂提示，1.5秒自动消失 |
| 删除确认 | 操作前 confirm 对话框确认 |
| 数据渲染 | 各模块 render 函数负责渲染到对应 tab-content |

---

## 开发注意事项

1. **数据存储在浏览器**，清除缓存会丢失，需定期导出备份
2. **考勤记录取值**：1=正常出勤（扣课时），0=请假（不扣课时）
3. **课消计算**：基于出勤记录自动计算，出勤一次扣1课时
4. **成绩趋势图**：学员详情页显示，需要≥2条成绩记录才绘制
5. **授权码**：验证通过后存入 localStorage，Key 为 `licenseKey`，默认码 `SMS2025`
6. **多人使用同一授权码**：授权码存在每个用户的浏览器本地，互不影响数据

---

## 后续开发计划

1. ~~重构为模块化项目结构（js/css 分离）~~ ✅ 已完成
2. 考虑云端同步方案（iCloud/Firebase）
3. 家长端功能（可选）

---

## 最近变更

| 日期 | 变更内容 |
|------|----------|
| 2026-05-21 | 数据管理新增一键导出所有Excel、一键清空所有数据、重置为示例数据功能 |

---

## 快速同步新会话

如果需要在新终端或VS Code插件重新开始对话，可以复制以下内容：

```
你好，我有一个学员管理系统项目。
项目位置：VS Code 打开的文件夹
项目背景：中小学数学老师，5年教龄，管理60人8个班级。
项目情况请读取当前目录的 CLAUDE.md 文件。
```

这样我就能快速同步所有上下文。
