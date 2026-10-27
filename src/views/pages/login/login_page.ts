const loginPage = {
  title: 'E-commerce login',
  eyebrow: 'Welcome back',
  intro: 'Log in to your account to continue shopping.',
  fields: [
    {
      id: 'email',
      name: 'email',
      label: 'Email',
      type: 'email',
      autocomplete: 'email',
      placeholder: 'Enter your email address',
    },
    {
      id: 'password',
      name: 'password',
      label: 'Password',
      type: 'password',
      autocomplete: 'current-password',
      placeholder: 'Enter your password',
    },
  ],
  forgotPassword: {
    id: 'forgot-password',
    label: 'Forgot password?',
  },
  actions: [
    {
      id: 'login-submit',
      type: 'submit',
      label: 'Login',
    },
    {
      id: 'sign-up',
      type: 'button',
      label: 'Sign up',
      className: 'secondary',
    },
  ],
};

export default loginPage;
