const loginPage = {
  title: 'E-commerce login',
  eyebrow: 'Welcome back',
  intro: 'Log in to your account to continue shopping.',
  fields: [
    /* username field */
    {
      id: 'username',
      name: 'username',
      label: 'Username',
      type: 'text',
      autocomplete: 'username',
      placeholder: 'Enter your username',
    },
    /* password field */
    {
      id: 'password',
      name: 'password',
      label: 'Password',
      type: 'password',
      autocomplete: 'current-password',
      placeholder: 'Enter your password',
    },
  ],
  /* forgot password link */
  forgotPassword: {
    id: 'forgot-password',
    label: 'Forgot password?',
  },
  actions: [
    /* login button */
    {
      id: 'login-submit',
      type: 'submit',
      label: 'Login',
      disabled: true,
    },
    /* sign up button */
    {
      id: 'sign-up',
      type: 'button',
      label: 'Sign up',
      className: 'secondary',
    },
  ],
};

/* export login page content to app.ts */
export default loginPage;
