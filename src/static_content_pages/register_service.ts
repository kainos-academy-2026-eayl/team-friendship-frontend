const registerPage = {
  title: 'Create an account | Team Friendship',
  brandName: 'Team Friendship',
  eyebrow: 'New user',
  heading: 'Create an account',
  intro: 'Register for a Team Friendship account.',
  formAction: '/register',

  fields: [
    /* email field */
    {
      id: 'email',
      name: 'email',
      label: 'Email',
      type: 'email',
      autocomplete: 'email',
      placeholder: 'Enter your email address',
    },
    /* username field */
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
    /* password field */
    {
      id: 'password',
      name: 'password',
      label: 'Password',
      type: 'password',
      autocomplete: 'new-password',
      placeholder: 'Enter a password',
    },
    /* confirm password field */
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
    /* register button */
    {
      id: 'register-submit',
      type: 'submit',
      label: 'Register',
      disabled: true,
    },
    /* back to login button */
    {
      id: 'back-to-login',
      type: 'button',
      label: 'Back to login',
      className: 'secondary',
      disabled: true,
    },
  ],
};

/* export register page content to app.ts */
export default registerPage;
