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
        <div class="license-modal-body">
            <p class="license-modal-note">请输入授权码继续使用</p>
            <input type="text" id="licenseInput" class="license-input" placeholder="请输入授权码">
            <button class="btn btn-primary license-submit" onclick="verifyLicense()">验证</button>
            <p id="licenseError" class="license-error">授权码无效，请检查后重新输入</p>
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
        document.getElementById('licenseError').classList.add('show');
    }
}

// 解绑授权（清除本地授权记录，需要重新验证）
function unbindLicense() {
    if (!confirm('确定解除授权吗？解除后将需要重新输入授权码。')) return;
    localStorage.removeItem('licenseKey');
    location.reload();
}

// 移动端导航切换
function toggleMobileNav() {
    const sidebar = document.querySelector('.app-sidebar');
    const overlay = document.getElementById('mobileNavOverlay');
    if (sidebar) {
        sidebar.classList.toggle('open');
        if (overlay) {
            overlay.classList.toggle('show');
        }
    }
}
