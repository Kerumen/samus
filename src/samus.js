import blessed from 'blessed'
import { spawn } from 'child_process'

import fetch from './fetch'

const isBasicAuthErr = err => (
  err.status
  && err.status === 401
  && err.response
  && err.response.headers
  && err.response.headers['www-authenticate']
  && err.response.headers['www-authenticate'].indexOf('Basic') > -1
)

class Samus {

  constructor (url, config) {

    this.config = config
    this.url = url || this.config && this.config.defaultServer && this.config.defaultServer.url

    if (this.url && this.url[this.url.length - 1] === '/') {
      this.url = this.url.substr(0, this.url.length - 1)
    }

    this.list = null
    this.authForm = null
    this.credentials = this.config && this.config.defaultServer && this.config.defaultServer.credentials || null

    this.screen = blessed.screen({ smartCSR: true })
    this.screen.key(['escape', 'q', 'C-c'], () => this.screen.destroy())

    this.loader = blessed.loading()
    this.screen.append(this.loader)

    this.load()

  }

  destroy (msg) {
    this.screen.destroy()
    if (msg) {
      console.log(msg)
    }
    process.exit()
  }

  output (text) {
    let name = `${this.url}/${text}`
    if (!name.startsWith('http')) {
      name = `http://${name}`
    }
    this.screen.destroy()

    console.log('\n>>>>>>>> Launching mpv...\n')

    const child = spawn('mpv', ['--quiet', name])
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)

  }

  navigate (suburl) {
    this.url = `${this.url}/${suburl}`
    this.load()
  }

  auth () {
    this.authForm = blessed.form({
      label: 'Authentication required',
      parent: this.screen,
      border: 'line',
      height: 11,
      width: 50,
      keys: true,
    })
    const inputUsername = blessed.textbox({
      inputOnFocus: true,
      parent: this.authForm,
      name: 'username',
      top: 3,
      left: 5,
      right: 5,
      height: 1,
      style: {
        bg: 'black',
        focus: {
          bg: 'blue',
          fg: 'black',
        },
        hover: {
          bg: 'blue'
        }
      },
    })
    inputUsername.on('submit', () => this.authForm.submit())
    const inputPassword = blessed.textbox({
      inputOnFocus: true,
      parent: this.authForm,
      censor: true,
      name: 'password',
      top: 5,
      left: 5,
      right: 5,
      height: 1,
      style: {
        bg: 'black',
        focus: {
          bg: 'blue',
          fg: 'black',
        },
        hover: {
          bg: 'blue'
        }
      },
    })
    inputPassword.on('submit', () => this.authForm.submit())
    inputUsername.focus()
    this.authForm.on('submit', () => {
      this.credentials = {
        username: inputUsername.value,
        password: inputPassword.value
      }
      this.screen.remove(this.authForm)
      this.load()
    })
    this.screen.render()
  }

  load () {
    if (this.list) { this.screen.remove(this.list) }
    this.loader.load(`>>> Loading ${this.url}`)
    fetch(this.url, this.credentials)
      .then(items => {
        this.list = blessed.list({
          items,
          parent: this.screen,
          border: 'line',
          label: ` ${this.url} `,
          keys: true,
          style: {
            selected: {
              bg: 'white',
              fg: 'black'
            }
          },
        })
        this.list.on('select', (item) => {
          const text = item.getText()
          if (text === '../') {
            const lastSlashIndex = this.url.lastIndexOf('/')
            if (lastSlashIndex > -1) {
              this.url = this.url.substring(0, lastSlashIndex)
              this.load()
            }
          } else if (text[text.length - 1] === '/') {
            this.navigate(text.substr(0, text.length - 1))
          } else {
            this.output(text)
          }
        })
        this.list.focus()
        this.screen.render()
      })
      .catch(err => {
        if (isBasicAuthErr(err)) {
          this.auth()
        } else {
          this.destroy(err)
        }
      })
      .then(() => this.loader.stop())
  }

}

export default Samus
