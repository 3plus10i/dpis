import { DPIS } from './dpis.js';

// 初始化DPIS系统
const canvasId = 'dpis-canvas';
const dpis = new DPIS(canvasId);

// 初始化交互事件
function bindEvents() {
    const canvas = document.getElementById(canvasId);
    
    // 这里绑定到document，则可以在canvas外部也能触发事件

    // 鼠标移动事件
    document.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        dpis.updateMousePosition(e.clientX - rect.left, e.clientY - rect.top);
    });
    
    // 触摸事件
    document.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        dpis.updateMousePosition(touch.clientX - rect.left, touch.clientY - rect.top);
    }, { passive: false });
    
    document.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        dpis.updateMousePosition(touch.clientX - rect.left, touch.clientY - rect.top);
    }, { passive: false });

    // 停止触摸事件
    document.addEventListener('touchend', () => {
        dpis.updateMousePosition(null, null);
    });
}

// 图片列表
const IMAGE_LIST = [
    '罗德岛.png', '巴别塔.png', '彩虹小队.png', '企鹅物流.png', '莱茵生命.png'
];

// 动态生成图片列表
function renderImageList() {
    const imageListContainer = document.getElementById('imageList');
    
    IMAGE_LIST.forEach(name => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        
        const img = document.createElement('img');
        img.src = `public/${name}`;
        img.alt = name;
        img.className = 'sidebar-image';
        img.dataset.src = `public/${name}`;
        
        const span = document.createElement('span');
        span.className = 'image-name';
        span.textContent = name;
        
        imageItem.appendChild(img);
        imageItem.appendChild(span);
        imageListContainer.appendChild(imageItem);
        
        // 绑定点击事件
        imageItem.addEventListener('click', () => {
            const imageSrc = `public/${name}`;
            dpis.loadImage(imageSrc)
                .catch(error => {
                    console.error('图片加载失败:', error);
                    alert('图片加载失败: ' + error.message);
                });
        });
    });
}

// 初始化控制面板
function initControls() {
    const controls = [
        { id: 'particleRadius', configName: 'particleRadius', valueId: 'particleRadiusValue' },
        { id: 'repulsionRadius', configName: 'repulsionRadius', valueId: 'repulsionRadiusValue' },
        { id: 'repulsionForce', configName: 'repulsionForce', valueId: 'repulsionForceValue' },
        { id: 'friction', configName: 'resistence', valueId: 'frictionValue' },
        { id: 'attractionForce', configName: 'attractionForce', valueId: 'attractionForceValue' },
        { id: 'particleSpacing', configName: 'particleInterval', valueId: 'particleSpacingValue' },
        { id: 'unitDistance', configName: 'unitDistance', valueId: 'unitDistanceValue' },
        { id: 'offsetAngle', configName: 'offsetAngle', valueId: 'offsetAngleValue' },
    ];
    
    controls.forEach(control => {
        const rangeInput = document.getElementById(control.id);
        const valueDisplay = document.getElementById(control.valueId);
        
        if (!rangeInput) {
            console.warn(`控制面板元素缺失: ${control.id}`);
            return;
        }
        
        // 初始化当前值显示
        const currentValue = dpis[control.configName];
        if (valueDisplay && currentValue !== undefined) {
            valueDisplay.textContent = currentValue;
        }
        
        // range输入框事件
        rangeInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            if (valueDisplay) {
                valueDisplay.textContent = value;
            }
            const config = {};
            config[control.configName] = value;
            dpis.updateConfig(config);
            if (control.configName === 'particleInterval') {
                dpis.loadImage('public/罗德岛.png')
                    .catch(error => console.error('初始图片加载失败:', error));
            }
        });
        
    });
    // 力律选择
    const valueDisplay = document.getElementById('forceLawValue');
    const currentValue = dpis['forceLaw'];
    if (valueDisplay && currentValue !== undefined) {
        valueDisplay.textContent = currentValue;
    }
    const forceLawSelect = document.getElementById('forceLaw');
    if (forceLawSelect) {
        forceLawSelect.addEventListener('change', (e) => {
            const selectedLaw = e.target.value;
            const config = {};
            config['forceLaw'] = selectedLaw;
            dpis.updateConfig(config);
            if (valueDisplay) {
                valueDisplay.textContent = selectedLaw;
            }
        });
    }
}


// 初始化页面
function initPage() {
    renderImageList();
    initControls();
    bindEvents();
    
    // 初始加载罗德岛.png
    window.addEventListener('load', () => {
        dpis.loadImage('public/罗德岛.png')
            .catch(error => console.error('初始图片加载失败:', error));
    });

    // 监听窗口大小变化
    window.addEventListener('resize', () => {
        dpis.init('dpis-canvas');
        // 重新加载当前图片
        dpis.loadImage('public/罗德岛.png')
            .catch(error => console.error('初始图片加载失败:', error));
    });
}

// 启动应用
initPage();
