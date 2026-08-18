# 桌面应用图标说明

本目录用于存放 Electron 打包所需的图标文件。

## 需要的文件

### `icon.ico`（Windows 打包必需）
- 尺寸建议：包含 256x256、128x128、64x64、48x48、32x32、16x16 多尺寸
- 格式：`.ico`
- 用途：应用窗口图标、任务栏图标、安装包图标、开始菜单图标

## 如何生成 icon.ico

### 方法 1：在线转换（最简单）
1. 准备一张 256x256 的 PNG 图片（建议用史迪奇主题图）
2. 访问 https://icoconvert.com/ 或 https://convertio.co/png-ico/
3. 上传 PNG，选择多尺寸（推荐勾选所有尺寸），下载 `icon.ico`
4. 放到本目录下，重命名为 `icon.ico`

### 方法 2：使用 ImageMagick
```bash
magick convert img/史迪奇1.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico
```

### 方法 3：使用 Python（Pillow）
```python
from PIL import Image
img = Image.open('img/史迪奇1.png')
img.save('build/icon.ico', sizes=[(256,256),(128,128),(64,64),(48,48),(32,32),(16,16)])
```

## 临时方案（无图标也能运行）

如果暂时没有 `.ico` 文件，应用仍可运行，只是：
- 任务栏会显示默认 Electron 图标
- 打包成 .exe 安装包时会有警告（但不影响使用）

执行 `npm start` 开发时不需要图标。
