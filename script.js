function getMealTime() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 10) return '早餐时段';
  if (hour >= 10 && hour < 14) return '午餐时段';
  if (hour >= 14 && hour < 17) return '下午茶时段';
  if (hour >= 17 && hour < 21) return '晚餐时段';
  return '夜宵时段';
}

function getSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return '春季';
  if (month >= 6 && month <= 8) return '夏季';
  if (month >= 9 && month <= 11) return '秋季';
  return '冬季';
}

async function onAiRecommend() {
  const prompt = (els.aiPrompt?.value || '').trim();
  if (!prompt) {
    if (els.aiTip) els.aiTip.textContent = '请先输入你的口味/预算/偏好描述';
    return;
  }
  
  // 准备菜品列表和用户偏好
  const dishNames = state.dishes
    .slice(0, 1000) // 限制数量避免token过多
    .map(d => d['菜品名称'] || d['菜名'] || d['名称'] || '')
    .filter(Boolean)
    .join('、');
  
  if (!dishNames) {
    if (els.aiTip) els.aiTip.textContent = '暂无菜品数据，请等待数据加载完成';
    return;
  }
  
  // 获取上下文信息
  const mealTime = getMealTime();
  const season = getSeason();
  const weather = currentWeatherData.weather;
  const temperature = currentWeatherData.temperature;
  
  // 构建上下文文本
  const location = currentLocationData.city || '杭州';
  const detailLocation = currentLocationData.address ? `${currentLocationData.city} ${currentLocationData.address}` : location;
  
  const contextText = `\n\n【当前用餐环境】
- 时段：${mealTime}
- 季节：${season}
- 天气：${weather}，气温 ${temperature}°C
- 地点：${detailLocation}`;
  
  // 获取用户喜好
  const likedDishes = Array.from(state.preferences.likes)
    .map(key => key.split('::')[1]) // 提取菜品名
    .filter(Boolean)
    .slice(0, 20); // 最多20个
  
  let preferenceText = '';
  if (likedDishes.length > 0) {
    preferenceText += `\n\n【用户历史偏好】
用户收藏的菜品：${likedDishes.join('、')}
请分析这些菜品的共同特点（如口味、食材、烹饪方式等），并根据这些偏好特征推荐类似风格的其他菜品，不要直接推荐用户已收藏的菜品。`;
  }
  
  // 显示流式输出区域
  if (els.aiStreamOutput) {
    els.aiStreamOutput.classList.add('visible');
    els.aiStreamOutput.textContent = '';
  }
  if (els.aiTip) els.aiTip.textContent = 'AI 正在思考你的口味…';
  
  try {
    const baseUrl = localStorage.getItem('ai.baseUrl') || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const apiKey = localStorage.getItem('ai.apiKey') || 'sk-312b493179ab472587b9b12e78a26a2e';
    const model = localStorage.getItem('ai.recommendModel') || 'qwen-plus';
    
    console.log('AI Request:', { baseUrl, apiKey: apiKey.substring(0, 10) + '...', model, prompt });
    
    const systemPrompt = `你是一个专业的美食推荐助理。我会给你用户的需求描述、用餐环境上下文和可选的菜品列表。

请用**Markdown格式**输出，包含：

## 🍽️ 为您推荐

先用1-2句温暖友好的话分析用户需求和当前用餐场景（结合时段、季节、天气）。

### 推荐菜品

为每个推荐菜品使用以下格式：

**🌟 [菜品名]**  
*推荐理由*：简洁说明为什么推荐这道菜（口味、营养、场景适配（季节性、天气适宜性）等）

### 💡 用餐建议

给出搭配建议和美好祝福。

---

**推荐原则**：
- 结合时段推荐：早餐宜清淡营养、午餐宜丰盛均衡、晚餐宜适中、夜宵宜开胃不油腻
- 结合季节推荐：春季宜清爽、夏季宜清凉解暑、秋季宜滋补、冬季宜温补暖身
- 结合天气推荐：晴天可推荐任意、高温宜清凉、低温宜热乎、雨天宜暖心
- 如果用户有历史偏好记录，优先推荐类似于他们喜欢的菜品
- 从菜品列表中挑选3-9个最适合的菜品
- 最后用JSON格式返回：{"recommended_dishes": ["菜品1", "菜品2", "菜品3"]}

可选菜品列表：${dishNames}${contextText}${preferenceText}`;

    const resp = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'accept-language': '*',
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        stream: true,
        stream_options: {
          include_usage: true
        }
      })
    });
    
    console.log('AI Response status:', resp.status);
    
    if (!resp.ok) {
      const errorData = await resp.json();
      throw new Error(errorData?.message || `HTTP ${resp.status}`);
    }
    
    // 处理流式响应，实时显示
    let fullContent = '';
    let displayedContent = '';
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices?.[0]?.delta?.content) {
              const newContent = parsed.choices[0].delta.content;
              fullContent += newContent;
              
              // 过滤掉JSON部分，只显示文字内容（包括未闭合的部分）
              let filteredContent = fullContent;
              // 移除 ```json ... ``` 代码块
              filteredContent = filteredContent.replace(/```json[\s\S]*?```/g, '');
              // 移除单独的JSON对象（以 { 开头，包含 "recommended_dishes" 的）
              filteredContent = filteredContent.replace(/\{[\s\S]*?"recommended_dishes"[\s\S]*?\}/g, '');
              // 移除未闭合的 ```json 开头（防止显示中间状态）
              filteredContent = filteredContent.replace(/```json[\s\S]*$/g, '');
              // 移除未闭合的JSON对象开头（防止显示 { "recommended_dishes": 等）
              filteredContent = filteredContent.replace(/\{[\s\S]*?"recommended_dishes"[\s\S]*$/g, '');
              
              displayedContent = filteredContent.trim();
              
              // 实时更新显示，使用Markdown渲染
              if (els.aiStreamOutput) {
                // 检查marked是否可用
                if (typeof marked !== 'undefined' && marked.parse) {
                  try {
                    els.aiStreamOutput.innerHTML = marked.parse(displayedContent);
                  } catch (e) {
                    els.aiStreamOutput.textContent = displayedContent;
                  }
                } else {
                  els.aiStreamOutput.textContent = displayedContent;
                }
                // 自动滚动到底部
                els.aiStreamOutput.scrollTop = els.aiStreamOutput.scrollHeight;
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
    
    console.log('AI Full content:', fullContent);
    
    // 从完整内容中提取JSON
    let recommendedDishes = [];
    try {
      const jsonMatch = fullContent.match(/\{[\s\S]*"recommended_dishes"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        recommendedDishes = parsed.recommended_dishes || [];
      }
    } catch (e) {
      console.error('Failed to parse JSON:', e);
    }

    // 根据AI推荐的菜品名筛选
    if (recommendedDishes.length > 0) {
      const filteredBase = joinAndFilter();
      const result = filteredBase.filter(item => 
        recommendedDishes.some(dish => 
          (item.dishName || '').includes(dish) || dish.includes(item.dishName || '')
        )
      );
      
      if (result.length > 0) {
        state.filtered = result;
        pagination.page = 1;
        updateStats();
        render();
        if (els.aiTip) els.aiTip.textContent = `AI 为您推荐了 ${result.length} 道美食 🍽️`;
      } else {
        if (els.aiTip) els.aiTip.textContent = 'AI 推荐的菜品暂时没有找到，请试试其他描述';
      }
    } else {
      if (els.aiTip) els.aiTip.textContent = 'AI 思考完毕，但未找到匹配的菜品';
    }
  } catch (e) {
    console.error(e);
    if (els.aiTip) els.aiTip.textContent = 'AI 推荐失败：' + e.message;
    if (els.aiStreamOutput) {
      els.aiStreamOutput.textContent = '抱歉，AI推荐服务暂时不可用，请稍后再试。';
    }
  }
}
// Minimal utility CSV parser: handles simple CSV with commas and quotes
function parseCsv(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(current);
      current = '';
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (current !== '' || row.length > 0) {
        row.push(current);
        rows.push(row);
        row = [];
        current = '';
      }
      // swallow \r in \r\n pairs
    } else {
      current += c;
    }
  }
  if (current !== '' || row.length > 0) {
    row.push(current);
    rows.push(row);
  }
  return rows;
}

function rowsToObjects(rows) {
  if (!rows || rows.length === 0) return [];
  const header = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = (r[idx] ?? '').trim();
    });
    return obj;
  });
}

const state = {
  dishes: [], // from 菜品名录.csv
  shops: [],  // from 店铺名录.csv
  filtered: [],
  preferences: { likes: new Set() },
};

const els = {
  keyword: { value: '' },
  minScore: { value: '0' },
  maxPp: { value: '' },
  count: { value: '9' },
  cards: document.getElementById('cards'),
  stats: document.getElementById('stats'),
  bubbleCanvas: document.getElementById('bubble-canvas'),
  bubblePath: document.getElementById('bubble-path'),
  bubbleHint: document.getElementById('bubble-hint'),
  dishSearchInput: document.getElementById('dish-search-input'),
  btnDishSearch: document.getElementById('btn-dish-search'),
  dishRanking: document.getElementById('dish-ranking'),
  shopRanking: document.getElementById('shop-ranking'),
  aiPrompt: document.getElementById('ai-prompt'),
  btnAiReco: document.getElementById('btn-ai-reco'),
  aiTip: document.getElementById('ai-tip'),
  aiStreamOutput: document.getElementById('ai-stream-output'),
  btnSettings: document.getElementById('btn-settings'),
  aiConfigModal: document.getElementById('ai-config-modal'),
  btnCloseModal: document.getElementById('btn-close-modal'),
  btnSaveConfig: document.getElementById('btn-save-config'),
  btnCancelConfig: document.getElementById('btn-cancel-config'),
  aiBaseUrlModal: document.getElementById('ai-baseurl-modal'),
  aiApiKeyModal: document.getElementById('ai-apikey-modal'),
  aiRecommendModelModal: document.getElementById('ai-recommend-model-modal'),
  aiSummaryModelModal: document.getElementById('ai-summary-model-modal'),
  btnFavorites: document.getElementById('btn-favorites'),
  favoritesModal: document.getElementById('favorites-modal'),
  btnCloseFavorites: document.getElementById('btn-close-favorites'),
  favoritesList: document.getElementById('favorites-list'),
  // 美食笔记元素
  notesSearchInput: document.getElementById('notes-search-input'),
  btnNotesSearch: document.getElementById('btn-notes-search'),
  notesResults: document.getElementById('notes-results'),
  notesPagination: document.getElementById('notes-pagination'),
  notesPagePrev: document.getElementById('notes-page-prev'),
  notesPageNext: document.getElementById('notes-page-next'),
  notesPageInfo: document.getElementById('notes-page-info'),
  favoriteCount: document.querySelector('.favorite-count'),
  favoritesSummary: document.getElementById('favorites-summary'),
};

// 从API获取数据（替代原来的CSV读取）
async function fetchDataFromAPI() {
  try {
    const [dishesRes, shopsRes] = await Promise.all([
      fetch('http://localhost:5000/api/dishes'),
      fetch('http://localhost:5000/api/shops'),
    ]);
    
    if (!dishesRes.ok) throw new Error('菜品API请求失败: ' + dishesRes.status);
    if (!shopsRes.ok) throw new Error('店铺API请求失败: ' + shopsRes.status);
    
    const dishesData = await dishesRes.json();
    const shopsData = await shopsRes.json();
    
    if (!dishesData.success) throw new Error('菜品数据获取失败');
    if (!shopsData.success) throw new Error('店铺数据获取失败');
    
    return {
      dishes: dishesData.data,
      shops: shopsData.data
    };
  } catch (error) {
    console.error('API获取数据失败:', error);
    throw error;
  }
}

async function tryAutoLoad() {
  els.stats.textContent = '正在自动加载美食数据...';
  try {
    // 从API获取数据而不是读取CSV
    const { dishes, shops } = await fetchDataFromAPI();
    applyLoadedData(dishes, shops);
  } catch (e) {
    console.warn('API加载失败，尝试降级到CSV:', e);
    // 降级策略：如果API失败，尝试读取CSV
  try {
    const [dishesText, shopsText] = await Promise.all([
        fetch('./菜品名录.csv').then(r => r.text()),
        fetch('./店铺名录.csv').then(r => r.text()),
      ]);
      const dishes = rowsToObjects(parseCsv(dishesText));
      const shops = rowsToObjects(parseCsv(shopsText));
      applyLoadedData(dishes, shops);
    } catch (e2) {
      console.warn(e2);
      els.stats.textContent = '数据加载失败：请确保后端服务已启动。';
    }
  }
}

function applyLoadedData(dishes, shops) {
  // 随机打乱顺序，让每次加载展示不同
  state.dishes = shuffleArray(dishes);
  state.shops = shuffleArray(shops);
  state.filtered = joinAndFilter();
  render();
  updateStats();
  els.stats.textContent = `已为您找到您周边的美食：菜品 ${state.dishes.length}，店铺 ${state.shops.length}`;
  // Build and render keyword bubbles now that data is available
  bubbleState.tokens = [];
  renderBubbles();
  renderRankings();
}

function joinAndFilter() {
  const keyword = (els.keyword.value || '').trim().toLowerCase();
  const minScore = parseFloat(els.minScore.value || '0') || 0;
  const maxPp = parseFloat(els.maxPp.value || '');

  // Build shop map by name
  const shopByName = new Map();
  for (const s of state.shops) {
    if (!s['店名']) continue;
    shopByName.set(String(s['店名']).trim(), s);
  }

  // Join dish with shop
  const joined = state.dishes.map(d => {
    const shopName = String(d['店名'] || '').trim();
    const shop = shopByName.get(shopName) || {};
    return {
      dishName: d['菜品名称'] || d['菜名'] || d['名称'] || '',
      imageUrl: d['菜品图片url'] || d['图片'] || d['图片url'] || '',
      recommendCount: Number(d['菜品推荐人数'] || d['推荐人数'] || 0),
      shopName,
      shopScore: parseFloat(shop['评分score'] || shop['评分'] || 0),
      shopAvgPrice: parseFloat((shop['人均消费'] || '').toString().replace(/[^\d.]/g, '')),
      shopAddress: shop['地址'] || '',
      shopPhone: shop['电话'] || '',
      shopDetail: shop['详情页'] || shop['链接'] || '',
      shopRecommends: (shop['推荐菜品列表'] || '').split(/[,，]/).map(s => s.trim()).filter(Boolean),
    };
  });

  // Filter
  const filtered = joined.filter(item => {
    if (Number.isFinite(minScore) && item.shopScore < minScore) return false;
    if (Number.isFinite(maxPp) && maxPp > 0 && Number.isFinite(item.shopAvgPrice) && item.shopAvgPrice > maxPp) return false;
    if (keyword) {
      const hay = `${item.dishName} ${item.shopName} ${item.shopAddress}`.toLowerCase();
      if (!hay.includes(keyword)) return false;
    }
    return true;
  });

  // 只在有筛选条件时才排序，初始加载时保持随机顺序
  const hasFilterConditions = keyword || minScore > 0 || (Number.isFinite(maxPp) && maxPp > 0);
  if (hasFilterConditions) {
    // Sort by (score desc, recommendCount desc)
    filtered.sort((a, b) => (b.shopScore - a.shopScore) || (b.recommendCount - a.recommendCount));
  }
  return filtered;
}

function shuffleArray(array) {
  // Fisher-Yates 洗牌算法
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function pickRandom(list, count) {
  const copy = [...list];
  const out = [];
  for (let i = 0; i < count && copy.length > 0; i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function updateStats() {
  els.stats.textContent = `候选 ${state.filtered.length} 项`;
}

function normalizeImage(url) {
  if (!url) return 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="%23121822"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239fb3c8" font-size="14">无图</text></svg>';
  try {
    // Basic sanitize; allow http(s)
    const u = new URL(url, window.location.href);
    if (u.protocol === 'http:' || u.protocol === 'https:') return u.toString();
    return '';
  } catch {
    return '';
  }
}

let pagination = { page: 1, pageSize: 9 };

function render(list = state.filtered) {
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pagination.pageSize));
  if (pagination.page > totalPages) pagination.page = totalPages;
  const start = (pagination.page - 1) * pagination.pageSize;
  const end = Math.min(total, start + pagination.pageSize);
  els.cards.innerHTML = '';
  const frag = document.createDocumentFragment();
  const pageItems = list.slice(start, end);
  for (const item of pageItems) {
    const card = document.createElement('article');
    card.className = 'card';

    const img = document.createElement('img');
    img.className = 'thumb';
    img.loading = 'lazy';
    img.src = normalizeImage(item.imageUrl);
    img.alt = item.dishName || 'Dish';

    const content = document.createElement('div');
    content.className = 'content';

    // 菜品名称 - 单独一行
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = item.dishName || '未命名菜品';

    // 店名 - 单独一行（带图标）
    const shopName = document.createElement('div');
    shopName.className = 'shop-name';
    shopName.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
      <polyline points="9 22 9 12 15 12 15 22"></polyline>
    </svg>
    <span>${item.shopName || '未知店铺'}</span>`;

    // 评分、人均、推荐 - 共用一行
    const meta = document.createElement('div');
    meta.className = 'meta';
    const badges = [
      Number.isFinite(item.shopScore) ? `评分：${item.shopScore.toFixed(1)}` : '评分：未知',
      Number.isFinite(item.shopAvgPrice) ? `人均：¥${item.shopAvgPrice}` : '人均：未知',
      item.recommendCount ? `推荐：${item.recommendCount}` : '',
    ].filter(Boolean);
    for (const b of badges) {
      const span = document.createElement('span');
      span.className = 'badge';
      span.textContent = b;
      meta.appendChild(span);
    }

    // Make entire card clickable to open detail page
    if (item.shopDetail) {
      card.classList.add('clickable');
      card.addEventListener('click', () => {
        window.open(item.shopDetail, '_blank', 'noopener');
      });
    }

    // 收藏按钮和地址 - 共用一行（收藏左对齐，地址右对齐）
    const addressRow = document.createElement('div');
    addressRow.className = 'address-row';
    
    const like = document.createElement('button');
    like.className = 'chip like';
    like.setAttribute('data-tooltip', '收藏');
    like.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
    </svg>`;
    like.addEventListener('click', (e) => { 
      e.stopPropagation(); 
      onFeedback(item, true);
      // 提示用户
      like.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
      </svg>`;
      like.classList.add('liked');
      setTimeout(() => {
        like.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
        </svg>`;
      }, 2000);
    });
    
    const address = document.createElement('div');
    address.className = 'address-text';
    // 只显示前8个字符
    const addressText = item.shopAddress || '';
    const shortAddress = addressText.length > 8 ? addressText.substring(0, 8) : addressText;
    address.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3"></circle>
    </svg>
    <span>${shortAddress}</span>`;
    address.title = item.shopAddress || ''; // 完整地址作为tooltip
    
    addressRow.appendChild(like);
    if (address.textContent) {
      addressRow.appendChild(address);
    }

    content.appendChild(title);
    content.appendChild(shopName);
    content.appendChild(meta);
    content.appendChild(addressRow);

    card.appendChild(img);
    card.appendChild(content);
    frag.appendChild(card);
  }
  els.cards.appendChild(frag);
  const info = document.getElementById('page-info');
  if (info) info.textContent = `${pagination.page} / ${totalPages}（共${total}条）`;
}

function onFilter() {
  state.filtered = joinAndFilter();
  updateStats();
  render();
}

function onRandom() {
  const count = Math.max(1, Math.min(12, parseInt(els.count.value || '3', 10)));
  showSpin(true);
  setTimeout(() => {
    const picked = pickAIPicks(state.filtered, count);
    render(picked);
    showSpin(false);
  }, 450);
}

function onReset() {
  els.keyword.value = '';
  els.minScore.value = '0';
  els.maxPp.value = '';
  els.count.value = '3';
  bubbleState.path = [];
  state.filtered = joinAndFilter();
  updateStats();
  render();
  renderBubbles();
  renderRankings();
}

function keyForItem(item) {
  return `${item.shopName}::${item.dishName}`;
}

function loadPreferences() {
  try {
    const raw = JSON.parse(localStorage.getItem('eat-ai-preferences') || '{}');
    state.preferences.likes = new Set(raw.likes || []);
  } catch {
    state.preferences = { likes: new Set() };
  }
}

function savePreferences() {
  localStorage.setItem('eat-ai-preferences', JSON.stringify({
    likes: Array.from(state.preferences.likes),
  }));
}

function onFeedback(item, isLike) {
  const key = keyForItem(item);
  if (isLike) {
    state.preferences.likes.add(key);
  }
  savePreferences();
  updateFavoriteCount();
}

function updateFavoriteCount() {
  if (els.favoriteCount) {
    els.favoriteCount.textContent = state.preferences.likes.size;
  }
}

async function generateFavoritesSummary() {
  if (!els.favoritesSummary) return;
  
  if (state.preferences.likes.size === 0) {
    els.favoritesSummary.innerHTML = '';
    return;
  }
  
  // 显示加载状态
  els.favoritesSummary.classList.add('loading');
  els.favoritesSummary.innerHTML = '正在分析您的美食偏好...';
  
  const filteredBase = joinAndFilter();
  const favorites = Array.from(state.preferences.likes)
    .map(key => {
      const [shopName, dishName] = key.split('::');
      return filteredBase.find(item => item.shopName === shopName && item.dishName === dishName);
    })
    .filter(Boolean);
  
  if (favorites.length === 0) {
    els.favoritesSummary.innerHTML = '';
    els.favoritesSummary.classList.remove('loading');
    return;
  }
  
  // 准备菜品信息
  const dishInfo = favorites.map(item => `${item.dishName}（${item.shopName}）`).join('、');
  
  const baseUrl = localStorage.getItem('ai.baseUrl') || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const apiKey = localStorage.getItem('ai.apiKey') || 'sk-312b493179ab472587b9b12e78a26a2e';
  const model = localStorage.getItem('ai.summaryModel') || 'qwen-flash';
  
  const systemPrompt = `你是一位专业的美食品鉴师。请根据用户收藏的菜品，分析用户的美食偏好，用简短、友好的语言总结（60字以内）。
  
  例如："您似乎偏爱川菜和火锅，喜欢麻辣浓郁的口味，同时也注重食材的新鲜度。"
  
  只输出总结文字，不要有其他内容。`;
  
  const userPrompt = `我收藏的菜品有：${dishInfo}`;
  
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        stream: false,
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || '您有着独特的美食品味！';
    
    els.favoritesSummary.classList.remove('loading');
    els.favoritesSummary.innerHTML = `<strong>💡 您的美食偏好：</strong>${summary}`;
  } catch (error) {
    console.error('Failed to generate summary:', error);
    els.favoritesSummary.classList.remove('loading');
    els.favoritesSummary.innerHTML = '';
  }
}

function renderFavoritesList() {
  if (!els.favoritesList) return;
  
  els.favoritesList.innerHTML = '';
  
  if (state.preferences.likes.size === 0) {
    els.favoritesList.innerHTML = '<div style="text-align: center; color: var(--muted); padding: 40px 20px;">还没有收藏任何菜品<br/>点击菜品卡片上的❤️按钮即可收藏</div>';
    return;
  }
  
  const filteredBase = joinAndFilter();
  const favorites = Array.from(state.preferences.likes)
    .map(key => {
      const [shopName, dishName] = key.split('::');
      return filteredBase.find(item => item.shopName === shopName && item.dishName === dishName);
    })
    .filter(Boolean);
  
  favorites.forEach(item => {
    const div = document.createElement('div');
    div.className = 'favorite-item';
    div.innerHTML = `
      <img src="${normalizeImage(item.imageUrl)}" alt="${item.dishName}" />
      <div class="favorite-item-info">
        <div class="favorite-item-name">${item.dishName}</div>
        <div class="favorite-item-shop">${item.shopName}</div>
      </div>
      <button class="btn-remove-favorite" title="取消收藏">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;
    
    // 点击项目跳转详情
    div.addEventListener('click', (e) => {
      if (!e.target.closest('.btn-remove-favorite') && item.shopDetail) {
        window.open(item.shopDetail, '_blank', 'noopener');
      }
    });
    
    // 取消收藏
    const btnRemove = div.querySelector('.btn-remove-favorite');
    btnRemove.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = keyForItem(item);
      state.preferences.likes.delete(key);
      savePreferences();
      updateFavoriteCount();
      renderFavoritesList();
    });
    
    els.favoritesList.appendChild(div);
  });
}

function scoreItem(item) {
  // Base score from shopScore and recommendCount
  let score = (Number.isFinite(item.shopScore) ? item.shopScore : 0) * 1.0 + (item.recommendCount || 0) * 0.01;
  const key = keyForItem(item);
  if (state.preferences.likes.has(key)) score += 2.5;
  // Light bonus if dish name appears in shop recommended list
  if (item.shopRecommends && item.shopRecommends.some(x => x && item.dishName.includes(x))) score += 0.5;
  return score;
}

function pickAIPicks(list, count) {
  const scored = list.map(item => ({ item, s: scoreItem(item) }));
  scored.sort((a, b) => b.s - a.s);
  // Mix top-k with some randomness
  const top = Math.max(count * 2, 6);
  const pool = scored.slice(0, Math.min(top, scored.length)).map(x => x.item);
  return pickRandom(pool, count);
}

function showSpin(show) {
  const el = document.getElementById('spin-overlay');
  if (!el) return;
  el.classList.toggle('show', !!show);
}

function onDishSearch() {
  const query = (els.dishSearchInput?.value || '').trim();
  if (!query) return;
  
  // 重置气泡路径
  bubbleState.path = [];
  
  // 模糊搜索菜品名
  const base = joinAndFilter();
  const searchResults = base.filter(item => 
    item.dishName.toLowerCase().includes(query.toLowerCase())
  );
  
  if (searchResults.length === 0) {
    alert(`未找到包含"${query}"的菜品`);
    return;
  }
  
  state.filtered = searchResults;
  updateStats();
  render();
  renderBubbles();
}

function wireUi() {
  const prev = document.getElementById('page-prev');
  const next = document.getElementById('page-next');
  if (prev) prev.addEventListener('click', () => { pagination.page = Math.max(1, pagination.page - 1); render(); });
  if (next) next.addEventListener('click', () => { pagination.page = pagination.page + 1; render(); });
  if (els.btnAiReco) els.btnAiReco.addEventListener('click', onAiRecommend);
  
  // Tab 切换逻辑
  initSearchTabs();
  
  // 菜品搜索
  if (els.btnDishSearch) {
    els.btnDishSearch.addEventListener('click', onDishSearch);
  }
  if (els.dishSearchInput) {
    els.dishSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') onDishSearch();
    });
  }
  
  // AI配置弹窗
  if (els.btnSettings) {
    els.btnSettings.addEventListener('click', () => {
      // 加载当前配置
      if (els.aiBaseUrlModal) els.aiBaseUrlModal.value = localStorage.getItem('ai.baseUrl') || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
      if (els.aiApiKeyModal) els.aiApiKeyModal.value = localStorage.getItem('ai.apiKey') || 'sk-312b493179ab472587b9b12e78a26a2e';
      if (els.aiRecommendModelModal) els.aiRecommendModelModal.value = localStorage.getItem('ai.recommendModel') || 'qwen-plus';
      if (els.aiSummaryModelModal) els.aiSummaryModelModal.value = localStorage.getItem('ai.summaryModel') || 'qwen-flash';
      // 显示弹窗
      if (els.aiConfigModal) els.aiConfigModal.classList.add('show');
    });
  }
  
  // 关闭弹窗
  const closeModal = () => {
    if (els.aiConfigModal) els.aiConfigModal.classList.remove('show');
  };
  
  if (els.btnCloseModal) els.btnCloseModal.addEventListener('click', closeModal);
  if (els.btnCancelConfig) els.btnCancelConfig.addEventListener('click', closeModal);
  
  // 点击遮罩层关闭
  if (els.aiConfigModal) {
    els.aiConfigModal.addEventListener('click', (e) => {
      if (e.target === els.aiConfigModal || e.target.classList.contains('modal-overlay')) {
        closeModal();
      }
    });
  }
  
  // 保存配置
  if (els.btnSaveConfig) {
    els.btnSaveConfig.addEventListener('click', () => {
      const baseUrl = els.aiBaseUrlModal?.value?.trim() || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
      const apiKey = els.aiApiKeyModal?.value?.trim() || '';
      const recommendModel = els.aiRecommendModelModal?.value?.trim() || 'qwen-plus';
      const summaryModel = els.aiSummaryModelModal?.value?.trim() || 'qwen-flash';
      localStorage.setItem('ai.baseUrl', baseUrl);
      localStorage.setItem('ai.apiKey', apiKey);
      localStorage.setItem('ai.recommendModel', recommendModel);
      localStorage.setItem('ai.summaryModel', summaryModel);
      if (els.aiTip) els.aiTip.textContent = 'AI 配置已保存 ✓';
      closeModal();
    });
  }
  
  // 收藏列表弹窗
  if (els.btnFavorites) {
    els.btnFavorites.addEventListener('click', async () => {
      renderFavoritesList();
      if (els.favoritesModal) els.favoritesModal.classList.add('show');
      // 生成收藏总结
      await generateFavoritesSummary();
    });
  }
  
  if (els.btnCloseFavorites) {
    els.btnCloseFavorites.addEventListener('click', () => {
      if (els.favoritesModal) els.favoritesModal.classList.remove('show');
    });
  }
  
  if (els.favoritesModal) {
    els.favoritesModal.addEventListener('click', (e) => {
      if (e.target === els.favoritesModal || e.target.classList.contains('modal-overlay')) {
        els.favoritesModal.classList.remove('show');
      }
    });
  }
}

function updateDateTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', { 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit',
    weekday: 'short'
  });
  const timeStr = now.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
  
  const datetimeEl = document.getElementById('current-datetime');
  if (datetimeEl) {
    datetimeEl.textContent = `${dateStr} ${timeStr}`;
  }
}

// 全局变量存储天气数据和位置信息
let currentWeatherData = { weather: '晴', temperature: 25 };
let currentLocationData = { city: '杭州市', district: '', address: '' };

// 使用GPS定位（浏览器geolocation API）
async function getGPSLocation() {
  console.log('📍 尝试GPS定位...');
  
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      console.warn('⚠️ 浏览器不支持GPS定位');
      reject(new Error('浏览器不支持GPS定位'));
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        
        console.log(`📍 GPS定位成功: lat=${lat}, lon=${lon}`);
        
        // 调用逆地理编码API获取详细地址
        try {
          const response = await fetch(`http://localhost:5000/api/geocode?lat=${lat}&lon=${lon}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
          console.log('📦 逆地理编码响应:', data);
    
    if (data.status === 0 && data.content) {
            const detail = data.content.address_detail;
            const address = data.content.address;
            
            console.log(`✅ GPS定位成功: ${address} (来源: ${data.source})`);
            resolve({
              city: detail.city,
              district: detail.district,
              street: detail.street,
              address: address,
              type: 'gps',
              source: data.source,
              coords: { lat, lon }
            });
          } else {
            throw new Error('逆地理编码失败');
          }
  } catch (error) {
          console.error('❌ 逆地理编码失败:', error);
          reject(error);
        }
      },
      (error) => {
        console.error('❌ GPS定位失败:', error.message);
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  });
}

