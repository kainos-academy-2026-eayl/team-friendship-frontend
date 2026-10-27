const basketPage = {
  title: 'Basket',
  eyebrow: 'Shopping Basket',
  intro: 'Review the items in your basket before checkout.',
  products: [
    /* product item */
    {
      name: 'Product Name',
      quantity: '1',
      totalPrice: '£0.00',
      image: {
        src: '',
        alt: 'Product image',
      },
    },
  ],
  basketTotal: '£0.00',
  actions: [
    /* checkout button */
    {
      id: 'checkout',
      type: 'button',
      label: 'Checkout',
      disabled: true,
    },
  ],
};

/* export basket page content to app.ts */
export default basketPage;
