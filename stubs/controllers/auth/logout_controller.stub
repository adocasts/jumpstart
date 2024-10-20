import User from '#models/user'
import type { HttpContext } from '@adonisjs/core/http'

export default class LogoutController {
  async handle({ response, auth, session }: HttpContext) {
    await User.logout(auth)

    session.flash('success', 'See you next time')

    return response.redirect().toRoute('auth.login.show')
  }
}