// 使用IP定位（通过后端代理，使用 ip-api.com）
// IP定位功能已禁用，只使用GPS精确定位
// async function getIPLocation() {
//   console.log('🌐 尝试IP定位...');
//   
//   try {
//     // 使用后端代理API（解决CORS问题）
//     const response = await fetch('http://localhost:5000/api/ip-location');
//     
//     if (!response.ok) {
//       throw new Error(`HTTP ${response.status}`);
//     }
//     
//     const data = await response.json();
//     console.log('📦 IP定位响应:', data);
//     
//     if (data.status === 0 && data.content) {
//       const city = data.content.address_detail.city || data.content.address_detail.province;
//       const district = data.content.address_detail.district || '';
//       
//       console.log(`✅ IP定位成功: ${city} ${district} (来源: ${data.source || 'ip-api.com'})`);
//       return {
//         city: city,
//         district: district,
//         address: data.content.address || `${city} ${district}`,
//         type: 'ip',
//         source: data.source || 'ip-api.com'
//       };
//     }
//     
//     throw new Error('IP定位数据格式错误');
//   } catch (error) {
//     console.error('❌ IP定位失败:', error);
//     return null;
//   }
// }

// 获取用户实时位置（仅使用GPS精确定位）
async function updateLocation() {
  const locationEl = document.getElementById('current-location');
  if (!locationEl) {
    console.error('❌ 位置元素未找到');
    return;
  }
  
  console.log('🔍 开始获取GPS定位...');
  locationEl.textContent = '正在定位...';
  locationEl.title = '正在获取精确位置...';
  
  // 只使用GPS定位
  try {
    const location = await getGPSLocation();
    
    if (location) {
      // GPS定位成功，显示完整的详细地址
      const fullAddress = location.address || `${location.city} ${location.district || ''}`;
      locationEl.textContent = fullAddress;
      locationEl.title = `GPS精确定位 - 点击刷新`;
      
      currentLocationData = location;
      
      console.log(`✅ GPS定位成功: ${location.address}`);
    
    // 更新天气
      updateWeather(location.city);
      return;
    }
  } catch (error) {
    console.error('❌ GPS定位失败:', error);
    
    // GPS定位失败，显示错误提示
    locationEl.textContent = '定位失败';
    locationEl.title = '无法获取位置，请确保已授权定位权限（点击刷新页面重试）';
    
    // 使用默认天气
    updateWeather('杭州市');
  }
}

