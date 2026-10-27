const productPage = {
  title: 'Product name',
  eyebrow: 'Product details',
  description: 'Product description',
  image: {
    src: '',
    alt: 'Product image',
  },
  price: '£0.00',
  availability: 'Stock availability',
  quantityField: {
    id: 'quantity',
    name: 'quantity',
    label: 'Quantity',
    type: 'number',
    min: '1',
    value: '1',
  },
  actions: [
    /* add to basket button */
    {
      id: 'add-to-basket',
      type: 'submit',
      label: 'Add to Basket',
      disabled: true,
    },
    /* continue shopping button */
    {
      id: 'continue-shopping',
      type: 'button',
      label: 'Continue Shopping',
      className: 'secondary',
    },
  ],
};

/* export product display page content to app.ts */
export default productPage;
