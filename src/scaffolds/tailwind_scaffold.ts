import ConfigureCommand from '@adonisjs/core/commands/configure'
import { writeFile } from 'node:fs/promises'
import { SourceFile, Symbol } from 'ts-morph'
import { SyntaxKind } from 'typescript'
import { stubsRoot } from '../../stubs/main.js'
import { readFileOrDefault } from '../utils/file_helper.js'
import BaseScaffold from './base_scaffold.js'

type Import = {
  name: string
  module: string
}

export default class TailwindScaffold extends BaseScaffold {
  tailwindImport: Import = {
    name: 'tailwind',
    module: 'tailwindcss',
  }

  autoprefixerImport: Import = {
    name: 'autoprefixer',
    module: 'autoprefixer',
  }

  constructor(protected command: ConfigureCommand) {
    super(command)
  }

  static installs: { name: string; isDevDependency: boolean }[] = [
    { name: 'tailwindcss', isDevDependency: true },
    { name: 'autoprefixer', isDevDependency: true },
  ]

  async run() {
    await this.boot()

    const cssPath = this.app.makePath('resources/css/app.css')
    const cssContents = '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n'

    await this.codemods.makeUsingStub(stubsRoot, 'configs/tailwind.config.stub', {})

    let css = await readFileOrDefault(cssPath, '')
    let wasChanged = false

    if (!css.includes('[x-cloak]')) {
      const cloak = '[x-cloak] { display: none; }\n'
      css = css ? `${cloak}${css}` : cloak
      wasChanged = true
    }

    if (!css.includes('@tailwind')) {
      css = css ? `${cssContents}\n${css}` : cssContents
      wasChanged = true
    }

    if (wasChanged) {
      await writeFile(cssPath, css)

      this.logger.action('update resources/css/app.css')
    }

    await this.#addViteConfig()
  }

  async #addViteConfig() {
    const project = await this.codemods.getTsMorphProject()
    const file = project?.getSourceFile(this.app.makePath('vite.config.ts'))
    const defaultExport = file?.getDefaultExportSymbol()

    if (!file) {
      throw new Error('Cannot find the vite.config.ts file')
    }

    if (!defaultExport) {
      throw new Error('Cannot find the default export in vite.config.ts')
    }

    const imports = await this.#addVitePostcssPlugins(defaultExport)

    this.#addMissingImports(file, imports)

    if (imports.length) {
      file.formatText({ indentSize: 2 })

      this.logger.action('create tailwind.config.ts')
    }

    await file.save()
  }

  async #addVitePostcssPlugins(defaultExport: Symbol) {
    // get the object contents of `defineConfig`
    const declaration = defaultExport.getDeclarations()[0]
    const options =
      declaration.getChildrenOfKind(SyntaxKind.ObjectLiteralExpression)[0] ||
      declaration.getChildrenOfKind(SyntaxKind.CallExpression)[0].getArguments()[0]

    // 1. if there isn't already a `css` property, we can add the whole thing
    const cssProperty = options
      .getProperty('css')
      ?.getFirstChildByKind(SyntaxKind.ObjectLiteralExpression)

    if (!cssProperty?.getFullText()) {
      options.addPropertyAssignment({
        name: 'css',
        initializer: `{ postcss: { plugins: [tailwind(), autoprefixer()] } }`,
      })
      return [this.tailwindImport, this.autoprefixerImport]
    }

    // 2. if there is a `css` property but not a `postcss` property,
    // we can add the whole `postcss` config
    const postcssProperty = cssProperty
      .getProperty('postcss')
      ?.getFirstChildByKind(SyntaxKind.ObjectLiteralExpression)

    if (!postcssProperty?.getFullText()) {
      cssProperty.addPropertyAssignment({
        name: 'postcss',
        initializer: '{ plugins: [tailwind(), autoprefixer()] }',
      })
      return [this.tailwindImport, this.autoprefixerImport]
    }

    // 3. if there is a `css.postcss` property, but it doesn't contain `plugins`,
    // we can add the plugins
    const plugins = postcssProperty
      ?.getProperty('plugins')
      ?.getFirstChildByKind(SyntaxKind.ArrayLiteralExpression)

    if (!plugins?.getFullText()) {
      postcssProperty.addPropertyAssignment({
        name: 'plugins',
        initializer: '[tailwind(), autoprefixer()]',
      })
      return [this.tailwindImport, this.autoprefixerImport]
    }

    // 4. if there is a `css.postcss.plugins` property,
    // determine if either the tailwind or autoprefixer plugis are missing
    const pluginItems = plugins
      ?.getElements()
      .filter((element) => ['tailwind()', 'autoprefixer()'].includes(element.getText()))
      .map((element) => element.getText())

    const imports: Import[] = []

    if (!pluginItems?.includes('tailwind()')) {
      plugins.insertElement(0, 'tailwind()')
      imports.push(this.tailwindImport)
    }

    if (!pluginItems.includes('autoprefixer()')) {
      plugins.addElement('autoprefixer()')
      imports.push(this.autoprefixerImport)
    }

    return imports
  }

  #addMissingImports(file: SourceFile, imports: Import[]) {
    const defaultImports = file.getImportDeclarations().map((r) => r.getDefaultImport()?.getText())

    imports?.forEach((imp) => {
      if (defaultImports?.includes(imp.name)) return

      file.addImportDeclaration({
        defaultImport: imp.name,
        moduleSpecifier: imp.module,
      })
    })
  }
}
