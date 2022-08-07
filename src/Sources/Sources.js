import Tool from '../DevTools/Tool'
import beautify from 'js-beautify'
import LunaObjectViewer from 'luna-object-viewer'
import Settings from '../Settings/Settings'
import { $, ajax, escape, trim, isStr, highlight, copy, dateFormat, cookie } from '../lib/util'
import evalCss from '../lib/evalCss'

export default class Sources extends Tool {
  constructor() {
    super()

    this._style = evalCss(require('./Sources.scss'))

    this.name = 'sources'
    this._showLineNum = true
    this._formatCode = true
    this._indentSize = 4
    this._expireDateObj = {}

    this._loadTpl()
  }
  init($el, container) {
    super.init($el)

    this._container = container
    this._bindEvent()
    this._initCfg()
  }
  destroy() {
    super.destroy()

    evalCss.remove(this._style)
    this._rmCfg()
  }
  set(type, val, extra) {
    if (type === 'img') {
      this._isFetchingData = true

      const img = new Image()

      const self = this

      img.onload = function () {
        self._isFetchingData = false
        self._data = {
          type: 'img',
          val: {
            width: this.width,
            height: this.height,
            src: val,
          },
          extra 
        }

        self._render()
      }
      img.onerror = function () {
        self._isFetchingData = false
      }

      img.src = val

      return
    }

    this._data = { type, val, extra }
    this._render()

    return this
  }
  show() {
    super.show()

    if (!this._data && !this._isFetchingData) {
      this._renderDef()
    }

    return this
  }
  _renderDef() {
    if (this._html) {
      this._data = {
        type: 'html',
        val: this._html,
        extra: {
          dataType: 'html'
        }
      }

      return this._render()
    }

    if (this._isGettingHtml) return
    this._isGettingHtml = true

    ajax({
      url: location.href,
      success: (data) => (this._html = data),
      error: () => (this._html = 'Sorry, unable to fetch source code:('),
      complete: () => {
        this._isGettingHtml = false
        this._renderDef()
      },
      dataType: 'raw',
    })
  }
  _canUpdate () {
    const { dataType } = this._data.extra || {}

    return ['localStorage', 'sessionStorage', 'cookie'].includes(dataType)
  }
  _bindEvent() {
    const self = this
    const $el = this._$el
    const container = this._container

    this._container.on('showTool', (name, lastTool) => {
      if (name !== this.name && lastTool.name === this.name) {
        delete this._data
      }
    })

    $el.on('click', '.eruda-tab-item', function () {
      const $this = $(this)
      const formatType = $this.data('format')

      $this.parent().find('.eruda-active').rmClass('eruda-active')
      $this.addClass('eruda-active')

      if (formatType === 'json') {
        $el.find('.eruda-raw-value').addClass('eruda-hide')
        $el.find('.eruda-value-input').addClass('eruda-hide') 
        $el.find('.eruda-json').rmClass('eruda-hide')
      } else {
        $el.find('.eruda-json').addClass('eruda-hide')
        $el.find('.eruda-value-input').addClass('eruda-hide') 
        $el.find('.eruda-raw-value').rmClass('eruda-hide')
      }
    }).on('click', '.eruda-edit', function () {
      const type = self._data.type

      if (type === 'raw') {
        $el.find('.eruda-raw-wrapper').addClass('eruda-hide')
      } else {
        $el.find('.eruda-json').addClass('eruda-hide')
      }

      $el.find('.eruda-raw-value').addClass('eruda-hide')
      $el.find('.eruda-value-input').rmClass('eruda-hide')
    }).on('click', '.eruda-copy', function () {
      const $this = $(this)
      let value = self._data.val
      try {
        if(!isStr(value)) {
          value = JSON.stringify(value)
        }
        /* eslint-disable no-empty */
      } catch (e) {}

      copy(value, function() {
        $this.find('span').addClass('eruda-icon-check').rmClass('eruda-icon-copy');
        setTimeout(function(){
          $this.find('span').addClass('eruda-icon-copy').rmClass('eruda-icon-check');
        }, 1500);
      });
    }).on('click', '.eruda-cancel', function () {
      $el.find('.eruda-value-input').addClass('eruda-hide') 
      $el.find('.eruda-raw-value').addClass('eruda-hide') 
      $el.find('.eruda-json').rmClass('eruda-hide')
      $el.find('.eruda-raw-wrapper').rmClass('eruda-hide')
    }).on('click', '.eruda-update', function() {
      if (self._canUpdate()) {
        const { dataType, key } = self._data.extra
        const value = $el.find('textarea').val()
        const type = self._data.type

        switch (dataType) {
          case 'localStorage':
          case 'sessionStorage':
            if (dataType === 'localStorage') {
              localStorage.setItem(key, value)
            } else {
              sessionStorage.setItem(key, value)
            }
            try {
              if (type === 'object') {
                self._data.val = JSON.parse(value)
              } else {
                self._data.val = value
              }
            } catch (e) {
              self._data.val = value
            }

            $el.find('.eruda-value-input').addClass('eruda-hide') 
            $el.find('.eruda-raw-value').addClass('eruda-hide') 
            $el.find('.eruda-json').rmClass('eruda-hide')
            $el.find('.eruda-raw-wrapper').rmClass('eruda-hide')

            if (type === 'raw') {
              self._renderRaw()
            } else {
              self._renderObj()
            }
            break;
        }
      }
    }).on('click', '.eruda-input-date', function () {
      const $this = $(this)
      $this.parent().parent().find('.eruda-input-container').toggleClass('eruda-hide')
    }).on('input', '.eruda-input-date-wrapper input', function () {
      const $this = $(this)
      const dateType = $this.data('type')

      try {
        const val = parseInt($this.val(), 10)
        let invalid = false
        switch(dateType) {
          case 'month':
            if (val > 12 || val <= 0) {
              invalid = true
            }
            break
          case 'day':
            if (val > 31 || val <= 0) {
              invalid= true
            }
            break
          case 'hours':
            if (val > 23 || val < 0) {
              invalid = true
            }
            break
          case 'minutes':
          case 'seconds':
            if (val > 59 || val < 0) {
              invalid = true
            }
            break
        }

        if (!invalid) {
          const newObj = {
            ...self._expireDateObj,
            [dateType]: val
          }
          const newDate = obj2Date(newObj)

          $el.find('.eruda-input-date').val(dateFormat(newDate, 'yyyy-mm-dd HH:MM:ss'))
          self._expireDateObj = newObj
        }
      } catch (e) {}
    }).on('click', '.eruda-input-cancel', function () {
      const resources = container.get('resources')
      if (!resources) return

      container.showTool('resources')
      $el.find('.eruda-input-box input').val('')
      $el.find('.eruda-input-box textarea').val('')
    }).on('click', '.eruda-input-update', function () {
      const dataType = self._data.extra.dataType
      const key = $el.find('.eruda-input-key').val(),
        value = $el.find('.eruda-input-value').val(),
        expires = obj2Date(self._expireDateObj),
        domain = $el.find('.eruda-input-domain').val(),
        path = $el.find('.eruda-input-path').val()

      if (!key || !value) {
        return;
      }
      
      if (dataType === 'localStorage') {
        localStorage.setItem(key, value)
      } else if (dataType === 'sessionStorage') {
        sessionStorage.setItem(key, value)
      } else {
        cookie.set(key, value, {
          domain,
          path,
          expires
        })
      }
      const resources = container.get('resources')
      if (!resources) return

      container.showTool('resources')
      $el.find('.eruda-input-box input').val('')
      $el.find('.eruda-input-box textarea').val('')
    })
  }
  _loadTpl() {
    this._codeTpl = require('./code.hbs')
    this._imgTpl = require('./image.hbs')
    this._objTpl = require('./object.hbs')
    this._rawTpl = require('./raw.hbs')
    this._iframeTpl = require('./iframe.hbs')
    this._inputTpl = require('./input.hbs')
  }
  _rmCfg() {
    const cfg = this.config

    const settings = this._container.get('settings')

    if (!settings) return

    settings
      .remove(cfg, 'showLineNum')
      .remove(cfg, 'formatCode')
      .remove(cfg, 'indentSize')
      .remove('Sources')
  }
  _initCfg() {
    const cfg = (this.config = Settings.createCfg('sources', {
      showLineNum: true,
      formatCode: true,
      indentSize: 4,
    }))

    if (!cfg.get('showLineNum')) this._showLineNum = false
    if (!cfg.get('formatCode')) this._formatCode = false
    this._indentSize = cfg.get('indentSize')

    cfg.on('change', (key, val) => {
      switch (key) {
        case 'showLineNum':
          this._showLineNum = val
          return
        case 'formatCode':
          this._formatCode = val
          return
        case 'indentSize':
          this._indentSize = +val
          return
      }
    })

    const settings = this._container.get('settings')
    settings
      .text('Sources')
      .switch(cfg, 'showLineNum', 'Show Line Numbers')
      .switch(cfg, 'formatCode', 'Beautify Code')
      .select(cfg, 'indentSize', 'Indent Size', ['2', '4'])
      .separator()
  }
  _render() {
    this._isInit = true

    const data = this._data
    const $el = this._$el

    $el.attr('data-can-update', false)

    switch (data.type) {
      case 'html':
      case 'js':
      case 'css':
        return this._renderCode()
      case 'img':
        return this._renderImg()
      case 'object':
        return this._renderObj()
      case 'raw':
        return this._renderRaw()
      case 'iframe':
        return this._renderIframe()
      case 'input':
        return this._renderInput()
    }
  }
  _renderImg() {
    this._renderHtml(this._imgTpl(this._data.val))
  }
  _renderCode() {
    const data = this._data
    const indent_size = this._indentSize

    let code = data.val
    const len = data.val.length

    // If source code too big, don't process it.
    if (len < MAX_BEAUTIFY_LEN && this._formatCode) {
      switch (data.type) {
        case 'html':
          code = beautify.html(code, { unformatted: [], indent_size })
          break
        case 'css':
          code = beautify.css(code, { indent_size })
          break
        case 'js':
          code = beautify(code, { indent_size })
          break
      }

      const curTheme = evalCss.getCurTheme()
      code = highlight(code, data.type, {
        keyword: `color:${curTheme.keywordColor}`,
        number: `color:${curTheme.numberColor}`,
        operator: `color:${curTheme.operatorColor}`,
        comment: `color:${curTheme.commentColor}`,
        string: `color:${curTheme.stringColor}`,
      })
    } else {
      code = escape(code)
    }

    if (len < MAX_LINE_NUM_LEN && this._showLineNum) {
      code = code.split('\n').map((line, idx) => {
        if (trim(line) === '') line = '&nbsp;'

        return {
          idx: idx + 1,
          val: line,
        }
      })
    }

    this._renderHtml(
      this._codeTpl({
        code,
        showLineNum: len < MAX_LINE_NUM_LEN && this._showLineNum,
      })
    )
  }
  _renderObj() {
    // Using cache will keep binding events to the same elements.
    this._renderHtml(this._objTpl(), false)

    const $el = this._$el
    const extra = this._data.extra || {}
    let val = this._data.val
    let valStr = this._data.val

    try {
      if (isStr(val)) {
        val = JSON.parse(val)
      } else {
        valStr = JSON.stringify(val)
      }
      /* eslint-disable no-empty */
    } catch (e) {}

    if (this._canUpdate()) {
      $el.attr('data-can-update', true); 
      $el.find('.eruda-sources-toolbar').rmClass('eruda-hide')
      $el.find('.eruda-value-input textarea').val(valStr)
      $el.find('.eruda-raw-value').text(valStr)
      $el.find('.eruda-size').text(`len: ${valStr.length}`)
      $el.find('.eruda-sources-type').text(`${extra.dataType}:${extra.key}`)
      $el.find('.eruda-tab-item').eq(0).addClass('eruda-active')
    }

    const objViewer = new LunaObjectViewer(
      this._$el.find('.eruda-json').get(0),
      {
        unenumerable: true,
        accessGetter: true,
      }
    )
    objViewer.set(val)
  }
  _renderInput () {
    const valStr = this._data.val
    const extra = this._data.extra
    const dataType = extra.dataType
    const $el = this._$el
    
    this._renderHtml(this._inputTpl({ val: valStr }))

    if (this._canUpdate()) {
      $el.find('.eruda-sources-toolbar').rmClass('eruda-hide')
      $el.find('.eruda-sources-type').text(`${extra.dataType}`).attr('data-type', extra.dataType)
    }
    $el.find('.eruda-input-box').data('type', dataType)

    if (dataType === 'cookie') {
      $el.find('.eruda-input-domain').val(window.location.hostname)
      $el.find('.eruda-input-path').val('/')

      const expireDate = new Date(new Date().getTime() + 259200000)
      const expireDateObj = getDateObj(expireDate);
      this._expireDateObj = expireDateObj

      $el.find('.eruda-input-date').val(dateFormat(expireDate, 'yyyy-mm-dd HH:MM:ss'))
      $el.find('.eruda-input-date-wrapper input').each(function () {
        const $this = $(this)
        const dateType = $this.data('type')
        const dateVal = `${expireDateObj[dateType]}`

        $this.val(dateVal.length < 2 ? `0${dateVal}` : dateVal)
      })
    }
    
  }
  _renderRaw() {
    const valStr = this._data.val
    const extra = this._data.extra
    const $el = this._$el
    
    this._renderHtml(this._rawTpl({ val: valStr }))

    if (this._canUpdate()) {
      $el.attr('data-can-update', true); 
      $el.find('.eruda-sources-toolbar').rmClass('eruda-hide')
      $el.find('.eruda-value-input textarea').val(valStr)
      $el.find('.eruda-size').text(`len: ${valStr.length}`)
      $el.find('.eruda-sources-type').text(`${extra.dataType}:${extra.key}`)
      $el.find('.eruda-tab-item').eq(0).addClass('eruda-active')
    }
  }
  _renderIframe() {
    this._renderHtml(this._iframeTpl({ src: this._data.val }))
  }
  _renderHtml(html, cache = true) {
    if (cache && html === this._lastHtml) return
    this._lastHtml = html
    this._$el.html(html)
    // Need setTimeout to make it work
    setTimeout(() => (this._$el.get(0).scrollTop = 0), 0)
  }
}

const MAX_BEAUTIFY_LEN = 100000
const MAX_LINE_NUM_LEN = 400000


function getDateObj (date) {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds()
  }
}

function obj2Date (obj) {
  const newDate = new Date()

  newDate.setFullYear(obj.year)
  newDate.setMonth(obj.month - 1)
  newDate.setDate(obj.day)
  newDate.setHours(obj.hours)
  newDate.setMinutes(obj.minutes)
  newDate.setSeconds(obj.seconds)

  return newDate
}