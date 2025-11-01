# Windows 故障排除指南

## 双击 start.bat 后闪退？

### 问题1: 未安装 Python

**症状**: 窗口闪退，看不到任何错误信息

**解决方案**:
1. 下载安装 Python：https://www.python.org/downloads/
2. **重要**: 安装时必须勾选 ✅ "Add Python to PATH"
3. 安装完成后重启命令行窗口
4. 验证安装：打开 CMD，输入 `python --version`

### 问题2: Python 未添加到 PATH

**症状**: 提示 "未找到 Python"

**解决方案**:

#### 方法1: 重新安装 Python（推荐）
1. 卸载现有 Python
2. 重新下载安装
3. **务必勾选** ✅ "Add Python to PATH"

#### 方法2: 手动添加 PATH
1. 找到 Python 安装路径，通常是：
   - `C:\Users\你的用户名\AppData\Local\Programs\Python\Python3XX\`
   - `C:\Python3XX\`
2. 右键"此电脑" → 属性 → 高级系统设置 → 环境变量
3. 在"系统变量"中找到 Path，点击编辑
4. 添加以下两个路径：
   - `C:\...\Python3XX\`
   - `C:\...\Python3XX\Scripts\`
5. 保存后重启命令行

### 问题3: 端口被占用

**症状**: 提示 "端口 5000 已被占用" 或 "端口 8000 已被占用"

**解决方案**:

#### 查看占用端口的程序
```cmd
netstat -ano | findstr ":5000"
netstat -ano | findstr ":8000"
```

#### 关闭占用端口的进程
```cmd
taskkill /F /PID 进程ID
```

或者，直接关闭可能占用端口的程序（如其他 Python 程序、Web 服务器等）

### 问题4: 虚拟环境创建失败

**症状**: 提示 "创建虚拟环境失败"

**解决方案**:
1. 确保 Python 版本 >= 3.7
2. 删除 `api/venv` 目录（如果存在）
3. 以管理员身份运行命令行
4. 手动创建虚拟环境：
```cmd
cd api
python -m venv venv
```

### 问题5: 依赖安装失败

**症状**: 提示 "依赖安装失败"

**解决方案**:

#### 方法1: 不使用镜像源
```cmd
cd api
venv\Scripts\activate
pip install -r requirements.txt
```

#### 方法2: 升级 pip
```cmd
python -m pip install --upgrade pip
pip install -r requirements.txt
```

#### 方法3: 使用其他镜像源
```cmd
pip install -r requirements.txt -i https://mirrors.aliyun.com/pypi/simple/
```

### 问题6: 权限不足

**症状**: 提示 "拒绝访问" 或 "权限不足"

**解决方案**:
1. 右键 `start.bat`
2. 选择"以管理员身份运行"

## 调试方法

### 方法1: 使用命令行运行（推荐）

不要双击 `start.bat`，而是：

1. 按 `Win + R`，输入 `cmd`，回车
2. 使用 `cd` 命令进入项目目录：
```cmd
cd C:\Users\你的用户名\IdeaProjects\AI-Gourmet
```
3. 运行启动脚本：
```cmd
start.bat
```

这样可以看到完整的错误信息。

### 方法2: 手动逐步运行

```cmd
REM 1. 检查 Python
python --version

REM 2. 进入 api 目录
cd api

REM 3. 创建虚拟环境
python -m venv venv

REM 4. 激活虚拟环境
venv\Scripts\activate

REM 5. 安装依赖
pip install -r requirements.txt

REM 6. 启动后端
python app.py
```

在另一个命令行窗口：
```cmd
REM 7. 启动前端
python -m http.server 8000
```

### 方法3: 查看详细日志

修改 `start.bat`，去掉 `>nul 2>&1` 来查看详细输出：

找到这两行：
```batch
start /b !PYTHON_CMD! app.py >nul 2>&1
start /b !PYTHON_CMD! -m http.server 8000 >nul 2>&1
```

改为：
```batch
start /b !PYTHON_CMD! app.py
start /b !PYTHON_CMD! -m http.server 8000
```

## 常见错误信息

### "python" 不是内部或外部命令

**原因**: Python 未安装或未添加到 PATH

**解决**: 见"问题1"和"问题2"

### ModuleNotFoundError: No module named 'flask'

**原因**: 依赖未正确安装

**解决**: 见"问题5"

### OSError: [WinError 10048] 通常每个套接字地址只允许使用一次

**原因**: 端口被占用

**解决**: 见"问题3"

### PermissionError: [WinError 5] 拒绝访问

**原因**: 权限不足

**解决**: 见"问题6"

## 系统要求

- **操作系统**: Windows 10 或更高版本
- **Python**: 3.7 或更高版本
- **网络**: 首次运行需要网络连接下载依赖包

## 仍然无法解决？

### 收集信息

运行以下命令，收集系统信息：

```cmd
echo Python 版本:
python --version

echo.
echo Pip 版本:
pip --version

echo.
echo 系统信息:
systeminfo | findstr /B /C:"OS Name" /C:"OS Version"

echo.
echo 端口占用情况:
netstat -ano | findstr ":5000"
netstat -ano | findstr ":8000"
```

将输出结果保存，方便问题排查。

### 替代方案: 使用 Git Bash

如果有安装 Git for Windows，可以使用 Git Bash 运行 Linux 脚本：

```bash
./start.sh
```

### 联系支持

提供以下信息：
1. Windows 版本
2. Python 版本
3. 完整的错误信息
4. 上述系统信息的输出

## 成功启动的标志

当看到以下信息时，表示启动成功：

```
==========================================
🎉 服务器启动成功！
==========================================

📱 访问地址: http://localhost:8000/index.html

💡 提示:
  - 首次访问需要授权GPS定位
  - 按 Ctrl+C 停止服务
  - 或直接关闭此窗口

==========================================

浏览器将在3秒后自动打开...
```

浏览器会自动打开，显示应用界面。

