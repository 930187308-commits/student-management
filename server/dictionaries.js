const DICTIONARIES = {
    studentStatus: [
        { value: 'active', label: '在读', category: 'student', active: true },
        { value: 'renewalPending', label: '待续费', category: 'student', active: true },
        { value: 'inactive', label: '停课/非在读', category: 'student', active: false },
        { value: 'archived', label: '归档', category: 'student', active: false }
    ],
    classStatus: [
        { value: 'active', label: '正常', category: 'class', active: true },
        { value: 'forming', label: '组班中', category: 'class', active: true },
        { value: 'finished', label: '已结课', category: 'class', active: false },
        { value: 'archived', label: '已归档', category: 'class', active: false }
    ],
    feeStatus: [
        { value: 'paid', label: '已缴', category: 'fee', active: true },
        { value: 'pending', label: '欠费/待收款', category: 'fee', active: true },
        { value: 'refunded', label: '已退费', category: 'fee', active: false }
    ],
    prospectTrialStatus: [
        { value: 'new', label: '新咨询', category: 'prospect', active: true },
        { value: 'contacted', label: '已联系', category: 'prospect', active: true },
        { value: 'trial', label: '已试听', category: 'prospect', active: true },
        { value: 'forming', label: '组班中', category: 'prospect', active: true },
        { value: 'lost', label: '流失', category: 'prospect', active: false },
        { value: 'deal', label: '已转正式', category: 'prospect', active: false }
    ],
    prospectDealStatus: [
        { value: 'pending', label: '未成交', category: 'prospect', active: true },
        { value: 'deal', label: '已成交', category: 'prospect', active: false },
        { value: 'lost', label: '已流失', category: 'prospect', active: false }
    ],
    communicationStatus: [
        { value: 'pending', label: '待沟通', category: 'communication', active: true },
        { value: 'done', label: '已沟通', category: 'communication', active: false },
        { value: 'followUp', label: '需跟进', category: 'communication', active: true }
    ],
    grades: [
        { value: '五年级', label: '五年级', stage: 'primary', next: '六年级' },
        { value: '六年级', label: '六年级', stage: 'primary', next: '初一' },
        { value: '初一', label: '初一', stage: 'middle', next: '初二' },
        { value: '初二', label: '初二', stage: 'middle', next: '初三' },
        { value: '初三', label: '初三', stage: 'middle', next: '' },
        { value: '高一', label: '高一', stage: 'high', next: '高二' },
        { value: '高二', label: '高二', stage: 'high', next: '高三' },
        { value: '高三', label: '高三', stage: 'high', next: '' }
    ],
    attendanceStatus: [
        { value: 1, label: '出勤', category: 'attendance', consumesHour: true },
        { value: 0, label: '请假/未出勤', category: 'attendance', consumesHour: false },
        { value: null, label: '未记录', category: 'attendance', consumesHour: false }
    ]
};

function getDictionaries() {
    return {
        version: '2026-06-18',
        dictionaries: DICTIONARIES
    };
}

function getDictionary(name) {
    return DICTIONARIES[name] || null;
}

module.exports = {
    DICTIONARIES,
    getDictionaries,
    getDictionary
};
