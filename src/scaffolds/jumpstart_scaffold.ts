import { cp, readFile, writeFile } from 'node:fs/promises'
import BaseScaffold from './base_scaffold.js'
import ConfigureCommand from '@adonisjs/core/commands/configure'
import { stubsRoot } from '../../stubs/main.js'
import TailwindScaffold from './tailwind_scaffold.js'

type Import = {
  defaultImport?: string
  namedImports?: string[]
  module: string
}

export default class JumpstartScaffold extends BaseScaffold {
  constructor(protected command: ConfigureCommand) {
    super(command)
  }

  static installs: { name: string; isDevDependency: boolean }[] = [
    { name: 'edge-iconify', isDevDependency: false },
    { name: '@iconify-json/ph', isDevDependency: false },
    { name: '@iconify-json/svg-spinners', isDevDependency: false },
  ]

  async run() {
    const ace = await this.app.container.make('ace')
    const isAuthConfigured = await this.isProviderRegistered('@adonisjs/auth/auth_provider')
    const isLucidConfigured = await this.isProviderRegistered('@adonisjs/lucid/database_provider')
    const isMailConfigured = await this.isProviderRegistered('@adonisjs/mail/mail_provider')

    if (!isLucidConfigured) {
      this.logger.log(
        this.colors.blue("You'll need @adonisjs/lucid installed and configured to continue")
      )
      await ace.exec('add', ['@adonisjs/lucid'])
    }

    if (!isAuthConfigured) {
      this.logger.log(
        this.colors.blue("You'll need @adonisjs/auth installed and configured to continue")
      )
      await ace.exec('add', ['@adonisjs/auth'])
    }

    if (!isMailConfigured) {
      this.logger.log(
        this.colors.blue("You'll need @adonisjs/mail installed and configured to continue")
      )
      await ace.exec('add', ['@adonisjs/mail'])
    }

    await this.boot()

    await this.codemods.installPackages([
      ...TailwindScaffold.installs,
      ...JumpstartScaffold.installs,
    ])

    await new TailwindScaffold(this.command).run()

    await this.#updateEnv()
    await this.#enableHttpMethodSpoofing()
    await this.#registerPreloads()
    await this.#generateStubs()
    await this.#updateRoutes()
    await this.#updateUserModel()

    this.logger.success('Jumpstart is all set! Visit /welcome to get started.')
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

    this.logger.action('update config/app.ts -> enabled HTTP Method Spoofing').succeeded()
  }

