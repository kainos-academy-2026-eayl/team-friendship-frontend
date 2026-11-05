const homePage = {
  title: 'Welcome to Team Friendship',
  eyebrow: 'Online Shopping',
  intro:
    'Browse our products, discover great deals, and enjoy a seamless shopping experience.',
  featuredProducts: [
    {
      id: '9',
      name: 'Monopoly',
      imageUrl: '/images/products_images/monopoly.webp',
    },
    { id: '12', name: 'Catan', imageUrl: '/images/products_images/catan.webp' },
    {
      id: '10',
      name: 'Cluedo',
      imageUrl: '/images/products_images/cluedo.webp',
    },
    { id: '4', name: 'Furby', imageUrl: '/images/products_images/furby.webp' },
    {
      id: '3',
      name: 'Hula hoop',
      imageUrl: '/images/products_images/hulaHoop.webp',
    },
    {
      id: '11',
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
