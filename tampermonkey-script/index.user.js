// ==UserScript==
// @name         mofish
// @version      0.0.2
// @updateURL    https://raw.githubusercontent.com/neroneroffy/content-viewer/master/tampermonkey-script/index.meta.js
// @downloadURL  https://raw.githubusercontent.com/neroneroffy/content-viewer/master/tampermonkey-script/index.user.js
// @description  摸鱼神器
// @author       neroneroffy
// @include      *://*
// @grant        none
// @run-at       document-end
// ==/UserScript==


;(function() {
// 发布订阅用来控制一些渲染和事件绑定的时机
  class EventEmitter {
    constructor() {
      this._listeners = new Map()
    }
    on(name, fn) {
      const listeners = this._listeners.get(name)
      if (!listeners) {
        this._listeners.set(name, [ fn ])
      } else {
        listeners.push(fn)
      }
    }
    off(name, fn) {
      const listeners = this._listeners.get(name)
      if (listeners && listeners.length) {
        const index = listeners.findIndex(item => {
          return item === fn || item === fn.origin
        })
        listeners.splice(index, 1)
      }
    }
    once(name, fn) {
      const self = this
      function only() {
        fn()
        self.off(name, only)
      }
      only.origin = fn
      self.on(name, only)
    }
    emit(name, ...args) {
      const listeners = this._listeners.get(name)
      if (listeners && listeners.length) {
        listeners.forEach(cb => cb(...args))
      }
    }
  }

  const TEXT = 'TEXT'
  const WEB = 'WEB'
  const BTN_ACTIVE_BG_COLOR = '#e4e4e4'
  const BTN_ACTIVE_TEXT_COLOR = '#fff'
  const BTN_COMMON_TEXT_COLOR = '#ccc'
  const NORMAL_BG_COLOR = '#fff'
  const MIN_WIDTH = 300
  const MIN_HEIGHT = 300
  const IFRAME_SRC = 'http://localhost:8848'
  class MoFish {
    constructor(container, middlewares) {
      this.container = container
      this._middlewares = middlewares
      this.elements = [ this.container ]
      this.contentWrapper = null // 整体外层容器
      this.inputEle = null // 输入框
      this.contentControlBtn = null // 清除按钮
      this.textContent = null // 文字模式下的容器
      this.webContent = null // 网页模式下的容器
      this.inputStr = null //缓存输入框输入的内容
      this.opacityControl = null // 透明度控制的DOM
      this._eventBus = null // 发布订阅
      this.toolBar = null // 模式切换DOM
      this.mode = TEXT // 当前所处的模式
      this._domIdPrefix = 'm-f-20210812'
      this._initialOpacity = 50 // 默认透明度
      try {
        // 渲染内容
        return this.render()
      } catch (e) {
        return Promise.reject(e)
      }
    }
    _compose(...funcs) {
      // 串联执行插件
      if (funcs.length === 0) {
        return arg => arg
      }
      if (funcs.length === 1) {
        return funcs[0]
      }
      return funcs.reduce((a, b) => {
        return (...args) => a(b(...args))
      })
    }
    _applyMiddleware(target) {
      // 应用插件
      return this._compose(...this._middlewares)(target)
    }
    render() {
      this.container.id = `${this._domIdPrefix}-main`
      const containerStyle = `
            box-sizing: border-box;
            position: fixed;
            width: ${MIN_WIDTH}px;
            height: ${MIN_HEIGHT}px;
            bottom: 0;
            right: -290px;
            padding: 5px;
            background: #e4e4e4;
            z-index: 10000;
            opacity: ${this._initialOpacity / 100};
            background: #fff;
            border: 1px solid #ccc;
            `
      this.attachStyle(this.container, containerStyle)
      this.contentWrapper = document.createElement('div')
      this.contentWrapper.id = `${this._domIdPrefix}-content-wrapper`
      const containerWrapperStyle = `
          position: relative;
          width: 100%;
          height: 90%;
        `
      this.attachStyle(this.contentWrapper, containerWrapperStyle)

      // 渲染模式切换、输入框、清除按钮、透明度控制组件
      const renderList = [
        this._renderToolBar(),
        this._renderInput(),
        this._renderContentControlBtn(),
        this._renderOpacityControl()
      ]
      return Promise.all(renderList).then(
          domList => {
            domList.forEach(dom => {
              this.contentWrapper.append(dom)
            })
            this.container.append(this.contentWrapper)
            const eventBus = this.getEventBus()
            // 渲染内容
            eventBus.emit('onRenderContent')
            this.elements = [this.container, this.contentWrapper, ...domList]
            // 将this抛出
            return this._applyMiddleware(this)
          },
          err => Promise.reject(err)
      )
    }
    _renderToolBar() {
      // 渲染模式切换
      const tools = [
        {
          name: '文字',
          key: TEXT
        },
        {
          name: '网页',
          key: WEB
        },
      ]
      const toolBarEle = document.createElement('div')
      toolBarEle.id = `${this._domIdPrefix}-tool-bar`
      const styleText = `
            outline: none;
            line-height: 28px;
            margin-right: 10px;
            margin-bottom: 10px;
            display: flex;
        `
      this.attachStyle(toolBarEle, styleText)
      const itemCssText = `
            padding: 3px 6px;
            font-size: 12px;
            border: 1px solid #e4e4e4;
            cursor: pointer;
            color: #e4e4e4;
        `
      const itemClick = e => {
        const target = e.target
        const key = target.getAttribute('key')
        const toolBar = document.getElementById(`${this._domIdPrefix}-tool-bar`)
        const items = toolBar.getElementsByTagName('div')
        const contentControlBtn = document.getElementById(`${this._domIdPrefix}-content-control-btn`)
        this.mode = key
        switch (key) {
          case TEXT:
            contentControlBtn.style.display = 'inline'
            break
          case WEB:
            contentControlBtn.style.display = 'none'
        }
        this.inputStr = ''
        this._renderContent(key)
        for (let i = 0; i < items.length; i++) {
          const tool = items[i]
          tool.style.background = 'none'
          tool.style.color = BTN_COMMON_TEXT_COLOR
        }
        target.style.background = BTN_ACTIVE_BG_COLOR
        target.style.color = BTN_ACTIVE_TEXT_COLOR
      }
      const eventBus = this.getEventBus()
      eventBus.once('onRenderContent', () => {
        this._renderContent()
      })
      tools.forEach(item => {
        const toolItem = document.createElement('div')
        toolItem.setAttribute('key', item.key)
        toolItem.innerHTML = item.name
        this.attachStyle(toolItem, itemCssText)
        toolItem.addEventListener('click', itemClick)
        // 设置初始样式
        if (item.key === this.mode) {
          toolItem.style.background = BTN_ACTIVE_BG_COLOR
          toolItem.style.color = BTN_ACTIVE_TEXT_COLOR
        }
        toolBarEle.appendChild(toolItem)
      })
      this.toolBarEle = toolBarEle
      return Promise.resolve(this.toolBarEle)
    }
    _renderInput() {
      // 输入框
      const host = this
      const inputEle = document.createElement('input')
      inputEle.id = `${this._domIdPrefix}-input`
      inputEle.addEventListener('keydown', function (event) {
        const code = event.keyCode;
        if(code ===13){ //这是键盘的enter监听事件
          host.inputStr = this.value
          console.log('host.mode', host.mode);
          if (host.mode !== WEB) {
            this.value = ''
          }
          this.blur()
          host._processInputValue()
        }
      })
      const styleText = `
            border-radius: 4px;
            border: 1px solid #e4e4e4;
            outline: none;
            line-height: 28px;
            margin-right: 10px;
            color: #e4e4e4;
            `
      this.attachStyle(inputEle, styleText)
      this.inputEle = inputEle
      return Promise.resolve(this.inputEle)
    }
    _renderContentControlBtn() {
      // 内容控制按钮
      const host = this
      const contentControlBtn = document.createElement('button')
      contentControlBtn.id = `${this._domIdPrefix}-content-control-btn`
      contentControlBtn.innerText = '清 除'
      const contentControlBtnCssText = `
            border: 1px solid #e4e4e4;
            padding: 6px 10px;
            border-radius: 4px;
            background: #fff;
            color: #e4e4e4;
          `
      this.attachStyle(contentControlBtn, contentControlBtnCssText)
      contentControlBtn.addEventListener('click', function () {
        if (host.mode === TEXT) {
          host.textContent.innerHTML = ''
        } else if (host.mode === WEB) {
          //
        }
      })
      this.contentControlBtn = contentControlBtn
      return Promise.resolve(this.contentControlBtn)
    }
    _renderContent() {
      // 文字模式和网页模式，都由该函数集中渲染
      const eventBus = this.getEventBus()
      const contentWrapper = document.getElementById(`${this._domIdPrefix}-content-wrapper`)

      const doms = document.getElementsByClassName(`${this._domIdPrefix}-dom-content`)
      if (doms && doms.length) {
        for (let i = 0; i < doms.length; i++) {
          doms[i].style.display = 'none'
        }
      }
      switch (this.mode) {
        case TEXT:
          const textContent = document.getElementById(`${this._domIdPrefix}-text-content`)
          if (!textContent) {
            this._renderTextContent().then(dom => {
              contentWrapper.appendChild(dom)
            })
          } else {
            textContent.style.display = 'block'
          }
          return
        case WEB:
          const webContent = document.getElementById(`${this._domIdPrefix}-web-content`)
          if (!webContent) {
            this._renderWebContent().then(dom => {
              contentWrapper.appendChild(dom)
              eventBus.emit('onWebContentShow')
            })
          } else {
            webContent.style.display = 'block'
          }
          if (webContent) {
            return this.webContent
          }
          return this._renderWebContent()
      }
    }
    _renderTextContent() {
      // 渲染文字模式的容器
      const eventBus = this.getEventBus()
      const textContent = document.createElement('div')
      textContent.id = `${this._domIdPrefix}-text-content`
      textContent.classList.add(`${this._domIdPrefix}-dom-content`)
      const styleText = `
            width: 100%;
            height: ${((MIN_HEIGHT - 140) / MIN_HEIGHT) * 100}%;
            color: #ccc;
            margin-top: 10px;
            overflow-y: auto;
            overflow-x: hidden;
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE 10+ */
            ::-webkit-scrollbar {
                display: none; /* Chrome Safari */
            }
          `
      this.attachStyle(textContent, styleText)
      this.textContent = textContent
      eventBus.on('onUpdateTextContent', () => {
        this.textContent.innerHTML = this.inputStr
      })
      return Promise.resolve(this.textContent)
    }
    _renderWebContent() {
      // 渲染网页模式的容器
      const eventBus = this.getEventBus()
      const webContent = document.createElement('div')
      webContent.id = `${this._domIdPrefix}-web-content`
      webContent.src = this.inputStr
      webContent.classList.add(`${this._domIdPrefix}-dom-content`)
      const iframe = document.createElement('iframe')
      iframe.setAttribute('name', 'iframeBox')
      iframe.src = IFRAME_SRC
      const styleText = `
            width: 100%;
            height: 50%;
            margin-top: 10px;
            overflow-y: auto;
            overflow-x: hidden;
            position: relative;
            border: none;
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE 10+ */
            ::-webkit-scrollbar {
                display: none; /* Chrome Safari */
            }
          `
      const iframeStyleText = `
            width: 100vw;
            height: 100vh;
            border: none;
            position: absolute;
            top: 0;
            left: 0;
          `
      this.attachStyle(webContent, styleText)
      this.attachStyle(iframe, iframeStyleText)
      webContent.appendChild(iframe)
      this.webContent = webContent
      this.iframeContent = iframe

      eventBus.on('onUpdateIframeContent', () => {
        const webDom = document.getElementById(`${this._domIdPrefix}-web-content`)
        const iframeDom = webDom.getElementsByTagName('iframe')[0]
        if (iframeDom) {
          iframeDom.contentWindow.postMessage(this.inputStr,IFRAME_SRC);
        }
      })
      return Promise.resolve(this.webContent)
    }
    _renderOpacityControl() {
      // 渲染透明度控制器
      const opacityControl = document.createElement('div')
      opacityControl.id = `${this._domIdPrefix}-opacity-control`
      const opacityControlBar = document.createElement('div')
      const opacityControlStyle = `
            width: 100px;
            height: 5px;
            background: #e4e4e4;
            border-radius: 4px;
            position: relative;
            margin-top: 10px;
            margin-left: 10px
        `
      const opacityControlBarStyle = `
            width: 8px;
            height: 14px;
            background: #000;
            position: absolute;
            border-radius: 2px;
            left: ${this._initialOpacity}px;
            top: 50%;
            margin-top: -7px;
        `
      this.attachStyle(opacityControl, opacityControlStyle)
      this.attachStyle(opacityControlBar, opacityControlBarStyle)
      this._setSlideBarPosition(opacityControl)(opacityControlBar)
      opacityControl.append(opacityControlBar)
      this.opacityControl = opacityControl
      return Promise.resolve(this.opacityControl)
    }
    _setSlideBarPosition(parent) {
      // 设置透明度滑块位置
      let leftPosition = this._initialOpacity
      let isClicked = false
      return function (child) {
        const slide = (e) => {
          const currPosition = e.pageX - parent.getBoundingClientRect().left
          if (currPosition >= this._initialOpacity - 45 && currPosition <= 96 && isClicked) {
            leftPosition = currPosition
            child.style.left = leftPosition + 'px'
            this.container.style.opacity = leftPosition / 100
          }
        }
        child.addEventListener('mousedown', () => {
          isClicked = true
          document.addEventListener('mousemove', slide)
        })
        document.addEventListener('mouseup', () => {
          isClicked = true
          document.removeEventListener('mousemove', slide)
        })
      }.bind(this)
    }
    _processInputValue() {
      // 处理输入框的值，根据当前所处模式（文字、网页）决定进行什么操作，在输入框敲回车时触发
      const eventBus = this.getEventBus()
      switch (this.mode) {
        case TEXT:
          eventBus.emit('onUpdateTextContent')
          break
        case WEB:
          eventBus.emit('onUpdateIframeContent')
          break
        default:
          return null
      }
    }
    getEventBus() {
      // 发布订阅单例
      if (!this._eventBus) {
        this._eventBus = new EventEmitter()
      }
      return this._eventBus
    }
    attachStyle(target, cssText) {
      target.style.cssText = cssText
    }
  }

  const wrapper = document.createElement('div')

// 交互功能扩展
  const middlewares = [
    // iframe拖动
    instance => {
      const eventBus = instance.getEventBus()
      const { _domIdPrefix, attachStyle } = instance
      // 当处于网页模式iframe显示时，才能为iframe所在容器绑定事件
      eventBus.once('onWebContentShow', () => {
        const webContent = document.getElementById(`${_domIdPrefix}-web-content`)
        const iframeContent = webContent.getElementsByTagName('iframe')[0]
        // 拖动位置计算
        const calcPosition = (pt, bounds) => {
          const left =
              (pt.x >= bounds.right
                      ? pt.x
                      :bounds.right
              ) - bounds.offsetX
          const top =
              (pt.y >= bounds.bottom
                      ? pt.y
                      : bounds.bottom
              ) - bounds.offsetY
          return { left, top }
        }
        // 拖动边界计算
        const mouseBounds = (pt, compRact, containerRact) => {
          return {
            left: containerRact.left + (pt.x - compRact.left),
            right: containerRact.right - (compRact.right - pt.x),
            top: containerRact.top + (pt.y - compRact.top),
            bottom: containerRact.bottom - (compRact.bottom - pt.y),
            offsetX: containerRact.left + (pt.x - compRact.left),
            offsetY: containerRact.top + (pt.y - compRact.top)
          }
        }
        // 设置拖动遮罩
        const mask = document.createElement('div')
        mask.id = `${_domIdPrefix}-web-content-mask`
        const cssText = `
                width: 100%;
                height: 100%;
                background: #000;
                opacity: 0.1;
                position: absolute;
                cursor: move;
                top: 0;
                left: 0;
            `
        attachStyle(mask, cssText)
        // 当按下alt时，才允许拖动网页
        document.addEventListener('keydown', e => {
          if (e.keyCode === 18) {
            webContent.appendChild(mask)
            webContent.addEventListener('mousedown', event => {
              const mBounds = mouseBounds(
                  event,
                  iframeContent.getClientRects()[0],
                  webContent.getClientRects()[0]
              )
              const move = e => {
                let pt = calcPosition(e, mBounds)
                iframeContent.style.left = pt.left + 'px'
                iframeContent.style.top = pt.top + 'px'
              }
              webContent.addEventListener('mousemove', move)
              webContent.addEventListener('mouseup', () => {
                webContent.removeEventListener('mousemove', move)
              })
              webContent.addEventListener('mouseleave', () => {
                webContent.removeEventListener('mousemove', move)
              })
            })
          }
        })
        document.addEventListener('keyup', e => {
          if (e.keyCode === 18) {
            webContent.removeChild(mask)
          }
        })
      })
      return instance
    },
    // 拖拽边角缩放
    instance => {
      const { container, attachStyle, _domIdPrefix } = instance
      const anchorBL = document.createElement('div')
      const anchorBR = document.createElement('div')
      const anchorStyleText = `
            width: 10px;
            height: 10px;
            position: absolute;
            bottom: 0;
            background: #e4e4e4;
        `
      const anchorBLStyleText = `
            left: 0;
            cursor: nesw-resize;
        `
      const anchorBRStyleText = `
            right: 0;
            cursor: nwse-resize;
        `
      anchorBL.className = `${_domIdPrefix}-anchor-bl`
      anchorBR.className = `${_domIdPrefix}-anchor-br`
      attachStyle(anchorBL, anchorStyleText + anchorBLStyleText)
      attachStyle(anchorBR, anchorStyleText + anchorBRStyleText)
      function drag(anchor) {
        anchor.addEventListener('mousedown', (e) => {
          const oldX = e.clientX;
          const oldY = e.clientY;
          const oldWidth = container.offsetWidth;
          const oldHeight = container.offsetHeight;
          const oldLeft = container.offsetLeft;
          const oldTop = container.offsetTop;
          const { mode } = instance
          let content
          switch (mode) {
            case TEXT:
              content = document.getElementById(`${_domIdPrefix}-text-content`)
              break
            case WEB:
              content = document.getElementById(`${_domIdPrefix}-web-content`)
              const iframe = content.getElementsByTagName('iframe')[0]
              // 移除掉iframe的document对象上的mousemove事件，解决网页模式下拖拽穿透问题
              if (iframe.contentDocument) {
                iframe.contentDocument.addEventListener('mouseup', () => {
                  document.removeEventListener('mousemove', anchorDrag)
                })

              }
              break
            default:
              content = undefined
          }

          function anchorDrag(de) {
            const iframe = content.getElementsByTagName('iframe')[0]
            let disX = (oldLeft + (de.clientX - oldLeft));
            if(disX >= oldLeft) {
              disX = oldLeft
            }
            if (anchor.className.indexOf('bl') > -1) {
              const newWidth = oldWidth - (de.clientX - oldX)
              const newHeight = oldHeight + (de.clientY - oldY)
              const widthToSet = newWidth < 300 ? 300 : newWidth
              const heightToSet = newHeight < 300 ? 300 : newHeight
              container.style.width = widthToSet + 'px';
              container.style.height = heightToSet + 'px';
              container.style.left = disX + 'px';
              container.style.bottom = oldTop + (de.clientY + oldY) + 'px';
              content.style.height = `${((heightToSet - 140) / heightToSet) * 100}%`
              if (iframe) {
                content.style.height = `${((heightToSet - 140) / heightToSet) * 100}%`
              }
            }
            if (anchor.className.indexOf('br') > -1) {
              let newWidth = oldWidth + (de.clientX - oldX)
              let newHeight = oldHeight + (de.clientY - oldY)
              const widthToSet = newWidth < 300 ? 300 : newWidth
              const heightToSet = newHeight < 300 ? 300 : newHeight
              container.style.width = widthToSet + 'px';
              container.style.height = heightToSet + 'px';
              container.style.right = oldLeft - (de.clientX - oldX) + 'px';
              container.style.bottom = oldTop + (de.clientY + oldY) + 'px';
              content.style.height = `${((heightToSet - 140) / heightToSet) * 100}%`
              if (iframe) {
                content.style.height = `${((heightToSet - 140) / heightToSet) * 100}%`
              }
            }
          }
          document.addEventListener('mousemove', anchorDrag)
          document.addEventListener('mouseup', () => {
            document.removeEventListener('mousemove', anchorDrag)
          })
        })
      }
      drag(anchorBL)
      drag(anchorBR)
      container.append(anchorBL)
      container.append(anchorBR)
      return instance
    },
    // 热键（alt + 空格隐藏， alt + 空格显示）
    instance => {
      // 热键插件
      const { container } = instance
      const keys = {}
      document.body.addEventListener('keydown', e => {
        // alt键
        if (e.keyCode === 18) {
          if (!keys[18]) {
            keys[18] = true
          }
        }
        // alt + 空格隐藏
        if (e.keyCode === 32 && keys[18]) {
          container.style.display = 'none'
        }

        // alt + ctrl显示
        if (e.keyCode === 17 && keys[18]) {
          container.style.display = 'block'
        }

      })
      document.body.addEventListener('keyup', e => {
        if (e.keyCode === 77) {
          if (keys[77]) {
            delete keys[77]
          }
        }
        if (e.keyCode === 79) {
          if (keys[79]) {
            delete keys[79]
          }
        }
      })
      return instance
    },
    // 拖拽移动
    instance => {
      // 拖拽插件
      instance.testProaty = 1
      const { container, contentWrapper, attachStyle } = instance
      const dragControl = document.createElement('div')
      const dragStyle = `
            width: 100%;
            height: 32px;
            background: #e4e4e4;
            opacity: 0.3;
            margin-bottom: 10px;
            cursor: move;
          `
      attachStyle(dragControl, dragStyle)
      container.insertBefore(dragControl, contentWrapper)
      let isMouseDown = false
      let diffX = 0
      let diffY = 0
      dragControl.addEventListener('mousedown', (e) => {
        diffX = e.pageX - container.getBoundingClientRect().left
        diffY = e.pageY - container.getBoundingClientRect().top
        isMouseDown = true
        function drag(e) {
          container.style.left = `${e.pageX - diffX}px`
          container.style.top = `${e.pageY - diffY}px`
        }
        document.addEventListener('mousemove', drag)
        document.addEventListener('mouseup', () => {
          const containerWidth = parseInt(container.style.width)
          const containerPositionX = container.getBoundingClientRect().left
          if (container.getBoundingClientRect().right - 16 > document.body.clientWidth) {
            container.style.left = `unset`
            container.style.right = `${-containerWidth + 10}px`
          }
          if (containerPositionX < 0) {
            container.style.left = `${-containerWidth + 10}px`
            container.style.right = `unset`
          }
          document.removeEventListener('mousemove', drag)
        })
      })
      container.addEventListener('mouseenter', () => {
        // 边缘检测，贴边显示
        const containerWidth = parseInt(container.style.width)
        const containerPositionX = container.getBoundingClientRect().left
        if (containerWidth + containerPositionX > document.body.clientWidth) {
          container.style.right = '0px'
        }
        if (containerPositionX < 0) {
          container.style.left = `0px`
        }
      })
      container.addEventListener('mouseleave', () => {
        // 边缘检测，贴边隐藏
        const containerWidth = parseInt(container.style.width)
        if (container.style.right === '0px') {
          container.style.right = `-${containerWidth - 10}px`
        }
        if (container.style.left === '0px') {
          container.style.left = `-${containerWidth - 10}px`
        }
      })
      return instance
    }
  ]
  new MoFish(
      wrapper,
      middlewares
  ).then(instance => {
    // instance是插件实例
  })
  document.body.appendChild(wrapper)
})()