async function updateWeather(cityName = '杭州') {
  const weatherEl = document.getElementById('current-weather');
  if (!weatherEl) return;
  
  try {
    // 使用天气API
    const city = cityName || currentLocationData.city || 'Hangzhou';
    const response = await fetch(`https://wttr.in/${city}?format=j1`);
    const data = await response.json();
    
    if (data && data.current_condition && data.current_condition[0]) {
      const current = data.current_condition[0];
      const weatherDesc = current.lang_zh?.[0]?.value || current.weatherDesc[0].value;
      const temp = current.temp_C;
      
      currentWeatherData = {
        weather: weatherDesc,
        temperature: parseInt(temp)
      };
      
      const weatherEmoji = getWeatherEmoji(weatherDesc);
      weatherEl.innerHTML = `${weatherEmoji} ${weatherDesc} ${temp}°C`;
    } else {
      weatherEl.innerHTML = `☀️ ${currentWeatherData.temperature}°C`;
    }
  } catch (error) {
    console.error('获取天气失败:', error);
    weatherEl.innerHTML = `☀️ ${currentWeatherData.temperature}°C`;
  }
}

function getWeatherEmoji(weather) {
  if (weather.includes('晴')) return '☀️';
  if (weather.includes('云') || weather.includes('阴')) return '☁️';
  if (weather.includes('雨')) return '🌧️';
  if (weather.includes('雪')) return '❄️';
  if (weather.includes('雾') || weather.includes('霾')) return '🌫️';
  if (weather.includes('雷')) return '⛈️';
  return '🌡️';
}

// -------- 启动加载页流程 --------
async function initSplashScreen() {
  const splashScreen = document.getElementById('splash-screen');
  const statusText = document.getElementById('splash-status-text');
  const statusDetail = document.getElementById('splash-status-detail');
  const progressFill = document.getElementById('splash-progress-fill');
  const authButton = document.getElementById('splash-auth-button');
  
  if (!splashScreen) {
    // 如果没有启动页，直接初始化主程序
    init();
    return;
  }
  
  try {
    // 步骤1: 等待用户点击授权按钮
    console.log('🚀 启动页：等待用户授权');
    statusText.textContent = '需要获取您的位置信息';
    statusDetail.textContent = '为了给您推荐附近的美食';
    progressFill.style.width = '0%';
    
    // 确保按钮显示
    if (authButton) {
      authButton.style.display = 'inline-flex';
    }
    
    // 等待用户点击按钮
    await new Promise((resolve) => {
      authButton.addEventListener('click', () => {
        console.log('✅ 用户点击授权按钮');
        // 隐藏按钮
        authButton.style.display = 'none';
        resolve();
      }, { once: true });
    });
    
    // 步骤2: 请求GPS定位权限（0-30%）
    console.log('🚀 启动页：请求GPS定位权限');
    statusText.textContent = '正在请求定位权限...';
    statusDetail.textContent = '请在浏览器弹窗中点击"允许"';
    progressFill.style.width = '10%';
    
    // 随机延迟 600-1000ms
    await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400));
    
    // 步骤3: 获取GPS定位（30-100%）
    console.log('📍 启动页：获取GPS定位');
    statusText.textContent = '正在获取您的位置...';
    statusDetail.textContent = '这可能需要几秒钟...';
    progressFill.style.width = '30%';
    
    let locationData = null;
    let gpsError = null;
    
    // 只使用GPS定位（不降级到IP）
    try {
      locationData = await getGPSLocation();
      progressFill.style.width = '50%';
    } catch (error) {
      gpsError = error;
      console.error('❌ GPS定位失败:', error);
      progressFill.style.width = '40%';
    }
    
    // 如果GPS定位失败，显示错误提示
    if (!locationData) {
      console.log('⚠️ GPS定位失败，显示授权引导');
      
      // 判断失败原因
      let errorTitle = '📍 需要位置权限';
      let errorMessage = '';
      let errorInstructions = '';
      
      if (gpsError && gpsError.code === 1) {
        // 用户拒绝了权限
        errorTitle = '❌ 位置权限被拒绝';
        errorMessage = '您需要授权位置信息才能使用本应用';
        errorInstructions = getLocationPermissionInstructions();
      } else if (gpsError && gpsError.code === 2) {
        // 位置不可用
        errorTitle = '⚠️ 位置信息不可用';
        errorMessage = '设备无法获取位置信息，请检查GPS是否开启';
        errorInstructions = '请确保设备GPS已开启，然后刷新页面重试';
      } else if (gpsError && gpsError.code === 3) {
        // 超时
        errorTitle = '⏱️ 获取位置超时';
        errorMessage = '获取位置信息超时';
        errorInstructions = getLocationTimeoutHelp();
      } else {
        // 其他错误
        errorTitle = '⚠️ 无法获取位置';
        errorMessage = '请授权位置信息后刷新页面';
        errorInstructions = getLocationPermissionInstructions();
      }
      
      // 显示错误界面
      statusText.innerHTML = errorTitle;
      statusDetail.innerHTML = `
        <div style="margin-top: 20px; line-height: 1.8; max-height: 70vh; overflow-y: auto;">
          <p style="font-size: 16px; margin: 0 0 15px 0;">${errorMessage}</p>
          <div style="text-align: left; max-width: 600px; margin: 0 auto; font-size: 14px; opacity: 0.95;">
            ${errorInstructions}
          </div>
          <button onclick="location.reload()" style="
            margin-top: 30px;
            padding: 12px 32px;
            font-size: 16px;
            font-weight: 600;
            color: #667eea;
            background: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: transform 0.2s, box-shadow 0.2s;
          " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 16px rgba(0,0,0,0.2)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)';">
            🔄 刷新页面
          </button>
        </div>
      `;
      progressFill.style.width = '0%';
      progressFill.style.background = '#ff6b6b'; // 红色表示错误
      
      // 隐藏加载动画
      const spinner = document.querySelector('.splash-status .spinner');
      if (spinner) {
        spinner.style.display = 'none';
      }
      
      // 不再继续流程
      return;
    }
    
    // 保存定位数据
    currentLocationData = locationData;
    
    // 步骤3: 显示定位结果（60-65%）
    const locationText = locationData.address || locationData.city || '您的位置';
    console.log(`✅ 启动页：定位成功 - ${locationText}`);
    statusText.innerHTML = `已获取您的定位<br><span style="color: var(--brand-2); font-size: 15px; font-weight: 600;">${locationText}</span>`;
    statusDetail.textContent = '正在分析您的位置信息...';
    progressFill.style.width = '65%';
    
    // 随机延迟 1000-1500ms
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 500));
    
    // 步骤4: 分析周边环境（65-75%）- 保持定位信息显示
    console.log('🗺️ 启动页：分析周边环境');
    statusText.innerHTML = `已获取您的定位<br><span style="color: var(--brand-2); font-size: 15px; font-weight: 600;">${locationText}</span>`;
    statusDetail.textContent = '正在分析周边环境，查找附近的美食商圈...';
    progressFill.style.width = '75%';
    
    // 随机延迟 1200-1800ms
    await new Promise(resolve => setTimeout(resolve, 1200 + Math.random() * 600));
    
    // 步骤5: 加载美食数据（75-90%）- 保持定位信息显示
    console.log('🍜 启动页：加载美食数据');
    statusText.innerHTML = `已获取您的定位<br><span style="color: var(--brand-2); font-size: 15px; font-weight: 600;">${locationText}</span>`;
    statusDetail.textContent = '正在加载美食推荐，基于您的位置为您精选...';
    progressFill.style.width = '90%';
    
    // 随机延迟 1500-2200ms
    await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 700));
    
    // 步骤6: 完成（90-100%）- 保持定位信息显示
    console.log('🎉 启动页：加载完成');
    statusText.innerHTML = `已获取您的定位<br><span style="color: var(--brand-2); font-size: 15px; font-weight: 600;">${locationText}</span>`;
    statusDetail.textContent = '准备就绪！为您找到了周边的精选美食';
    progressFill.style.width = '100%';
    
    // 随机延迟 600-1000ms
    await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400));
    
    // 隐藏启动页
    splashScreen.classList.add('hidden');
    
    // 等待动画完成后初始化主程序
    setTimeout(() => {
      init();
    }, 800);
    
  } catch (error) {
    console.error('❌ 启动页出错:', error);
    // 出错显示提示
    statusText.textContent = '⚠️ 初始化失败';
    statusDetail.innerHTML = `
      <p style="margin: 20px 0;">请刷新页面重试</p>
      <button onclick="location.reload()" style="
        padding: 12px 32px;
        font-size: 16px;
        font-weight: 600;
        color: #667eea;
        background: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      ">
        🔄 刷新页面
      </button>
    `;
    progressFill.style.width = '0%';
  }
}

// 获取位置权限设置指引（根据不同浏览器）
function getLocationPermissionInstructions() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isChrome = userAgent.includes('chrome') && !userAgent.includes('edge');
  const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');
  const isFirefox = userAgent.includes('firefox');
  const isEdge = userAgent.includes('edge');
  
  if (isChrome) {
    return `
      <p><strong>Chrome浏览器设置方法：</strong></p>
      <ol style="text-align: left; padding-left: 20px;">
        <li>点击地址栏左侧的 <strong>🔒 锁图标</strong></li>
        <li>找到"位置"选项</li>
        <li>选择 <strong>"允许"</strong></li>
        <li>刷新页面即可</li>
      </ol>
    `;
  } else if (isSafari) {
    return `
      <p><strong>Safari浏览器设置方法：</strong></p>
      <ol style="text-align: left; padding-left: 20px;">
        <li>打开 <strong>系统偏好设置</strong></li>
        <li>选择 <strong>安全性与隐私</strong></li>
        <li>点击 <strong>隐私</strong> 标签</li>
        <li>选择 <strong>定位服务</strong></li>
        <li>确保Safari已勾选</li>
        <li>刷新页面即可</li>
      </ol>
    `;
  } else if (isFirefox) {
    return `
      <p><strong>Firefox浏览器设置方法：</strong></p>
      <ol style="text-align: left; padding-left: 20px;">
        <li>点击地址栏左侧的 <strong>🛡️ 图标</strong></li>
        <li>找到"位置"权限</li>
        <li>点击 <strong>×</strong> 清除阻止</li>
        <li>刷新页面重新授权</li>
      </ol>
    `;
  } else if (isEdge) {
    return `
      <p><strong>Edge浏览器设置方法：</strong></p>
      <ol style="text-align: left; padding-left: 20px;">
        <li>点击地址栏右侧的 <strong>🔒 图标</strong></li>
        <li>找到"位置"选项</li>
        <li>选择 <strong>"允许"</strong></li>
        <li>刷新页面即可</li>
      </ol>
    `;
  } else {
    return `
      <p><strong>通用设置方法：</strong></p>
      <ol style="text-align: left; padding-left: 20px;">
        <li>点击地址栏的 <strong>权限图标</strong></li>
        <li>找到"位置"或"定位"选项</li>
        <li>选择 <strong>"允许"</strong></li>
        <li>刷新页面即可</li>
      </ol>
      <p style="margin-top: 15px; font-size: 13px;">如果找不到选项，请查看浏览器的"设置 → 隐私和安全 → 网站设置 → 位置"</p>
    `;
  }
}

