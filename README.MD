# 内容查看器
嵌入到网页中的内容查看窗口

**如需使用网页模式，请先clone本仓库，安装依赖后npm start启动node服务**

# 功能
* 文字模式：粘贴文字，查看文字内容，点击清除按钮清空文字内容
* 网页模式：输入网址，回车查看网页
* 网页模式下，支持按住alt键内拖动网页内容
* 透明度调节
* 贴边隐藏，鼠标hover再次显示
* 拖动调整位置
* 拖动左右下边角调整大小
* alt + 空格隐藏，alt + ctrl显示

# 截图
<img src="https://github.com/neroneroffy/content-viewer/blob/master/img.png"/>
<img src="https://github.com/neroneroffy/content-viewer/blob/master/img_1.png"/>

# 油猴脚本安装地址

[这里](https://raw.githubusercontent.com/neroneroffy/content-viewer/master/tampermonkey-script/index.user.js)

# 网页模式实现
实现：嵌入到浏览器的油猴脚本在网页模式下的iframe网页引用的是本仓库node下的静态页面，当输入网址敲回车后，油猴脚本会将网址传输给iframe，iframe会向node服务发请求，node接收到请求后，调用puppeteer获取目标网页内容，返回给iframe
