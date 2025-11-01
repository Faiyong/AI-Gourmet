# 🍜 舌尖上的AI

**AI-Gourmet** - 一款智能美食探索应用，帮你发现身边的美食。

![WechatIMG45](https://github.com/user-attachments/assets/1c4428f8-8dff-488c-8f6b-05c1c5e72a9c)

---

## 🚀 快速启动

### 方式一：一键启动（推荐）

#### macOS / Linux

```bash
chmod +x start.sh
./start.sh
```

#### Windows（可能遇到问题，不推荐，可以使用方式二手动命令行启动）

方法1：双击运行 `start.bat` 文件

方法2：使用命令行

```cmd
start.bat
```

### 方式二：手动命令行启动

#### 1. 启动后端服务

```bash
# 进入 api 目录（注意先到项目根目录！！！）
cd api

# 创建虚拟环境（首次运行，时间较长，耐心等待）
python3 -m venv venv

# 激活虚拟环境
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

（清华源）pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple --quiet

# 启动后端
python app.py
```

后端服务将在 `http://localhost:5000` 启动

#### 2. 启动前端服务（新开终端窗口）

```bash
# 在项目根目录（注意项目根目录！！！）
python3 -m http.server 8000

# Windows 用户使用:
python -m http.server 8000
```

前端服务将在 `http://localhost:8000` 启动

#### 3. 打开浏览器

访问: **http://localhost:8000/index.html**

#### 4. 授权定位

点击"允许获取位置"按钮，然后在浏览器弹窗中选择"允许"。

#### 5. 开始使用

等待几秒加载数据，然后就可以探索美食了！🎉

> **提示**：一键启动会自动完成上述所有步骤，推荐使用！

---

## ✨ 主要功能

- **周边热门美食** - 附近最热门的菜品排行
- **智能美食探索** - AI关键词气泡式搜索
- **美食笔记** - 多平台美食笔记聚合
- **美食菜谱** - 专业菜谱库 + 饮食健康

---

## 💡 使用提示

### 基本操作

- **搜索**: 输入关键词（如"火锅"、"咖啡"）
- **筛选**: 调整评分、价格等条件
- **查看详情**: 点击菜品卡片
- **切换功能**: 点击顶部Tab切换

### 特色交互

- **魔法棒光标** - 全站魔法棒光标效果
- **星空背景** - 流星雨 + 鼠标交互特效
- **气泡搜索** - AI关键词气泡点击搜索

---

## ⚙️ 环境要求

- **Python** 3.7 或更高版本
  - Windows: 从 [python.org](https://www.python.org/downloads/) 下载安装
  - macOS: `brew install python3` 或从官网下载
  - Linux: `sudo apt install python3` (Ubuntu/Debian)
- **浏览器**: Chrome/Safari/Firefox/Edge（最新版本）
- **网络**: 需要网络连接获取在线数据

---

## 🐛 常见问题

### Q: Windows 双击 start.bat 后闪退？

**A**: 推荐按以下顺序尝试：

1. **首选方案：使用方式二手动命令行启动**（见上方"快速启动"部分）
   - 这样可以看到每一步的详细输出
   - 更容易定位问题所在
   - 适合排查环境配置问题

2. **使用 CMD 运行 start.bat**：
   - 打开 CMD（命令提示符）
   - 使用 `cd` 命令进入项目目录
   - 运行 `start.bat`
   - 这样可以看到完整的错误信息

3. **检查 Python 环境**：
   - 确认已安装 Python 3.7+
   - 确认安装时勾选了 "Add Python to PATH"
   - 在 CMD 中运行 `python --version` 验证

4. **查看详细解决方案**: [Windows 故障排除指南](WINDOWS_TROUBLESHOOTING.md)

> **💡 提示**：闪退通常是因为 Python 未安装或未添加到 PATH，使用手动命令行启动可以清楚看到错误信息！

### Q: 无法获取定位？⚠️ 重要

**A**: 请按以下顺序排查：

1. **检查访问地址**：必须使用 `http://localhost:8000` 或 `http://127.0.0.1:8000` 访问
   - ❌ 不要使用机器IP地址（如 `192.168.x.x`）
   - ❌ 不要使用 `0.0.0.0`

2. **检查浏览器权限**：
   - 点击地址栏左侧的锁图标或感叹号
   - 确认"位置"权限已设置为"允许"
   - 如果是"已阻止"，改为"允许"后刷新页面

3. **检查网络环境**（常见问题）：
   - 🔴 **虚拟机环境**：虚拟机的网络配置可能导致定位服务不可用，**建议在宿主机上运行**
   - 🔴 **公司网络**：部分公司网络或防火墙会屏蔽定位服务，**尝试切换到个人热点或家庭网络**
   - 🔴 **VPN环境**：VPN可能影响定位精度，**尝试断开VPN**
   - ✅ **推荐网络**：个人WiFi、手机热点、家庭宽带

4. **检查系统定位服务**：
   - Windows: 设置 → 隐私 → 位置 → 确保已开启
   - macOS: 系统偏好设置 → 安全性与隐私 → 隐私 → 定位服务
   - 确保浏览器有权限使用定位服务

5. **尝试其他浏览器**：
   - Chrome/Edge（推荐）
   - Firefox
   - Safari（macOS）

> **💡 快速解决方案**：如果在公司虚拟机或受限网络环境中无法定位，用手机开热点连接后重试！

### Q: 启动失败？

**A**: 检查：
1. Python版本是否 >= 3.7
2. 端口8000和5000是否被占用
3. 是否有网络连接

### Q: 如何停止服务？

**A**: 
- **macOS/Linux**: 在终端按 `Ctrl+C` 即可停止
- **Windows**: 按 `Ctrl+C` 或直接关闭命令行窗口

---

## 📁 项目结构

```
.
├── index.html          # 主页面
├── script.js           # 前端逻辑
├── style.css           # 样式文件
├── p5-bg.js           # 背景特效
├── start.sh            # 启动脚本 (macOS/Linux)
├── start.bat           # 启动脚本 (Windows)
└── api/               # 后端API
    ├── app.py         # Flask应用
    ├── requirements.txt # 依赖包
    ├── start_server.sh  # 后端启动脚本 (macOS/Linux)
    └── start_server.bat # 后端启动脚本 (Windows)
```

---

## 📚 更多文档

- [用户使用手册](用户使用手册.md) - 5分钟快速上手
- [Windows 故障排除指南](Windows故障排除指南.md) - Windows 常见问题解决方案

---

## 📄 许可证

MIT License

---

**项目名称**: AI-Gourmet (舌尖上的AI)  
**英文名**: AI-Gourmet  
**中文名**: 舌尖上的AI  
**版本**: 1.0  
**创建时间**: 2025-10  

🎉 **开始探索美食之旅吧！**