// 获取定位超时的帮助信息
function getLocationTimeoutHelp() {
  return `
    <div style="text-align: left; max-width: 500px; margin: 0 auto;">
      <p style="font-size: 14px; margin-bottom: 15px; text-align: center;">
        <strong>常见原因及解决方案：</strong>
      </p>
      
      <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
        <p style="font-size: 14px; margin: 0 0 10px 0;">
          <strong>🔴 网络环境问题</strong>
        </p>
        <ul style="font-size: 13px; margin: 0; padding-left: 20px; line-height: 1.8;">
          <li><strong>虚拟机环境：</strong>虚拟机的网络配置可能导致定位不可用<br/>
              → <span style="color: #4ade80;">建议在宿主机上运行</span></li>
          <li><strong>公司网络：</strong>公司防火墙可能屏蔽定位服务<br/>
              → <span style="color: #4ade80;">尝试切换到手机热点或家庭网络</span></li>
          <li><strong>VPN环境：</strong>VPN可能影响定位精度<br/>
              → <span style="color: #4ade80;">尝试断开VPN</span></li>
        </ul>
      </div>
      
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 12px; border-radius: 8px; text-align: center;">
        <p style="font-size: 13px; margin: 0; color: white;">
          💡 <strong>快速解决：</strong>如果在虚拟机或公司网络中，用手机开热点连接后重试！
        </p>
      </div>
    </div>
  `;
}

function init() {
  wireUi();
  loadPreferences();
  updateFavoriteCount();
  // Auto attempt loading on start for convenience
  tryAutoLoad();
  renderBubbles();
  renderRankings();
  initNotes();
  initRecipes();  // 初始化菜谱功能
  initRecipeDetailModal();  // 初始化菜谱详情弹窗
  initNoteDetailModal();  // 初始化笔记详情弹窗
  
  // 更新日期时间、位置和天气（启动页已经获取了定位）
  updateDateTime();
  
  // 如果启动页已获取定位，更新显示
  const locationEl = document.getElementById('current-location');
  if (locationEl && currentLocationData) {
    // 显示完整的详细地址
    const fullAddress = currentLocationData.address || `${currentLocationData.city} ${currentLocationData.district || ''}`;
    locationEl.textContent = fullAddress;
    locationEl.title = `GPS精确定位 - 点击刷新`;
    
    // 更新天气
    updateWeather(currentLocationData.city);
  } else {
    // 启动页没有获取到定位（理论上不会发生，因为启动页会阻塞）
    locationEl.textContent = '定位失败';
    locationEl.title = '请刷新页面重新授权定位';
    updateWeather('杭州市');
  }
  
  // 添加位置点击刷新功能
  if (locationEl) {
    locationEl.style.cursor = 'pointer';
    locationEl.addEventListener('click', () => {
      console.log('🔄 用户点击刷新页面重新定位');
      if (confirm('刷新页面以重新获取GPS定位？')) {
        location.reload();
      }
    });
  }
  
  // 每秒更新时间
  setInterval(updateDateTime, 1000);
  // 如果需要更新，用户可以点击位置信息
  
  // 每10分钟更新天气
  setInterval(updateWeather, 10 * 60 * 1000);
}

// -------- Rankings with Auto-scroll --------
const rankingState = {
  dishScrollIndex: 0,
  shopScrollIndex: 0,
  dishInterval: null,
  shopInterval: null,
};

function renderRankings() {
  if (!els.dishRanking || !els.shopRanking) {
    console.log('Ranking elements not found:', { dishRanking: els.dishRanking, shopRanking: els.shopRanking });
    return;
  }
  
  console.log('Rendering rankings with', state.dishes.length, 'dishes');
  
  // 榜单一：根据菜品推荐人数排行
  const dishRankingFull = state.dishes
    .map(d => ({
      name: d['菜品名称'] || d['菜名'] || d['名称'] || '未命名菜品',
      shopName: d['店名'] || '未知店铺',
      count: Number(d['菜品推荐人数'] || d['推荐人数'] || 0),
      imageUrl: d['菜品图片url'] || d['图片'] || d['图片url'] || ''
    }))
    .sort((a, b) => (b.count - a.count));

  // 如果过滤后为空，使用未过滤的前N个
  const dishLimit = 20; // 固定20，2列展示
  const dishSlice = (dishRankingFull.filter(d => d.count > 0).length > 0
    ? dishRankingFull.filter(d => d.count > 0)
    : dishRankingFull).slice(0, Math.max(dishLimit, 10));

  els.dishRanking.innerHTML = '';
  const dishInner = document.createElement('div');
  dishInner.className = 'ranking-list-inner';
  dishSlice.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'ranking-item';
    div.dataset.index = index;
    div.innerHTML = `
      <span class="rank">${index + 1}</span>
      <img class="dish-img" src="${normalizeImage(item.imageUrl)}" alt="${item.name}" />
      <span class="name">${item.name}</span>
      <span class="count">${item.count}人推荐</span>
    `;
    // 点击跳转
    div.addEventListener('click', () => {
      const shop = state.shops.find(s => s['店名'] === item.shopName);
      if (shop && shop['详情页']) window.open(shop['详情页'], '_blank', 'noopener');
    });
    dishInner.appendChild(div);
  });
  els.dishRanking.appendChild(dishInner);

  // 榜单二：根据店铺所有菜品推荐人数之和排行
  const shopTotals = new Map();
  const shopDishes = new Map();
  for (const d of state.dishes) {
    const shopName = d['店名'] || '未知店铺';
    const count = Number(d['菜品推荐人数'] || d['推荐人数'] || 0);
    shopTotals.set(shopName, (shopTotals.get(shopName) || 0) + count);
    if (!shopDishes.has(shopName)) shopDishes.set(shopName, []);
    shopDishes.get(shopName).push({
      name: d['菜品名称'] || d['菜名'] || d['名称'] || '未命名菜品',
      count,
      imageUrl: d['菜品图片url'] || d['图片'] || d['图片url'] || ''
    });
  }
  let shopRanking = Array.from(shopTotals.entries())
    .map(([shopName, totalCount]) => ({
      name: shopName,
      count: totalCount,
      topDishes: (shopDishes.get(shopName) || [])
        .sort((a, b) => (b.count - a.count))
        .slice(0, 3)
    }))
    .sort((a, b) => (b.count - a.count));
  // 同样增加兜底：若总数均为0，仍展示前N个
  if (!shopRanking.some(s => s.count > 0)) {
    shopRanking = shopRanking.slice(0, 10);
  }
  const shopLimit = 10; // 固定10，一列展示
  els.shopRanking.innerHTML = '';
  const shopInner = document.createElement('div');
  shopInner.className = 'ranking-list-inner';
  shopRanking.slice(0, Math.max(shopLimit, 5)).forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'shop-item';
    div.dataset.index = index;
    const topDishesHtml = (item.topDishes || []).map(dish => `
      <div class="top-dish" data-shop-name="${item.name}">
        <img src="${normalizeImage(dish.imageUrl)}" alt="${dish.name}" />
        <div class="dish-name">${dish.name}</div>
      </div>
    `).join('');
    div.innerHTML = `
      <div class="shop-header">
        <span class="shop-rank">${index + 1}</span>
        <span class="shop-name">${item.name}</span>
        <span class="shop-count">${item.count}人推荐</span>
      </div>
      <div class="top-dishes">${topDishesHtml}</div>
    `;
    const topDishElements = div.querySelectorAll('.top-dish');
    topDishElements.forEach(dishElement => {
      dishElement.addEventListener('click', () => {
        const shopName = dishElement.dataset.shopName;
        const shop = state.shops.find(s => s['店名'] === shopName);
        if (shop && shop['详情页']) window.open(shop['详情页'], '_blank', 'noopener');
      });
    });
    shopInner.appendChild(div);
  });
  els.shopRanking.appendChild(shopInner);
  
  // 启动自动轮播
  startRankingCarousel();
}

function startRankingCarousel() {
  // 清除旧的interval
  if (rankingState.dishInterval) clearInterval(rankingState.dishInterval);
  if (rankingState.shopInterval) clearInterval(rankingState.shopInterval);
  
  const dishItems = els.dishRanking.querySelectorAll('.ranking-item');
  const shopItems = els.shopRanking.querySelectorAll('.shop-item');
  
  // 菜品榜单轮播函数（使用淡入淡出效果）
  const rotateDish = () => {
    const items = els.dishRanking.querySelectorAll('.ranking-item');
    if (items.length === 0) return;
    
    // 移除所有高亮，添加淡出效果
    items.forEach(item => {
      item.classList.remove('highlighted');
      item.classList.add('fade-out');
    });
    
    // 下一个索引
    rankingState.dishScrollIndex = (rankingState.dishScrollIndex + 1) % items.length;
    const currentItem = items[rankingState.dishScrollIndex];
    
    // 高亮当前项
    if (currentItem) {
      currentItem.classList.remove('fade-out');
      currentItem.classList.add('highlighted');
      
      // 滚动到当前项（居中显示）
      const container = els.dishRanking;
      const itemTop = currentItem.offsetTop;
      const containerHeight = container.clientHeight;
      const itemHeight = currentItem.clientHeight;
      const scrollTop = Math.max(0, itemTop - (containerHeight / 2) + (itemHeight / 2));
      container.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }
  };
  
  // 启动菜品榜单轮播（每5秒固定切换一项）
  if (dishItems.length > 0) {
    // 初始化：设置索引为最后一个，这样第一次调用rotateDish时会变成0（第一个）
    rankingState.dishScrollIndex = dishItems.length - 1;
    // 立即高亮第一个项目
    dishItems.forEach((item, index) => {
      if (index === 0) {
        item.classList.add('highlighted');
        item.classList.remove('fade-out');
      } else {
        item.classList.remove('highlighted');
        item.classList.add('fade-out');
      }
    });
    rankingState.dishInterval = setInterval(rotateDish, 5000);
  }
  
  // 菜品榜单鼠标滚动监听
  if (els.dishRanking) {
    els.dishRanking.addEventListener('scroll', () => {
      const container = els.dishRanking;
      const items = container.querySelectorAll('.ranking-item');
      if (items.length === 0) return;
      
      // 找到当前视口中最接近中心的项
      const containerTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const centerY = containerTop + containerHeight / 2;
      
      let closestIndex = 0;
      let minDistance = Infinity;
      
      items.forEach((item, index) => {
        const itemTop = item.offsetTop;
        const itemHeight = item.offsetHeight;
        const itemCenter = itemTop + itemHeight / 2;
        const distance = Math.abs(itemCenter - centerY);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });
      
      // 更新轮播索引
      rankingState.dishScrollIndex = closestIndex;
      
      // 高亮最接近的项
      items.forEach((item, index) => {
        if (index === closestIndex) {
          item.classList.remove('fade-out');
          item.classList.add('highlighted');
        } else {
          item.classList.remove('highlighted');
          item.classList.add('fade-out');
        }
      });
    });
  }
  
  // 店铺榜单轮播函数（使用淡入淡出效果）
  const rotateShop = () => {
    const items = els.shopRanking.querySelectorAll('.shop-item');
    if (items.length === 0) return;
    
    // 移除所有高亮，添加淡出效果
    items.forEach(item => {
      item.classList.remove('highlighted');
      item.classList.add('fade-out');
    });
    
    // 下一个索引
    rankingState.shopScrollIndex = (rankingState.shopScrollIndex + 1) % items.length;
    const currentItem = items[rankingState.shopScrollIndex];
    
    // 高亮当前项
    if (currentItem) {
      currentItem.classList.remove('fade-out');
      currentItem.classList.add('highlighted');
      
      // 滚动到当前项（居中显示）
      const container = els.shopRanking;
      const itemTop = currentItem.offsetTop;
      const containerHeight = container.clientHeight;
      const itemHeight = currentItem.clientHeight;
      const scrollTop = Math.max(0, itemTop - (containerHeight / 2) + (itemHeight / 2));
      container.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }
  };
  
  // 启动店铺榜单轮播（每8秒固定切换一项）
  if (shopItems.length > 0) {
    rankingState.shopInterval = setInterval(rotateShop, 8000);
  }
  
  // 店铺榜单鼠标滚动监听
  if (els.shopRanking) {
    els.shopRanking.addEventListener('scroll', () => {
      const container = els.shopRanking;
      const items = container.querySelectorAll('.shop-item');
      if (items.length === 0) return;
      
      // 找到当前视口中最接近中心的项
      const containerTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const centerY = containerTop + containerHeight / 2;
      
      let closestIndex = 0;
      let minDistance = Infinity;
      
      items.forEach((item, index) => {
        const itemTop = item.offsetTop;
        const itemHeight = item.offsetHeight;
        const itemCenter = itemTop + itemHeight / 2;
        const distance = Math.abs(itemCenter - centerY);
        
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });
      
      // 更新轮播索引
      rankingState.shopScrollIndex = closestIndex;
      
      // 高亮最接近的项
      items.forEach((item, index) => {
        if (index === closestIndex) {
          item.classList.remove('fade-out');
          item.classList.add('highlighted');
        } else {
          item.classList.remove('highlighted');
          item.classList.add('fade-out');
        }
      });
    });
  }
}
// -------- Keyword bubble explorer --------
const bubbleState = {
  tokens: [], // all tokens from dishName
  path: [],   // [level1, level2] then dish names at level3
  level: 1,
  theme: '',  // current level1 seed
};

const LEVEL1_SEEDS = [
  '辣的让你爽', '香的让你睡', '人间烟火气', '夜有所胖', '解馋必点', '下饭灵魂', 
  '鲜香快乐', '暖胃治愈', '夏日清爽', '硬核肉食', '素食也香', '海鲜盛宴',
  '地道家常', '异域风情', '汤汤水水', '烧烤江湖',
  '深夜放毒', '早餐能量', '霸气巨无霸', '精致小份菜', '甜品终结者',
  '酸爽开胃王', '川湘麻辣魂', '东北硬菜', '粤式清新', '小吃一条街',
  '网红打卡款', '妈妈的味道', '减肥失败款', '快手炒菜', '低卡轻食',
  '养生佳品', '醉酒必备', '宵夜yyds', '早茶小点心', '米饭杀手', '面条爱好者',
  '饺子宇宙', '小龙虾天堂', '火锅爱好者', '吃出回忆杀', '包子馒头', '饼类专场',
  '蒸的健康', '炸的酥脆', '煮的软烂', '烤的焦香', '凉拌清新',
  '油泼辣子', '蘸料灵魂', '酱香浓郁', '越吃越上头'
];

