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
  orderServices: OrderService[];
}

export interface OrderItem {
  productID: number;
  quantity: number;
}

export interface CreateOrderRequest {
  customerID: number;
  orderServices: OrderItem[];
}

export type OrderFailure = { ok: false; status: number; message: string };

export type OrderResult = { ok: true; order: Order } | OrderFailure;

export type OrdersResult = { ok: true; orders: Order[] } | OrderFailure;