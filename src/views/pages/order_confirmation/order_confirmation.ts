const orderConfirmationPage = {
  title: 'Order Confirmed',
  eyebrow: 'Thank You',
  intro: 'Your order has been placed. Here is a summary of what you ordered.',
  actions: [
    {
      id: 'view-order-history',
      label: 'View Order History',
      href: '/order_history',
    },
    {
      id: 'continue-shopping',
      label: 'Continue Shopping',
      className: 'secondary',
      href: '/product_browse',
    },
  ],
};

export default orderConfirmationPage;
