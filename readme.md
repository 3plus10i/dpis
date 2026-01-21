# Dynamic Particle Image System - DPIS *动态点阵图像系统*

仿 [明日方舟官网](https://ak.hypergryph.com/#world) 的交互式动态点阵系统。

DPIS 被设计为模块化的，便于嵌入您的前端网页中。本项目是 DPIS 的完整实现和演示。

本项目受到 [Arknights-FlowingPoints](https://github.com/BlackCoder0/Arknights-FlowingPoints) 的启发，在此致谢。

## 特性

-  **交互式动态**：粒子会基于鼠标/触摸位置受力并运动
-  **图片切换动效**：支持动态切换图片，粒子会平滑过渡
-  **高度自定义**：提供丰富的参数配置，源码中更可自定义激活过滤器和受力规则
-  **响应式设计**：支持鼠标和触摸事件，适配移动端
-  **模块化架构**：核心逻辑与 UI 分离，易于集成到现有项目中

![dpis-demo](./doc/dpis-demo.gif)

## 1. 快速开始

直接打开即可运行。  
演示页面提供了基础参数控制面板，您可以在控制面板中调整参数，实时查看效果。

| 参数 | 推荐参考值 | 说明 |
|------|--------|------|
| `particleMass` | 1 | 粒子质量，影响加速度。一般不调。 |
| `particleRadius` | 2 | 粒子显示半径(px) |
| `particleMassRange` | 0.5 | 粒子质量分布范围(±50%)，制造粒子间微小运动差异 |
| `particleInterval` | 10 | 粒子间距(px) |
| `repulsionRadius` | 1800 | 斥力作用最大距离(px)，大点没关系 |
| `unitDistance` | 20 | 引力或斥力的单位作用距离(px) |
| `repulsionForce` | 5000 | 斥力强度(互动作用力强度) |
| `attractionForce` | 600 | 引力强度(恢复力系数) |
| `resistence` | 10 | 阻尼系数，与引力强度相比不应过小。 |
| `maxSpeed` | 1080 | 粒子最大速度(px/s)，防止过快。 |

### 参数模式建议

更快的恢复（更硬）：
- 增加 `attractionForce`
- 适量增加 `resistence`

波动的Q弹的恢复：
- 增加 `attractionForce`
- 适量减小 `resistence`

光晕般的图像：
- 增加 `particleRadius`
- 减小到小于粒子直径 `particleInterval`
- 配合颜色过滤函数，例如保留色彩、透明度调节

抽象区域点阵：
- 大幅增大 `particleInterval`
- 很小的 `particleRadius`

---

## 2. 原理和模型设计

### 2.1 单粒子模型

#### 2.1.1 粒子属性

运动学属性：
- **原始位置 O** (`originalX`, `originalY`)：粒子的锚点位置
- **当前位置 P** (`x`, `y`)：粒子的实时位置。向量 OP 称为相对坐标或偏移 r。
- **速度 v** (`vx`, `vy`)：粒子的运动速度
- **质量 m** (`mass`)：粒子的质量，影响加速度

其他属性：
- **颜色** (`color`)：粒子的填充颜色
- **半径** (`radius`)：粒子的显示半径
- **激活标记** (`activated`)：不激活的粒子不参与运动，也不绘制

#### 2.1.2 粒子动力学

粒子运动遵循牛顿第二定律，受力方程为：

``` 总受力 F = 恢复力 g + 外力 f + 阻力 h ```

1. **恢复力(引力)**：线性恢复力，使粒子回到原始位置
    ```
    g(r) = -kg * m * |r|  *  r/|r|
    ```
    其中 kg 为引力系数（`attractionForce`），m 为粒子质量（`particleMass`），
    调整粒子质量分布范围（`particleMassRange`）内的微小差异，可以制造粒子运动的微小差异，丰富动效。
    为恢复力增加偏移角度（`offsetAngle`），可以恢复过程具有一定的扭转效果
    ```
    g(r) = -kg * m * |r|  *  A(theta)*r/|r|
    ```

2. **外力(斥力)**：鼠标/触摸产生的斥力，服从(平方)反比定律
    ```
    f(d) = kf / |d/ud|² * d/|d|
    or f(d) = kf / |d/ud| * d/|d|
    ```
    其中：
    - `kf` 为斥力系数（`repulsionForce`）
    - `d` 为粒子相对鼠标的位置向量(`x - mouseX`, `y - mouseY`)
    - `ud` 为单位作用距离（推荐为30px），在此距离内斥力被限制为恒定值 `kf`

    ***关于力律**
    平方反比律是一个在远端衰减很快的收敛律，当指针位置较远时，作用力非常小。考虑一些修正：
    - 对数平方反比率 ```f(d) = kf / (1 + a*log(|d/ud|))^2 * d/|d|```
    - 反比率 ```f(d) = kf / |d/ud| * d/|d|```
    - 对数反比律 ```f(d) = kf / (1 + a*log(|d/ud|)) * d/|d|```
    - 双幂律 ```f(d) = kf (1+b)/ (|d/ud|^2+b*|d/ud|) * d/|d|```

    本项目默认使用反比律，以在较远距离上积极触发互动效果。
    ![decay-law](./doc/decay-law.png)

3. **阻力**：线性阻尼力，总是使粒子速度衰减
    ```
    h(v) = -kh * v
    ```
    其中 `kh` 为摩擦系数（`resistence`）

  **速度和位置更新**：
  ```
  v = v + F / m * dt
  P = P + (v + v_old) * dt / 2
  ```
### 2.2 DPIS模型
DPIS的核心是一群粒子。同时DPIS为粒子们提供参数配置，画布状态，图片数据，更新动画等外围服务。  

系统初始化时会创建所有粒子对象，只有当粒子间距或画布尺寸发生变化时，才会重新创建粒子对象。图像不影响粒子实例的数量。  
粒子被创建时都是未激活状态，不会被更新动力学或绘制。随着图片的载入，`scanImage` 会从图片上采样，激活部分粒子并赋予样式。

图片变更时：
- 已激活的粒子会被优先使用
- 当需要激活的粒子数量超过既有激活粒子数量时，会使用未激活粒子
- 反之会将部分已激活粒子设置为未激活
- 调整画布尺寸或粒子间距后，需要重新 `loadImage`

传入新图片后，`scanImage` 函数执行以下步骤：

1. **图片预处理**：缩放图片，居中适应画布
2. **网格采样**：根据粒子间距在图片上进行网格采样
3. **颜色提取**：获取采样点的 RGBA 值作为粒子颜色
4. **过滤处理**：在赋值之前可以进行三种过滤，过滤规则可自定义。
    - **激活过滤**：对亮度低于阈值或透明度低于阈值的点，不激活粒子
    - **颜色过滤**：将 RGBA 转换为灰度，或进行二值化处理
    - **位置过滤**：进行非线性变形，在视觉上改变"网格"结构

#### 2.2.1 自定义过滤函数

自定义过滤函数来实现特殊效果：

```javascript
// 自定义激活过滤示例：只激活非蓝色不透明区域（例如地图上的大陆）
dpis.filterActivate = (r, g, b, a) => {
    return  b < 128 && a > 128;
};
```

```javascript
// 自定义颜色过滤示例：反相
dpis.filterColor = (r, g, b, a) => {
    const gray = 255 - Math.round((r + g + b) / 3);
    return `rgba(${gray}, ${gray}, ${gray}, ${a / 255})`;
};
```

```javascript
// 自定义位置过滤示例：映射到内接椭圆
dpis.filterPosition = (x, y, imgWidth, imgHeight) => {
    // 计算中心点和相对偏移
    const centerX = imgWidth / 2, centerY = imgHeight / 2;
    const dx = x - centerX, dy = y - centerY;
    
    // 纵轴附加直接返回，避免除0错误
    if (Math.abs(dx) < centerX/1000) return { x: centerX, y: centerY };
    const a = imgWidth / 2; // 半长轴
    const b = imgHeight / 2; // 半短轴
    const angle = Math.atan2(dy, dx); // (-π, π]
    // 椭圆极坐标极径
    const r = b / Math.sqrt(1 - (1-(b*b)/(a*a))*Math.pow(Math.cos(angle), 2));
    
    // 与边界矩形相交
    const slope = Math.abs(dy / dx);
    const aspectRatio = b / a;
    let boundaryDist = slope <= aspectRatio ? 
        Math.abs(a / Math.cos(angle)) :
        Math.abs(b / Math.sin(angle));
    
    // 按比例 r/d 映射到椭圆内
    const scale = r / boundaryDist;
    return { x: centerX + dx * scale, y: centerY + dy * scale };
};
```



## 许可证

MIT License