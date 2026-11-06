import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const script = readFileSync('public/scripts/basket.js', 'utf8');

function setup() {
  const status = { textContent: '' };
  class Button {
    name = 'direction';
    value = 'increase';
    disabled = false;
    getAttribute() {
      return null;
    }
    focus = vi.fn();
  }
  const button = new Button();
  class Form {
    action = 'http://localhost/basket/1/quantity';
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
    querySelectorAll: (selector: string) =>
      selector === 'form' ? [form] : [button],
    setAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    replaceChildren: vi.fn(),
  };
  const link = { replaceWith: vi.fn() };
  const newLink = {};
  const updated = { childNodes: ['updated basket'] };
  let submit: (event: unknown) => Promise<void>;
  const fetch = vi.fn(async () => ({
    url: 'http://localhost/basket',
    ok: true,
    text: async () => '<html></html>',
  }));
  vm.runInNewContext(script, {
    document: {
      addEventListener: (_name: string, handler: typeof submit) => {
        submit = handler;
      },
      querySelector: (selector: string) =>
        selector === '.header-basket' ? link : content,
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
        return {
          querySelector: (selector: string) =>
            selector === '.header-basket' ? newLink : updated,
        };
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
    link,
    newLink,
    button,
    event,
  };
}

describe('in-place basket updates', () => {
  it('prevents navigation and updates basket content and header after a successful save', async () => {
    const test = setup();
    await test.run();
    expect(test.event.preventDefault).toHaveBeenCalled();
    expect(test.fetch).toHaveBeenCalledWith(
      'http://localhost/basket/1/quantity',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(test.content.replaceChildren).toHaveBeenCalledWith('updated basket');
    expect(test.link.replaceWith).toHaveBeenCalledWith(test.newLink);
    expect(test.status.textContent).toBe('Basket updated.');
    expect(test.button.disabled).toBe(false);
    expect(test.content.removeAttribute).toHaveBeenCalledWith('aria-busy');
  });

  it('prevents a second update while the first is in flight', async () => {
    const test = setup();
    const pending = test.run();
    await test.run();
    await pending;
    expect(test.fetch).toHaveBeenCalledTimes(1);
  });

  it('reports network errors without changing the displayed basket or navigating', async () => {
    const test = setup();
    test.fetch.mockRejectedValue(
      new Error('Connection lost. Reload before retrying.'),
    );
    await test.run();
    expect(test.content.replaceChildren).not.toHaveBeenCalled();
    expect(test.status.textContent).toContain(
      'Reload your basket before trying again',
    );
    expect(test.button.disabled).toBe(false);
  });
});
