const { DEFAULT_DATA, openDatabase, setData, createBackup } = require('./db');

function main() {
    openDatabase();
    const backup = createBackup('before_reset_empty');
    const saved = setData({
        ...DEFAULT_DATA,
        lastModified: new Date().toISOString()
    }, 'reset_empty');

    console.log(JSON.stringify({
        ok: true,
        backup,
        counts: {
            classes: saved.classes.length,
            students: saved.students.length,
            fees: saved.fees.length,
            attendance: saved.attendance.length,
            grades: saved.grades.length,
            communications: saved.communications.length,
            prospects: saved.prospects.length
        }
    }, null, 2));
}

try {
    main();
} catch (error) {
    console.error(`清空失败：${error.message}`);
    process.exit(1);
}
