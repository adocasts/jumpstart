import { Codemods } from '@adonisjs/core/ace/codemods'
import ConfigureCommand from '@adonisjs/core/commands/configure'
import { cp } from 'node:fs/promises'
import { SyntaxKind } from 'typescript'
import { stubsRoot } from '../../stubs/main.js'
import { slash } from '@adonisjs/core/helpers'
export default class BaseScaffold {
  declare codemods: Codemods

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
    const project = await this.codemods.getTsMorphProject()
    const file = project?.getSourceFile(this.app.makePath('adonisrc.ts'))
    const defaultExport = file?.getDefaultExportSymbol()

    if (!file) {
      throw new Error('Cannot find the adonisrc.ts file')
    }

    if (!defaultExport) {
      throw new Error('Cannot find the default export in adonisrc.ts')
    }

    // get the object contents of `defineConfig`
    const declaration = defaultExport.getDeclarations()[0]
    const options =
      declaration.getChildrenOfKind(SyntaxKind.ObjectLiteralExpression)[0] ||
      declaration.getChildrenOfKind(SyntaxKind.CallExpression)[0].getArguments()[0]

    const providers = options
      .getProperty('providers')
      ?.getFirstChildByKind(SyntaxKind.ArrayLiteralExpression)

    return providers?.getFullText().includes(path)
  }
}
