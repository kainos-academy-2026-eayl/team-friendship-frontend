const forgotPasswordPage = {
  title: 'Forgot Password',
  eyebrow: 'Account Recovery',
  intro:
    'Enter the email address associated with your account and we will send password recovery instructions.',
  fields: [
    /* email field */
    {
      id: 'email',
      name: 'email',
      label: 'Email Address',
      type: 'email',
      autocomplete: 'email',
      placeholder: 'Enter your email address',
    },
  ],
  actions: [
    /* send recovery email button */
    {
      id: 'send-recovery-email',
      type: 'submit',
      label: 'Send Recovery Email',
      disabled: true,
    },
  ],
};

/* export forgot password page content to app.ts */
export default forgotPasswordPage;
