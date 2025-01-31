import ConfigureCommand from '@adonisjs/core/commands/configure'
import { mkdir, writeFile } from 'node:fs/promises'
import { readFileOrDefault } from '../utils/file_helper.js'
import BaseScaffold from './base_scaffold.js'

export default class TailwindScaffold extends BaseScaffold {
  constructor(protected command: ConfigureCommand) {
    super(command)
  }

  static installs: { name: string; isDevDependency: boolean }[] = [
    { name: 'tailwindcss', isDevDependency: true },
    { name: '@tailwindcss/vite', isDevDependency: true },
  ]

  async run() {
    await this.boot()

    const cssPath = this.app.makePath('resources/css')
    const cssFile = this.app.makePath('resources/css/app.css')
    const cssContents = '@import "tailwindcss";\n@source "../views";\n'
    const defaultReset = '* {\n  margin: 0;\n  padding: 0;\n}'

    let css = await readFileOrDefault(cssFile, '')
    let wasChanged = false

    if (!css.includes('[x-cloak]')) {
      const cloak = '[x-cloak] { display: none; }\n'
      css = css ? `${cloak}${css}` : cloak
      wasChanged = true
    }

    if (!css.includes('@import tailwindcss')) {
      css = css ? `${cssContents}\n${css}` : cssContents
      wasChanged = true
    }

    if (css.includes(defaultReset)) {
      css = css.replace(defaultReset, '')
      wasChanged = true
    }

    if (wasChanged) {
      await mkdir(cssPath, { recursive: true })
      await writeFile(cssFile, css)

      this.logger.action('update resources/css/app.css')
    }

    await this.#addVitePlugin()
  }

  async #addVitePlugin() {
    this.codemods.registerVitePlugin('tailwindcss()', [
      {
        isNamed: false,
        module: '@tailwindcss/vite',
        identifier: 'tailwindcss',
      },
    ])
  }
}
