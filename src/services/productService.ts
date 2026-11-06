import { z } from 'zod';

const backendProductSchema = z.object({
  productID: z.number().int().positive(),
  productName: z.string(),
  productDescription: z.string(),
  productCategory: z.string().nullable(),
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
  category: string;
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
    category: product.productCategory ?? 'Uncategorised',
    price: product.productPrice.toFixed(2),
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

export function filterProductsByCategory(
  products: Product[],
  category: string | undefined,
): Product[] {
  const target = category?.trim().toLowerCase();
  if (!target) {
    return products;
  }
  return products.filter(
    (product) => product.category?.toLowerCase() === target,
  );
}

export function getCategories(products: Product[]): string[] {
  const byKey = new Map<string, string>();
  for (const product of products) {
    const key = (product.category ?? 'Uncategorised').toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, product.category ?? 'Uncategorised');
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );
}

export const productSortOptions = ['category-asc', 'category-desc'] as const;
export type ProductSort = (typeof productSortOptions)[number];

export function sortProducts(
  products: Product[],
  sort: ProductSort | undefined,
): Product[] {
  if (!sort) {
    return products;
  }
  const direction = sort === 'category-desc' ? -1 : 1;
  return [...products].sort(
    (a, b) =>
      direction *
        (a.category ?? 'Uncategorised').localeCompare(
          b.category ?? 'Uncategorised',
          undefined,
          {
            sensitivity: 'base',
          },
        ) || a.name.localeCompare(b.name),
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
