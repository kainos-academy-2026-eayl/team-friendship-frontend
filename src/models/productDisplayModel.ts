export interface Product {
    id: number;
    name: string;
    description: string;
    price: string;
    imageUrl: string;
    stock: number;
}

export type ProductResult =
    | { ok: true; product: Product; }
    | { ok: false; status: 404 | 502; message: string; };
