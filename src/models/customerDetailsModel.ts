import { z } from 'zod';

export const customerDetailsSchema = z.object({
  customerID: z.number().int().positive(),
  customerForename: z.string(),
  customerSurname: z.string(),
  customerEmail: z.string(),
  customerPhone: z.string(),
  address: z.string(),
  postcode: z.string(),
});

export const customerEditFields = [
  {
    name: 'customerForename',
    label: 'First name',
    type: 'text',
    autocomplete: 'given-name',
    maxLength: 100,
  },
  {
    name: 'customerSurname',
    label: 'Surname',
    type: 'text',
    autocomplete: 'family-name',
    maxLength: 100,
  },
  {
    name: 'customerEmail',
    label: 'Email address',
    type: 'email',
    autocomplete: 'email',
    maxLength: 254,
  },
  {
    name: 'customerPhone',
    label: 'Phone number',
    type: 'tel',
    autocomplete: 'tel',
    maxLength: 50,
  },
  {
    name: 'address',
    label: 'Address',
    type: 'text',
    autocomplete: 'street-address',
    maxLength: 500,
  },
  {
    name: 'postcode',
    label: 'Postcode',
    type: 'text',
    autocomplete: 'postal-code',
    maxLength: 20,
  },
] as const;

export const customerEditFieldNames = [
  ...customerEditFields.map((field) => field.name),
  'password',
];
