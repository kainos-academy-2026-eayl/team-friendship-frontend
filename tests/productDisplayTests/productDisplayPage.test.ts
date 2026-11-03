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
});
