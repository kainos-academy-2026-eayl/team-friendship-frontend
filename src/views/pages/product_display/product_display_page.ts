const productPage = {
  title: 'Product Details',
  eyebrow: 'Product Information',
  actions: [
    {
      id: 'add-to-basket',
      type: 'submit',
      label: 'Add to Basket',
      href: '/basket',
    },
    {
      id: 'continue-shopping',
      type: 'link',
      label: 'Continue Shopping',
      className: 'secondary',
      href: '/product_browse',
    },
  ],
};

export default productPage;
