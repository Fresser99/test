/* =========================
   Shell页面脚本 - 博物馆风格数据可视化
   真实人流模型：区分累计访问量和实时在场人数
   ========================= */

// 洞窟ID列表
const CAVE_KEYS = ['17', '18', '19', '20', '21'];

// =========================
// 数据结构：区分两种量
// =========================

// ① 累计访问量（历史）- 进入一次就+1，永不减少，用于"受欢迎程度"
let caveCounts = JSON.parse(
    localStorage.getItem('yungang_cave_counts')
) || {};

// ② 当前在场人数（实时）- 有进有出，会波动，用于"空间承载状态"
let currentVisitors = JSON.parse(
    localStorage.getItem('yungang_current_visitors')
) || {};

// 初始化所有洞窟数据
CAVE_KEYS.forEach(key => {
    if (!caveCounts.hasOwnProperty(key)) {
        caveCounts[key] = 0;
    }
    if (!currentVisitors.hasOwnProperty(key)) {
        currentVisitors[key] = 0;
    }
});

// 保存到 localStorage
localStorage.setItem('yungang_cave_counts', JSON.stringify(caveCounts));
localStorage.setItem('yungang_current_visitors', JSON.stringify(currentVisitors));

// 图表实例
let flowChart = null;
let spatialChart = null;

// 时间序列数据（用于流量图）- 记录实时在场人数
let timeSeriesData = [];
const MAX_DATA_POINTS = 24; // 保留24个数据点

// 随机数据生成器
let randomDataInterval = null;

// 每个洞窟的进出场模拟参数
const caveSimulationParams = {};
CAVE_KEYS.forEach(key => {
    caveSimulationParams[key] = {
        // 平均停留时间（分钟）
        avgStayTime: 10 + Math.random() * 10, // 10-20分钟
        // 进入概率（每次更新的进入概率）
        enterProbability: 0.3 + Math.random() * 0.2, // 0.3-0.5
        // 离开概率（基于当前人数）
        leaveProbability: 0.1
    };
});

/* =========================
   更新总人数显示 - 显示实时在场人数
   ========================= */
function updateTotalCount() {
    // 显示当前总在场人数（实时）
    const total = Object.values(currentVisitors)
        .reduce((sum, val) => sum + val, 0);
    const visitCountEl = document.getElementById('visitCount');
    if (visitCountEl) {
        visitCountEl.textContent = total;
    }
}

/* =========================
   更新高峰时段
   ========================= */
function updatePeakHour() {
    const hour = new Date().getHours();
    let peakHour = '';

    if (hour >= 19 && hour < 22) {
        peakHour = '19:30 - 22:00';
    } else if (hour >= 12 && hour < 14) {
        peakHour = '12:00 - 13:30';
    } else if (hour >= 22 && hour < 24) {
        peakHour = '22:00 - 23:30';
    } else {
        peakHour = '19:30 - 22:00';
    }

    document.getElementById('peakHour').textContent = peakHour;
}

/* =========================
   更新平均停留时间
   ========================= */
function updateAvgDwellTime() {
    // 基于所有洞窟的平均停留时间计算
    const avgTimes = Object.values(caveSimulationParams).map(p => p.avgStayTime);
    const avgTime = Math.round(avgTimes.reduce((sum, val) => sum + val, 0) / avgTimes.length);
    
    const avgDwellTimeEl = document.getElementById('avgDwellTime');
    if (avgDwellTimeEl) {
        avgDwellTimeEl.textContent = avgTime + '分钟';
    }
}

/* =========================
   模拟真实人流：进进出出
   ========================= */
function simulateVisitorFlow() {
    CAVE_KEYS.forEach(key => {
        const params = caveSimulationParams[key];
        const current = currentVisitors[key] || 0;
        
        // 模拟进入：基于进入概率
        if (Math.random() < params.enterProbability) {
            // 有人进入
            currentVisitors[key] = current + 1;
            // 累计访问量 +1（永不减少）
            caveCounts[key] = (caveCounts[key] || 0) + 1;
        }
        
        // 模拟离开：基于当前人数和离开概率
        // 当前人数越多，离开的概率越大（模拟参观完离开）
        if (current > 0) {
            const leaveChance = params.leaveProbability * (1 + current * 0.1);
            if (Math.random() < leaveChance) {
                currentVisitors[key] = Math.max(0, currentVisitors[key] - 1);
            }
        }
    });
    
    // 保存到 localStorage
    localStorage.setItem('yungang_cave_counts', JSON.stringify(caveCounts));
    localStorage.setItem('yungang_current_visitors', JSON.stringify(currentVisitors));
}

