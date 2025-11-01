# 美食笔记搜索 Flask API

解决前端CORS跨域问题的Python Flask后端服务

## 快速启动

### 方法1：使用启动脚本（推荐）

#### macOS / Linux

```bash
# 给脚本添加执行权限
chmod +x start_server.sh

# 运行启动脚本
./start_server.sh
```

#### Windows

方法1：双击运行 `start_server.bat` 文件

方法2：使用命令行

```cmd
start_server.bat
```

### 方法2：手动启动

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 启动服务
python app.py
```

## API接口

### 1. 健康检查
```
GET http://localhost:5000/api/health
```

响应示例：
```json
{
  "status": "healthy",
  "service": "美食笔记搜索API"
}
```

### 2. 搜索美食笔记
```
GET http://localhost:5000/api/search-notes?query=杭州美食推荐&page=1
```

参数：
- `query`: 搜索关键词（必填）
- `page`: 页码，默认为1

响应：百度搜索结果的HTML内容

## 测试API

### 使用curl测试

```bash
# 健康检查
curl http://localhost:5000/api/health

# 搜索测试
curl "http://localhost:5000/api/search-notes?query=杭州美食推荐"
```

### 使用浏览器测试

直接访问以下URL：
- 健康检查: http://localhost:5000/api/health
- 搜索测试: http://localhost:5000/api/search-notes?query=杭州美食推荐

## 目录结构

```
api/
├── app.py              # Flask应用主文件
├── requirements.txt    # Python依赖列表
├── start_server.sh     # 启动脚本（macOS/Linux）
└── README.md          # 说明文档
```

## 依赖说明

- **Flask 3.0.0**: Web框架
- **flask-cors 4.0.0**: 处理跨域请求
- **requests 2.31.0**: HTTP客户端库

## 配置说明

### 修改端口

默认端口为 `5000`，如需修改，编辑 `app.py` 最后一行：

```python
app.run(debug=True, host='0.0.0.0', port=5000)  # 修改这里的端口号
```

同时需要修改前端 `script.js` 中的API地址：

```javascript
const apiUrl = `http://localhost:5000/api/search-notes?...`;  // 修改端口号
```

### 允许外部访问

默认配置已允许外部访问（`host='0.0.0.0'`），如果只需要本地访问，可修改为：

```python
app.run(debug=True, host='127.0.0.1', port=5000)
```

## 常见问题

### Q1: 提示 "Address already in use"

**原因**: 端口5000已被占用

**解决方案**:
```bash
# macOS/Linux 查找占用端口的进程
lsof -ti:5000 | xargs kill -9

# 或者修改端口号（见上方"修改端口"说明）
```

### Q2: 提示 "ModuleNotFoundError"

**原因**: 依赖未安装

**解决方案**:
```bash
pip install -r requirements.txt
```

### Q3: pip安装速度慢

**解决方案**: 使用国内镜像源
```bash
pip install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple
```

### Q4: Windows系统启动

**解决方案**: 
1. 使用提供的 `start_server.bat` 脚本（推荐）
2. 使用 Git Bash 运行 `.sh` 脚本
3. 或者直接运行Python命令：
```bash
cd api
pip install -r requirements.txt
python app.py
```

## 开发模式

Flask默认以开发模式运行（`debug=True`），特性：
- ✅ 代码修改后自动重启
- ✅ 详细的错误信息
- ✅ 交互式调试器

**⚠️ 注意**: 生产环境请使用 `debug=False`

## 生产部署

### 使用gunicorn（推荐）

```bash
# 安装gunicorn
pip install gunicorn

# 启动服务
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

参数说明：
- `-w 4`: 4个工作进程
- `-b 0.0.0.0:5000`: 绑定地址和端口
- `app:app`: 模块名:应用名

### 使用Docker部署

创建 `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app.py .

EXPOSE 5000

CMD ["python", "app.py"]
```

构建和运行：

```bash
docker build -t food-notes-api .
docker run -p 5000:5000 food-notes-api
```

## 日志

服务器运行时的日志会输出到控制台，包括：
- 请求信息（搜索关键词、页码）
- 百度URL
- 响应状态和内容长度
- 错误信息

## 许可证

MIT License

## 支持

如有问题，请查看控制台日志或联系开发者。

