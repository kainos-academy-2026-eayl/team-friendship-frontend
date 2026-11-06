function backendUrl() {
  return process.env.BACKEND_URL ?? 'http://localhost:3000';
}

export async function getBasket(customerId: number) {
  const response = await fetch(`${backendUrl()}/basket/${customerId}`, {
    headers: {
      accept: 'application/json',
    },
  });

  return await response.json();
}

export async function addToBasket(
  customerID: number,
  productID: number,
  quantity: number,
) {
  const response = await fetch(`${backendUrl()}/basket`, {
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
