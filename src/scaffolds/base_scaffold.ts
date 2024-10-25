import { Codemods } from '@adonisjs/core/ace/codemods'
import ConfigureCommand from '@adonisjs/core/commands/configure'
import { readFileOrDefault } from '../utils/file_helper.js'
import { slash } from '@adonisjs/core/helpers'
import { stubsRoot } from '../../stubs/main.js'
import { cp, readdir } from 'node:fs/promises'
import {
  SourceFile,
  VariableDeclarationStructure,
  VariableDeclarationKind,
  OptionalKind,
} from 'ts-morph'

export default class BaseScaffold {
  declare codemods: Codemods

  #contents: Map<string, string> = new Map()
  #migrations?: string[]

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

  async hasProvider(path: string) {
    let contents = this.#contents.get('adonisrc.ts')

    if (!contents) {
      contents = await readFileOrDefault(this.app.makePath('adonisrc.ts'), '')
      this.#contents.set('adonisrc.ts', contents)
    }

    return contents.includes(path)
  }

  async copyView(stubName: string) {
    const stub = this.app.makePath(stubsRoot, 'views', stubName)
    const dest = this.app.viewsPath(stubName.replace('.stub', '.edge'))
    await this.copyStub(stub, dest)
  }

  async copyModel(stubName: string) {
    const stub = this.app.makePath(stubsRoot, 'models', stubName)
    const dest = this.app.modelsPath(stubName.replace('.stub', '.ts'))
    await this.copyStub(stub, dest)
  }

  async copyController(stubName: string) {
    const stub = this.app.makePath(stubsRoot, 'controllers', stubName)
    const dest = this.app.httpControllersPath(stubName.replace('.stub', '.ts'))
    await this.copyStub(stub, dest)
  }

  async copyStub(stub: string, dest: string) {
    const action = this.logger.action(`create ${this.getLogPath(dest)}`)

    try {
      await cp(stub, dest, { recursive: true, force: false, errorOnExist: true })
      action.succeeded()
    } catch (error) {
      if (error.code !== 'ERR_FS_CP_EEXIST') {
        throw error
      }

      action.skipped('file already exists')
    }
  }

  async stubMigration(migrationStub: string) {
    const name = slash(migrationStub).split('.stub').at(0)?.split('/').reverse().at(0)

    if (!name) {
      throw new Error(`Migration name could note be found for: ${migrationStub}`)
    }

    if (!this.#migrations) {
      this.#migrations = await readdir(this.app.migrationsPath())
    }

    if (this.#migrations.some((migration) => migration.includes(name))) {
      return this.logger.action(`create ${name}`).skipped('migration already exists')
    }

    await this.codemods.makeUsingStub(stubsRoot, migrationStub, {})
  }

  getLogPath(path: string) {
    return slash(this.app.relativePath(path))
  }

  getConstDeclaration(file: SourceFile, declaration: OptionalKind<VariableDeclarationStructure>) {
    if (file.getVariableDeclaration(declaration.name)) return
    return {
      declarationKind: VariableDeclarationKind.Const,
      declarations: [declaration],
    }
  }
}