function getThemeFilter(seed) {
  // Returns a predicate over dish name for level1 theme → restricts level2 candidates
  const byIncludes = (keywords) => (name) => keywords.some(k => name.includes(k));
  switch (seed) {
    case '素食也香':
      return byIncludes(['素', '素食', '素菜', '蔬菜', '清炒', '凉拌', '沙拉', '菌', '豆腐', '青菜', '茄子', '土豆', '西蓝花', '西兰花', '菜花']);
    case '硬核肉食':
      return byIncludes(['牛', '羊', '猪', '鸡', '鸭', '鹅', '肉', '排', '肘子', '肉夹馍', '烤肉', '牛排']);
    case '辣的让你爽':
      return byIncludes(['辣', '麻辣', '香辣', '剁椒', '椒麻', '重庆', '川', '湘', '火锅', '酸辣']);
    case '香的让你睡':
      return byIncludes(['葱香', '蒜香', '椒盐', '葱油', '酥香', '芝麻', '孜然', '奶香']);
    case '人间烟火气':
      return byIncludes(['小炒', '小吃', '家常', '快餐', '便当', '盖饭', '卤味', '拌饭', '简餐']);
    case '夜有所胖':
      return byIncludes(['烧烤', '烤', '炸', '串', '夜宵', '花甲', '龙虾', '烤串', '烤鱼']);
    case '解馋必点':
      return byIncludes(['烤', '炸', '卤', '辣', '糖醋', '香辣', '孜然', '干锅', '铁板']);
    case '下饭灵魂':
      return byIncludes(['盖饭', '拌饭', '焖饭', '卤肉', '红烧', '酱香', '咖喱']);
    case '鲜香快乐':
      return byIncludes(['鲜', '清蒸', '白灼', '水煮', '清汤', '菌']);
    case '暖胃治愈':
      return byIncludes(['汤', '粥', '面', '粉', '米线', '馄饨', '煲', '火锅']);
    case '夏日清爽':
      return byIncludes(['凉', '冷', '冰', '沙拉', '酸辣', '青柠', '凉皮', '凉粉']);
    case '海鲜盛宴':
      return byIncludes(['虾', '蟹', '鱼', '贝', '海鲜', '蛤', '螺', '鲍', '海', '蚝', '扇贝']);
    case '地道家常':
      return byIncludes(['家常', '小炒', '炒菜', '番茄', '土豆', '青椒', '茄子', '豆腐', '炖']);
    case '异域风情':
      return byIncludes(['韩', '日', '泰', '越', '意', '法', '墨', '印', '咖喱', '披萨', '寿司', '拉面']);
    case '汤汤水水':
      return byIncludes(['汤', '煲', '粥', '羹', '锅', '炖', '煮', '米线', '粉', '面']);
    case '烧烤江湖':
      return byIncludes(['烤', '烧烤', '串', '炭火', '铁板', '烤肉', '烤鱼']);
    case '深夜放毒':
      return byIncludes(['烧烤', '烤', '炸', '串', '夜宵', '龙虾', '花甲', '烤串', '炸鸡', '汉堡', '披萨']);
    case '早餐能量':
      return byIncludes(['包子', '馒头', '粥', '豆浆', '油条', '饼', '煎饼', '鸡蛋', '早餐', '三明治', '面包', '小笼包']);
    case '霸气巨无霸':
      return byIncludes(['大份', '超大', '巨无霸', '特大', '加量', '双份', '三人份', '全家桶', '霸王']);
    case '精致小份菜':
      return byIncludes(['小份', '例份', '精致', '小碟', '一人食', '单人', '迷你', '小巧']);
    case '甜品终结者':
      return byIncludes(['甜品', '蛋糕', '冰淇淋', '奶茶', '甜', '糖', '糕', '布丁', '慕斯', '芝士']);
    case '酸爽开胃王':
      return byIncludes(['酸', '醋', '柠檬', '酸辣', '酸菜', '酸汤', '开胃', '泡椒', '青柠']);
    case '川湘麻辣魂':
      return byIncludes(['麻辣', '剁椒', '川', '湘', '辣', '椒麻', '香辣', '麻', '火锅', '水煮']);
    case '东北硬菜':
      return byIncludes(['东北', '锅包肉', '溜肉段', '杀猪菜', '酸菜', '炖', '大盘', '铁锅']);
    case '粤式清新':
      return byIncludes(['清蒸', '白灼', '煲仔', '广式', '粤', '烧腊', '肠粉', '虾饺', '烧味']);
    case '小吃一条街':
      return byIncludes(['小吃', '街边', '特色', '传统', '老字号', '地道', '特产']);
    case '网红打卡款':
      return byIncludes(['网红', '爆款', '抖音', '流行', '必吃', '排队']);
    case '妈妈的味道':
      return byIncludes(['妈', '家', '传统', '经典', '旧', '老', '儿时']);
    case '减肥失败款':
      return byIncludes(['炸', '烤', '烧烤', '油炸', '肥肉', '奶油', '芝士', '肘子', '红烧肉']);
    case '快手炒菜':
      return byIncludes(['快炒', '小炒', '爆炒', '清炒', '炒', '青椒', '番茄', '豆角']);
    case '低卡轻食':
      return byIncludes(['沙拉', '轻食', '低卡', '健康', '减脂', '蔬菜', '水煮', '无油']);
    case '养生佳品':
      return byIncludes(['养生', '清淡', '滋补', '煲汤', '炖', '药膳', '枸杞', '红枣', '滋润']);
    case '醉酒必备':
      return byIncludes(['解酒', '清汤', '粥', '面', '小吃', '下酒', '烤串', '花生', '毛豆']);
    case '宵夜yyds':
      return byIncludes(['宵夜', '夜宵', '烧烤', '烤串', '炸鸡', '花甲', '龙虾', '麻辣烫']);
    case '早茶小点心':
      return byIncludes(['点心', '早茶', '虾饺', '烧卖', '叉烧', '肠粉', '凤爪', '糕']);
    case '米饭杀手':
      return byIncludes(['盖饭', '拌饭', '下饭', '卤肉', '红烧', '酱香', '咖喱', '茄汁']);
    case '面条爱好者':
      return byIncludes(['面', '面条', '拉面', '刀削面', '担担面', '炸酱面', '阳春面', '牛肉面']);
    case '饺子宇宙':
      return byIncludes(['饺子', '水饺', '蒸饺', '锅贴', '煎饺', '馄饨', '云吞', '抄手']);
    case '小龙虾天堂':
      return byIncludes(['小龙虾', '龙虾', '麻辣虾', '虾尾', '虾球']);
    case '火锅爱好者':
      return byIncludes(['火锅', '涮', '麻辣烫', '串串', '冒菜', '关东煮']);
    case '吃出回忆杀':
      return byIncludes(['传统', '老字号', '经典', '怀旧', '童年', '儿时', '老味道']);
    case '包子馒头':
      return byIncludes(['包子', '馒头', '花卷', '肉包', '菜包', '豆沙包', '糖三角', '小笼包']);
    case '饼类专场':
      return byIncludes(['饼', '煎饼', '烙饼', '馅饼', '葱油饼', '手抓饼', '千层饼']);
    case '蒸的健康':
      return byIncludes(['蒸', '清蒸', '粉蒸', '水蒸']);
    case '炸的酥脆':
      return byIncludes(['炸', '油炸', '酥炸', '干炸', '脆皮', '酥脆']);
    case '煮的软烂':
      return byIncludes(['煮', '水煮', '白煮', '炖煮', '慢炖']);
    case '烤的焦香':
      return byIncludes(['烤', '烧烤', '炙烤', '碳烤', '烤箱']);
    case '凉拌清新':
      return byIncludes(['凉拌', '凉菜', '凉', '拌', '凉皮', '凉粉']);
    case '油泼辣子':
      return byIncludes(['油泼', '油辣', '辣椒油', '红油', '辣子']);
    case '蘸料灵魂':
      return byIncludes(['蘸', '蘸料', '酱', '调料', '蘸水']);
    case '酱香浓郁':
      return byIncludes(['酱', '酱香', '黄豆酱', '甜面酱', '豆瓣酱', '京酱']);
    case '越吃越上头':
      return byIncludes(['上瘾', '回味', '停不下来', '辣', '麻辣', '香', '鲜']);
    default:
      return () => true;
  }
}

function tokenizeDishName(name) {
  // Simple tokenizer: split by common separators, keep CJK sequences and words
  const parts = String(name)
    .replace(/[()\[\]{}·•]/g, ' ')
    .split(/[\s,，/\\+\-&|·]+/)
    .map(s => s.trim())
    .filter(Boolean);
  return parts;
}

function buildTokens() {
  const freq = new Map();
  for (const d of state.dishes) {
    const name = d['菜品名称'] || d['菜名'] || d['名称'] || '';
    const tokens = tokenizeDishName(name);
    for (const t of tokens) {
      const count = freq.get(t) || 0;
      freq.set(t, count + 1);
    }
  }
  bubbleState.tokens = Array.from(freq.entries())
    .filter(([, c]) => c >= 2)
    .map(([text, count]) => ({ text, count }));
}

function nextCandidates() {
  // Level1: show seeded themes (static)
  if (bubbleState.level === 1) {
    return LEVEL1_SEEDS.map((text, i) => ({ text, count: 0, level: 1 }));
  }
  // Level2: show short cuisine tokens extracted from data (e.g., 火锅/麻辣烫/饺子)
  if (bubbleState.level === 2) {
    const themeFilter = getThemeFilter(bubbleState.theme);
    const freq = new Map();
    for (const d of state.dishes) {
      const name = d['菜品名称'] || d['菜名'] || d['名称'] || '';
      if (!themeFilter(name)) continue;
      const tokens = tokenizeDishName(name);
      for (const t of tokens) {
        if (t.length < 2 || t.length > 4) continue;
        const count = freq.get(t) || 0;
        freq.set(t, count + 1);
      }
    }
    return Array.from(freq.entries())
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 40);
  }
  // Level3: concrete dish names filtered by level2 token
  if (bubbleState.level === 3) {
    const level2 = bubbleState.path[1];
    const freq = new Map();
    for (const d of state.dishes) {
      const name = d['菜品名称'] || d['菜名'] || d['名称'] || '';
      if (level2 && name.includes(level2)) {
        const count = freq.get(name) || 0;
        freq.set(name, count + 1);
      }
    }
    return Array.from(freq.entries())
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 40);
  }
  return [];
}

function bubbleColor(idx) {
  const hues = [212, 260, 160, 20, 300, 40, 190];
  const h = hues[idx % hues.length];
  return `hsl(${h} 80% 30% / 0.85)`;
}

