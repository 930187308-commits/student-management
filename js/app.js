// ==================== 应用入口 ====================

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    checkLicense();
});

// 授权码验证
function checkLicense() {
    const savedLicense = localStorage.getItem('licenseKey');
    const validLicense = 'SMS2025'; // 可修改为你的授权码

    if (savedLicense === validLicense) {
        init();
    } else {
        showLicenseModal();
    }
}

function showLicenseModal() {
    document.getElementById('modalTitle').textContent = '授权验证';
    document.getElementById('modalBody').innerHTML = `
        <div style="text-align: center; padding: 20px 0;">
            <p style="margin-bottom: 20px; color: #666;">请输入授权码继续使用</p>
            <input type="text" id="licenseInput" placeholder="请输入授权码" style="
                width: 100%;
                padding: 12px 16px;
                border: 1px solid #ddd;
                border-radius: 8px;
                font-size: 16px;
                text-align: center;
                margin-bottom: 16px;
            ">
            <button class="btn btn-primary" style="width: 100%;" onclick="verifyLicense()">验证</button>
            <p id="licenseError" style="color: #e74c3c; margin-top: 12px; display: none;">授权码无效，请检查后重新输入</p>
        </div>
    `;
    document.getElementById('modal').classList.add('show');
}

function verifyLicense() {
    const input = document.getElementById('licenseInput').value.trim();
    const validLicense = 'SMS2025'; // 可修改为你的授权码

    if (input === validLicense) {
        localStorage.setItem('licenseKey', input);
        document.getElementById('modal').classList.remove('show');
        showToast('授权成功');
        init();
    } else {
        document.getElementById('licenseError').style.display = 'block';
    }
}

// 解绑授权（清除本地授权记录，需要重新验证）
function unbindLicense() {
    if (!confirm('确定解除授权吗？解除后将需要重新输入授权码。')) return;
    localStorage.removeItem('licenseKey');
    location.reload();
}