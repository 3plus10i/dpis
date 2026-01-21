class Particle {
    constructor() {
        this.x = 0;
        this.y = 0;
        // 其他属性...
    }
}

// 关于粒子管理的新设想
// 主要目的：
// 1. 天然随机访问，底层数据结构连续
// 2. 调整画布尺寸或粒子间距等影响粒子总数上限的操作时，不重建粒子群。完全弹性的粒子群管理。

// 问题回复：
// - 粒子间距固定 ：新方案假设粒子可以"弹性"管理，但 dpis 的 particleInterval 决定了粒子总数。如果画布尺寸变化，粒子总数应重新计算，而非弹性伸缩。
// A:脱离具体图片的粒子总数是一个想象概念，并不重要，只有当scan时，经过激活过滤的扫描点才真的需要一个粒子存在。因此可以在scan时复用，在不足时动态创建。而尺寸调整等粒子总数调整行为，并不实际影响粒子总数。
// - 激活状态语义 ：dpis 中激活 = 显示 + 参与物理计算，新方案的激活仅标记"已分配"，未处理粒子物理逻辑。
// A:在dpis的update时显示更新范围为[0, activeCount)即可，甚至剩了粒子update()中做状态判断的工作。
// - 频繁的图片切换会导致粒子反复创建销毁，可能触发 GC 卡顿。
// A:现有方案中，切换图片不重建粒子，但是代价是粒子总数总是等于最大可能粒子数，也就是铺满画布的数量。统计显示，大多数情况下，图片上被激活的粒子数量只有20%左右，因此保持最大粒子数是对内存的浪费。
// 另一方面，当调整页面尺寸，或调整间距参数时，旧方案会重建粒子群，而新方案则会将这个行为延迟到scan时。如果scan时发现粒子总数不足，才会创建新粒子，发现用到的粒子太少，才会进行清理。前者往往是放大了尺寸/减小了密度，后者往往是反之。而在新尺寸/参数下切换图片时，由于统计规律，也很少会触发销毁/扩容。
// 只有当用户频繁在两张激活数差异较大的图片之间切换时，才会触发销毁/扩容。这可通过限制最小容量（例如50%铺满容量）来减弱影响。


class ParticleSwarm {
    constructor(initialCapacity = 64) {
        this.particles = [];
        this.activeNum = 0; // 数组前 activeCount 个是激活的

        // 初始化
        for (let i = 0; i < initialCapacity; i++) {
            this._createNewParticle();
        }
    }

    _createNewParticle() {
        const p = new Particle();
        this.particles.push(p);
        return p;
    }

    // 交换数组中两个元素的位置
    _swap(i, j) {
        // 禁止跨区交换
        if ((i-this.activeNum)*(j-this.activeNum) < 0) return -1;
        if (i === j) return 0;
        const p1 = this.particles[i];
        const p2 = this.particles[j];
        this.particles[i] = p2;
        this.particles[j] = p1;
        return 0;
    }

    /**
     * Scan 操作：取用并激活 n 个粒子
     */
    scan(requestedCount) {
        // 1. 优先从已激活区域随机取用（随机访问同时又维护半序的关键）
        // 使用类似洗牌的逻辑：从 [activeCount, wasActiveNum-1] 随机选一个换到 activeCount 位置
        const wasActiveNum = this.activeNum;
        let count = 0;
        while (count < requestedCount && count < wasActiveNum) {
            const randomIndex = Math.floor(Math.random() * (wasActiveNum - count)) + count;
            this._swap(count, randomIndex);
            // do sth to particles[count]
            count++;
        }

        // 2. 如果不够，从未激活区域取用并激活
        while (count < requestedCount) {
            // 如果所有对象都用完了，扩容 double
            if (count >= this.particles.length) {
                const growSize = this.particles.length || 1;
                for (let i = 0; i < growSize; i++) {
                    this._createNewParticle();
                }
            }
            // do sth to particles[count]
            // for example, let this new particle appaer at the position of a random active particle
            const randomWasActiveIndex = Math.floor(Math.random() * wasActiveNum);
            this.particles[count].x = this.particles[randomWasActiveIndex].x;
            this.particles[count].y = this.particles[randomWasActiveIndex].y;
            // do other assigenments
            
            count++;
        }

        this.activeNum = count;

        // 4. 尝试触发清理操作
        this._cleanup();
        
        return 0;
    }

    /**
     * 清理操作：当激活数量不足一半时，清理一半对象，直到激活不少于一半
     */
    _cleanup() {
        // 条件：activeCount < total / 2  =>  total > activeCount * 2
        while (this.particles.length > this.activeNum * 2 && this.particles.length > 0) {
            const removeCount = Math.floor(this.particles.length / 2);
            // 从数组末尾移除过多的未激活对象
            for (let i = 0; i < removeCount; i++) {
                this.particles.pop();
            }
        }
    }
}