import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const script = readFileSync('public/scripts/product-quantity.js', 'utf8');

function setup() {
  const status = { textContent: '' };
  class Button {
    name = 'direction';
    value = 'increase';
    disabled = false;
    getAttribute() {
      return '/products/12/quantity';
    }
    focus = vi.fn();
  }
  const button = new Button();
  const nextButton = new Button();
  const decrease = new Button();
  decrease.value = 'decrease';
  class Form {
    matches() {
      return true;
    }
    querySelectorAll() {
      return [button];
    }
  }
  const form = new Form();
  const content = {
    querySelector: () => status,
    querySelectorAll: () => [nextButton, decrease],
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    replaceChildren: vi.fn(),
  };
  const updated = { childNodes: ['updated product'] };
  let submit: (event: unknown) => Promise<void>;
  const fetch = vi.fn(
    async (_url?: string, _options?: { body: URLSearchParams }) => ({
      url: 'http://localhost/products/12/quantity',
      ok: true,
      text: async () => '<html></html>',
    }),
  );
  vm.runInNewContext(script, {
    document: {
      addEventListener: (_name: string, handler: typeof submit) => {
        submit = handler;
      },
      querySelector: () => content,
    },
    HTMLFormElement: Form,
    HTMLButtonElement: Button,
    FormData: class extends Map {
      constructor() {
        super();
        this.set('quantity', '1');
      }
    },
    DOMParser: class {
      parseFromString() {
        return { querySelector: () => updated };
      }
    },
    URLSearchParams,
    URL,
    fetch,
    Error,
    console: { error: vi.fn() },
  });
  const event = { target: form, submitter: button, preventDefault: vi.fn() };
  return {
    run: () => submit(event),
    fetch,
    content,
    status,
    button,
    nextButton,
    decrease,
    event,
  };
}

describe('in-place product quantity selection', () => {
  it('submits the current quantity and direction without navigating', async () => {
    const test = setup();
    await test.run();
    expect(test.event.preventDefault).toHaveBeenCalled();
    expect(test.fetch).toHaveBeenCalledWith(
      '/products/12/quantity',
      expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
    );
    expect(test.fetch.mock.calls[0]?.[1]?.body.toString()).toBe(
      'quantity=1&direction=increase',
    );
    expect(test.content.replaceChildren).toHaveBeenCalledWith(
      'updated product',
    );
    expect(test.status.textContent).toBe('Quantity updated.');
    expect(test.nextButton.focus).toHaveBeenCalled();
    expect(test.button.disabled).toBe(false);
    expect(test.content.removeAttribute).toHaveBeenCalledWith('aria-busy');
  });

  it('preserves normal add-to-basket submission', async () => {
    const test = setup();
    test.button.name = '';
    await test.run();
    expect(test.event.preventDefault).not.toHaveBeenCalled();
    expect(test.fetch).not.toHaveBeenCalled();
  });

  it('serializes selection updates and prevents adding while pending', async () => {
    const test = setup();
    const pending = test.run();
    expect(test.button.disabled).toBe(true);
    await test.run();
    await pending;
    expect(test.fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps new stock-limit controls disabled and focuses an available control', async () => {
    const test = setup();
    test.nextButton.disabled = true;
    await test.run();
    expect(test.nextButton.disabled).toBe(true);
    expect(test.nextButton.focus).not.toHaveBeenCalled();
    expect(test.decrease.focus).toHaveBeenCalled();
  });

  it('reports server errors instead of success', async () => {
    const test = setup();
    const response = await test.fetch();
    test.fetch.mockResolvedValue({ ...response, ok: false });
    await test.run();
    expect(test.status.textContent).toContain('Unable to update quantity');
  });

  it('reports network errors and restores controls without navigating', async () => {
    const test = setup();
    test.fetch.mockRejectedValue(new Error('Connection lost'));
    await test.run();
    expect(test.content.replaceChildren).not.toHaveBeenCalled();
    expect(test.status.textContent).toContain('Reload the product');
    expect(test.button.disabled).toBe(false);
  });

  it('rejects unexpected redirects without replacing the product', async () => {
    const test = setup();
    const response = await test.fetch();
    test.fetch.mockResolvedValue({
      ...response,
      url: 'http://localhost/login',
    });
    await test.run();
    expect(test.content.replaceChildren).not.toHaveBeenCalled();
    expect(test.status.textContent).toContain('Reload the product');
  });
});
