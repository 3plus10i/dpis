// 力律枚举类
export class ForceLaw {
    static Inverse = 'inverse';
    static LogInverse = 'logInverse';
    static SquareInverse = 'squareInverse';
    static LogSquareInverse = 'logSquareInverse';
    static DualPower = 'dualPower';
}

export class ParticleShape {
    static Circle = 'circle';
    static Rect = 'rect';
}

// 动态粒子图像系统 - DPIS
export class DPIS {
    constructor(canvasId) {
        // 粒子群
        this._particles = [];
        this.activeNum = 0;
        this.leastParticleNum = 4096;
        
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
        this.mouseX = null;
        this.mouseY = null;
        
        // 系统参数 - forceParameters
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
        this.particleShape = ParticleShape.Circle;
        
        // 过滤函数
        this.filterActivate = this.defaultFilterActivate;
        this.filterColor = this.defaultFilterColor;
        this.filterPosition = this.defaultFilterPosition;
        
        // 时间跟踪
        this.lastTime = 0;
        this.maxDeltaTime = 1/30; // 最大时间步长，防止数值不稳定
        
        // 初始化
        this.renew();
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
    
    // 重置画布、重载图片，重启动画
    renew() {
        // 设置画布尺寸
        this.resizeCanvas();
        if (this.image && this.image.src) {
            this.loadAndBuildImage(this.image.src)
        } else {
            this.buildIdleStyle()
        }
        // 启动动画循环
        this.animate();
    }

    // 在没有图但是又需要视觉反馈时，加载一个简单的闲置形态
    buildIdleStyle() {
        const count = Math.floor(0.2*this.leastParticleNum);
        for (let i = 0; i < count; i++) {
            this.setIdleParticle(this.getParticle(i));
        }
        this.activeNum = count;
    }

    // 获取粒子, 若索引超出范围, 则扩容粒子群
    getParticle(index) {
        if (index >= this.getParticlesNum()) {
            let growSize = 0;
            if (index <= 2 * this.getParticlesNum()) {
                growSize = this.getParticlesNum() || 1;
            } else {
                growSize = index - this.getParticlesNum() + 1;
            }
            for (let i = 0; i < growSize; i++) {
                this._createParticle();
            }
        }
        return this._particles[index];
    }

    // 获取当前激活的粒子群
    getActiveParticles() {
        return this._particles.slice(0, this.activeNum);
    }
    
    // 清理操作：当激活数量不足一半时，清理一半对象，直到总数达到阈值或激活不少于一半
    _cleanup() {
        if (this.getParticlesNum() <= this.leastParticleNum) return;
        while (this.getParticlesNum() > this.activeNum * 2) {
            const removeCount = Math.floor(this.getParticlesNum() / 2);
            // 从数组末尾移除过多的未激活对象
            for (let i = 0; i < removeCount; i++) {
                this._particles.pop();
            }
        }
    }

    // 设置粒子
    setParticle(index, p) {
        this._particles[index] = p;
    }

    // 获取粒子群总数量
    getParticlesNum() {
        return this._particles.length;
    }

    // 创建一个新粒子
    _createParticle() {
        const p = new Particle();
        p.originalX = this.canvas.width / 2;
        p.originalY = this.canvas.height / 2;
        p.x = p.originalX;
        p.y = p.originalY;
        p.radius = this.particleRadius;
        p.shape = this.particleShape;
        p.mass = this.particleMass * (1 + this.particleMassRange * (Math.random() - 0.5));
        p.maxSpeed = this.maxSpeed;
        p.forceLaw = this.forceLaw;
        p.unitDistance = this.unitDistance;
        p.offsetAngle = this.offsetAngle;
        this._particles.push(p);
        return p;
    }

    // 交换数组中两个元素的位置
    _swap(i, j) {
        // 禁止跨区交换
        if ((i-this.activeNum)*(j-this.activeNum) < 0) return -1;
        if (i === j) return 0;
        const p1 = this._particles[i];
        const p2 = this._particles[j];
        this._particles[i] = p2;
        this._particles[j] = p1;
        return 0;
    }

    // 更新系统参数，主要用于前端监听实时调整
    updateConfig(dpisAttrs) {
        // 包括particleRadius, particleShape, particleMass, particleMassRange, forceLaw, unitDistance, offsetAngle, repulsionRadius, repulsionForce, resistence, attractionForce
        Object.assign(this, dpisAttrs);
        // 更新粒子的自维护属性
        this.getActiveParticles().forEach(particle => {
            particle.radius = this.particleRadius;
            particle.mass = this.particleMass * (1 + this.particleMassRange * (Math.random() - 0.5));
        });
        
    }

    getUpdateParameters() {
        return {
            mouseX: this.mouseX,
            mouseY: this.mouseY,
            repulsionRadius: this.repulsionRadius,
            repulsionForce: this.repulsionForce,
            resistence: this.resistence,
            attractionForce: this.attractionForce,
            shape: this.particleShape,
            forceLaw: this.forceLaw,
            unitDistance: this.unitDistance,
            offsetAngle: this.offsetAngle,
            maxSpeed: this.maxSpeed,
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
    
    //  闲置粒子：正态分布位置，白色，激活
    setIdleParticle(particle) {
        const r_4 = Math.min(this.canvas.width, this.canvas.height) / 2 / 4;
        // 更高效的极坐标拒绝采样法生成正态随机数
        let s=0, u0, u1;
        while (s >= 1 || s === 0) {
            u0 = 2*Math.random() - 1;
            u1 = 2*Math.random() - 1;
            s = u0 * u0 + u1 * u1;
        }
        s = Math.sqrt((-2.0 * Math.log(s)) / s);
        u0 = Math.max(Math.min(u0 * s, 3), -3); // 3sigma钳位
        u1 = Math.max(Math.min(u1 * s, 3), -3);

        const x = this.canvas.width / 2 + u0 * r_4 ;
        const y = this.canvas.height / 2 + u1 * r_4 ;

        particle.originalX = x;
        particle.originalY = y;
        // particle.x = x;
        // particle.y = y;
        particle.color = '#eeeeee';
    }
    
    // 加载并构建图片
    loadAndBuildImage(imageSrc) {
        const info = imageSrc.length > 50 ? imageSrc.substring(0, 40) + '...' + imageSrc.substring(imageSrc.length - 10) : imageSrc;
        console.log('[DPIS] Loading image: ' + info)
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                this.image = img;
                this.buildFromImage(img);
                resolve(img);
            };
            img.onerror = () => {
                console.error('[DPIS] Image load error: ' + info);
                reject(new Error('图片加载失败'));
            };
            img.src = imageSrc
        });
    }

