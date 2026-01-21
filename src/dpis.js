// 力律枚举类
export class ForceLaw {
    static Inverse = 'inverse';
    static LogInverse = 'logInverse';
    static SquareInverse = 'squareInverse';
    static LogSquareInverse = 'logSquareInverse';
    static DualPower = 'dualPower';
}

// 动态粒子图像系统 - DPIS
export class DPIS {
    constructor(canvasId) {
        // 粒子群
        this.particles = [];
        
        // 画布对象参数
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.backgroundColor = '#40404000';
        
        // 临时画布仅用于图片采样
        this.tempCanvas = document.createElement('canvas');
        this.tempCtx = this.tempCanvas.getContext('2d', { willReadFrequently: true });
        
        // 图片对象参数
        this.image = null;
        
        // 鼠标位置参数
        this.mouseX = 0;
        this.mouseY = 0;
        
        // 系统参数 - dpisConfig
        this.particleMass = 1;
        this.particleMassRange = 0.5;
        this.particleRadius = 1.5; 
        this.particleInterval = 10;
        this.repulsionRadius = 1800;
        this.repulsionForce = 5000;
        this.attractionForce = 500;
        this.resistence = 15;
        this.maxSpeed = 1080;
        this.forceLaw = ForceLaw.Inverse; // 外力力律
        this.unitDistance = 20; // 外力单位作用距离 px
        this.offsetAngle = 0; // 恢复力偏移角度 deg
        
        // 过滤函数
        this.filterActivate = this.defaultFilterActivate;
        this.filterColor = this.defaultFilterColor;
        this.filterPosition = this.defaultFilterPosition;
        
        // 时间跟踪
        this.lastTime = 0;
        this.maxDeltaTime = 1/30; // 最大时间步长，防止数值不稳定
        
        // 初始化
        this.init();
        this._bindEvents();
    }
    
    // 默认激活过滤：透明处不激活
    defaultFilterActivate(r, g, b, a) {
        return a > 1;
    }
    
    // 默认颜色过滤：二值化量化灰阶
    defaultFilterColor(r, g, b, a) {
        let gray = (r + g + b) / 3;
        gray = gray > 128 ? 223 : 64;
        return `rgba(${gray}, ${gray}, ${gray}, 1)`;
    }
    
    // 默认位置过滤：返回原始位置
    defaultFilterPosition(x, y, imgWidth, imgHeight) {
        return { x, y };
    }

    // 更新系统参数，主要用于前端监听实时调整
    updateConfig(config) {
        Object.assign(this, config);
        
        // 更新粒子的属性
        this.particles.forEach(particle => {
            particle.radius = this.particleRadius;
            particle.mass = this.particleMass * (1 + this.particleMassRange * (Math.random() - 0.5));
            particle.maxSpeed = this.maxSpeed;
            particle.forceLaw = this.forceLaw;
            particle.unitDistance = this.unitDistance;
            particle.offsetAngle = this.offsetAngle;
        });
        
    }

    getDpisState() {
        // mouseX, mouseY, repulsionRadius, repulsionForce, attractionForce, resistence
        return {
            mouseX: this.mouseX,
            mouseY: this.mouseY,
            repulsionRadius: this.repulsionRadius,
            repulsionForce: this.repulsionForce,
            resistence: this.resistence,
            attractionForce: this.attractionForce,
        };
    }
    
    // 更新鼠标/触摸位置
    updateMousePosition(x, y) {
        this.mouseX = x;
        this.mouseY = y;
    }

