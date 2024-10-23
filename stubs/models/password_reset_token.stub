import { DateTime, DurationLikeObject } from 'luxon'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import User from './user.js'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import string from '@adonisjs/core/helpers/string'
import encryption from '@adonisjs/core/services/encryption'
import router from '@adonisjs/core/services/router'
import mail from '@adonisjs/mail/services/main'
import env from '#start/env'
import { Exception } from '@adonisjs/core/exceptions'
import app from '@adonisjs/core/services/app'

export default class PasswordResetToken extends BaseModel {
  // how long the token will remain valid after creation
  static validFor: DurationLikeObject = { hour: 1 }

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare value: string

  @column.dateTime()
  declare expiresAt: DateTime

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  get isValid() {
    return this.expiresAt > DateTime.now()
  }

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  // #region Methods

  /**
   * Creates a password reset token and sends a "forgot password" email
   * @param email user's email
   * @returns
   */
  static async send(email: string) {
    const user = await User.findBy('email', email)
    const value = string.generateRandom(32)
    const encryptedValue = encryption.encrypt(value)

    // silently fail if email does not exist
    if (!user) return

    await this.expireAllForUser(user)
    await this.create({
      expiresAt: DateTime.now().plus(this.validFor),
      userId: user.id,
      value,
    })

    const resetLink = router
      .builder()
      .prefixUrl(env.get('APP_URL'))
      .params({ value: encryptedValue })
      .make('auth.password.reset')

    await mail.sendLater((message) => {
      message
        .subject(`Reset your ${app.appName} password`)
        .to(user.email)
        .htmlView('emails/auth/forgot_password', {
          user,
          resetLink,
          validFor: Object.keys(this.validFor).reduce(
            (acc, key) => `${acc} ${this.validFor[key as keyof DurationLikeObject]} ${key}`.trim(),
            ''
          ),
        })
    })
  }

  /**
   * Validates the password reset token and update's the user's password
   * @param encryptedValue encrypted password reset token value
   * @param password user's new password
   * @returns
   */
  static async reset(encryptedValue: string, password: string) {
    const { isValid, user } = await this.verify(encryptedValue)

    // if the token is invalid or not matched to a user, throw invalid exception
    if (!isValid || !user) {
      throw new Exception('The password reset token provided is invalid or expired', {
        status: 403,
        code: 'E_INVALID_PASSWORD_RESET_TOKEN',
      })
    }

    await user.merge({ password }).save()
    await this.expireAllForUser(user)

    const loginLink = router.builder().prefixUrl(env.get('APP_URL')).make('auth.login.show')

    await mail.sendLater((message) => {
      message
        .subject(`Your ${app.appName} password has been reset`)
        .to(user.email)
        .htmlView('emails/auth/password_reset', {
          user,
          loginLink,
        })
    })

    return user
  }

  /**
   * Verifies the password reset token value and matches to a user
   * @param encryptedValue encrypted password reset token value
   * @returns
   */
  static async verify(encryptedValue: string) {
    const value = encryption.decrypt(encryptedValue)
    const token = await this.findBy({ value })
    const user = await token?.related('user').query().first()

    return {
      isValid: token?.isValid,
      token,
      user,
    }
  }

  /**
   * Expires all pending password reset tokens for the provided user
   * @param user user model
   */
  static async expireAllForUser(user: User) {
    await PasswordResetToken.query()
      .where('userId', user.id)
      .where('expiresAt', '>=', DateTime.now().toSQL({ includeOffset: false }))
      .update({
        expiresAt: DateTime.now().toSQL({ includeOffset: false }),
        updatedAt: DateTime.now().toSQL({ includeOffset: false }),
      })
  }

  // #endregion
}
