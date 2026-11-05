const homePage = {
  title: 'Welcome to Team Friendship',
  eyebrow: 'Online Shopping',
  intro:
    'Browse our products, discover great deals, and enjoy a seamless shopping experience.',
  featuredProducts: [
    { name: 'Monopoly', imageUrl: '/images/products_images/monopoly.webp' },
    { name: 'Catan', imageUrl: '/images/products_images/catan.webp' },
    { name: 'Cluedo', imageUrl: '/images/products_images/cluedo.webp' },
    { name: 'Furby', imageUrl: '/images/products_images/furby.webp' },
    { name: 'Hula hoop', imageUrl: '/images/products_images/hulaHoop.webp' },
    {
      name: 'Game of Life',
      imageUrl: '/images/products_images/gameOfLife.webp',
    },
  ],
  actions: [
    {
      id: 'login-button',
      label: 'Login',
      href: '/login',
      className: '',
    },
    {
      id: 'register-button',
      label: 'Register Account',
      href: '/register',
      className: 'secondary',
    },
  ],
};

export default homePage;
