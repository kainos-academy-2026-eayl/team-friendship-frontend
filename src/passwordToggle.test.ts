import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const script = readFileSync('public/scripts/password-toggle.js', 'utf8');

class PasswordInput {
  type = 'password';
  value = 'Secret123!';
}

function setup() {
  const inputs = [new PasswordInput(), new PasswordInput()];
  const clicks: (() => void)[] = [];
  const buttons = inputs.map((_input, index) => ({
    hidden: true,
    dataset: { passwordLabel: index === 0 ? 'password' : 'confirm password' },
    attributes: {} as Record<string, string>,
    getAttribute: () => String(index),
    setAttribute(key: string, value: string) {
      this.attributes[key] = value;
    },
    addEventListener(_event: string, click: () => void) {
      clicks[index] = click;
    },
  }));
  runInNewContext(script, {
    HTMLInputElement: PasswordInput,
    document: {
      querySelectorAll: () => buttons,
      getElementById: (id: string) => inputs[Number(id)],
    },
    console: { error: vi.fn() },
  });
  return { inputs, buttons, clicks };
}

describe('registration password visibility', () => {
  it('shows and hides the password without changing its value', () => {
    const { inputs, buttons, clicks } = setup();
    expect(buttons[0]?.hidden).toBe(false);
    clicks[0]?.();
    expect(inputs[0]?.type).toBe('text');
    expect(inputs[0]?.value).toBe('Secret123!');
    expect(buttons[0]?.attributes).toEqual({
      'aria-pressed': 'true',
      'aria-label': 'Hide password',
    });
    clicks[0]?.();
    expect(inputs[0]?.type).toBe('password');
    expect(buttons[0]?.attributes['aria-label']).toBe('Show password');
  });

  it('toggles confirm password independently', () => {
    const { inputs, buttons, clicks } = setup();
    clicks[1]?.();
    expect(inputs[0]?.type).toBe('password');
    expect(inputs[1]?.type).toBe('text');
    expect(buttons[1]?.attributes['aria-label']).toBe('Hide confirm password');
  });
});
