const registerPage = {
  title: 'Create an account | Team Friendship',
  brandName: 'Team Friendship',
  eyebrow: 'New user',
  heading: 'Create an account',
  intro: 'Register for a Team Friendship account.',
  formAction: '/register',

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
      id: 'username',
      name: 'username',
      label: 'Username',
      type: 'text',
      autocomplete: 'username',
      placeholder: 'Choose a username',
      minlength: 3,
      ariaDescribedBy: 'username-error',
      errorId: 'username-error',
    },
    {
      id: 'password',
      name: 'password',
      label: 'Password',
      type: 'password',
      autocomplete: 'new-password',
      placeholder: 'Enter a password',
    },
    {
      id: 'confirm-password',
      name: 'confirmPassword',
      label: 'Confirm password',
      type: 'password',
      autocomplete: 'new-password',
      placeholder: 'Re-enter your password',
      ariaDescribedBy: 'password-error',
      errorId: 'password-error',
    },
  ],

  actions: [
    {
      id: 'register-submit',
      type: 'submit',
      label: 'Register',
      disabled: true,
    },
    {
      id: 'back-to-login',
      type: 'button',
      label: 'Back to login',
      className: 'secondary',
      disabled: true,
    },
  ],
};

export default registerPage;
