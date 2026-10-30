import { z } from 'zod';

const backendProductSchema = z.object({
  productID: z.number().int().positive(),
  productName: z.string(),
  productDescription: z.string(),
  productPrice: z.number().nonnegative(),
  productImage: z.string(),
  productStock: z.number().int().nonnegative(),
});

const productsResponseSchema = z.object({
  products: z.array(backendProductSchema),
});

export interface Product {
  id: number;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
  stock: number;
}

export type ProductsResult =
  | { ok: true; products: Product[] }
  | { ok: false; message: string };

function toProduct(product: z.infer<typeof backendProductSchema>): Product {
  return {
    id: product.productID,
    name: product.productName,
    description: product.productDescription,
    price: product.productPrice.toFixed(2),
    // Backend may send a full URL or relative path; images are served from public/images.
    imageUrl: `/images/products_images/${product.productImage.split('/').pop()}`,
    stock: product.productStock,
  };
}

export function filterProducts(
  products: Product[],
  searchTerm: string,
): Product[] {
  const term = searchTerm.trim().toLowerCase();
  if (!term) {
    return products;
  }
  return products.filter(
    (product) =>
      product.name.toLowerCase().includes(term) ||
      product.description.toLowerCase().includes(term),
  );
}

export async function getProducts(apiUrl: string): Promise<ProductsResult> {
  try {
    const response = await fetch(`${apiUrl}/products`, {
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      return { ok: false, message: 'Unable to load products.' };
    }

    const result = productsResponseSchema.safeParse(await response.json());
    if (!result.success) {
      console.error(
        'Unexpected products response',
        z.flattenError(result.error),
      );
      return { ok: false, message: 'Unable to load products.' };
    }

    return { ok: true, products: result.data.products.map(toProduct) };
  } catch {
    return {
      ok: false,
      message: 'Unable to reach the server. Please try again.',
    };
  }
}