/* =========================
   生成随机数据（模拟统计）- 更新实时在场人数
   ========================= */
function generateRandomData() {
    // 模拟真实人流：进进出出
    simulateVisitorFlow();
    
    // 更新时间序列数据 - 记录实时在场总人数
    const totalCurrent = Object.values(currentVisitors).reduce((sum, val) => sum + val, 0);
    const now = new Date();
    const timeLabel = now.getHours() + ':' + 
        String(now.getMinutes()).padStart(2, '0');
    
    timeSeriesData.push({
        time: timeLabel,
        value: totalCurrent
    });
    
    // 保持数据点数量
    if (timeSeriesData.length > MAX_DATA_POINTS) {
        timeSeriesData.shift();
    }
    
    // 更新显示和图表
    updateTotalCount();
    updateAvgDwellTime();
    renderFlowChart();
    renderSpatialChart();
}

/* =========================
   初始化时间序列数据 - 基于实时在场人数
   ========================= */
function initTimeSeriesData() {
    const now = new Date();
    const totalCurrent = Object.values(currentVisitors).reduce((sum, val) => sum + val, 0);
    
    // 生成过去24个时间点的数据（模拟历史实时在场人数）
    for (let i = MAX_DATA_POINTS - 1; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 5 * 60 * 1000); // 每5分钟一个点
        const hour = time.getHours();
        const minute = time.getMinutes();
        const timeLabel = hour + ':' + String(minute).padStart(2, '0');
        
        // 模拟数据：基于当前实时在场人数和时间波动
        // 模拟一天中的人流波动（上午少，下午多）
        const hourRatio = hour < 9 ? 0.3 : (hour < 12 ? 0.6 : (hour < 18 ? 1.0 : 0.4));
        const baseValue = totalCurrent * hourRatio;
        const variation = Math.sin(i * 0.3) * totalCurrent * 0.2;
        const value = Math.max(0, Math.floor(baseValue + variation));
        
        timeSeriesData.push({
            time: timeLabel,
            value: value
        });
    }
}

/* =========================
   渲染流量图（线图/面积图）- 显示实时在场人数
   ========================= */
function renderFlowChart() {
    if (!flowChart) return;
    
    const times = timeSeriesData.map(d => d.time);
    const values = timeSeriesData.map(d => d.value);
    
    flowChart.setOption({
        backgroundColor: 'transparent',
        animation: false, // 禁用动画，保持庄重
        grid: {
            left: '10%',
            right: '8%',
            top: '15%',
            bottom: '15%',
            containLabel: false
        },
        xAxis: {
            type: 'category',
            data: times,
            boundaryGap: false,
            axisLine: {
                show: true,
                lineStyle: {
                    color: 'rgba(255, 255, 255, 0.2)',
                    width: 1
                }
            },
            axisLabel: {
                show: true,
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: 11,
                fontFamily: 'FZFangSong-Z02S, serif',
                interval: Math.floor(times.length / 6) // 只显示部分标签
            },
            axisTick: {
                show: false
            },
            splitLine: {
                show: false
            }
        },
        yAxis: {
            type: 'value',
            axisLine: {
                show: false
            },
            axisLabel: {
                show: true,
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: 11,
                fontFamily: 'FZFangSong-Z02S, serif'
            },
            axisTick: {
                show: false
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: 'rgba(255, 255, 255, 0.08)',
                    width: 1,
                    type: 'dashed'
                }
            }
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderWidth: 1,
            textStyle: {
                color: '#fff',
                fontSize: 12,
                fontFamily: 'FZFangSong-Z02S, serif'
            },
            formatter: function(params) {
                const param = params[0];
                return param.axisValue + '<br/>' + 
                       '实时在场人数: ' + param.value;
            },
            axisPointer: {
                lineStyle: {
                    color: 'rgba(255, 255, 255, 0.3)',
                    width: 1
                }
            }
        },
        series: [{
            name: '实时在场人数',
            type: 'line',
            smooth: true,
            data: values,
            lineStyle: {
                color: 'rgba(255, 255, 255, 0.6)',
                width: 1.5
            },
            areaStyle: {
                color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [{
                        offset: 0,
                        color: 'rgba(255, 255, 255, 0.1)'
                    }, {
                        offset: 1,
                        color: 'rgba(255, 255, 255, 0.02)'
                    }]
                }
            },
            symbol: 'circle',
            symbolSize: 3,
            itemStyle: {
                color: 'rgba(255, 255, 255, 0.6)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.3)'
            },
            emphasis: {
                focus: 'series',
                itemStyle: {
                    color: 'rgba(255, 255, 255, 0.8)',
                    borderColor: 'rgba(255, 255, 255, 0.5)'
                }
            }
        }]
    }, false); // 不合并，直接替换
}

