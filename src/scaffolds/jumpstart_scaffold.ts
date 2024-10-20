import { cp, readFile, writeFile } from 'node:fs/promises'
import BaseScaffold from './base_scaffold.js'
import ConfigureCommand from '@adonisjs/core/commands/configure'
import { stubsRoot } from '../../stubs/main.js'

type Import = {
  defaultImport?: string
  namedImports?: string[]
  module: string
}

export default class JumpstartScaffold extends BaseScaffold {
  constructor(protected command: ConfigureCommand) {
    super(command)
  }

  async run() {
    await this.boot()

    const ace = await this.app.container.make('ace')
    const isAuthConfigured = await this.isProviderRegistered('@adonisjs/auth/auth_provider')
    const isLucidConfigured = await this.isProviderRegistered('@adonisjs/lucid/database_provider')
    const isMailConfigured = await this.isProviderRegistered('@adonisjs/mail/mail_provider')

    if (!isLucidConfigured) {
      this.logger.log(
        this.colors.blue("You'll need @adonisjs/lucid installed and configured to continue")
      )
      await ace.exec('add @adonisjs/lucid', [])
    }

    if (!isAuthConfigured) {
      this.logger.log(
        this.colors.blue("You'll need @adonisjs/auth installed and configured to continue")
      )
      await ace.exec('add @adonisjs/auth', [])
    }

    if (!isMailConfigured) {
      this.logger.log(
        this.colors.blue("You'll need @adonisjs/mail installed and configured to continue")
      )
      await ace.exec('add', ['@adonisjs/mail'])
    }

    await this.codemods.installPackages([
      { name: 'edge-iconify', isDevDependency: false },
      { name: '@iconify-json/ph', isDevDependency: false },
      { name: '@iconify-json/svg-spinners', isDevDependency: false },
    ])

    await this.#updateEnv()
    await this.#enableHttpMethodSpoofing()
    await this.#registerPreloads()
    await this.#generateStubs()
    await this.#updateUserModel()
  }