    /**
     * 将下一个激活粒子随机化
     */
    randomNextActiveParticle(count) {
        if (count >= this.activeNum) {
            // 直接返回非激活粒子
            return count;
        }
        const randomIndex = Math.floor(Math.random() * (this.activeNum - count)) + count;
        this._swap(count, randomIndex);
        return count;
    }
    
    // 扫描图片，将图形信息赋予粒子，构建粒子图
    buildFromImage(image) {
        // 将图片缩放到适应画布，然后获取图片数据
        let a = Math.max(image.width/this.canvas.width, image.height/this.canvas.height);
        const imgWidth = Math.floor(image.width/a);
        const imgHeight = Math.floor(image.height/a);
        
        this.tempCanvas.width = imgWidth;
        this.tempCanvas.height = imgHeight;
        this.tempCtx.drawImage(image, 0, 0, imgWidth, imgHeight);
        const imgData = this.tempCtx.getImageData(0, 0, imgWidth, imgHeight);
        
        // 计算偏移量，从图片坐标转换到画布中心坐标
        const offsetX = (this.canvas.width - imgWidth) / 2;
        const offsetY = (this.canvas.height - imgHeight) / 2;

        
        const wasActiveNum = this.activeNum;
        let count = 0;
        const rows = Math.floor(imgHeight / this.particleInterval);
        const cols = Math.floor(imgWidth / this.particleInterval);
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const x = col * this.particleInterval;
                const y = row * this.particleInterval;

                // 获取采样点的rgba值
                const pixelIndex = (y * imgWidth + x) * 4;
                const r = imgData.data[pixelIndex];
                const g = imgData.data[pixelIndex + 1];
                const b = imgData.data[pixelIndex + 2];
                const a = imgData.data[pixelIndex + 3];
                
                // 应用激活过滤
                if (this.filterActivate(r, g, b, a)) {
                    // 取出粒子
                    if (count < wasActiveNum) {
                        // 1. 有限从已激活区域随机取用
                        this.randomNextActiveParticle(count);
                    } else {
                        // 2. 如果不够，从未激活区域顺序取用（并激活）
                        // 取用的未激活粒子从某个过去激活粒子借用实时位置
                        if (wasActiveNum > 10) {
                            const randomWasActiveIndex = Math.floor(Math.random() * wasActiveNum);
                            this.getParticle(count).x = this.getParticle(randomWasActiveIndex).x;
                            this.getParticle(count).y = this.getParticle(randomWasActiveIndex).y;
                        } else {
                            this.setIdleParticle(this.getParticle(count));
                        }
                    };
                    
                    // 应用位置过滤 更新粒子原始位置
                    const filteredPos = this.filterPosition(x, y, imgWidth, imgHeight);
                    this.getParticle(count).originalX = filteredPos.x + offsetX;
                    this.getParticle(count).originalY = filteredPos.y + offsetY;
                    
                    // 应用颜色过滤，更新粒子颜色
                    this.getParticle(count).color = this.filterColor(r, g, b, a);
                    
                    count++;
                }
            };
        };
        this.activeNum = count;
        // 清理可能的过多未激活粒子（有必要吗）
        this._cleanup();
        return 0;
    };
    
    // 计算更新系统视觉状态
    update(dtSeconds) {
        // 更新所有粒子运动状态和样式
        this.getActiveParticles().forEach(particle => {
            particle.update(this.getUpdateParameters(), dtSeconds);
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
        this.getActiveParticles().forEach(particle => {
            particle.draw(this.ctx);
        });
    }
    
    // 清空系统
    clear() {
        this.activeNum = 0;
        this._cleanup();
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
    constructor() {
        // 构建图片时更新
        this.originalX = 0;
        this.originalY = 0;
        this.color = '#888888';
        
        // 绘制更新
        this.x = 0;
        this.y = 0;
        this.vx = 0;
        this.vy = 0;
        
        // 可调但应该在绘制中自有恒定值的量
        this.mass = 1;
        this.radius = 1;
        this.shape = ParticleShape.Circle; // 粒子形状

        // 力场和绘制相关，应由上级结构管理
        // 可调但是不需要自己维护恒定值的量
        // this.forceLaw = ForceLaw.Inverse; // 外力力律
        // this.unitDistance = 30; // 外力单位作用距离 px
        // this.offsetAngle = 0; // 恢复力偏移角度 deg
        // this.maxSpeed = 1080; // 甚至懒得调，真没用
    }
    
    // 计算受力 F = 恢复力+外力+阻力
    calculateForce(updateParameters) {
        const {repulsionRadius, repulsionForce, attractionForce, resistence, forceLaw, unitDistance, offsetAngle } = updateParameters;

        let { mouseX, mouseY } = updateParameters;

        // 鼠标位置null视为作用范围外
        if (mouseX === null ) { mouseX = - repulsionRadius;}
        if (mouseY === null ) { mouseY = - repulsionRadius;}
        
        let fx = 0;
        let fy = 0;
        
        // 1. 线性恢复力 g(r) = - kg * r
        // g = - kg * r/ud  *  (rx, ry) / r 
        const rx = this.x - this.originalX;
        const ry = this.y - this.originalY;
        const r = Math.sqrt(rx * rx + ry * ry);
        // 谨防除0错误
        if (r >= this.radius/10) {
            const theta = offsetAngle * Math.PI/180;
            const rx_rot = rx * Math.cos(theta) - ry * Math.sin(theta);
            const ry_rot = rx * Math.sin(theta) + ry * Math.cos(theta);
            
            fx += -attractionForce * this.mass * Math.pow(r/unitDistance, 1) * rx_rot / r;
            fy += -attractionForce * this.mass * Math.pow(r/unitDistance, 1) * ry_rot / r;
        }
        // 2. 外力
        // f = kf * function  *  (dx,dy) / d
        const dx = this.x - mouseX;
        const dy = this.y - mouseY;
        const d = Math.sqrt(dx * dx + dy * dy);
        
        if (d < repulsionRadius) {
            const ud = Math.max(d/unitDistance, 1);
            let forceMagnitude = 0;
            switch (forceLaw) {
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
    update(updateParameters, dtSeconds) {
        // 计算受力
        const { fx, fy } = this.calculateForce(updateParameters);
        const { maxSpeed } = updateParameters;

        const old_vx = this.vx;
        const old_vy = this.vy;
        
        // 速度更新: v = v + F / m * dt
        this.vx += fx / this.mass * dtSeconds;
        this.vy += fy / this.mass * dtSeconds;
        
        // 速度限幅
        const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (speed > maxSpeed) {
            this.vx = (this.vx / speed) * maxSpeed;
            this.vy = (this.vy / speed) * maxSpeed;
        }
        
        // 位置更新: P = P + v_avg * dt
        this.x += (this.vx + old_vx) / 2 * dtSeconds;
        this.y += (this.vy + old_vy) / 2 * dtSeconds;
    }
    
    // 绘制粒子
    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        if (this.shape === ParticleShape.Circle) {
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        } else if (this.shape === ParticleShape.Rect) {
            ctx.rect(this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2);
        }
        ctx.fill();
    }
}
