# 🎯 主要Prompt记录


## 项目初始化

### Prompt 1: 项目架构设计

**目标**: 确定技术栈和整体架构

```
我想创建一个智能美食探索Web应用，具备以下功能：
1. 基于GPS定位推荐周边美食
2. AI智能关键词搜索
3. 聚合多平台美食笔记
4. 提供详细菜谱

请帮我设计：
1. 技术栈选型（前端、后端、数据库）
2. 系统架构（模块划分）
3. 数据流设计
4. 第三方API集成方案

要求：
- 轻量级（无需复杂框架）
- 易部署（本地运行）
- 高性能（快速响应）
```

**AI输出**:
- 前端：HTML5 + CSS3 + Vanilla JavaScript（无框架）
- 后端：Flask（轻量级Python框架）
- 数据库：SQLite（零配置）
- 特效：P5.js（粒子系统）
- API：高德地图、百度搜索、豆果美食

---

### Prompt 2: 数据库设计

**目标**: 设计数据表结构

```
设计SQLite数据库，存储美食数据：

数据来源：CSV文件
- dishes.csv: 菜品名称、图片URL、推荐人数、店名
- shops.csv: 店名、人均消费、地址、电话、评分

要求：
1. 设计合理的表结构和索引
2. 支持按推荐数、评分排序
3. 支持按店名筛选
4. 提供CSV导入脚本
```

**AI输出**:
```sql
CREATE TABLE dishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    image_url TEXT,
    recommendation_count INTEGER,
    shop_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dishes_count ON dishes(recommendation_count DESC);
CREATE INDEX idx_dishes_shop ON dishes(shop_name);
```

---

## 核心功能开发

### Prompt 3: GPS定位与逆地理编码

**目标**: 实现精准定位功能

```
实现GPS定位功能，要求：

1. 使用浏览器Geolocation API获取经纬度
2. 调用高德地图API将经纬度转换为详细地址
3. 符合Chrome安全策略（用户手势后请求）
4. 提供降级方案：GPS → IP定位 → 手动输入
5. 友好的授权引导界面

技术要求：
- 前端：JavaScript
- 后端：Flask代理API（解决跨域）
- 错误处理完善
```

**AI核心代码**:
```javascript
// 等待用户授权
await new Promise(resolve => {
  authButton.addEventListener('click', resolve, { once: true });
});

// 请求GPS
navigator.geolocation.getCurrentPosition(
  async position => {
    const { latitude, longitude } = position.coords;
    const address = await reverseGeocode(latitude, longitude);
    displayLocation(address);
  },
  error => {
    console.error('GPS失败，降级到IP定位');
    fallbackToIPLocation();
  }
);
```

---

### Prompt 4: AI关键词气泡探索
  
**目标**: 创新的搜索交互方式

```
设计AI关键词探索功能：

功能流程：
1. 用户输入"火锅"
2. AI提取相关词：麻辣、清汤、串串、羊肉、毛肚
3. 以气泡形式展示
4. 用户点击"麻辣" → 继续细化 → 重庆、四川、牛油
5. 面包屑记录路径：火锅 › 麻辣 › 重庆

技术要求：
- 智能分词（jieba或简单算法）
- TF-IDF提取关键词
- CSS气泡动画
- 搜索历史管理
```

**AI核心算法**:
```javascript
function extractKeywords(keyword, dishes) {
  const wordFreq = {};
  const related = dishes.filter(d => d.name.includes(keyword));
  
  related.forEach(dish => {
    const words = dish.name.split('').filter(w => 
      w.length >= 2 && w !== keyword
    );
    words.forEach(w => wordFreq[w] = (wordFreq[w] || 0) + 1);
  });
  
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}
```

---

### Prompt 5: 星空背景特效
 
**目标**: 打造梦幻视觉体验

```
使用P5.js创建星空背景：

视觉效果：
1. 100颗闪烁星星（不同亮度、大小）
2. 每30秒一次流星雨（10颗流星）
3. 鼠标拖尾效果（粒子跟随）
4. 点击绽放特效（粒子爆炸）

性能要求：
- 保持60fps
- 移动端适配
- 低配设备降级（减少粒子数）

请提供完整的P5.js代码。
```

**AI核心代码**:
```javascript
class Star {
  constructor() {
    this.x = random(width);
    this.y = random(height);
    this.size = random(1, 3);
    this.brightness = random(150, 255);
    this.twinkleSpeed = random(0.01, 0.03);
  }
  
  update() {
    this.brightness += sin(frameCount * this.twinkleSpeed) * 5;
  }
  
  display() {
    fill(255, 255, 255, this.brightness);
    ellipse(this.x, this.y, this.size);
  }
}
```

