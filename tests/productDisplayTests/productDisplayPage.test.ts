import nunjucks from 'nunjucks';
import { expect, test } from 'vitest';

import productPage from '../../src/views/pages/product_display/product_display_page';

test('given the product id is 40, the rendered HTML contains Marble', () => {
  const html = nunjucks
    .configure(['src/views/pages', 'src/views'])
    .render('product_display/product_display.njk', {
      page: productPage,
      product: {
        id: 40,
        name: 'Marble',
        description: 'Bold and shiny, perfect for all your taskmaster needs',
        price: '30.88',
        imageUrl: '/images/products_images/marble.jpeg',
        stock: 10,
      },
    });

  expect(html).toMatch(/Marble/);
  expect(html).toContain('class="product-image"');
  expect(html).toContain('£30.88');
  expect(html).toContain('In Stock (10 available)');
  expect(html).toContain(
    'Bold and shiny, perfect for all your taskmaster needs',
  );
  expect(html).toContain('id="quantity"');
  expect(html).toContain('id="add-to-basket"');
  expect(html).toContain('id="continue-shopping"');
  expect(html).toContain('role="status"');
  expect(html).not.toContain('role="alert"');
});

test.each([
  'Invalid product id',
  'Unable to load product.',
  'Unable to reach the server. Please try again.',
])('renders an alert without product details for %s', (error) => {
  const html = nunjucks
    .configure(['src/views/pages', 'src/views'])
    .render('product_display/product_display.njk', {
      page: productPage,
      error,
    });

  expect(html).toContain(`role="alert">${error}</p>`);
  expect(html).not.toContain('class="product-image"');
  expect(html).not.toContain('id="product-title"');
  expect(html).not.toContain('class="price"');
  expect(html).not.toContain('class="availability"');
  expect(html).not.toContain('Out of Stock');
  expect(html).not.toContain('class="intro"');
  expect(html).not.toContain('id="product-form"');
  expect(html).not.toContain('id="quantity"');
  expect(html).not.toContain('id="add-to-basket"');
  expect(html).not.toContain('id="continue-shopping"');
  expect(html).not.toContain('role="status"');
});
