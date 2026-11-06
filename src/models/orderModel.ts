export interface OrderProduct {
  productID: number;
  productName: string;
  productDescription: string;
  productCategory: string;
  productPrice: number;
  productImage: string;
  productStock: number;
}

// Mirrors the backend Prisma `OrderService` model: one product line within an order.
export interface OrderService {
  orderID: number;
  productID: number;
  quantity: number;
  product: OrderProduct;
}

export interface Order {
  orderID: number;
  customerID: number;
  dateCreated: Date;
  status: string;
  address: string;
  postcode: string;
  discountCode: string | null;
  discountAmount: number;
  orderServices: OrderService[];
}

export interface OrderItem {
  productID: number;
  quantity: number;
}

export interface DeliveryAddress {
  address: string;
  postcode: string;
}

// Omitting address/postcode makes the backend use the customer's saved home address.
export interface CreateOrderRequest extends Partial<DeliveryAddress> {
  customerID: number;
  discountCode?: string;
  orderServices: OrderItem[];
}

export interface CreateOrderOptions {
  deliveryAddress?: DeliveryAddress;
  discountCode?: string;
}

export type OrderFailure = { ok: false; status: number; message: string };

export type OrderResult = { ok: true; order: Order } | OrderFailure;

export type OrdersResult = { ok: true; orders: Order[] } | OrderFailure;
