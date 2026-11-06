import { z } from 'zod';

export const confirmationOrderSchema = z.object({
  orderID: z.number().int().positive(),
  customerID: z.number().int().positive(),
  dateCreated: z.iso.datetime(),
  status: z.string().min(1),
  orderServices: z
    .array(
      z.object({
        quantity: z.number().int().positive(),
        product: z.object({ productName: z.string().min(1) }),
      }),
    )
    .min(1),
});
