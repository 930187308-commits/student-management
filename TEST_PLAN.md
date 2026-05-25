# 测试数据验证清单

## 测试数据规模

- 班级：12 个，覆盖正常、组班中、已结课。
- 学员：84 名，覆盖在读、待续费、停课、退费、毕业、未分班、缺手机号、长姓名、特殊字符。
- 收费：36+ 条，覆盖已缴、欠费、0 课时、不同付款方式。
- 考勤：72 次课，覆盖出勤、请假、未填写。
- 成绩：200+ 条，覆盖校内、校外、高分、低分、薄弱点。
- 沟通：75 条左右，覆盖续费、学情、请假、投诉、其他、换行 follow-up、特殊字符。
- 招生线索：36 条，覆盖待跟进、已联系、试课、成交、流失、无电话。

## 导入测试数据

```bash
cd /Users/bzx/Projects/student-ai-console
scripts/node.sh server/generate-test-data.js
scripts/node.sh server/import-json.js /Users/bzx/Data/student-ai-console/backups/test-data-具体文件名.json
launchctl kickstart -k gui/501/com.bzx.student-ai-console
```

## 一键恢复空数据

```bash
cd /Users/bzx/Projects/student-ai-console
scripts/node.sh server/reset-empty-data.js
launchctl kickstart -k gui/501/com.bzx.student-ai-console
```

恢复前会自动生成 SQLite 和 JSON 备份。

## 多设备验证

1. 在 MacBook 打开 `http://192.168.1.97:3000`，确认学员、班级、收费、考勤、成绩、沟通、招生线索都能显示。
2. 在 iPad 新增一名测试学员，MacBook 刷新后应能看到。
3. 在 MacBook 修改该学员年级、班级、状态，iPad 刷新后应同步。
4. 在 iPad 将该学员归档/停课，MacBook 和 Mac mini 刷新后应同步。
5. 在 MacBook 新增收费记录，iPad 刷新后应同步。
6. 在 iPad 修改考勤 1/0/空，MacBook 刷新后应同步。
7. 在 MacBook 新增成绩，iPad 刷新后应同步。
8. 在 iPad 新增沟通记录，MacBook 刷新后应同步。
9. 在手机端只验证能查、能简单新增，不要求排版完美。

## 冲突验证

1. MacBook 和 iPad 同时打开页面。
2. MacBook 新增或修改一条记录并保存。
3. iPad 不刷新，直接修改另一条记录并保存。
4. 预期：如果 iPad 基于旧版本保存，服务器应拒绝覆盖，并提示刷新。

## 通过标准

- 刷新后数据数量不减少。
- 学员归档不会物理删除。
- 未填写考勤不会自动变成出勤。
- 特殊字符只作为文本显示，不执行。
- 备份目录中能看到导入前和清空前的备份文件。
