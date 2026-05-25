const { openDatabase, createBackup } = require('./db');

function main() {
    const reason = process.argv[2] || 'manual_cli';
    openDatabase();
    const backup = createBackup(reason);
    console.log(JSON.stringify({
        ok: true,
        reason,
        backup
    }, null, 2));
}

try {
    main();
} catch (error) {
    console.error(`备份失败：${error.message}`);
    process.exit(1);
}