function renderBubblePath() {
  // 保留提示元素，只移除其他动态元素
  Array.from(els.bubblePath.children).forEach(child => {
    if (child.id !== 'bubble-hint') {
      child.remove();
    }
  });
  
  const frag = document.createDocumentFragment();
  bubbleState.path.forEach((t, i) => {
    const span = document.createElement('span');
    span.className = 'crumb';
    span.textContent = t;
    span.addEventListener('click', () => {
      bubbleState.path = bubbleState.path.slice(0, i + 1);
      bubbleState.level = i + 1;
      applyBubbleFilter();
      renderBubbles();
    });
    frag.appendChild(span);
  });
  if (bubbleState.path.length > 0) {
    const clear = document.createElement('button');
    clear.className = 'btn-clear-bubble';
    clear.title = '清空已选';
    clear.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 6h18M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M10 11v6M14 11v6"></path>
    </svg>`;
    clear.addEventListener('click', () => {
      bubbleState.path = [];
      bubbleState.level = 1;
      // 显示提示
      if (els.bubbleHint) els.bubbleHint.classList.remove('hidden');
      applyBubbleFilter();
      renderBubbles();
    });
    frag.appendChild(clear);
  }
  els.bubblePath.appendChild(frag);
}

function renderBubbles() {
  if (!state.dishes.length) return; // wait for data
  if (bubbleState.tokens.length === 0) buildTokens();
  renderBubblePath();
  els.bubbleCanvas.innerHTML = '';
  const cand = nextCandidates();
  const W = els.bubbleCanvas.clientWidth || 700;
  const H = Math.max(320, els.bubbleCanvas.clientHeight || 320);
  const pad = 28;
  cand.forEach((c, i) => {
    const b = document.createElement('div');
    b.className = 'bubble';
    // 优化气泡尺寸：减小基础尺寸，更平滑的缩放
    const base = bubbleState.level === 1 ? 12 : bubbleState.level === 2 ? 10 : 9;
    const size = base + Math.min(10, Math.log2(2 + (c.count || 1)) * 3);
    // 改进布局算法：使用更分散的螺旋分布
    const goldenAngle = 137.508 * (Math.PI / 180);
    const angle = i * goldenAngle;
    const radius = Math.sqrt(i + 1) * 35; // 进一步增加间距
    // 添加随机偏移，使分布更自然
    const randomOffset = Math.random() * 15;
    const x = W / 2 + Math.cos(angle) * (radius + randomOffset);
    const y = H / 2 + Math.sin(angle) * (radius + randomOffset);
    // 禁用过渡，直接设置位置
    b.style.transition = 'none';
    b.style.left = `${Math.max(pad, Math.min(W - pad, x))}px`;
    b.style.top = `${Math.max(pad, Math.min(H - pad, y))}px`;
    b.style.background = bubbleColor(i);
    b.style.transform = `translate(-50%, -50%)`;
    b.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)';
    b.style.setProperty('--float-duration', `${5 + Math.random() * 4}s`);
    b.style.setProperty('--float-delay', `${Math.random() * 2}s`);
    const text = document.createElement('span');
    text.className = 'text';
    text.style.fontSize = `${Math.max(9, size - 3)}px`; // 进一步调小字体
    text.textContent = c.text;
    b.appendChild(text);
    b.addEventListener('click', () => {
      // 隐藏提示
      if (els.bubbleHint) els.bubbleHint.classList.add('hidden');
      
      if (bubbleState.level === 1) {
        bubbleState.path = [c.text];
        bubbleState.level = 2;
        bubbleState.theme = c.text;
      } else if (bubbleState.level === 2) {
        bubbleState.path = [bubbleState.path[0], c.text];
        bubbleState.level = 3;
      } else if (bubbleState.level === 3) {
        bubbleState.path = [bubbleState.path[0], bubbleState.path[1], c.text];
        // At level 3 we apply dish-name exact contains filter and keep at level 3 for more picks
      }
      applyBubbleFilter();
      renderBubbles();
    });
    els.bubbleCanvas.appendChild(b);
    // 在下一帧恢复过渡效果，此时位置已经设置完成
    requestAnimationFrame(() => {
      b.style.transition = '';
    });
  });
}

function applyBubbleFilter() {
  if (bubbleState.path.length === 0) {
    state.filtered = joinAndFilter();
  } else {
    const filteredBase = joinAndFilter();
    const currentPath = bubbleState.path;
    
    // Apply filter based on current path level
    if (currentPath.length === 1) {
      // Level 1: Apply theme-based semantic filter
      const themeFilter = getThemeFilter(currentPath[0]);
      state.filtered = filteredBase.filter(item => themeFilter(item.dishName || ''));
    } else if (currentPath.length === 2) {
      // Level 2: Apply level2 token as contains filter
      const t2 = currentPath[1] || '';
      state.filtered = filteredBase.filter(item => (item.dishName || '').includes(t2));
    } else if (currentPath.length >= 3) {
      // Level 3+: Apply level3 dish name as contains filter
      const t3 = currentPath[2] || '';
      state.filtered = filteredBase.filter(item => (item.dishName || '').includes(t3));
    } else {
      state.filtered = filteredBase;
    }
  }
  
  // Reset pagination when filter changes
  pagination.page = 1;
  updateStats();
  render();
}

// -------- Tab 切换功能 --------
function initSearchTabs() {
  const tabAi = document.getElementById('tab-ai');
  const tabKeyword = document.getElementById('tab-keyword');
  const tabContentAi = document.getElementById('tab-content-ai');
  const tabContentKeyword = document.getElementById('tab-content-keyword');
  
  if (!tabAi || !tabKeyword || !tabContentAi || !tabContentKeyword) {
    console.log('Tab elements not found');
    return;
  }
  
  // Tab切换函数
  function switchTab(tabName) {
    // 移除所有active类
    tabAi.classList.remove('active');
    tabKeyword.classList.remove('active');
    tabContentAi.classList.remove('active');
    tabContentKeyword.classList.remove('active');
    
    // 添加对应的active类
    if (tabName === 'ai') {
      tabAi.classList.add('active');
      tabContentAi.classList.add('active');
      console.log('✅ 切换到 AI 智能推荐');
    } else if (tabName === 'keyword') {
      tabKeyword.classList.add('active');
      tabContentKeyword.classList.add('active');
      console.log('✅ 切换到 关键字搜索');
    }
  }
  
  // 绑定点击事件
  tabAi.addEventListener('click', () => switchTab('ai'));
  tabKeyword.addEventListener('click', () => switchTab('keyword'));
  
  console.log('📑 Tab切换功能已初始化，默认显示: AI 智能推荐');
}

// -------- 美食笔记 --------
// 自定义安全验证错误类
class SecurityVerificationError extends Error {
  constructor(message, tips) {
    super(message);
    this.name = 'SecurityVerificationError';
    this.tips = tips || [];
  }
}

const notesState = {
  currentPage: 1,
  pageSize: 9,  // 每页显示9个笔记
  totalResults: 0,
  results: [],
  currentQuery: '',
  isLoading: false,
};

function initNotes() {
  if (!els.btnNotesSearch || !els.notesSearchInput) {
    console.log('Notes elements not found');
    return;
  }

  // 搜索按钮点击
  els.btnNotesSearch.addEventListener('click', () => {
    const query = els.notesSearchInput.value.trim();
    if (query) {
      searchNotes(query, 1);
    }
  });

  // 回车键搜索
  els.notesSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = els.notesSearchInput.value.trim();
      if (query) {
        searchNotes(query, 1);
      }
    }
  });

  // 分页按钮
  if (els.notesPagePrev) {
    els.notesPagePrev.addEventListener('click', () => {
      if (notesState.currentPage > 1) {
        notesState.currentPage--;
        renderCurrentPageNotes();
        updateNotesPagination();
        // 滚动到笔记区域顶部
        document.querySelector('.notes-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  if (els.notesPageNext) {
    els.notesPageNext.addEventListener('click', () => {
      const totalPages = Math.ceil(notesState.totalResults / notesState.pageSize);
      if (notesState.currentPage < totalPages) {
        notesState.currentPage++;
        renderCurrentPageNotes();
        updateNotesPagination();
        // 滚动到笔记区域顶部
        document.querySelector('.notes-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
}

async function searchNotes(query, page = 1) {
  if (notesState.isLoading) return;
  
  notesState.isLoading = true;
  notesState.currentQuery = query;
  notesState.currentPage = 1; // 新搜索总是从第1页开始

  // 显示加载状态
  els.notesResults.innerHTML = `
    <div class="notes-loading">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        <line x1="2" y1="12" x2="6" y2="12"></line>
        <line x1="18" y1="12" x2="22" y2="12"></line>
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
      </svg>
      <p>正在搜索美食笔记...</p>
    </div>
  `;

  try {
    // 自动在搜索词后添加"大众点评"以获取更多大众点评笔记
    const enhancedQuery = `${query} 大众点评`;
    
    // 使用Flask后端API（解决CORS跨域问题）
    // 确保Flask服务器已启动: python api/app.py
    const apiUrl = `http://localhost:5000/api/search-notes?query=${encodeURIComponent(enhancedQuery)}&page=${page}`;
    
    console.log('原始搜索词:', query);
    console.log('增强搜索词:', enhancedQuery);
    console.log('发起搜索请求:', apiUrl);
    
    // 发起请求
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html',
      },
    });

    if (!response.ok) {
      // 特殊处理403安全验证错误
      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({}));
        throw new SecurityVerificationError(errorData.message || '触发百度安全验证', errorData.tips);
      }
      
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    
    // 解析HTML并提取笔记内容
    const notes = parseNotesFromHtml(html);
    
    if (notes.length === 0) {
      throw new Error('未找到相关笔记');
    }

    // 保存所有结果
    notesState.results = notes;
    notesState.totalResults = notes.length;
    
    // 渲染当前页的笔记
    renderCurrentPageNotes();
    updateNotesPagination();
    
  } catch (error) {
    console.error('搜索美食笔记失败:', error);
    
    // 特殊处理安全验证错误
    if (error instanceof SecurityVerificationError) {
      els.notesResults.innerHTML = `
        <div class="notes-error">
          <h3>🔒 ${error.message}</h3>
          <p style="margin: 16px 0; color: #ffa500; font-size: 15px;">百度检测到自动化请求，这是正常的反爬虫机制</p>
          
          <div style="text-align: left; max-width: 600px; margin: 20px auto; padding: 20px; background: rgba(255,165,0,0.1); border-radius: 12px; border: 1px solid rgba(255,165,0,0.3);">
            <strong style="font-size: 15px; color: #ffa500;">💡 解决方法：</strong>
            <ul style="margin: 12px 0; padding-left: 20px; line-height: 2;">
              ${error.tips.map(tip => `<li>${tip}</li>`).join('')}
              <li style="margin-top: 8px; color: #ff69b4;"><strong>推荐：</strong>直接在浏览器中打开 <a href="https://www.baidu.com/s?wd=${encodeURIComponent(notesState.currentQuery)}&pd=note&rpf=pc" target="_blank" style="color: #ff69b4; text-decoration: underline;">百度搜索</a></li>
            </ul>
          </div>
          
          <div style="display: flex; gap: 12px; justify-content: center; margin-top: 20px;">
            <button onclick="location.reload()" class="btn" style="background: linear-gradient(135deg, #ff69b4, #ff1493); color: white; border: none; padding: 10px 20px;">刷新重试</button>
            <a href="https://www.baidu.com/s?wd=${encodeURIComponent(notesState.currentQuery)}&pd=note&rpf=pc" target="_blank" class="btn" style="background: linear-gradient(135deg, #ffa500, #ff8c00); color: white; border: none; padding: 10px 20px; text-decoration: none; display: inline-block;">打开百度搜索</a>
          </div>
        </div>
      `;
    } else {
      // 其他错误
      els.notesResults.innerHTML = `
        <div class="notes-error">
          <h3>⚠️ 搜索失败</h3>
          <p style="margin: 12px 0; color: var(--danger);">${error.message || '无法连接到后端服务'}</p>
          <div style="text-align: left; max-width: 700px; margin: 20px auto; padding: 20px; background: rgba(0,0,0,0.3); border-radius: 12px; font-size: 14px; line-height: 2;">
            <strong style="font-size: 16px;">🚀 启动Flask后端服务：</strong><br><br>
            
            <strong>1️⃣ 安装Python依赖</strong><br>
            <code style="display: block; background: rgba(0,0,0,0.5); padding: 8px 12px; border-radius: 6px; margin: 8px 0; font-family: 'Courier New', monospace;">cd api && pip install -r requirements.txt</code>
            
            <strong>2️⃣ 启动Flask服务器</strong><br>
            <code style="display: block; background: rgba(0,0,0,0.5); padding: 8px 12px; border-radius: 6px; margin: 8px 0; font-family: 'Courier New', monospace;">python app.py</code>
            
            <strong>3️⃣ 验证服务运行</strong><br>
            访问: <a href="http://localhost:5000/api/health" target="_blank" style="color: #ff69b4;">http://localhost:5000/api/health</a>
            
            <div style="margin-top: 16px; padding: 12px; background: rgba(255,105,180,0.1); border-left: 3px solid #ff69b4; border-radius: 4px;">
              <strong>💡 提示：</strong>如果没有Python环境，请先安装：<br>
              • macOS/Linux: <code>brew install python3</code><br>
              • Windows: 访问 <a href="https://www.python.org/downloads/" target="_blank" style="color: #ff69b4;">python.org</a> 下载安装
            </div>
          </div>
          <button onclick="location.reload()" class="btn" style="margin-top: 16px; background: linear-gradient(135deg, #ff69b4, #ff1493); color: white; border: none;">刷新重试</button>
        </div>
      `;
    }
  } finally {
    notesState.isLoading = false;
  }
}

