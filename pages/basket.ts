const basketPage = {
    title: 'Basket',
    eyebrow: 'Shopping Basket',
    intro: 'Review the items in your basket before checkout.',
    products: [
        {
            name: 'Product Name',
            quantity: '1',
            totalPrice: '£0.00',
            image: {
                src: '',
                alt: 'Product image'
            }
        }
    ],
    basketTotal: '£0.00',
    actions: [
        {
            id: 'checkout',
            type: 'button',
            label: 'Checkout'
        }
    ]
};

export default basketPage;
