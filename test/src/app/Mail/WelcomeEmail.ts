import { Mailable } from "arcanajs/mail";

/**
 * Welcome Email
 *
 * Sent to new users when they register
 */
export class WelcomeEmail extends Mailable {
  constructor(private user: { name: string; email: string }) {
    super();
  }

  build() {
    return this.to(this.user.email)
      .subject("Welcome to ArcanaJS!")
      .view("welcome", {
        name: this.user.name,
        appName: "ArcanaJS",
        loginUrl: `${process.env.APP_URL}/login`,
      });
  }
}