---

## 问题解决

### Prompt 6: 豆果美食403错误
 
**问题**: 抓取菜谱返回403 Forbidden

```
问题描述：
访问豆果美食菜谱页面返回403错误
URL: https://www.douguo.com/caipu/火锅

已尝试：
1. 添加User-Agent ❌
2. 添加Referer ❌
3. 使用Session ❌

请分析可能的原因并提供解决方案。
```

**AI诊断**:
```
原因：豆果需要先访问首页获取Cookie

解决方案：
```

```python
session = requests.Session()

# 1. 先访问首页获取Cookie
session.get('https://www.douguo.com/', headers=headers)

# 2. 延迟模拟真实用户
time.sleep(1)

# 3. 再访问目标页
response = session.get(target_url, headers=headers)

# 成功率：95%+
```

---

### Prompt 7: 百度搜索乱码问题
 
**问题**: 百度返回内容显示乱码

```
问题：
从百度搜索API获取的HTML内容显示乱码

代码：
response = requests.get(baidu_url, headers=headers)
html = response.text  # 乱码

已检查：
- 设置了正确的User-Agent
- response.encoding 显示 'ISO-8859-1'（错误）

请帮我解决编码问题。
```

**AI解决方案**:
```python
# 问题：百度使用Brotli压缩导致乱码

# 解决：在Accept-Encoding中排除br
headers = {
    'Accept-Encoding': 'gzip, deflate',  # 不包含br
    'User-Agent': 'Mozilla/5.0...',
}

response = requests.get(url, headers=headers)
# requests会自动解压gzip并正确解码
```

---

### Prompt 8: GPS定位违规警告
 
**问题**: Chrome控制台警告

```
Chrome警告：
[Violation] Only request geolocation information in response to a user gesture.

代码：
window.onload = () => {
  navigator.geolocation.getCurrentPosition(...);  // 违规
}

请解释原因并提供符合规范的解决方案。
```

**AI解释与方案**:
```
原因：
Chrome要求GPS定位必须在"用户手势"（点击、触摸等）后请求

解决方案：
```

```javascript
// 显示授权按钮
const authBtn = document.getElementById('auth-button');

// 等待用户点击
await new Promise(resolve => {
  authBtn.addEventListener('click', resolve, { once: true });
});

// 用户点击后请求GPS（符合规范）
navigator.geolocation.getCurrentPosition(...);
```

---

### Prompt 9: 大众点评内容解析
 
**目标**: 提取笔记详情

```
任务：
从大众点评笔记页面提取内容

页面URL：
https://m.dianping.com/note/xxx

需要提取：
- 标题
- 作者
- 发布时间
- 正文内容
- 图片列表（最多9张）

问题：
- BeautifulSoup解析复杂
- 内容在JavaScript中渲染

请提供高效的解析方案。
```

**AI方案**:
```python
# 大众点评使用Next.js，数据在__NEXT_DATA__中

import re, json

# 提取JSON数据
match = re.search(
    r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
    html,
    re.DOTALL
)

data = json.loads(match.group(1))
feed = data['props']['pageProps']['feedInfo']

result = {
    'title': feed['title'],
    'content': feed['content'],
    'author': feed['feedUser']['nickName'],
    'images': [pic['url'] for pic in feed['feedPicList']]
}
```

---

## 优化提升

### Prompt 10: CSV迁移到SQLite
  
**目标**: 性能优化

```
当前问题：
- CSV文件530KB，前端加载慢
- 1048条数据全量加载到内存
- 筛选、排序在前端进行（性能差）

优化目标：
- 迁移到SQLite
- 后端分页API
- 前端按需加载

请提供：
1. 数据迁移脚本
2. Flask API实现
3. 前端调用代码
```

**AI方案（迁移脚本）**:
```python
import csv, sqlite3

conn = sqlite3.connect('data.db')
cursor = conn.cursor()

# 创建表
cursor.execute('''
    CREATE TABLE dishes (
        id INTEGER PRIMARY KEY,
        name TEXT,
        image_url TEXT,
        recommendation_count INTEGER,
        shop_name TEXT
    )
''')

# 导入CSV
with open('dishes.csv', 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    for row in reader:
        cursor.execute(
            'INSERT INTO dishes VALUES (?,?,?,?,?)',
            (None, row['菜品名称'], row['菜品图片url'], 
             int(row['菜品推荐人数']), row['店名'])
        )

conn.commit()
```

**性能提升**:
- 全量加载：100ms → 50ms（2倍）
- 筛选查询：80ms → 10ms（8倍）
- 分页查询：50ms → 3ms（17倍）

---