    // 绑定鼠标和触摸事件
    _bindEvents() {
        // 鼠标移动事件
        document.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.updateMousePosition(e.clientX - rect.left, e.clientY - rect.top);
        });
        
        // 触摸事件 - 仅在画布区域响应，避免干扰页面滚动
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.updateMousePosition(touch.clientX - rect.left, touch.clientY - rect.top);
        }, { passive: false });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.updateMousePosition(touch.clientX - rect.left, touch.clientY - rect.top);
        }, { passive: false });

        // 停止触摸事件
        this.canvas.addEventListener('touchend', () => {
            this.updateMousePosition(null, null);
        });
        this.canvas.addEventListener('touchcancel', () => {
            this.updateMousePosition(null, null);
        });
    }
    
    // 初始化系统
    init(dpisConfig) {
        // 合并配置
        Object.assign(this, dpisConfig);
        
        // 设置画布尺寸
        this.resizeCanvas();
        
        // 创建所有粒子对象
        this.createParticles();
        
        // 启动动画循环
        this.animate();
    }
    
    // 调整画布尺寸，适应父容器padding
    resizeCanvas() {
        const canvasWrapper = this.canvas.parentElement;
        const styles = window.getComputedStyle(canvasWrapper);
        const paddingLeft = parseFloat(styles.paddingLeft);
        const paddingRight = parseFloat(styles.paddingRight);
        const paddingTop = parseFloat(styles.paddingTop);
        const paddingBottom = parseFloat(styles.paddingBottom);
        
        this.canvas.width = canvasWrapper.clientWidth - paddingLeft - paddingRight;
        this.canvas.height = canvasWrapper.clientHeight - paddingTop - paddingBottom;
    }
    
    //  闲置粒子设置：将粒子位置设置为画布中央的正态分布随机位置
    setIdleParticle(particle) {
        const r = Math.min(this.canvas.width, this.canvas.height) / 2;

        // Box-Muller 变换获取标准正态分布随机数
        let u1 = Math.random();
        let u2 = Math.random();
        let z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
        let z1 = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);

        const x = this.canvas.width / 2 + z0 * r / 4;
        const y = this.canvas.height / 2 + z1 * r / 4;

        particle.originalX = Math.max(r/4, Math.min(this.canvas.width - r/4, x));
        particle.originalY = Math.max(r/4, Math.min(this.canvas.height - r/4, y));
    }
    
    // 创建所有粒子对象
    createParticles() {
        this.particles = [];
        
        const cols = Math.floor(this.canvas.width / this.particleInterval);
        const rows = Math.floor(this.canvas.height / this.particleInterval);
        const num = cols * rows;
        if (num >= 50000) {
            console.warn('[DPIS] 粒子数量过多，可能影响性能。尝试调小画布尺寸或调大粒子间距。');
        }
        
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const particle = new Particle(0, 0);
                // 初始化到闲置粒子位置
                this.setIdleParticle(particle)
                particle.x = particle.originalX;
                particle.y = particle.originalY;
                particle.mass = this.particleMass * (1 + this.particleMassRange * Math.random());
                particle.radius = this.particleRadius;
                particle.maxSpeed = this.maxSpeed;
                particle.forceLaw = this.forceLaw;
                particle.unitDistance = this.unitDistance;
                particle.offsetAngle = this.offsetAngle;
                this.particles.push(particle);
            }
        }

        console.log('[DPIS] Created particles: ' + this.particles.length + ' (' + cols + 'c x ' + rows + 'r)');
    }
    
    // 加载图片
    loadImage(imageSrc) {
        const info = imageSrc.length > 20 ? imageSrc.substring(0, 20) + '...' : imageSrc;
        console.log('[DPIS] Loading image: ' + info)
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.image = img;
                this.scanImage(img);
                resolve(img);
            };
            img.onerror = () => {
                reject(new Error('图片加载失败'));
            };
            img.src = imageSrc
        });
    }
    
    // 扫描图片，根据采样步长生成粒子
    scanImage(image) {
        // 将图片缩放到适应画布，然后获取图片数据
        let imgWidth = image.width;
        let imgHeight = image.height;
        imgHeight *= this.canvas.width / imgWidth;
        imgWidth = this.canvas.width;
        if (imgHeight > this.canvas.height ) {
            imgWidth *= this.canvas.height / imgHeight;
            imgHeight = this.canvas.height;
        }
        imgWidth = Math.floor(imgWidth);
        imgHeight = Math.floor(imgHeight);
        
        this.tempCanvas.width = imgWidth;
        this.tempCanvas.height = imgHeight;
        this.tempCtx.drawImage(image, 0, 0, imgWidth, imgHeight);
        const imgData = this.tempCtx.getImageData(0, 0, imgWidth, imgHeight);
        
        // 计算偏移量，从图片坐标转换到画布中心坐标
        const offsetX = (this.canvas.width - imgWidth) / 2;
        const offsetY = (this.canvas.height - imgHeight) / 2;

        // 准备粒子列表：将激活的粒子放在前面，未激活的粒子放在后面，且随机打乱顺序
        let activatedIndex = [];
        let unactivatedIndex = [];
        ({activatedIndex, unactivatedIndex} = this.getAorUaParticleIndex());
        const particleIndexList = [...activatedIndex, ...unactivatedIndex];
        
        // 根据粒子间距在图片（而非画布）上进行网格采样，并将采样结果赋予粒子
        let activatedCount = 0;
        const rows = Math.floor(imgHeight / this.particleInterval);
        const cols = Math.floor(imgWidth / this.particleInterval);
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = col * this.particleInterval;
                const y = row * this.particleInterval;
                if (activatedCount >= this.particles.length) break;
                
                // 获取采样点的rgba值
                const pixelIndex = (y * imgWidth + x) * 4;
                const r = imgData.data[pixelIndex];
                const g = imgData.data[pixelIndex + 1];
                const b = imgData.data[pixelIndex + 2];
                const a = imgData.data[pixelIndex + 3];
                
                
                // 应用激活过滤
                if (this.filterActivate(r, g, b, a)) {
                    const particle = this.particles[particleIndexList[activatedCount]];
                    activatedCount++;
                        
                    // 应用位置过滤 更新粒子原始位置
                    const filteredPos = this.filterPosition(x, y, imgWidth, imgHeight);
                    particle.originalX = filteredPos.x + offsetX;
                    particle.originalY = filteredPos.y + offsetY;
                    
                    // 应用颜色过滤，更新粒子颜色
                    particle.color = this.filterColor(r, g, b, a);

                    // 若采用了未激活的粒子，则尽量让它从某个已激活的粒子那里继承实时位置
                    // 这可以避免未激活的粒子在切换图片时突然从屏幕上空白处出现
                    if (activatedIndex.length > 10 && !particle.activated) {
                        const randomActivatedParticle = this.particles[activatedIndex[Math.floor(Math.random() * activatedIndex.length)]];
                        particle.x = randomActivatedParticle.x;
                        particle.y = randomActivatedParticle.y;
                    }

                    particle.activated = true;
                }
            }
            if (activatedCount >= this.particles.length) break;
        }
        console.log('[DPIS] ScanImage activate count:', activatedCount, 'total:', this.particles.length);
        // 剩余粒子设为未激活
        if (activatedCount < this.particles.length) {
            for (let i = activatedCount; i < this.particles.length; i++) {
                this.particles[particleIndexList[i]].activated = false;
            }
        }
    }

    // 分别返回激活和未激活的粒子, 并打乱顺序
    getAorUaParticleIndex() {
        let activatedIndex = [];
        let unactivatedIndex = [];
        for (let i = 0; i < this.particles.length; i++) {
            if (this.particles[i].activated) {
                activatedIndex.push(i);
            } else {
                unactivatedIndex.push(i);
            }
        }
        // 洗牌算法
        let shuffleFunc = (arr) => {
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
        }
        shuffleFunc(activatedIndex);
        shuffleFunc(unactivatedIndex);
        return { activatedIndex, unactivatedIndex };
    }
    
    // 更新系统
    update(dtSeconds) {
        // 更新所有粒子状态
        this.particles.forEach(particle => {
            particle.update(this.getDpisState(), dtSeconds);
        });
    }
    
    // 绘制系统
    draw() {
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制背景
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制所有粒子
        this.particles.forEach(particle => {
            particle.draw(this.ctx);
        });
    }
    
    // 清空系统
    clear() {
        this.particles.forEach(particle => {
            particle.activated = false;
        });
    }
    
    // 动画循环
    animate(currentTime = 0) {
        // 计算真实时间差（秒）
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // 转换为秒，并限制最大时间步长防止数值不稳定
        const dtSeconds = Math.min(deltaTime / 1000, this.maxDeltaTime);
        
        // 只在有合理时间差时更新（防止初始帧的异常大dt）
        if (dtSeconds > 0 && dtSeconds < this.maxDeltaTime) {
            this.update(dtSeconds);
        }
        
        this.draw();
        
        requestAnimationFrame((time) => this.animate(time));
    }
    
}


