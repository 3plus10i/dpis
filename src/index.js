import { DPIS } from './dpis.js';

// 初始化DPIS系统
const canvasId = 'dpis-canvas';
const dpis = new DPIS(canvasId);

// 示例图片列表
const IMAGE_LIST = [
    'rhodes_island.png', 'rhodes_island2.png','rainbow6.png', 'rhinelab.png','holo-saw.jpg','white.png',
    'kroos.png','MTL_SL_G2.png'
];

const DEFAULT_IMAGE = IMAGE_LIST[0];

// 动态生成图片列表
function renderImageList() {
    const imageListContainer = document.getElementById('imageList');
    imageListContainer.innerHTML = ''; // 清空列表

    // 1. 创建上传按钮项
    const uploadItem = document.createElement('div');
    uploadItem.className = 'image-item upload-item';
    uploadItem.innerHTML = `
        <div class="upload-icon">+</div>
        <span class="image-name">上传图片</span>
        <input type="file" id="imageUpload" accept="image/*" style="display: none;">
    `;
    
    const fileInput = uploadItem.querySelector('#imageUpload');
    
    // 点击项触发隐藏的 file input
    uploadItem.addEventListener('click', () => fileInput.click());
    
    // 处理文件选择
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const dataUrl = event.target.result;
                // 加载到 dpis
                dpis.loadImage(dataUrl)
                    .then(() => {
                        // 上传成功后，将图片临时添加到列表（如果尚未在列表中）
                        addImageToList(file.name, dataUrl);
                    })
                    .catch(error => {
                        console.error('图片加载失败:', error);
                        alert('图片加载失败: ' + error.message);
                    });
            };
            reader.readAsDataURL(file);
        }
    });
    
    imageListContainer.appendChild(uploadItem);
    
    IMAGE_LIST.forEach(name => {
        createImageItem(name, `public/${name}`, imageListContainer);
    });
}

// 创建并添加图片项到列表
function createImageItem(name, src, container) {
    const imageItem = document.createElement('div');
    imageItem.className = 'image-item';
    
    const img = document.createElement('img');
    img.src = src;
    img.alt = name;
    img.className = 'demo-image';
    
    const span = document.createElement('span');
    span.className = 'image-name';
    span.textContent = name;
    
    imageItem.appendChild(img);
    imageItem.appendChild(span);
    container.appendChild(imageItem);
    
    // 绑定点击事件
    imageItem.addEventListener('click', () => {
        dpis.loadImage(src)
            .catch(error => {
                console.error('图片加载失败:', error);
                alert('图片加载失败: ' + error.message);
            });
    });
}

// 辅助函数：将新图片添加到列表显示
function addImageToList(name, src) {
    const imageListContainer = document.getElementById('imageList');
    // 在上传按钮之后插入新图片
    const uploadItem = imageListContainer.querySelector('.upload-item');
    const newItem = document.createElement('div');
    newItem.className = 'image-item';
    
    const img = document.createElement('img');
    img.src = src;
    img.alt = name;
    img.className = 'demo-image';
    
    const span = document.createElement('span');
    span.className = 'image-name';
    span.textContent = name;
    
    newItem.appendChild(img);
    newItem.appendChild(span);
    
    if (uploadItem.nextSibling) {
        imageListContainer.insertBefore(newItem, uploadItem.nextSibling);
    } else {
        imageListContainer.appendChild(newItem);
    }
    
    // 绑定点击事件
    newItem.addEventListener('click', () => {
        dpis.loadImage(src)
            .catch(error => {
                console.error('图片加载失败:', error);
                alert('图片加载失败: ' + error.message);
            });
    });
}

// 初始化控制面板
function initControls() {
    const controls = [
        { id: 'particleRadius', configName: 'particleRadius', valueId: 'particleRadiusValue' },
        { id: 'repulsionRadius', configName: 'repulsionRadius', valueId: 'repulsionRadiusValue' },
        { id: 'unitDistance', configName: 'unitDistance', valueId: 'unitDistanceValue' },
        { id: 'repulsionForce', configName: 'repulsionForce', valueId: 'repulsionForceValue' },
        { id: 'resistence', configName: 'resistence', valueId: 'frictionValue' },
        { id: 'attractionForce', configName: 'attractionForce', valueId: 'attractionForceValue' },
        { id: 'particleInterval', configName: 'particleInterval', valueId: 'particleSpacingValue' },
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
        
        // range输入条事件
        rangeInput.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            if (valueDisplay) {
                valueDisplay.textContent = value;
            }
            const config = {};
            config[control.configName] = value;
            dpis.updateConfig(config);
            if (control.configName === 'particleInterval') {
                // 调整间距后，总粒子数量需要改变
                dpis.init();
                dpis.loadImage(`public/${DEFAULT_IMAGE}`)
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


// 防抖函数
function debounce(fn, delay) {
    let timer = null;
    return function() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            fn.apply(this, arguments);
        }, delay);
    };
}

// 初始化页面
function initPage() {
    renderImageList();
    initControls();

    
    // 初始加载罗德岛.png
    window.addEventListener('load', () => {
        dpis.loadImage(`public/${DEFAULT_IMAGE}`)
            .catch(error => console.error('初始图片加载失败:', error));
    });

    // 监听窗口大小变化（增加防抖）
    const handleResize = debounce(() => {
        dpis.init();
        // 如果当前有图片，则重新加载
        if (dpis.image) {
            dpis.loadImage(dpis.image.src)
                .catch(error => console.error('窗口调整后图片加载失败:', error));
        }
    }, 250);

    window.addEventListener('resize', handleResize);
}

// 启动应用
initPage();