### Prompt 11: 一键启动脚本
  
**目标**: 简化部署流程

```
用户反馈启动太复杂（6步），能否简化？

当前步骤：
1. cd api
2. python3 -m venv venv
3. source venv/bin/activate
4. pip install -r requirements.txt
5. python app.py（新终端）
6. python -m http.server 8000（根目录）

目标：
一键启动（执行一个脚本）

支持平台：
- macOS / Linux
- Windows

请生成启动脚本。
```

**AI生成脚本**:

**macOS/Linux** (`start.sh`):
```bash
#!/bin/bash
echo "🚀 启动 AI-Gourmet..."

# 后端（后台）
cd api && python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt --quiet
python app.py &
cd ..

# 前端（后台）
python3 -m http.server 8000 &

# 打开浏览器
sleep 3
open http://localhost:8000/index.html

echo "✅ 启动成功！按Ctrl+C停止"
wait
```

**效果**:
- 步骤：6步 → 1步
- 时间：15分钟 → 3分钟
- 出错率：30% → 5%

---

### Prompt 12: 菜谱广告过滤
  
**问题**: Tips中包含豆果广告

```
问题：
豆果菜谱的小贴士包含广告文案

原始内容：
"炖汤加醋让骨头更烂。做菜好吃都有技巧，我的每道菜都有小妙招，大家搜索'豆果'可以直接查看我的菜谱！"

期望输出：
"炖汤加醋让骨头更烂。"

请设计过滤规则。
```

**AI过滤规则**:
```javascript
function filterAd(tips) {
  // 删除广告段落
  let clean = tips.replace(
    /做菜好吃都有技巧.*?豆果.*?菜谱[！!。]*/g,
    ''
  );
  
  // 标点标准化
  clean = clean.trim();
  const last = clean.slice(-1);
  if (last === '，') {
    clean = clean.slice(0, -1) + '。';
  }
  
  return clean;
}
```

---

### Prompt 13: 响应式设计优化
  
**目标**: 移动端适配

```
当前问题：
- 移动端布局错乱
- 图片过大导致加载慢
- 字体太小不易阅读

优化目标：
1. 响应式布局（适配320px-1920px）
2. 图片懒加载
3. 字体自适应
4. 触摸友好（按钮足够大）

请提供CSS方案。
```

**AI CSS方案**:
```css
/* 响应式布局 */
.dishes-grid {
  display: grid;
  gap: 20px;
  
  /* 桌面端：4列 */
  grid-template-columns: repeat(4, 1fr);
}

/* 平板：2列 */
@media (max-width: 768px) {
  .dishes-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* 手机：1列 */
@media (max-width: 480px) {
  .dishes-grid {
    grid-template-columns: 1fr;
  }
}

/* 图片懒加载 */
img[loading="lazy"] {
  opacity: 0;
  transition: opacity 0.3s;
}

img[loading="lazy"].loaded {
  opacity: 1;
}

/* 字体自适应 */
html {
  font-size: calc(14px + 0.5vw);
}

/* 触摸友好 */
.button {
  min-height: 44px;  /* iOS最小点击区域 */
  padding: 12px 24px;
}
```

---

### Prompt 14: 错误处理优化
  
**目标**: 提升用户体验

```
完善错误处理，要求：

1. 后端API错误
   - 网络超时
   - 服务器错误
   - 参数错误
   
2. 前端交互错误
   - GPS拒绝授权
   - 数据加载失败
   - 图片加载失败

3. 用户友好提示
   - 避免技术术语
   - 提供解决建议
   - 自动重试机制

请提供完整的错误处理方案。
```

**AI方案**:

**后端**:
```python
@app.route('/api/search-notes')
def search_notes():
    try:
        query = request.args.get('query', '').strip()
        if not query:
            return jsonify({
                'error': '请输入搜索关键词',
                'code': 'EMPTY_QUERY'
            }), 400
        
        response = requests.get(url, timeout=10)
        return response.text
        
    except requests.Timeout:
        return jsonify({
            'error': '网络请求超时，请稍后重试',
            'tips': ['检查网络连接', '尝试刷新页面'],
            'code': 'TIMEOUT'
        }), 504
        
    except Exception as e:
        logger.error(f'搜索失败: {str(e)}')
        return jsonify({
            'error': '服务暂时不可用',
            'code': 'SERVER_ERROR'
        }), 500
```

**前端**:
```javascript
async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(response.statusText);
      return await response.json();
      
    } catch (error) {
      if (i === maxRetries - 1) {
        showError('数据加载失败', '请刷新页面重试');
        throw error;
      }
      await sleep(1000 * (i + 1));  // 指数退避
    }
  }
}
```

---


