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
        {
            id: 'add-to-basket',
            type: 'submit',
            label: 'Add to Basket',
            disabled: true,
        },
        {
            id: 'continue-shopping',
            type: 'button',
            label: 'Continue Shopping',
            className: 'secondary',
        },
    ],
};

export default productPage;