import { Mailable } from "arcanajs/mail";

/**
 * Password Reset Email
 *
 * Sent when a user requests a password reset
 */
export class PasswordResetEmail extends Mailable {
  constructor(
    private user: { name: string; email: string },
    private resetToken: string
  ) {
    super();
  }

  build() {
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${this.resetToken}`;

    return this.to(this.user.email)
      .subject("Reset Your Password")
      .priority("high")
      .view("password-reset", {
        name: this.user.name,
        resetUrl,
        expiresIn: "1 hour",
      });
  }
}