function parseNotesFromHtml(html) {
  // 创建临时DOM解析器
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const notes = [];
  const seenTitles = new Set(); // 用于去重
  
  // 百度搜索结果的容器 - 优先使用更具体的选择器
  const resultItems = doc.querySelectorAll('.c-result[data-srcid="1599"]');
  
  console.log(`找到 ${resultItems.length} 个搜索结果容器`);
  
  resultItems.forEach((item, index) => {
    try {
      // 提取标题 - 百度使用 cosc-title 类和 s-text 注释标记
      const titleEl = item.querySelector('h3.cosc-title, h3 .cosc-title-slot, h3');
      let title = '';
      if (titleEl) {
        // 尝试从HTML注释中提取标题（更准确）
        const htmlContent = titleEl.innerHTML;
        const match = htmlContent.match(/<!--s-text-->(.*?)<!--\/s-text-->/);
        if (match) {
          title = match[1].trim();
        } else {
          title = titleEl.textContent.trim();
        }
      }
      
      // 提取图片
      const imgEl = item.querySelector('img.cos-image-body, img[alt]');
      let image = '';
      if (imgEl) {
        image = imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '';
        // 解码HTML实体
        image = image.replace(/&amp;/g, '&');
      }
      
      // 提取链接
      let url = '';
      const linkEl = item.querySelector('[rl-link-href]');
      if (linkEl) {
        url = linkEl.getAttribute('rl-link-href') || '';
      } else {
        const aEl = item.querySelector('a[href]');
        if (aEl) {
          url = aEl.href;
        }
      }
      
      // 如果没有找到链接，尝试从article元素上查找
      if (!url) {
        const articleLink = item.getAttribute('rl-link-href');
        if (articleLink) {
          url = articleLink;
        }
      }
      
      // 提取来源和时间
      const sourceEl = item.querySelector('.source-name_5yg27, .cu-color-source');
      const source = sourceEl ? sourceEl.textContent.trim() : '百度';
      
      const timeEl = item.querySelector('.source-time_7nWwX, .cu-color-info');
      const time = timeEl ? timeEl.textContent.trim() : '';
      
      // 生成描述（使用来源和时间）
      const description = time ? `${source} · ${time}` : source;
      
      if (title) {
        // 去重检查：如果标题已经存在，跳过
        if (seenTitles.has(title)) {
          console.log(`⚠️ 跳过重复笔记: ${title.substring(0, 30)}...`);
          return;
        }
        
        seenTitles.add(title);
        
        const noteData = {
          id: `note-${notes.length}-${Date.now()}`,
          title,
          description,
          url: url || '',
          image: image || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='280' height='180' viewBox='0 0 280 180'%3E%3Crect width='280' height='180' fill='%23222'/%3E%3Ctext x='140' y='90' text-anchor='middle' fill='%23666' font-size='16'%3E美食笔记%3C/text%3E%3C/svg%3E`,
          source,
        };
        
        // 调试日志
        if (notes.length < 3) {
          console.log(`✅ 笔记 ${notes.length + 1}:`, {
            title: noteData.title.substring(0, 30),
            url: noteData.url.substring(0, 80),
            hasUrl: !!noteData.url
          });
        }
        
        notes.push(noteData);
      }
    } catch (err) {
      console.error('解析笔记项失败:', err);
    }
  });
  
  console.log(`📊 解析完成: 找到 ${resultItems.length} 个容器, 去重后得到 ${notes.length} 个唯一笔记`);
  
  if (resultItems.length > notes.length) {
    console.log(`✨ 成功去除 ${resultItems.length - notes.length} 个重复笔记`);
  }
  
  return notes;
}

// 渲染当前页的笔记
function renderCurrentPageNotes() {
  const allNotes = notesState.results;
  
  if (!allNotes || allNotes.length === 0) {
    els.notesResults.innerHTML = `
      <div class="notes-placeholder">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>未找到相关笔记</p>
        <p class="notes-hint">试试其他关键词吧</p>
      </div>
    `;
    els.notesPagination.style.display = 'none';
    return;
  }
  
  // 计算当前页的笔记范围
  const startIndex = (notesState.currentPage - 1) * notesState.pageSize;
  const endIndex = startIndex + notesState.pageSize;
  const currentPageNotes = allNotes.slice(startIndex, endIndex);
  
  console.log(`渲染第 ${notesState.currentPage} 页: ${startIndex}-${endIndex}, 共 ${currentPageNotes.length} 个笔记`);
  
  renderNotes(currentPageNotes);
}

function renderNotes(notes) {
  if (!notes || notes.length === 0) {
    els.notesResults.innerHTML = `
      <div class="notes-placeholder">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>未找到相关笔记</p>
        <p class="notes-hint">试试其他关键词吧</p>
      </div>
    `;
    return;
  }

  const html = `
    <div class="notes-grid">
      ${notes.map((note, index) => {
        // 确保URL有效
        const validUrl = note.url && note.url !== '#' ? note.url : '';
        const cursorStyle = validUrl ? 'cursor: pointer;' : 'cursor: default;';
        
        return `
        <div class="note-item" data-note-url="${validUrl.replace(/"/g, '&quot;')}" style="${cursorStyle}">
          <img class="note-item-image" src="${note.image}" alt="${note.title}" loading="lazy" 
               onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27280%27 height=%27180%27 viewBox=%270 0 280 180%27%3E%3Crect width=%27280%27 height=%27180%27 fill=%27%23222%27/%3E%3Ctext x=%27140%27 y=%2790%27 text-anchor=%27middle%27 fill=%27%23666%27 font-size=%2716%27%3E暂无图片%3C/text%3E%3C/svg%3E'">
          <div class="note-item-content">
            <div class="note-item-title">${note.title}</div>
            <div class="note-item-desc">${note.description}</div>
            ${!validUrl ? '<div class="note-item-meta"><span style="color: var(--danger); font-size: 11px;">暂无链接</span></div>' : ''}
          </div>
        </div>
      `;
      }).join('')}
    </div>
  `;

  els.notesResults.innerHTML = html;
  
  // 为笔记卡片添加点击事件
  document.querySelectorAll('.note-item').forEach(item => {
    const url = item.getAttribute('data-note-url');
    if (url) {
      item.addEventListener('click', () => {
        // 从卡片中获取标题
        const titleEl = item.querySelector('.note-item-title');
        const title = titleEl ? titleEl.textContent : '';
        showNoteDetail(url, title);
      });
    }
  });
}

function updateNotesPagination() {
  const totalPages = Math.max(1, Math.ceil(notesState.totalResults / notesState.pageSize));
  
  els.notesPageInfo.textContent = `第 ${notesState.currentPage} / ${totalPages} 页`;
  
  if (els.notesPagePrev) {
    els.notesPagePrev.disabled = notesState.currentPage <= 1;
  }
  
  if (els.notesPageNext) {
    els.notesPageNext.disabled = notesState.currentPage >= totalPages;
  }
  
  els.notesPagination.style.display = 'flex';
}

// -------- 美食菜谱 --------
const recipesState = {
  currentTab: 'search',
  currentPage: 1,
  pageSize: 9,
  totalResults: 0,
  results: [],
  currentQuery: '',
  currentCategory: '',
  isLoading: false,
};

function initRecipes() {
  // Tab切换
  const tabButtons = document.querySelectorAll('.recipe-tab');
  tabButtons.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchRecipeTab(tabName);
    });
  });

  // 搜索菜谱
  const searchInput = document.getElementById('recipe-search-input');
  const searchBtn = document.getElementById('btn-recipe-search');
  if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
      const query = searchInput.value.trim();
      if (query) {
        searchRecipes(query);
      }
    });
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = searchInput.value.trim();
        if (query) {
          searchRecipes(query);
        }
      }
    });
  }

  // 健康分类按钮
  const healthBtns = document.querySelectorAll('.health-category-btn');
  healthBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // 移除其他按钮的active状态
      healthBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const category = btn.dataset.category;
      loadHealthRecipes(category);
    });
  });

  // 分页按钮
  const prevBtn = document.getElementById('recipe-page-prev');
  const nextBtn = document.getElementById('recipe-page-next');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (recipesState.currentPage > 1) {
        recipesState.currentPage--;
        renderCurrentPageRecipes();
        updateRecipesPagination();
        document.querySelector('.recipes-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(recipesState.totalResults / recipesState.pageSize);
      if (recipesState.currentPage < totalPages) {
        recipesState.currentPage++;
        renderCurrentPageRecipes();
        updateRecipesPagination();
        document.querySelector('.recipes-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
}

function switchRecipeTab(tabName) {
  recipesState.currentTab = tabName;
  
  // 更新tab按钮状态
  document.querySelectorAll('.recipe-tab').forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // 更新panel显示状态
  document.querySelectorAll('.recipe-panel').forEach(panel => {
    if (panel.id === `recipe-panel-${tabName}`) {
      panel.classList.add('active');
    } else {
      panel.classList.remove('active');
    }
  });
  
  // 隐藏分页
  const pagination = document.getElementById('recipe-pagination');
  if (pagination) {
    pagination.style.display = 'none';
  }
  
  // 自动加载精选推荐（当切换到featured tab时）
  if (tabName === 'featured') {
    const resultsContainer = document.getElementById('recipe-featured-results');
    // 检查是否已经加载过内容
    const hasContent = resultsContainer && resultsContainer.querySelector('.recipe-card');
    if (!hasContent) {
      // 如果还没有内容，自动加载
      loadFeaturedRecipes();
    }
  }
}

async function searchRecipes(query) {
  if (recipesState.isLoading) return;
  
  recipesState.isLoading = true;
  recipesState.currentQuery = query;
  recipesState.currentPage = 1;
  
  const resultsContainer = document.getElementById('recipe-search-results');
  resultsContainer.innerHTML = `
    <div class="recipe-loading">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        <line x1="2" y1="12" x2="6" y2="12"></line>
        <line x1="18" y1="12" x2="22" y2="12"></line>
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
      </svg>
      <p>正在搜索菜谱...</p>
    </div>
  `;
  
  try {
    const apiUrl = `http://localhost:5000/api/search-recipes?query=${encodeURIComponent(query)}&page=1`;
    console.log('搜索菜谱:', apiUrl);
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const recipes = parseRecipesFromHtml(html);
    
    if (recipes.length === 0) {
      throw new Error('未找到相关菜谱');
    }
    
    recipesState.results = recipes;
    recipesState.totalResults = recipes.length;
    
    renderCurrentPageRecipes();
    updateRecipesPagination();
    
  } catch (error) {
    console.error('搜索菜谱失败:', error);
    resultsContainer.innerHTML = `
      <div class="recipe-error">
        <h3>⚠️ 搜索失败</h3>
        <p>${error.message || '无法连接到后端服务'}</p>
        <button onclick="location.reload()" class="btn" style="margin-top: 16px; background: linear-gradient(135deg, #4CAF50, #45a049); color: white; border: none;">刷新重试</button>
      </div>
    `;
  } finally {
    recipesState.isLoading = false;
  }
}

async function loadFeaturedRecipes() {
  if (recipesState.isLoading) return;
  
  recipesState.isLoading = true;
  recipesState.currentPage = 1;
  
  const resultsContainer = document.getElementById('recipe-featured-results');
  resultsContainer.innerHTML = `
    <div class="recipe-loading">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        <line x1="2" y1="12" x2="6" y2="12"></line>
        <line x1="18" y1="12" x2="22" y2="12"></line>
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
      </svg>
      <p>正在加载精选菜谱...</p>
    </div>
  `;
  
  try {
    const apiUrl = `http://localhost:5000/api/featured-recipes`;
    console.log('加载精选菜谱:', apiUrl);
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const recipes = parseRecipesFromHtml(html);
    
    if (recipes.length === 0) {
      throw new Error('未找到精选菜谱');
    }
    
    recipesState.results = recipes;
    recipesState.totalResults = recipes.length;
    
    renderCurrentPageRecipes();
    updateRecipesPagination();
    
  } catch (error) {
    console.error('加载精选菜谱失败:', error);
    resultsContainer.innerHTML = `
      <div class="recipe-error">
        <h3>⚠️ 加载失败</h3>
        <p>${error.message || '无法连接到后端服务'}</p>
        <button onclick="location.reload()" class="btn" style="margin-top: 16px; background: linear-gradient(135deg, #4CAF50, #45a049); color: white; border: none;">刷新重试</button>
      </div>
    `;
  } finally {
    recipesState.isLoading = false;
  }
}

async function loadHealthRecipes(category) {
  if (recipesState.isLoading) return;
  
  recipesState.isLoading = true;
  recipesState.currentCategory = category;
  recipesState.currentPage = 1;
  
  const resultsContainer = document.getElementById('recipe-health-results');
  resultsContainer.innerHTML = `
    <div class="recipe-loading">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        <line x1="2" y1="12" x2="6" y2="12"></line>
        <line x1="18" y1="12" x2="22" y2="12"></line>
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
      </svg>
      <p>正在加载健康菜谱...</p>
    </div>
  `;
  
  try {
    const apiUrl = category 
      ? `http://localhost:5000/api/health-recipes?category=${encodeURIComponent(category)}`
      : `http://localhost:5000/api/health-recipes`;
    console.log('加载健康菜谱:', apiUrl);
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    const recipes = parseRecipesFromHtml(html);
    
    if (recipes.length === 0) {
      throw new Error('未找到相关健康菜谱');
    }
    
    recipesState.results = recipes;
    recipesState.totalResults = recipes.length;
    
    renderCurrentPageRecipes();
    updateRecipesPagination();
    
  } catch (error) {
    console.error('加载健康菜谱失败:', error);
    resultsContainer.innerHTML = `
      <div class="recipe-error">
        <h3>⚠️ 加载失败</h3>
        <p>${error.message || '无法连接到后端服务'}</p>
        <button onclick="location.reload()" class="btn" style="margin-top: 16px; background: linear-gradient(135deg, #4CAF50, #45a049); color: white; border: none;">刷新重试</button>
      </div>
    `;
  } finally {
    recipesState.isLoading = false;
  }
}

function parseRecipesFromHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const recipes = [];
  const seenTitles = new Set();
  
  // 豆果美食的多种可能的菜谱容器选择器
  // 尝试多种选择器以适配不同页面结构
  let recipeItems = doc.querySelectorAll('a[href*="/cookbook/"]');
  
  // 如果找不到，尝试其他选择器
  if (recipeItems.length === 0) {
    recipeItems = doc.querySelectorAll('.cook-list li, .recipe-item, .item, .list-item');
  }
  
  console.log(`找到 ${recipeItems.length} 个菜谱容器`);
  
  recipeItems.forEach((item, index) => {
    try {
      let title = '';
      let image = '';
      let url = '';
      let author = '';
      
      // 如果item本身是a标签
      if (item.tagName === 'A' && item.getAttribute('href') && item.getAttribute('href').includes('/cookbook/')) {
        // ✅ 使用getAttribute获取原始href，不要使用.href（会被浏览器转换为绝对路径）
        url = item.getAttribute('href');
        
        // 提取图片
        const imgEl = item.querySelector('img');
        if (imgEl) {
          image = imgEl.src || imgEl.dataset.src || imgEl.dataset.original || '';
          // 从alt获取标题
          if (imgEl.alt) {
            title = imgEl.alt;
          }
        }
        
        // 从其他元素获取标题
        if (!title) {
          const titleEl = item.querySelector('.title, .name, .cp-title, h3, strong, p');
          if (titleEl) {
            title = titleEl.textContent.trim();
          }
        }
      } else {
        // 提取链接
        const linkEl = item.querySelector('a[href*="/cookbook/"]');
        if (linkEl) {
          // ✅ 使用getAttribute获取原始href
          url = linkEl.getAttribute('href');
        }
        
        // 提取标题
        const titleEl = item.querySelector('.title, .name, .cp-title, h3, strong, a');
        if (titleEl) {
          title = titleEl.textContent.trim();
        }
        
        // 提取图片
        const imgEl = item.querySelector('img');
        if (imgEl) {
          image = imgEl.src || imgEl.dataset.src || imgEl.dataset.original || '';
          if (!title && imgEl.alt) {
            title = imgEl.alt;
          }
        }
      }
      
      // 提取作者
      const authorEl = item.querySelector('.author, .username, .by');
      if (authorEl) {
        author = authorEl.textContent.trim();
      }
      
      // 清理标题（去除多余空格和换行）
      title = title.replace(/\s+/g, ' ').trim();
      
      // 验证URL和标题的有效性
      if (title && title.length > 0 && title.length < 100 && url && !seenTitles.has(title)) {
        seenTitles.add(title);
        
        // 确保URL是完整的
        if (!url.startsWith('http')) {
          url = url.startsWith('/') ? `https://www.douguo.com${url}` : `https://www.douguo.com/${url}`;
        }
        
        recipes.push({
          id: `recipe-${recipes.length}-${Date.now()}`,
          title,
          image: image || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='280' height='180' viewBox='0 0 280 180'%3E%3Crect width='280' height='180' fill='%23f5f5f5'/%3E%3Ctext x='140' y='90' text-anchor='middle' fill='%23999' font-size='16'%3E菜谱图片%3C/text%3E%3C/svg%3E`,
          url: url,
          author: author || '豆果美食',
        });
        
        if (recipes.length <= 3) {
          console.log(`✅ 菜谱 ${recipes.length}:`, {
            title: title.substring(0, 30),
            url: url.substring(0, 50),
            hasImage: !!image
          });
        }
      }
    } catch (err) {
      console.error('解析菜谱项失败:', err);
    }
  });
  
  console.log(`📊 解析完成: 找到 ${recipeItems.length} 个容器, 去重后得到 ${recipes.length} 个唯一菜谱`);
  
  // 如果没有找到菜谱，记录HTML的开头部分用于调试
  if (recipes.length === 0) {
    console.warn('⚠️ 未找到菜谱，HTML开头:', html.substring(0, 500));
  }
  
  return recipes;
}

function renderCurrentPageRecipes() {
  const allRecipes = recipesState.results;
  
  if (!allRecipes || allRecipes.length === 0) {
    const resultsContainer = getCurrentResultsContainer();
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div class="recipe-placeholder">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>未找到相关菜谱</p>
          <p class="recipe-hint">试试其他关键词吧</p>
        </div>
      `;
    }
    const pagination = document.getElementById('recipe-pagination');
    if (pagination) pagination.style.display = 'none';
    return;
  }
  
  const startIndex = (recipesState.currentPage - 1) * recipesState.pageSize;
  const endIndex = startIndex + recipesState.pageSize;
  const currentPageRecipes = allRecipes.slice(startIndex, endIndex);
  
  console.log(`渲染第 ${recipesState.currentPage} 页: ${startIndex}-${endIndex}, 共 ${currentPageRecipes.length} 个菜谱`);
  
  renderRecipes(currentPageRecipes);
}

function getCurrentResultsContainer() {
  const tab = recipesState.currentTab;
  if (tab === 'search') return document.getElementById('recipe-search-results');
  if (tab === 'featured') return document.getElementById('recipe-featured-results');
  if (tab === 'health') return document.getElementById('recipe-health-results');
  return null;
}

function renderRecipes(recipes) {
  const resultsContainer = getCurrentResultsContainer();
  if (!resultsContainer) return;
  
  if (!recipes || recipes.length === 0) {
    resultsContainer.innerHTML = `
      <div class="recipe-placeholder">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>未找到相关菜谱</p>
        <p class="recipe-hint">试试其他关键词吧</p>
      </div>
    `;
    return;
  }
  
  const html = `
    <div class="recipe-grid">
      ${recipes.map(recipe => `
        <div class="recipe-card" data-recipe-url="${recipe.url.replace(/"/g, '&quot;')}">
          <img class="recipe-card-image" src="${recipe.image}" alt="${recipe.title}" loading="lazy"
               onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27280%27 height=%27180%27 viewBox=%270 0 280 180%27%3E%3Crect width=%27280%27 height=%27180%27 fill=%27%23f5f5f5%27/%3E%3Ctext x=%27140%27 y=%2790%27 text-anchor=%27middle%27 fill=%27%23999%27 font-size=%2716%27%3E暂无图片%3C/text%3E%3C/svg%3E'">
          <div class="recipe-card-content">
            <div class="recipe-card-title">${recipe.title}</div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
  
  resultsContainer.innerHTML = html;
  
  // 添加点击事件监听
  resultsContainer.querySelectorAll('.recipe-card').forEach(card => {
    card.addEventListener('click', function() {
      const recipeUrl = this.dataset.recipeUrl;
      if (recipeUrl) {
        // 从卡片中获取标题
        const titleEl = this.querySelector('.recipe-card-title');
        const title = titleEl ? titleEl.textContent : '';
        showRecipeDetail(recipeUrl, title);
      }
    });
  });
}

function updateRecipesPagination() {
  const totalPages = Math.max(1, Math.ceil(recipesState.totalResults / recipesState.pageSize));
  
  const pageInfo = document.getElementById('recipe-page-info');
  if (pageInfo) {
    pageInfo.textContent = `第 ${recipesState.currentPage} / ${totalPages} 页（共${recipesState.totalResults}个）`;
  }
  
  const prevBtn = document.getElementById('recipe-page-prev');
  const nextBtn = document.getElementById('recipe-page-next');
  
  if (prevBtn) prevBtn.disabled = recipesState.currentPage <= 1;
  if (nextBtn) nextBtn.disabled = recipesState.currentPage >= totalPages;
  
  const pagination = document.getElementById('recipe-pagination');
  if (pagination) pagination.style.display = 'flex';
}

// -------- 笔记详情弹窗 --------
async function showNoteDetail(noteUrl, title = '') {
  const modal = document.getElementById('note-detail-modal');
  const titleEl = document.getElementById('note-detail-title');
  const contentEl = document.getElementById('note-detail-content');
  
  if (!modal || !contentEl) return;
  
  // 立即设置标题（从卡片获取）
  if (titleEl && title) {
    titleEl.textContent = title;
  }
  
  // 显示弹窗和加载状态
  modal.classList.add('show');
  contentEl.innerHTML = `
    <div class="note-detail-loading">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        <line x1="2" y1="12" x2="6" y2="12"></line>
        <line x1="18" y1="12" x2="22" y2="12"></line>
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
      </svg>
      <p>正在加载笔记详情...</p>
    </div>
  `;
  
  try {
    const apiUrl = `http://localhost:5000/api/note-detail?url=${encodeURIComponent(noteUrl)}`;
    console.log('🔍 获取笔记详情:', noteUrl);
    console.log('📡 API URL:', apiUrl);
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const noteDetail = await response.json();
    
    console.log('✅ 笔记详情:', noteDetail);
    console.log('📊 详情统计:', {
      '类型': noteDetail.type,
      '标题': noteDetail.title || '未找到',
      '内容长度': noteDetail.content ? `${noteDetail.content.length}字符` : '未找到',
      '图片数量': noteDetail.images?.length || 0,
      '来源': noteDetail.source || '未知',
      'needJump': noteDetail.needJump,
      'error': noteDetail.error
    });
    
    // 处理需要跳转的情况
    console.log('🔍 判断笔记类型:', {
      type: noteDetail.type,
      isDianping: noteDetail.type === 'dianping',
      needJump: noteDetail.needJump,
      willJump: noteDetail.type !== 'dianping'
    });
    
    // 非大众点评笔记直接跳转到详情页（不显示弹窗）
    if (noteDetail.type !== 'dianping') {
      console.log('🔗 非大众点评笔记，直接跳转:', noteDetail.rawUrl);
      
      // 关闭弹窗
      modal.classList.remove('show');
      
      // 直接在新标签页打开
      window.open(noteDetail.rawUrl || noteUrl, '_blank');
      return;
    }
    
    // 处理错误情况
    if (noteDetail.error) {
      throw new Error(noteDetail.error);
    }
    
    if (titleEl) titleEl.textContent = noteDetail.title || '笔记详情';
    renderNoteDetail(noteDetail);
    
  } catch (error) {
    console.error('❌ 获取笔记详情失败:', error);
    contentEl.innerHTML = `
      <div class="note-detail-error">
        <h3>⚠️ 加载失败</h3>
        <p>${error.message || '无法获取笔记详情'}</p>
        <button onclick="document.getElementById('note-detail-modal').classList.remove('show')" class="btn">关闭</button>
      </div>
    `;
  }
}

// 笔记详情渲染 - 现在后端直接返回JSON，不需要前端解析HTML
function renderNoteDetail(detail) {
  const contentEl = document.getElementById('note-detail-content');
  if (!contentEl) return;
  
  let html = '';
  
  // 图片轮播/展示（放在正文前面，大众点评风格）
  if (detail.images && detail.images.length > 0) {
    html += `
      <div class="note-images-showcase">
        ${detail.images.map((img, index) => `
          <div class="note-image-item" onclick="window.open('${img}', '_blank')">
            <img src="${img}" alt="笔记配图 ${index + 1}" loading="lazy" 
                 onerror="this.style.display='none'">
          </div>
        `).join('')}
      </div>
    `;
  }
  
  // 正文内容（大众点评风格）
  if (detail.content) {
    html += '<div class="note-content-body">';
    
    // 处理内容，识别特殊格式
    const lines = detail.content.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      const trimmedLine = line.trim();
      
      // 店铺名称（以数字+表情符号开头）
      if (/^[\d]+[️⃣]+/.test(trimmedLine)) {
        html += `<div class="note-shop-name">${trimmedLine}</div>`;
      }
      // 地址（以📍开头）
      else if (trimmedLine.startsWith('📍')) {
        html += `<div class="note-location">${trimmedLine}</div>`;
      }
      // 价格/人均（包含￥或💰）
      else if (trimmedLine.includes('￥') || trimmedLine.includes('💰') || trimmedLine.includes('人均')) {
        html += `<div class="note-price">${trimmedLine}</div>`;
      }
      // 标签（以#开头或@开头）
      else if (trimmedLine.startsWith('#') || trimmedLine.startsWith('@')) {
        html += `<div class="note-tags">${trimmedLine}</div>`;
      }
      // 分隔线
      else if (trimmedLine === '---' || trimmedLine === '——' || trimmedLine === '-'.repeat(5)) {
        html += '<div class="note-divider"></div>';
      }
      // 普通段落
      else if (trimmedLine.length > 0) {
        html += `<p class="note-paragraph">${trimmedLine}</p>`;
      }
    });
    
    html += '</div>';
  }
  
  // 空状态
  if (!detail.content && (!detail.images || detail.images.length === 0)) {
    html = `
      <div class="note-detail-empty">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>暂无内容</p>
        <p class="text-muted">该笔记可能需要在原网站查看</p>
      </div>
    `;
  }
  
  contentEl.innerHTML = html;
}

function initNoteDetailModal() {
  const modal = document.getElementById('note-detail-modal');
  const closeBtn = document.getElementById('btn-close-note-detail');
  const overlay = modal?.querySelector('.modal-overlay');
  
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('show');
    });
  }
  
  if (overlay) {
    overlay.addEventListener('click', () => {
      modal.classList.remove('show');
    });
  }
}

