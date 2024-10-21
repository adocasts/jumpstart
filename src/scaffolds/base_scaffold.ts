import { Codemods } from '@adonisjs/core/ace/codemods'
import ConfigureCommand from '@adonisjs/core/commands/configure'
import { cp } from 'node:fs/promises'
import { stubsRoot } from '../../stubs/main.js'
import { slash } from '@adonisjs/core/helpers'
import { readFileOrDefault } from '../utils/file_helper.js'
export default class BaseScaffold {
  declare codemods: Codemods

  #contents: Map<string, string> = new Map()

  constructor(protected command: ConfigureCommand) {}

  get app() {
    return this.command.app
  }

  get logger() {
    return this.command.logger
  }

  get colors() {
    return this.command.colors
  }

  async boot() {
    this.codemods = await this.command.createCodemods()
  }

  async copyView(stubName: string) {
    const stub = this.app.makePath(stubsRoot, 'views', stubName)
    const dest = this.app.viewsPath(stubName.replace('.stub', '.ts'))
    await cp(stub, dest, { recursive: true, force: false })
    this.logger.action(`create ${slash(this.app.relativePath(dest))}`)
  }

  async copyModel(stubName: string) {
    const stub = this.app.makePath(stubsRoot, 'models', stubName)
    const dest = this.app.modelsPath(stubName.replace('.stub', '.ts'))
    await cp(stub, dest, { recursive: true, force: false })
    this.logger.action(`create ${slash(this.app.relativePath(dest))}`)
  }

  async copyController(stubName: string) {
    const stub = this.app.makePath(stubsRoot, 'controllers', stubName)
    const dest = this.app.httpControllersPath(stubName.replace('.stub', '.ts'))
    await cp(stub, dest, { recursive: true, force: false })
    this.logger.action(`create ${slash(this.app.relativePath(dest))}`)
  }

  async isProviderRegistered(path: string) {
    let contents = this.#contents.get('adonisrc.ts')

    if (!contents) {
      contents = await readFileOrDefault(this.app.makePath('adonisrc.ts'), '')
      this.#contents.set('adonisrc.ts', contents)
    }

    return contents.includes(path)
  }
}
