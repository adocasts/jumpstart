import PasswordResetToken from '#models/password_reset_token'
import { passwordResetSendValidator, passwordResetValidator } from '#validators/auth'
import type { HttpContext } from '@adonisjs/core/http'

export default class ForgotPasswordsController {
  #sentSessionKey = 'FORGOT_PASSWORD_SENT'

  async index({ view, session }: HttpContext) {
    const isSent = session.flashMessages.has(this.#sentSessionKey)

    return view.render('pages/auth/forgot_password/index', { isSent })
  }

  async send({ request, response, session }: HttpContext) {
    const { email } = await request.validateUsing(passwordResetSendValidator)

    await PasswordResetToken.send(email)

    session.flash(this.#sentSessionKey, true)

    return response.redirect().back()
  }

  async reset({ params, view }: HttpContext) {
    const { isValid, user } = await PasswordResetToken.verify(params.value)
    return view.render('pages/auth/forgot_password/reset', {
      value: params.value,
      email: user?.email,
      isValid,
    })
  }

  async update({ request, response, session }: HttpContext) {
    const data = await request.validateUsing(passwordResetValidator)

    await PasswordResetToken.reset(data.value, data.password)

    session.flash('success', 'Your password has been updated')

    return response.redirect().toRoute('auth.login.show')
  }
}