// -------- 菜谱详情弹窗 --------
async function showRecipeDetail(recipeUrl, title = '') {
  const modal = document.getElementById('recipe-detail-modal');
  const titleEl = document.getElementById('recipe-detail-title');
  const contentEl = document.getElementById('recipe-detail-content');
  
  if (!modal || !contentEl) return;
  
  // 立即设置标题（从卡片获取）
  if (titleEl && title) {
    titleEl.textContent = title;
  }
  
  // 显示弹窗和加载状态
  modal.classList.add('show');
  contentEl.innerHTML = `
    <div class="recipe-detail-loading">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="12" y1="2" x2="12" y2="6"></line>
        <line x1="12" y1="18" x2="12" y2="22"></line>
        <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
        <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
        <line x1="2" y1="12" x2="6" y2="12"></line>
        <line x1="18" y1="12" x2="22" y2="12"></line>
        <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
        <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
      </svg>
      <p>正在加载菜谱详情...</p>
    </div>
  `;
  
  try {
    // 添加debug参数以获取调试信息
    const apiUrl = `http://localhost:5000/api/recipe-detail?url=${encodeURIComponent(recipeUrl)}&debug=true`;
    console.log('🔍 获取菜谱详情:', recipeUrl);
    console.log('📡 API URL:', apiUrl);
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const html = await response.text();
    
    // 保存HTML供调试使用
    window.lastRecipeHtml = html;
    window.lastRecipeUrl = recipeUrl;
    
    // 输出HTML的前2000字符用于调试
    console.log('📄 HTML内容（前2000字符）:\n', html.substring(0, 2000));
    console.log('💾 完整HTML已保存到 window.lastRecipeHtml，可在控制台查看');
    
    // 查找调试信息
    const debugMatch = html.match(/<!-- ===== 调试信息 =====([\s\S]*?)===== 调试信息结束 ===== -->/);
    if (debugMatch) {
      console.log('🐛 调试信息:\n', debugMatch[1]);
    }
    
    const recipeDetail = parseRecipeDetail(html);
    
    console.log('✅ 解析结果:', recipeDetail);
    console.log('📊 解析统计:', {
      '标题': recipeDetail.title || '未找到',
      '图片': recipeDetail.image ? '有' : '无',
      '作者': recipeDetail.author || '未找到',
      '描述': recipeDetail.description ? `${recipeDetail.description.length}字符` : '未找到',
      '食材数量': recipeDetail.ingredients.length,
      '步骤数量': recipeDetail.steps.length,
      '小贴士': recipeDetail.tips ? '有' : '无'
    });
    
    if (titleEl) titleEl.textContent = recipeDetail.title || '菜谱详情';
    renderRecipeDetail(recipeDetail);
    
  } catch (error) {
    console.error('❌ 获取菜谱详情失败:', error);
    contentEl.innerHTML = `
      <div class="recipe-detail-error">
        <h3>⚠️ 加载失败</h3>
        <p>${error.message || '无法获取菜谱详情'}</p>
        <button onclick="document.getElementById('recipe-detail-modal').classList.remove('show')" class="btn">关闭</button>
      </div>
    `;
  }
}

function parseRecipeDetail(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  
  const detail = {
    title: '',
    image: '',
    author: '',
    description: '',
    ingredients: [],
    steps: [],
    tips: ''
  };
  
  // 提取标题 - 豆果美食使用 h1.title
  const titleEl = doc.querySelector('h1.title');
  if (titleEl) {
    detail.title = titleEl.textContent.trim();
  }
  
  // 提取主图 - 豆果美食在 #banner 里
  const bannerImg = doc.querySelector('#banner img, #banner .wb100');
  if (bannerImg) {
    detail.image = bannerImg.src || bannerImg.dataset.src || '';
  }
  
  // 提取作者 - 豆果美食使用 .nickname
  const authorEl = doc.querySelector('.nickname, .author-info .nickname');
  if (authorEl) {
    detail.author = authorEl.textContent.trim();
  }
  
  // 提取描述 - 豆果美食使用 p.intro
  const descEl = doc.querySelector('p.intro');
  if (descEl) {
    detail.description = descEl.textContent.trim();
  }
  
  // 提取食材 - 豆果美食使用 table.retamr 结构
  const ingredientTable = doc.querySelector('table.retamr');
  if (ingredientTable) {
    const tds = ingredientTable.querySelectorAll('td');
    tds.forEach(td => {
      const nameEl = td.querySelector('.scname');
      const amountEl = td.querySelector('.scnum');
      
      if (nameEl) {
        const name = nameEl.textContent.trim();
        const amount = amountEl ? amountEl.textContent.trim() : '';
        
        if (name) {
          detail.ingredients.push({
            name: name,
            amount: amount
          });
        }
      }
    });
  }
  
  // 提取步骤 - 豆果美食使用 .stepcont 结构
  const stepContainers = doc.querySelectorAll('.stepcont');
  stepContainers.forEach((container, index) => {
    const stepInfo = container.querySelector('.stepinfo');
    if (stepInfo) {
      // 获取步骤文本（排除"步骤X"这个p标签）
      const stepP = stepInfo.querySelector('p');
      let text = '';
      
      // 获取stepinfo下的所有文本，但排除p标签
      const childNodes = Array.from(stepInfo.childNodes);
      childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent.trim() + ' ';
        } else if (node.nodeName !== 'P') {
          text += node.textContent.trim() + ' ';
        }
      });
      
      text = text.trim();
      
      // 获取步骤图片
      const imgEl = container.querySelector('img');
      const imgSrc = imgEl ? (imgEl.src || imgEl.dataset.src || '') : '';
      
      if (text && text.length > 3) {
        detail.steps.push({
          step: index + 1,
          text: text,
          image: imgSrc
        });
      }
    }
  });
  
  // 提取小贴士 - 豆果美食使用 .tips
  const tipsEl = doc.querySelector('.tips');
  if (tipsEl) {
    // 获取tips中p标签的文本，排除标题
    const tipsP = tipsEl.querySelector('p');
    if (tipsP) {
      detail.tips = tipsP.textContent.trim();
    }
  }
  
  console.log('✅ 解析完成:', {
    标题: detail.title,
    作者: detail.author,
    描述长度: detail.description.length,
    食材数量: detail.ingredients.length,
    步骤数量: detail.steps.length,
    有小贴士: !!detail.tips
  });
  
  return detail;
}

function renderRecipeDetail(detail) {
  const contentEl = document.getElementById('recipe-detail-content');
  if (!contentEl) return;
  
  let html = '';
  
  // 主图和基本信息
  if (detail.image) {
    html += `<div class="recipe-detail-hero">
      <img src="${detail.image}" alt="${detail.title}" onerror="this.style.display='none'" />
    </div>`;
  }
  
  if (detail.description) {
    html += `<div class="recipe-detail-desc">${detail.description}</div>`;
  }
  
  // 食材列表
  if (detail.ingredients.length > 0) {
    html += `<div class="recipe-detail-section">
      <h4>🥘 食材清单</h4>
      <div class="recipe-ingredients">
        ${detail.ingredients.map(ing => `
          <div class="ingredient-item">
            <span class="ingredient-name">${ing.name}</span>
            ${ing.amount ? `<span class="ingredient-amount">${ing.amount}</span>` : ''}
          </div>
        `).join('')}
      </div>
    </div>`;
  }
  
  // 制作步骤
  if (detail.steps.length > 0) {
    html += `<div class="recipe-detail-section">
      <h4>👨‍🍳 制作步骤</h4>
      <div class="recipe-steps">
        ${detail.steps.map(step => `
          <div class="recipe-step">
            <div class="step-number">${step.step}</div>
            <div class="step-content">
              <p class="step-text">${step.text}</p>
              ${step.image ? `<img src="${step.image}" alt="步骤${step.step}" class="step-image" loading="lazy" onerror="this.style.display='none'" />` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;
  }
  
  // 小贴士（过滤广告文案）
  if (detail.tips) {
    console.log('📝 原始Tips:', detail.tips);
    console.log('📝 原始Tips字符码:', Array.from(detail.tips).map(c => `${c}(${c.charCodeAt(0)})`).join(' '));
    
    // 使用更可靠的方式：直接检查并替换整个广告句子
    let filteredTips = detail.tips;
    
    // 方式1: 使用字符串包含检查和替换
    if (filteredTips.includes('做菜好吃都有技巧')) {
      // 查找广告的起始位置
      const adStartIndex = filteredTips.indexOf('做菜好吃都有技巧');
      if (adStartIndex !== -1) {
        // 截取广告之前的内容
        filteredTips = filteredTips.substring(0, adStartIndex).trim();
        console.log('✂️ 使用substring方式过滤');
      }
    }
    
    // 方式2: 正则替换（支持各种引号和标点）
    filteredTips = filteredTips
      .replace(/做菜好吃都有技巧[^。！？]*?豆果[^。！？]*?菜谱[！!。]*/g, '')
      .trim();
    
    console.log('✂️ 过滤后Tips:', filteredTips);
    
    // 如果过滤后有内容
    if (filteredTips && filteredTips.length > 0) {
      // 检查最后一个字符
      const lastChar = filteredTips[filteredTips.length - 1];
      
      // 如果最后是逗号或没有标点符号，改为句号
      if (lastChar === '，' || lastChar === ',') {
        filteredTips = filteredTips.slice(0, -1) + '。';
      } else if (!/[。！？；：]/.test(lastChar)) {
        // 如果最后不是常见标点符号，添加句号
        filteredTips += '。';
      }
      
      // 显示过滤后的tips
      html += `<div class="recipe-detail-section">
        <h4>💡 小贴士</h4>
        <div class="recipe-tips">${filteredTips}</div>
      </div>`;
    }
  }
  
  // 如果没有有效内容
  if (!html) {
    html = `<div class="recipe-detail-empty">
      <p>暂无详细信息</p>
      <p class="text-muted">可能页面结构已变化，请访问原网站查看</p>
    </div>`;
  }
  
  contentEl.innerHTML = html;
}

function initRecipeDetailModal() {
  const modal = document.getElementById('recipe-detail-modal');
  const btnClose = document.getElementById('btn-close-recipe-detail');
  
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      if (modal) modal.classList.remove('show');
    });
  }
  
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal || e.target.classList.contains('modal-overlay')) {
        modal.classList.remove('show');
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', initSplashScreen);