/* =========================
   渲染空间分布图（柱状图）- 显示实时在场人数
   ========================= */
function renderSpatialChart() {
    if (!spatialChart) return;
    
    // 使用实时在场人数，而不是累计访问量
    const data = Object.entries(currentVisitors).map(([key, value]) => ({
        name: `第${key}窟`,
        value: value || 0
    }));
    
    spatialChart.setOption({
        backgroundColor: 'transparent',
        animation: false, // 禁用动画
        grid: {
            left: '15%',
            right: '10%',
            top: '15%',
            bottom: '20%',
            containLabel: false
        },
        xAxis: {
            type: 'category',
            data: data.map(d => d.name),
            axisLine: {
                show: true,
                lineStyle: {
                    color: 'rgba(255, 255, 255, 0.2)',
                    width: 1
                }
            },
            axisLabel: {
                show: true,
                color: 'rgba(255, 255, 255, 0.6)',
                fontSize: 12,
                fontFamily: 'FZFangSong-Z02S, serif',
                interval: 0
            },
            axisTick: {
                show: false
            },
            splitLine: {
                show: false
            }
        },
        yAxis: {
            type: 'value',
            axisLine: {
                show: false
            },
            axisLabel: {
                show: true,
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: 11,
                fontFamily: 'FZFangSong-Z02S, serif'
            },
            axisTick: {
                show: false
            },
            splitLine: {
                show: true,
                lineStyle: {
                    color: 'rgba(255, 255, 255, 0.08)',
                    width: 1,
                    type: 'dashed'
                }
            }
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderWidth: 1,
            textStyle: {
                color: '#fff',
                fontSize: 12,
                fontFamily: 'FZFangSong-Z02S, serif'
            },
            formatter: function(params) {
                const param = params[0];
                return param.name + '<br/>' + 
                       '实时在场人数: ' + param.value + '<br/>' +
                       '累计访问量: ' + (caveCounts[param.name.replace('第', '').replace('窟', '')] || 0);
            },
            axisPointer: {
                type: 'shadow',
                shadowStyle: {
                    color: 'rgba(255, 255, 255, 0.1)'
                }
            }
        },
        series: [{
            name: '实时在场人数',
            type: 'bar',
            data: data.map(d => d.value),
            barWidth: '50%',
            itemStyle: {
                color: {
                    type: 'linear',
                    x: 0,
                    y: 0,
                    x2: 0,
                    y2: 1,
                    colorStops: [{
                        offset: 0,
                        color: 'rgba(255, 255, 255, 0.4)'
                    }, {
                        offset: 1,
                        color: 'rgba(255, 255, 255, 0.15)'
                    }]
                },
                borderColor: 'rgba(255, 255, 255, 0.2)',
                borderWidth: 1
            },
            emphasis: {
                itemStyle: {
                    color: {
                        type: 'linear',
                        x: 0,
                        y: 0,
                        x2: 0,
                        y2: 1,
                        colorStops: [{
                            offset: 0,
                            color: 'rgba(255, 255, 255, 0.5)'
                        }, {
                            offset: 1,
                            color: 'rgba(255, 255, 255, 0.2)'
                        }]
                    }
                }
            },
            label: {
                show: true,
                position: 'top',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: 11,
                fontFamily: 'FZFangSong-Z02S, serif'
            }
        }]
    }, false);
}

