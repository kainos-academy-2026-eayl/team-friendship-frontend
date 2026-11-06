import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const script = readFileSync('public/scripts/theme.js', 'utf8');

function setup(saved: string | null = null, dark = false, blocked = false) {
  const root = { dataset: {} as Record<string, string> };
  const attributes: Record<string, string> = {};
  const toggle = {
    hidden: true,
    setAttribute: (key: string, value: string) => {
      attributes[key] = value;
    },
    addEventListener: vi.fn(),
  };
  const status = { textContent: '' };
  const documentEvents = new Map<string, () => void>();
  const windowEvents = new Map<
    string,
    (event: { key: string | null; newValue: string | null }) => void
  >();
  const systemEvents = new Map<string, () => void>();
  const media = {
    matches: dark,
    addEventListener: (event: string, callback: () => void) =>
      systemEvents.set(event, callback),
  };
  const storage = {
    getItem: vi.fn(() => {
      if (blocked) throw new Error('Storage disabled');
      return saved;
    }),
    setItem: vi.fn((_key: string, _value: string) => {
      if (blocked) throw new Error('Storage disabled');
    }),
  };
  const warn = vi.fn();
  runInNewContext(script, {
    document: {
      documentElement: root,
      getElementById: (id: string) => (id === 'theme-toggle' ? toggle : status),
      addEventListener: (event: string, callback: () => void) =>
        documentEvents.set(event, callback),
    },
    localStorage: storage,
    matchMedia: () => media,
    addEventListener: (
      event: string,
      callback: (event: {
        key: string | null;
        newValue: string | null;
      }) => void,
    ) => windowEvents.set(event, callback),
    console: { warn },
  });
  const themeBeforeDomReady = root.dataset.theme;
  documentEvents.get('DOMContentLoaded')?.();
  const click = () => toggle.addEventListener.mock.calls[0]?.[1]();
  return {
    root,
    attributes,
    toggle,
    status,
    storage,
    media,
    systemEvents,
    windowEvents,
    click,
    warn,
    themeBeforeDomReady,
  };
}

describe('shared theme preference', () => {
  it.each([false, true])(
    'uses device preference (dark=%s) before rendering',
    (dark) => {
      const app = setup(null, dark);
      expect(app.themeBeforeDomReady).toBe(dark ? 'dark' : 'light');
      expect(app.toggle.hidden).toBe(false);
      expect(app.attributes['aria-checked']).toBe(String(dark));
    },
  );

  it.each(['light', 'dark'])(
    'restores saved %s regardless of device preference',
    (saved) => {
      const app = setup(saved, saved !== 'dark');
      expect(app.root.dataset.theme).toBe(saved);
    },
  );

  it('switches in both directions and saves the choice for subsequent pages', () => {
    const app = setup();
    app.click();
    expect(app.root.dataset.theme).toBe('dark');
    expect(app.attributes['aria-checked']).toBe('true');
    expect(app.storage.setItem).toHaveBeenLastCalledWith(
      'friendshop-theme',
      'dark',
    );
    expect(setup('dark').root.dataset.theme).toBe('dark');
    app.click();
    expect(app.root.dataset.theme).toBe('light');
    expect(app.storage.setItem).toHaveBeenLastCalledWith(
      'friendshop-theme',
      'light',
    );
  });

  it('follows device changes until the user chooses a theme', () => {
    const app = setup();
    app.media.matches = true;
    app.systemEvents.get('change')?.();
    expect(app.root.dataset.theme).toBe('dark');
    app.click();
    app.systemEvents.get('change')?.();
    expect(app.root.dataset.theme).toBe('light');
  });

  it('ignores invalid stored values', () => {
    expect(setup('invalid', true).root.dataset.theme).toBe('dark');
  });

  it('synchronises changes from other tabs and follows the device when cleared', () => {
    const app = setup();
    app.windowEvents.get('storage')?.({
      key: 'friendshop-theme',
      newValue: 'dark',
    });
    expect(app.root.dataset.theme).toBe('dark');
    app.windowEvents.get('storage')?.({ key: null, newValue: null });
    expect(app.root.dataset.theme).toBe('light');
  });

  it('keeps working with an explicit warning when browser storage is blocked', () => {
    const app = setup(null, false, true);
    app.click();
    expect(app.root.dataset.theme).toBe('dark');
    expect(app.warn).toHaveBeenCalled();
    expect(app.status.textContent).toContain('cannot save this preference');
  });
});
