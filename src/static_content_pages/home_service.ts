const homePage = {
  title: 'Welcome to Team Friendship',
  eyebrow: 'Online Shopping',
  intro:
    'Browse our products, discover great deals, and enjoy a seamless shopping experience.',
  actions: [
    /* login button */
    {
      id: 'login-button',
      label: 'Login',
      href: '/login',
      className: '',
    },
    /* register button */
    {
      id: 'register-button',
      label: 'Register Account',
      href: '/register',
      className: 'secondary',
    },
  ],
};

/* export home page content to app.ts */
export default homePage;
