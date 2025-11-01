/* 天空繁星和流星雨背景效果 + 鼠标交互 */
console.log('🎨 p5-bg.js 开始加载...');

let p;
new p5((_p) => {
  p = _p;
  let stars = [];
  let meteors = [];
  let mouseTrails = []; // 鼠标拖尾
  let clickBursts = []; // 点击绽放
  let nextMeteorShower = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;
  
  const NUM_STARS = 100; // 减少到100颗
  const METEOR_SHOWER_INTERVAL = 15000;
  
  _p.setup = () => {
    console.log('✅ p5.js setup 开始');
    const c = _p.createCanvas(window.innerWidth, window.innerHeight);
    c.parent('bg-layer');
    console.log(`✅ Canvas 创建成功: ${_p.width} x ${_p.height}`);
    
    // 创建星星 - 更多分布在两侧
    for (let i = 0; i < NUM_STARS; i++) {
      let x, y;
      
      // 70%概率分布在两侧，30%分布在中间
      if (Math.random() < 0.7) {
        // 两侧区域（左右各25%宽度）
        if (Math.random() < 0.5) {
          x = Math.random() * _p.width * 0.25; // 左侧25%
        } else {
          x = _p.width * 0.75 + Math.random() * _p.width * 0.25; // 右侧25%
        }
      } else {
        // 中间区域（中间50%宽度）
        x = _p.width * 0.25 + Math.random() * _p.width * 0.5;
      }
      
      y = Math.random() * _p.height;
      
      stars.push({
        x: x,
        y: y,
        size: Math.random() * 3 + 1.5,
        brightness: Math.random() * 0.5 + 0.5,
        twinkleSpeed: Math.random() * 0.02 + 0.01,
        twinkleOffset: Math.random() * Math.PI * 2
      });
    }
    console.log(`✅ 创建了 ${stars.length} 颗星星`);
    
    // 设置第一次流星雨时间
    nextMeteorShower = _p.millis() + 5000 + Math.random() * 5000;
    
    _p.noStroke();
    
    // 初始化鼠标位置
    lastMouseX = _p.mouseX;
    lastMouseY = _p.mouseY;
  };
  
  _p.windowResized = () => {
    _p.resizeCanvas(window.innerWidth, window.innerHeight);
    // 重新分布星星
    stars = [];
    for (let i = 0; i < NUM_STARS; i++) {
      let x, y;
      if (Math.random() < 0.7) {
        if (Math.random() < 0.5) {
          x = Math.random() * _p.width * 0.25;
        } else {
          x = _p.width * 0.75 + Math.random() * _p.width * 0.25;
        }
      } else {
        x = _p.width * 0.25 + Math.random() * _p.width * 0.5;
      }
      y = Math.random() * _p.height;
      
      stars.push({
        x: x,
        y: y,
        size: Math.random() * 3 + 1.5,
        brightness: Math.random() * 0.5 + 0.5,
        twinkleSpeed: Math.random() * 0.02 + 0.01,
        twinkleOffset: Math.random() * Math.PI * 2
      });
    }
  };
  
  // 鼠标点击事件 - 创建绽放效果
  _p.mousePressed = () => {
    // 只在画布区域内响应
    if (_p.mouseX >= 0 && _p.mouseX <= _p.width && 
        _p.mouseY >= 0 && _p.mouseY <= _p.height) {
      
      // 创建绽放粒子（8-12个向外扩散的小星星）
      const particleCount = Math.floor(Math.random() * 5) + 8;
      const burstParticles = [];
      
      for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount;
        const speed = Math.random() * 3 + 2;
        
        burstParticles.push({
          x: _p.mouseX,
          y: _p.mouseY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: Math.random() * 3 + 2,
          brightness: 1,
          birthTime: _p.millis(),
          lifespan: Math.random() * 500 + 500 // 0.5-1秒
        });
      }
      
      clickBursts.push({
        particles: burstParticles,
        birthTime: _p.millis()
      });
      
      console.log('✨ 鼠标点击绽放！');
    }
  };
  
  _p.draw = () => {
    _p.clear();
    _p.background(0, 0);
    
    const currentTime = _p.millis();
    
    // 绘制星星（闪烁效果）
    for (const star of stars) {
      const twinkle = Math.sin(currentTime * star.twinkleSpeed + star.twinkleOffset) * 0.3 + 0.7;
      const alpha = star.brightness * twinkle * 180;
      
      const hue = Math.random() < 0.9 ? 0 : 200;
      _p.fill(200 + hue * 0.15, 200 + hue * 0.2, 255, alpha);
      _p.circle(star.x, star.y, star.size);
    }
    
    // 鼠标移动拖尾效果
    const mouseMoved = Math.abs(_p.mouseX - lastMouseX) > 2 || Math.abs(_p.mouseY - lastMouseY) > 2;
    
    if (mouseMoved && _p.mouseX >= 0 && _p.mouseX <= _p.width && 
        _p.mouseY >= 0 && _p.mouseY <= _p.height) {
      
      // 创建拖尾粒子
      mouseTrails.push({
        x: _p.mouseX,
        y: _p.mouseY,
        vx: (_p.mouseX - lastMouseX) * 0.1,
        vy: (_p.mouseY - lastMouseY) * 0.1,
        size: 3,
        brightness: 1,
        birthTime: currentTime,
        lifespan: 600 // 0.6秒
      });
      
      lastMouseX = _p.mouseX;
      lastMouseY = _p.mouseY;
    }
    
    // 绘制鼠标拖尾
    for (let i = mouseTrails.length - 1; i >= 0; i--) {
      const trail = mouseTrails[i];
      const age = currentTime - trail.birthTime;
      
      if (age > trail.lifespan) {
        mouseTrails.splice(i, 1);
        continue;
      }
      
      // 更新位置
      trail.x += trail.vx;
      trail.y += trail.vy;
      trail.vx *= 0.95; // 阻力
      trail.vy *= 0.95;
      
      // 渐隐
      const fadeRatio = 1 - age / trail.lifespan;
      const alpha = fadeRatio * trail.brightness * 200;
      
      // 绘制拖尾（类似流星）
      const trailLength = 5;
      for (let j = 0; j < trailLength; j++) {
        const ratio = j / trailLength;
        const trailX = trail.x - trail.vx * ratio * 10;
        const trailY = trail.y - trail.vy * ratio * 10;
        const trailAlpha = alpha * (1 - ratio);
        
        _p.fill(220, 230, 255, trailAlpha);
        _p.circle(trailX, trailY, (1 - ratio) * trail.size);
      }
    }
    
    // 绘制点击绽放效果
    for (let i = clickBursts.length - 1; i >= 0; i--) {
      const burst = clickBursts[i];
      let allDead = true;
      
      for (let j = burst.particles.length - 1; j >= 0; j--) {
        const particle = burst.particles[j];
        const age = currentTime - particle.birthTime;
        
        if (age > particle.lifespan) {
          burst.particles.splice(j, 1);
          continue;
        }
        
        allDead = false;
        
        // 更新位置
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.95; // 减速
        particle.vy *= 0.95;
        
        // 渐隐
        const fadeRatio = 1 - age / particle.lifespan;
        const alpha = fadeRatio * particle.brightness * 220;
        
        // 绘制粒子（星星形状）
        _p.fill(255, 255, 200, alpha);
        _p.circle(particle.x, particle.y, particle.size * fadeRatio);
        
        // 添加光晕
        _p.fill(255, 255, 255, alpha * 0.3);
        _p.circle(particle.x, particle.y, particle.size * fadeRatio * 2);
      }
      
      if (allDead) {
        clickBursts.splice(i, 1);
      }
    }
    
    // 流星雨
    if (currentTime >= nextMeteorShower) {
      console.log('💫 流星雨开始！');
      const meteorCount = Math.floor(Math.random() * 6) + 5;
      
      for (let i = 0; i < meteorCount; i++) {
        let startX, vx;
        if (Math.random() < 0.7) {
          if (Math.random() < 0.5) {
            startX = -100 - Math.random() * 200;
            vx = Math.random() * 3 + 2;
          } else {
            startX = _p.width + 100 + Math.random() * 200;
            vx = -(Math.random() * 3 + 2);
          }
        } else {
          startX = Math.random() * _p.width;
          vx = (Math.random() - 0.5) * 2;
        }
        
        meteors.push({
          x: startX,
          y: -50 - Math.random() * 200,
          vx: vx,
          vy: Math.random() * 3 + 4,
          length: Math.random() * 40 + 30,
          brightness: Math.random() * 0.5 + 0.5,
          birthTime: currentTime,
          lifespan: Math.random() * 1500 + 1500
        });
      }
      
      nextMeteorShower = currentTime + METEOR_SHOWER_INTERVAL + Math.random() * 5000;
      console.log(`✨ 创建了 ${meteorCount} 颗流星`);
    }
    
    // 绘制流星
    for (let i = meteors.length - 1; i >= 0; i--) {
      const meteor = meteors[i];
      const age = currentTime - meteor.birthTime;
      
      if (age > meteor.lifespan || 
          meteor.y > _p.height + 100 ||
          meteor.x < -200 || 
          meteor.x > _p.width + 200) {
        meteors.splice(i, 1);
        continue;
      }
      
      meteor.x += meteor.vx;
      meteor.y += meteor.vy;
      
      let fadeAlpha = 1;
      if (age > meteor.lifespan * 0.7) {
        fadeAlpha = 1 - (age - meteor.lifespan * 0.7) / (meteor.lifespan * 0.3);
      }
      
      // 绘制尾迹
      const trailSegments = 10;
      for (let j = 0; j < trailSegments; j++) {
        const ratio = j / trailSegments;
        const trailX = meteor.x - meteor.vx * ratio * 5;
        const trailY = meteor.y - meteor.vy * ratio * 5;
        const alpha = (1 - ratio) * meteor.brightness * fadeAlpha * 200;
        const hue = ratio * 30;
        
        _p.fill(255 - hue, 255 - hue * 0.5, 255, alpha);
        const size = (1 - ratio) * 2.5;
        _p.circle(trailX, trailY, size);
      }
      
      // 流星头部
      _p.fill(255, 255, 255, meteor.brightness * fadeAlpha * 255);
      _p.circle(meteor.x, meteor.y, 3);
    }
  };
});

console.log('✅ p5-bg.js 加载完成');
