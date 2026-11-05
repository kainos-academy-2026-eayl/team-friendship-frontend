const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3000';

export async function getBasket(customerId: number) {
    try {
        const response = await fetch(
            `${BACKEND_URL}/basket/${customerId}`,
            {
                headers: {
                    accept: 'application/json',
                },
            },
        );

        return await response.json();
    } catch (error) {
        console.error('Basket fetch error:', error);
        throw error;
    }
}

export async function addToBasket(
    customerID: number,
    productID: number,
    quantity: number,
) {
    const response = await fetch(`${BACKEND_URL}/basket`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            accept: 'application/json',
        },
        body: JSON.stringify({
            customerID,
            productID,
            quantity,
        }),
    });

    return await response.json();
}