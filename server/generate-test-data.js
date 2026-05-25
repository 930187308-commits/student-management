const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
const { DEFAULT_DATA } = require('./db');

const outputPath = process.argv[2] || path.join(config.backupDir, `test-data-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

function id(prefix, index) {
    return `${prefix}${String(index).padStart(3, '0')}`;
}

function dateFrom(start, offsetDays) {
    const date = new Date(`${start}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + offsetDays);
    return date.toISOString().slice(0, 10);
}

function pick(list, index) {
    return list[index % list.length];
}

const classSeeds = [
    ['六年级基础-A', '六年级', '基础', '周一 18:00-20:00', 'active'],
    ['六年级拔高-B', '六年级', '拔高', '周二 18:00-20:00', 'active'],
    ['六年级奥数-C', '六年级', '奥数', '周三 18:30-20:30', 'active'],
    ['初一基础-A', '初一', '基础', '周四 18:00-20:00', 'active'],
    ['初一拔高-B', '初一', '拔高', '周五 18:00-20:00', 'active'],
    ['初二基础-A', '初二', '基础', '周六 09:00-11:00', 'active'],
    ['初二拔高-B', '初二', '拔高', '周六 14:00-16:00', 'active'],
    ['初三中考冲刺-A', '初三', '中考', '周日 09:00-11:30', 'active'],
    ['初三中考压轴-B', '初三', '中考', '周日 14:00-16:30', 'active'],
    ['新初一暑假预备', '新初一', '短期班', '周一至周五 10:00-12:00', 'forming'],
    ['小升初自主招生', '六年级', '自主招生', '周六 18:30-20:30', 'forming'],
    ['2025春季已结课班', '初一', '基础', '周三 16:00-18:00', 'finished']
];

const classes = classSeeds.map((item, index) => ({
    id: id('c', index + 1),
    name: item[0],
    grade: item[1],
    classType: item[2],
    schedule: item[3],
    semester: index === 11 ? '2025春季' : '2026春季',
    maxStudents: pick([8, 10, 12, 15], index),
    status: item[4],
    summerSchedule: index % 3 === 0 ? '暑假周一至周五上午' : index % 3 === 1 ? '暑假周一三五下午' : ''
}));

const familyNames = ['赵', '钱', '孙', '李', '周', '吴', '郑', '王', '冯', '陈', '褚', '卫', '蒋', '沈', '韩', '杨'];
const givenNames = ['一鸣', '子涵', '浩然', '思远', '雨桐', '梓萱', '嘉豪', '若曦', '明哲', '欣怡', '晨曦', '宇轩'];
const schools = ['实验小学', '第一小学', '外国语学校', '育才中学', '实验中学', '附属学校'];
const teachers = ['白老师', '王老师', '李老师'];
const activeClasses = classes.filter((cls) => cls.status === 'active');

const students = Array.from({ length: 84 }, (_, index) => {
    const classItem = index === 80 ? null : activeClasses[index % activeClasses.length];
    const status = index % 17 === 0 ? 'inactive' :
        index % 19 === 0 ? 'withdrawn' :
        index % 23 === 0 ? 'graduated' :
        index % 11 === 0 ? 'renewalPending' : 'active';
    const name = index === 5 ? '测试<script>alert(1)</script>' :
        index === 12 ? '超长名字测试学员ABCDEFGHIJK' :
        `${pick(familyNames, index)}${pick(givenNames, index)}`;
    return {
        id: id('s', index + 1),
        name,
        gender: index % 2 === 0 ? '男' : '女',
        grade: classItem?.grade || pick(['六年级', '初一', '初二', '初三'], index),
        classId: classItem?.id || '',
        teacher: pick(teachers, index),
        enrollDate: dateFrom('2026-02-01', index % 45),
        phone: index % 13 === 0 ? '' : `1390000${String(index + 1).padStart(4, '0')}`,
        emergencyContact: index % 10 === 0 ? '' : `1380000${String(index + 1).padStart(4, '0')}`,
        status,
        followUpStatus: index % 11 === 0 ? 'needFollow' : index % 29 === 0 ? 'lost' : '',
        remark: index % 9 === 0 ? '需要关注计算准确率；家长希望每两周反馈一次。' : index % 14 === 0 ? '备注含特殊字符 <b>bold</b> & "quote"' : '',
        school: pick(schools, index),
        _archivedAt: status !== 'active' && status !== 'renewalPending' ? dateFrom('2026-04-01', index % 20) : undefined
    };
});