// 粒子类 - 单粒子模型
export class Particle {
    constructor(originalX, originalY) {
        // 原始位置O
        this.originalX = originalX;
        this.originalY = originalY;
        
        // 当前位置P
        this.x = originalX;
        this.y = originalY;
        
        // 速度v
        this.vx = 0;
        this.vy = 0;
        this.maxSpeed = 1080;
        
        // 粒子属性
        this.mass = 1;
        this.color = '#888888';
        this.radius = 1;
        this.activated = false;

        // 力场相关
        this.forceLaw = ForceLaw.Inverse; // 外力力律
        this.unitDistance = 30; // 外力单位作用距离 px
        this.offsetAngle = 0; // 恢复力偏移角度 deg
    }
    
    // 计算受力 F = 恢复力+外力+阻力
    calculateForce(dpisConfig) {
        const {repulsionRadius, repulsionForce, attractionForce, resistence } = dpisConfig;

        let { mouseX, mouseY } = dpisConfig;

        if (mouseX === null ) { mouseX = repulsionRadius+1;}
        if (mouseY === null ) { mouseY = repulsionRadius+1;}
        
        let fx = 0;
        let fy = 0;
        
        // 1. 线性恢复力 g(r) = - kg * r
        // g = - kg * r/ud  *  (rx, ry) / r 
        const rx = this.x - this.originalX;
        const ry = this.y - this.originalY;
        const r = Math.sqrt(rx * rx + ry * ry);
        const theta = this.offsetAngle * Math.PI/180;
        const rx_rot = rx * Math.cos(theta) - ry * Math.sin(theta);
        const ry_rot = rx * Math.sin(theta) + ry * Math.cos(theta);
        
        fx += -attractionForce * this.mass * Math.pow(r/this.unitDistance, 1) * rx_rot / r;
        fy += -attractionForce * this.mass * Math.pow(r/this.unitDistance, 1) * ry_rot / r;
        
        // 2. 外力
        // f = kf * function  *  (dx,dy) / d
        const dx = this.x - mouseX;
        const dy = this.y - mouseY;
        const d = Math.sqrt(dx * dx + dy * dy);
        
        if (d < repulsionRadius) {
            const ud = Math.max(d/this.unitDistance, 1);
            let forceMagnitude = 0;
            switch (this.forceLaw) {
                case ForceLaw.Inverse: // 反比
                    forceMagnitude = 1 / ud;
                    break;
                case ForceLaw.LogInverse: // 对数反比
                    forceMagnitude = 1 / (1+3*Math.log(ud));
                    break;
                case ForceLaw.SquareInverse: // 平方反比
                    forceMagnitude = 1 / Math.pow(ud, 2);
                    break;
                case ForceLaw.LogSquareInverse: // 对数平方反比
                    forceMagnitude = 1 / Math.pow(1+1*Math.log(ud), 2);
                    break;
                case ForceLaw.DualPower: // 双幂律
                    forceMagnitude = 4 / (ud*(ud+3));
                    break;
                default: // 默认平方反比
                    forceMagnitude = 1 / Math.pow(ud, 2);
                    break;
            }
            
            fx += repulsionForce * forceMagnitude * dx / d;
            fy += repulsionForce * forceMagnitude * dy / d;
        }
        
        // 3. 阻力 h(v) = - kh * v
        // 阻力相比于恢复力不能太小，否则会进入震荡。
        fx += -resistence * this.vx;
        fy += -resistence * this.vy;
        
        return { fx, fy };
    }
    
    // 更新粒子速度和位置
    // dtSeconds 单位：秒
    update(dpisConfig, dtSeconds) {
        if (!this.activated) return;
        
        // 计算受力
        const { fx, fy } = this.calculateForce(dpisConfig);

        const old_vx = this.vx;
        const old_vy = this.vy;
        
        // 速度更新: v = v + F / m * dt
        this.vx += fx / this.mass * dtSeconds;
        this.vy += fy / this.mass * dtSeconds;
        
        // 速度限幅
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > this.maxSpeed) {
            this.vx = (this.vx / speed) * this.maxSpeed;
            this.vy = (this.vy / speed) * this.maxSpeed;
        }
        
        // 位置更新: P = P + v_avg * dt
        this.x += (this.vx + old_vx) / 2 * dtSeconds;
        this.y += (this.vy + old_vy) / 2 * dtSeconds;
    }
    
    // 绘制粒子
    draw(ctx) {
        if (!this.activated) return;
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}