/* =========================
   初始化图表
   ========================= */
function initCharts() {
    const flowChartEl = document.getElementById('flowChart');
    const spatialChartEl = document.getElementById('spatialChart');
    
    if (flowChartEl && typeof echarts !== 'undefined') {
        flowChart = echarts.init(flowChartEl);
        initTimeSeriesData();
        renderFlowChart();
    }
    
    if (spatialChartEl && typeof echarts !== 'undefined') {
        spatialChart = echarts.init(spatialChartEl);
        renderSpatialChart();
    }
}

/* =========================
   绑定热区点击事件 - 同时更新两种数据
   ========================= */
function bindHotspotEvents() {
    const hotspots = document.querySelectorAll('.hotspot');
    
    hotspots.forEach(hotspot => {
        hotspot.addEventListener('click', (e) => {
            const caveId = hotspot.dataset.cave;
            if (!caveId) return;
            
            // 有人点击进入洞窟
            // ① 累计访问量 +1（永不减少）
            caveCounts[caveId] = (caveCounts[caveId] || 0) + 1;
            
            // ② 当前在场人数 +1（实时）
            currentVisitors[caveId] = (currentVisitors[caveId] || 0) + 1;
            
            // 保存到 localStorage
            localStorage.setItem('yungang_cave_counts', JSON.stringify(caveCounts));
            localStorage.setItem('yungang_current_visitors', JSON.stringify(currentVisitors));
            
            // 更新显示和图表
            updateTotalCount();
            updateAvgDwellTime();
            renderFlowChart();
            renderSpatialChart();
        });
    });
}

/* =========================
   启动随机数据生成（每5秒更新一次，模拟实时人流）
   ========================= */
function startRandomDataGeneration() {
    // 清除之前的定时器
    if (randomDataInterval) {
        clearInterval(randomDataInterval);
    }
    
    // 每5秒生成一次随机数据（模拟实时人流变化）
    randomDataInterval = setInterval(() => {
        generateRandomData();
    }, 5000);
}

/* =========================
   停止随机数据生成
   ========================= */
function stopRandomDataGeneration() {
    if (randomDataInterval) {
        clearInterval(randomDataInterval);
        randomDataInterval = null;
    }
}

/* =========================
   页面加载完成后初始化
   ========================= */
document.addEventListener('DOMContentLoaded', function() {
    // 等待 ECharts 加载完成
    if (typeof echarts !== 'undefined') {
        initCharts();
    } else {
        // 如果 ECharts 还没加载，等待一下
        setTimeout(() => {
            if (typeof echarts !== 'undefined') {
                initCharts();
            }
        }, 500);
    }
    
    // 绑定热区事件
    bindHotspotEvents();
    
    // 更新总人数（显示实时在场人数）
    updateTotalCount();
    updatePeakHour();
    updateAvgDwellTime();
    
    // 启动随机数据生成
    startRandomDataGeneration();
    
    // 窗口大小改变时重新调整图表
    window.addEventListener('resize', function() {
        if (flowChart) flowChart.resize();
        if (spatialChart) spatialChart.resize();
    });
});

/* =========================
   页面显示时刷新数据（处理浏览器前进后退）
   ========================= */
window.addEventListener('pageshow', function() {
    // 重新读取 localStorage
    const storedCounts = JSON.parse(
        localStorage.getItem('yungang_cave_counts')
    );
    const storedCurrent = JSON.parse(
        localStorage.getItem('yungang_current_visitors')
    );
    
    if (storedCounts) {
        caveCounts = storedCounts;
        CAVE_KEYS.forEach(key => {
            if (!caveCounts.hasOwnProperty(key)) {
                caveCounts[key] = 0;
            }
        });
    }
    
    if (storedCurrent) {
        currentVisitors = storedCurrent;
        CAVE_KEYS.forEach(key => {
            if (!currentVisitors.hasOwnProperty(key)) {
                currentVisitors[key] = 0;
            }
        });
    }
    
    // 重新渲染 UI
    updateTotalCount();
    updatePeakHour();
    updateAvgDwellTime();
    renderFlowChart();
    renderSpatialChart();
});

/* =========================
   对外暴露数据（供其他页面使用）
   ========================= */
