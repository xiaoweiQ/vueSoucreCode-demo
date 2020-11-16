function getValue(vm, path) {
  return path.split('.').reduce((data, currentVal) => {
    return data[currentVal]
  }, vm.$data)
}

function setValue(vm, path, value) {
  path.split('.').reduce((data, currentVal, index) => {
    if (index === path.split('.').length - 1) {
      data[currentVal] = value
    }
    return data[currentVal]
  }, vm.$data)
}

class GVue {
  constructor(options) {
    this.$el = options.el
    this.$data = options.data
    this.$options = options
    const rootEl = document.querySelector(this.$el)
    new Observe(this)
    new Compile(rootEl, this)
    this.propy(this.$data)
  }

  propy(data) {
    for (const key in data) {
      Object.defineProperty(this, key, {
        get() {
          return data[key]
        },
        set(newValue) {
          data[key] = newValue
        }
      })
    }
  }
}

class Compile {
  constructor(el, vm) {
    this.$el = el
    this.$vm = vm
    this.compile(el)
  }
  compile(rootEl) {
    rootEl.childNodes.forEach(nodeChild => {
      if (nodeChild.nodeType === 1) {
        // element
        this.compileElement(nodeChild)
      } else if (this.isInnerText(nodeChild)) {
        // text
        this.update(nodeChild, RegExp.$1.trim(), 'text')
      }
      if (nodeChild.childNodes) {
        this.compile(nodeChild)
      }
    })
  }
  // 更新
  update(node, exp, dir) {
    let fn = this[dir + 'Update']
    fn && fn(node, exp, this.$vm)
    new Watcher(this.$vm, exp, () => {
      fn && fn(node, exp, this.$vm)
    })
  }

  isInnerText(el) {
    return el.nodeType === 3 && /\{\{(.+?)\}\}/.test(el.textContent)
  }
  
  textUpdate(node, exp, vm) {
    node.textContent = getValue(vm, exp)
  }

  htmlUpdate(node, exp, vm) {
    node.innerHTML = getValue(vm, exp)
  }

  modelUpdate(node, exp, vm) {
    node.value = getValue(vm, exp)
    node.oninput = e => {
      setValue(vm, exp, e.target.value)
    }
  }

  triggerEvent(node, userEventName, event) {
    const fn = this.$vm.$options.methods && this.$vm.$options.methods[userEventName]
    node.addEventListener(event, fn.bind(this.$vm), false)
  }

  compileElement(node) {
    [...node.attributes].forEach(attribute => {
      const name = attribute.name
      const exp = attribute.value
      if (name.startsWith('g-')) {
        let [, dir] = name.split('-')
        this.update(node, exp, dir)
      }
      if (name.startsWith('@')) {
        let [, dir] = name.split('@')
        this.triggerEvent(node, exp, dir)
      }
    })
  }
}

class Observe {
  constructor(vm) {
    this.$vm = vm
    this.observe(this.$vm.$data)
  }
  observe(data) {
    if (data && typeof data === 'object')  {
      for (const [key, value] of Object.entries(data)) {
        this.defineReactive(data, key, value)
      }
    }
  }
  defineReactive(obj, key, value) {
    const dep = new Dep()
    this.observe(value)
    Object.defineProperty(obj, key, {
      get() {
        if (Dep.target) {
          dep.addSubs(Dep.target)
        }
        return value
      },
      set: newValue => {
        if (newValue !== value) {
          this.observe(newValue)
          value = newValue
          dep.notify()
        }
      }
    })
  }
}

class Watcher {
  constructor(vm, key, update) {
    this.$vm = vm
    this.$key = key
    this.$update = update
    Dep.target = this
    this.oldVal = this.getOldVal() // 保存旧值
    Dep.target = null
  }
  
  getOldVal() {
    return getValue(this.$vm, this.$key)
  }

  update() {
    const newVal = getValue(this.$vm, this.$key)
    if (newVal === this.oldVal) return
    this.$update()
  }
}

class Dep {
  constructor(vm) {
    this.$vm = vm
    this.subs = []
  }
  addSubs(watcher) {
    this.subs.push(watcher)
  }
  notify() {
    this.subs.forEach(watcher => {
      watcher.update()
    })
  }
}