  async #registerPreloads() {
    await this.codemods.makeUsingStub(stubsRoot, 'start/globals.stub', {})
    await this.codemods.updateRcFile((rcFile) => {
      rcFile.addPreloadFile('#start/globals')
    })
  }

  async #generateStubs() {
    //* NOTE: copy utils from base_scaffold exist because Tempura throws an exception on the backticked contents (escaped or not)

    // stubs -> views -- using cp due to the number of files
    await cp(this.app.makePath(stubsRoot, 'views'), this.app.viewsPath(), {
      recursive: true,
      force: false,
    })

    this.logger
      .action(`copy ${this.getLogPath(this.app.viewsPath())} -> pages, emails, components`)
      .succeeded()

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

  async #updateRoutes() {
    const project = await this.codemods.getTsMorphProject()
    const file = project?.getSourceFile(this.app.startPath('routes.ts'))

    if (!file) {
      this.logger.warning('skipped route updates, routes file not found')
      return
    }

    if (!file.getImportDeclaration('#start/kernel')) {
      file.addImportDeclaration({ namedImports: ['middleware'], moduleSpecifier: '#start/kernel' })
    }

    const contents = file.getText()

    const lastImportIndex = file.getImportDeclarations().reverse().at(0)?.getChildIndex() ?? 0
    console.log({ lastImportIndex })
    file.insertVariableStatements(
      lastImportIndex + 1,
      [
        this.getConstDeclaration(file, {
          name: 'LoginController',
          initializer: "() => import('#controllers/auth/login_controller')",
        }),
        this.getConstDeclaration(file, {
          name: 'LogoutController',
          initializer: "() => import('#controllers/auth/logout_controller')",
        }),
        this.getConstDeclaration(file, {
          name: 'RegisterController',
          initializer: "() => import('#controllers/auth/register_controller')",
        }),
        this.getConstDeclaration(file, {
          name: 'ForgotPasswordController',
          initializer: "() => import('#controllers/auth/forgot_password_controller')",
        }),
        this.getConstDeclaration(file, {
          name: 'ProfileController',
          initializer: "() => import('#controllers/settings/profile_controller')",
        }),
        this.getConstDeclaration(file, {
          name: 'AccountController',
          initializer: "() => import('#controllers/settings/account_controller')",
        }),
      ].filter((declaration) => declaration !== undefined)
    )

    if (
      !file.getStatement((statement) => statement.getText().includes('settings.profile.update'))
    ) {
      file.addStatements(
        [
          '\n',
          "router.on('/welcome').render('pages/welcome').as('welcome')",
          '\n',
          '//* AUTH -> LOGIN, REGISTER, LOGOUT',
          "router.get('/login', [LoginController, 'show']).as('auth.login.show').use(middleware.guest())",
          "router.post('/login', [LoginController, 'store']).as('auth.login.store').use([middleware.guest()])",
          "router.get('/register', [RegisterController, 'show']).as('auth.register.show').use(middleware.guest())",
          "router.post('/register', [RegisterController, 'store']).as('auth.register.store').use([middleware.guest()])",
          "router.post('/logout', [LogoutController, 'handle']).as('auth.logout').use(middleware.auth())",
          '\n',
          '//* AUTH -> FORGOT PASSWORD',
          "router.get('/forgot-password', [ForgotPasswordController, 'index']).as('auth.password.index').use([middleware.guest()])",
          "router.post('/forgot-password', [ForgotPasswordController, 'send']).as('auth.password.send').use([middleware.guest()])",
          "router.get('/forgot-password/reset/:value', [ForgotPasswordController, 'reset']).as('auth.password.reset').use([middleware.guest()])",
          "router.post('/forgot-password/reset', [ForgotPasswordController, 'update']).as('auth.password.update').use([middleware.guest()])",
          '\n',
          '//* SETTINGS -> ACCOUNT',
          "router.get('/settings/account', [AccountController, 'index']).as('settings.account').use(middleware.auth())",
          "router.put('/settings/account/email', [AccountController, 'updateEmail']).as('settings.account.email').use(middleware.auth())",
          "router.delete('/settings/account', [AccountController, 'destroy']).as('settings.account.destroy').use(middleware.auth())",
          '\n',
          '//* SETTINGS -> PROFILE',
          "router.get('/settings/profile', [ProfileController, 'index']).as('settings.profile').use(middleware.auth())",
          "router.put('/settings/profile', [ProfileController, 'update']).as('settings.profile.update').use(middleware.auth())",
        ].filter((statement) => statement === '\n' || !contents.includes(statement))
      )
    }

    await file.save()

    this.logger.action('update start/routes.ts -> added jumpstart routes').succeeded()
  }

  async #updateUserModel() {
    const project = await this.codemods.getTsMorphProject()
    const file = project?.getSourceFile(this.app.modelsPath('user.ts'))
    const model = file?.getClass('User')
    const imports: Set<Import> = new Set()

    if (!model) {
      this.logger.warning('skipped user model updates, user model not found')
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

    if (!model.getProperty('rememberMeTokens')) {
      model.insertProperty(0, {
        isStatic: true,
        name: 'rememberMeTokens',
        initializer: 'DbRememberMeTokensProvider.forModel(User)',
      })
    }

    if (!model.getMethod('login')) {
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
    }

    if (!model.getMethod('register')) {
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
    }

    if (!model.getMethod('logout')) {
      const logout = model.addMethod({
        isStatic: true,
        isAsync: true,
        name: 'logout',
        parameters: [{ name: 'auth', type: 'Authenticator<Authenticators>' }],
      })

      logout.setBodyText(`await auth.use('web').logout()`)
    }

    if (!model.getMethod('updateEmail')) {
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
    }

    imports?.forEach((imp) => {
      const exists = file?.getImportDeclaration(imp.module)

      if (exists) return

      file?.addImportDeclaration({
        defaultImport: imp.defaultImport,
        namedImports: imp.namedImports,
        moduleSpecifier: imp.module,
      })
    })

    file?.formatText()

    await file?.save()

    this.logger.action('update app/models/user -> added auth methods').succeeded()
  }
}