  async #updateEnv() {
    await this.codemods.defineEnvVariables({ APP_URL: `http:$HOST:$PORT` })
    await this.codemods.defineEnvValidations({
      leadingComment: 'URL pointing to your app; useful for emails',
      variables: {
        APP_URL: 'Env.schema.string()',
      },
    })
  }

  async #enableHttpMethodSpoofing() {
    const appConfigPath = this.app.makePath('config/app.ts')
    let appConfig = await readFile(appConfigPath, 'utf8')
    appConfig = appConfig.replace('allowMethodSpoofing: false', 'allowMethodSpoofing: true')
    await writeFile(appConfigPath, appConfig)
    this.logger.log(`${this.colors.green('UPDATED:')} config/app.ts > enabled HTTP Method Spoofing`)
  }

  async #registerPreloads() {
    await this.codemods.makeUsingStub(stubsRoot, 'start/globals.stub', {})
    await this.codemods.makeUsingStub(stubsRoot, 'routes/auth.stub', {})
    await this.codemods.makeUsingStub(stubsRoot, 'routes/web.stub', {})

    await this.codemods.updateRcFile((rcFile) => {
      rcFile
        .addPreloadFile('#start/globals')
        .addPreloadFile('#start/routes/auth')
        .addPreloadFile('#start/routes/web')
    })
  }

  async #generateStubs() {
    // stubs -> views
    await cp(this.app.makePath(stubsRoot, 'views'), this.app.viewsPath(), {
      recursive: true,
      force: false,
    })

    // stubs -> migrations
    await this.codemods.makeUsingStub(stubsRoot, 'migrations/create_email_histories_table.stub', {})
    await this.codemods.makeUsingStub(
      stubsRoot,
      'migrations/create_password_reset_tokens_table.stub',
      {}
    )
    await this.codemods.makeUsingStub(
      stubsRoot,
      'migrations/create_remember_me_tokens_table.stub',
      {}
    )

    // stubs -> models
    await this.copyModel('email_history.stub')
    await this.copyModel('password_reset_token.stub')

    // stubs -> validators
    await this.codemods.makeUsingStub(stubsRoot, 'validators/auth.stub', {})
    await this.codemods.makeUsingStub(stubsRoot, 'validators/settings.stub', {})

    // stubs -> services
    await this.codemods.makeUsingStub(stubsRoot, 'services/edge_form_service.stub', {})

    // stubs -> controllers
    await this.copyController('auth/forgot_password_controller.stub')
    await this.copyController('auth/login_controller.stub')
    await this.copyController('auth/logout_controller.stub')
    await this.copyController('auth/register_controller.stub')
    await this.copyController('settings/account_controller.stub')
    await this.copyController('settings/profile_controller.stub')
  }

  async #updateUserModel() {
    const project = await this.codemods.getTsMorphProject()
    const file = project?.getSourceFile(this.app.modelsPath('user.ts'))
    const model = file?.getClass('User')
    const imports: Set<Import> = new Set()

    if (!model) {
      this.logger.log(`${this.colors.yellow('SKIPPED:')} user model updates, model not found.`)
      return
    }

    imports.add({ namedImports: ['Authenticator'], module: '@adonisjs/auth' })
    imports.add({ namedImports: ['Authenticators'], module: '@adonisjs/auth/types' })
    imports.add({ namedImports: ['Infer'], module: '@vinejs/vine/types' })
    imports.add({
      namedImports: ['loginValidator', 'registerValidator'],
      module: '#validators/auth',
    })
    imports.add({ namedImports: ['updateEmailValidator'], module: '#validators/settings' })
    imports.add({ namedImports: ['DbRememberMeTokensProvider'], module: '@adonisjs/auth/session' })
    imports.add({ defaultImport: 'db', module: '@adonisjs/lucid/services/db' })
    imports.add({ defaultImport: 'mail', module: '@adonisjs/mail/services/main' })
    imports.add({ defaultImport: 'app', module: '@adonisjs/core/services/app' })
    imports.add({ defaultImport: 'EmailHistory', module: '#models/email_history' })

    model.addProperty({
      isStatic: true,
      name: 'rememberMeTokens',
      initializer: 'DbRememberMeTokensProvider.forModel(User)',
    })

    const login = model.addMethod({
      isStatic: true,
      isAsync: true,
      name: 'login',
      parameters: [
        { name: 'auth', type: 'Authenticator<Authenticators>' },
        {
          name: '{ email, password, remember }',
          type: 'Infer<typeof loginValidator>',
        },
      ],
    })

    login.setBodyText(`
      const user = await this.verifyCredentials(email, password)
      await auth.use('web').login(user, remember)
      return user  
    `)

    const register = model.addMethod({
      isStatic: true,
      isAsync: true,
      name: 'register',
      parameters: [
        { name: 'auth', type: 'Authenticator<Authenticators>' },
        { name: 'data', type: 'Infer<typeof registerValidator>' },
      ],
    })

    register.setBodyText(`
      const user = await this.create(data)
      await auth.use('web').login(user)
      return user  
    `)

    const logout = model.addMethod({
      isStatic: true,
      isAsync: true,
      name: 'logout',
      parameters: [{ name: 'auth', type: 'Authenticator<Authenticators>' }],
    })

    logout.setBodyText(`await auth.use('web').logout()`)

    const updateEmail = model.addMethod({
      isAsync: true,
      name: 'updateEmail',
      parameters: [{ name: 'data', type: 'Infer<typeof updateEmailValidator>' }],
    })

    updateEmail.setBodyText(`
      const emailOld = this.email

      // verify the password is correct for auth user
      await User.verifyCredentials(emailOld, data.password)

      await db.transaction(async (trx) => {
        this.useTransaction(trx)

        await this.merge({ email: data.email }).save()
        await EmailHistory.create(
          {
            userId: this.id,
            emailNew: data.email,
            emailOld,
          },
          { client: trx }
        )
      })

      await mail.sendLater((message) => {
        message
          .to(emailOld)
          .subject(\`Your \${app.appName} email has been successfully changed\`)
          .htmlView('emails/account/email_changed', { user: this })
      })  
    `)

    imports?.forEach((imp) => {
      const exists = file?.getImportDeclaration(imp.module)

      if (exists) return

      file?.addImportDeclaration({
        defaultImport: imp.defaultImport,
        namedImports: imp.namedImports,
        moduleSpecifier: imp.module,
      })
    })

    await file?.save()
  }
}
