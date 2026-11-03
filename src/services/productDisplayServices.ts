import { z } from 'zod';

const backendProductSchema = z.object({
    productID: z.number().int().positive(),
    productName: z.string(),
    productDescription: z.string(),
    productPrice: z.number().nonnegative(),
    productImage: z.string(),
    productStock: z.number().int().nonnegative(),
});

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
    | { ok: false; message: string; };


function toProduct(product: z.infer<typeof backendProductSchema>): Product {
    return {
        id: product.productID,
        name: product.productName,
        description: product.productDescription,
        price: product.productPrice.toFixed(2),
        imageUrl: `/images/products_images/${product.productImage.split('/').pop()}`,
        stock: product.productStock,
    };
}

export async function getProduct(
    apiUrl: string,
    productId: number,
): Promise<ProductResult> {
    try {
        const response = await fetch(
            `${apiUrl}/products/${productId}`,
            {
                headers: { accept: 'application/json' },
            },
        );

        if (!response.ok) {
            return { ok: false, message: 'Unable to load product.' };
        }

        const result = backendProductSchema.safeParse(
            await response.json(),
        );

        if (!result.success) {
            console.error(
                'Unexpected product response',
                z.flattenError(result.error),
            );

            return {
                ok: false,
                message: 'Unable to load product.',
            };
        }

        return {
            ok: true,
            product: toProduct(result.data),
        };
    } catch {
        return {
            ok: false,
            message: 'Unable to reach the server. Please try again.',
        };
    }
}