window.getYungangCaveData = function() {
    return {
        // 累计访问量（历史）
        totalVisits: caveCounts,
        // 当前在场人数（实时）
        currentVisitors: currentVisitors
    };
};

/* ============================================
   视差滚动转场动画 - 需要替换素材图片和文字
   ============================================ */
document.addEventListener('DOMContentLoaded', function() {
    // 等待GSAP库加载完成
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        initParallaxScene();
    } else {
        // 如果GSAP还没加载，等待一下
        setTimeout(() => {
            if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
                initParallaxScene();
            } else {
                console.warn('GSAP或ScrollTrigger未加载，视差效果将无法使用');
            }
        }, 1000);
    }
});

function initParallaxScene() {
    // 注册GSAP插件
    gsap.registerPlugin(ScrollTrigger);
    // 如果ScrollToPlugin可用，也注册它
    if (typeof ScrollToPlugin !== 'undefined') {
        gsap.registerPlugin(ScrollToPlugin);
    }
    
    // 获取视差场景包装容器
    const parallaxWrapper = document.querySelector('.parallax-scene-wrapper');
    if (!parallaxWrapper) {
        console.warn('未找到视差场景容器');
        return;
    }
    
    // 创建视差滚动时间轴 - 基于包装容器触发
    gsap.timeline({
        scrollTrigger: {
            trigger: '.parallax-scene-wrapper', // 使用包装容器作为触发点
            start: 'top top', // 当容器顶部到达视口顶部时开始
            end: 'bottom top', // 当容器底部到达视口顶部时结束
            scrub: 1, // 平滑跟随滚动
            pin: false // 不使用pin，让内容自然滚动
        }
    })
    // 【可调整】各图层的视差移动距离，数值越大移动越快
    .fromTo('.sky', {y: 0}, {y: -1200}, 0)           // 天空背景
    .fromTo('.cloud1', {y: 100}, {y: -4400}, 0)      // 云层1（前景）
    .fromTo('.cloud2', {y: -150}, {y: -4000}, 0)     // 云层2
    .fromTo('.cloud3', {y: -50}, {y: -3650}, 0)      // 云层3
    .fromTo('.mountBg', {y: -10}, {y: -1100}, 0)    // 背景山峦
    .fromTo('.mountMg', {y: -30}, {y: -2250}, 0)     // 中景山峦
    .fromTo('.mountFg', {y: -50}, {y: -1600}, 0);    // 前景山峦
    
    // 箭头按钮交互效果
    const arrowBtn = document.querySelector('#arrow-btn');
    if (arrowBtn) {
        // 鼠标悬停效果
        arrowBtn.addEventListener('mouseenter', () => {
            gsap.to('.arrow', {
                y: 10,
                duration: 0.8,
                ease: 'back.inOut(3)',
                overwrite: 'auto'
            });
        });
        
        // 鼠标离开效果
        arrowBtn.addEventListener('mouseleave', () => {
            gsap.to('.arrow', {
                y: 0,
                duration: 0.5,
                ease: 'power3.out',
                overwrite: 'auto'
            });
        });
        
        // 点击滚动效果 - 滚动到下一个区域
        arrowBtn.addEventListener('click', () => {
            const nextSection = document.querySelector('.next-section');
            if (nextSection) {
                // 滚动到下一个区域
                if (typeof ScrollToPlugin !== 'undefined') {
                    gsap.to(window, {
                        scrollTo: {
                            y: nextSection,
                            offsetY: 0
                        },
                        duration: 1.5,
                        ease: 'power1.inOut'
                    });
                } else {
                    // 降级方案：使用原生平滑滚动
                    nextSection.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            } else {
                // 如果没有下一个区域，滚动到视差场景底部
                const parallaxWrapper = document.querySelector('.parallax-scene-wrapper');
                if (parallaxWrapper) {
                    const scrollTarget = parallaxWrapper.offsetTop + parallaxWrapper.offsetHeight;
                    if (typeof ScrollToPlugin !== 'undefined') {
                        gsap.to(window, {
                            scrollTo: scrollTarget,
                            duration: 1.5,
                            ease: 'power1.inOut'
                        });
                    } else {
                        window.scrollTo({
                            top: scrollTarget,
                            behavior: 'smooth'
                        });
                    }
                }
            }
        });
    }
}