const fees = [];
students.forEach((student, index) => {
    if (index % 3 === 0) {
        fees.push({
            id: id('f', fees.length + 1),
            studentId: student.id,
            studentName: student.name,
            amount: pick([3200, 4000, 4800, 5600, 7200], index),
            pricePerHour: pick([160, 180, 200, 220], index),
            hours: pick([20, 24, 30, 40], index),
            paymentDate: dateFrom('2026-02-10', index % 70),
            package: pick(['春季20课时', '春季30课时', '中考冲刺包', '暑假预备包'], index),
            paymentMethod: pick(['微信转账', '支付宝', '银行转账', '现金'], index),
            status: index % 12 === 0 ? 'unpaid' : 'paid',
            remark: index % 15 === 0 ? '分两次缴费，需复核余额' : ''
        });
    }
    if (index % 10 === 0) {
        fees.push({
            id: id('f', fees.length + 1),
            studentId: student.id,
            studentName: student.name,
            amount: 0,
            pricePerHour: 200,
            hours: 0,
            paymentDate: dateFrom('2026-03-01', index % 30),
            package: '欠费/待确认记录',
            paymentMethod: '微信转账',
            status: 'unpaid',
            remark: '用于测试欠费筛选'
        });
    }
});

const attendance = [];
activeClasses.forEach((classItem, classIndex) => {
    for (let sessionIndex = 0; sessionIndex < 8; sessionIndex++) {
        const classStudents = students.filter((student) => student.classId === classItem.id && student.status === 'active');
        const records = {};
        classStudents.forEach((student, studentIndex) => {
            if ((studentIndex + sessionIndex) % 7 === 0) return;
            records[student.id] = (studentIndex + sessionIndex + classIndex) % 9 === 0 ? 0 : 1;
        });
        attendance.push({
            id: id('a', attendance.length + 1),
            classId: classItem.id,
            date: dateFrom('2026-03-01', classIndex * 2 + sessionIndex * 7),
            sessionName: `第${sessionIndex + 1}次课`,
            records
        });
    }
});

const grades = [];
students.filter((student) => student.status === 'active' || student.status === 'renewalPending').forEach((student, index) => {
    const count = 2 + (index % 3);
    for (let gradeIndex = 0; gradeIndex < count; gradeIndex++) {
        const score = Math.max(42, Math.min(100, 68 + ((index * 7 + gradeIndex * 5) % 31)));
        grades.push({
            id: id('g', grades.length + 1),
            studentId: student.id,
            studentName: student.name,
            classId: student.classId,
            testName: pick(['周测', '月考', '期中模拟', '专题测评'], gradeIndex) + `-${gradeIndex + 1}`,
            testDate: dateFrom('2026-03-05', index + gradeIndex * 18),
            score,
            fullScore: 100,
            ranking: 1 + ((index + gradeIndex) % 15),
            examType: gradeIndex % 2 === 0 ? 'school' : 'external',
            weakPoints: pick(['计算准确率', '几何辅助线', '应用题建模', '压轴题思路', '审题习惯'], index + gradeIndex),
            remark: score < 70 ? '需要重点跟进' : ''
        });
    }
});

const communications = [];
students.slice(0, 60).forEach((student, index) => {
    const count = index % 4 === 0 ? 2 : 1;
    for (let commIndex = 0; commIndex < count; commIndex++) {
        communications.push({
            id: id('m', communications.length + 1),
            studentId: student.id,
            studentName: student.name,
            topicId: pick(['t1', 't2', 't3', 't4', 't5'], index + commIndex),
            contactDate: dateFrom('2026-03-10', index + commIndex * 9),
            contactType: pick(['微信', '电话', '面谈', '短信'], index + commIndex),
            contactPerson: pick(['妈妈', '爸爸', '本人', '爷爷奶奶'], index),
            teacher: pick(teachers, index),
            status: pick(['pending', 'done', 'follow'], index + commIndex),
            content: index % 13 === 0 ? '测试转义：<img src=x onerror=alert(1)> 家长反馈' : '反馈近期课堂表现、作业完成和下阶段建议。',
            followUp: commIndex === 0 && index % 5 === 0 ? '下周二前再次跟进续费/作业情况。\n如无回复，电话确认。' : ''
        });
    }
});

const prospects = Array.from({ length: 36 }, (_, index) => ({
    id: id('p', index + 1),
    name: index === 3 ? '意向<script>测试</script>' : `意向学员${String(index + 1).padStart(2, '0')}`,
    phone: index % 8 === 0 ? '' : `1370000${String(index + 1).padStart(4, '0')}`,
    source: pick(DEFAULT_DATA.prospectSources, index),
    intent: pick(['小升初衔接', '中考冲刺', '校内同步提升', '奥数拓展', '一对一诊断'], index),
    trialDate: index % 6 === 0 ? '' : dateFrom('2026-04-01', index),
    trialStatus: pick(['pending', 'contacted', 'trial', 'deal', 'lost'], index),
    dealStatus: index % 9 === 0 ? 'deal' : index % 7 === 0 ? 'lost' : '',
    remark: index % 5 === 0 ? '需要二次跟进，关注价格敏感度。' : '',
    createDate: dateFrom('2026-03-20', index)
}));

const testData = {
    ...DEFAULT_DATA,
    classes,
    students,
    fees,
    attendance,
    grades,
    communications,
    prospects,
    lastModified: new Date().toISOString()
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(testData, null, 2));

console.log(JSON.stringify({
    ok: true,
    outputPath,
    counts: {
        classes: classes.length,
        students: students.length,
        fees: fees.length,
        attendance: attendance.length,
        grades: grades.length,
        communications: communications.length,
        prospects: prospects.length
    }
}, null, 2));
