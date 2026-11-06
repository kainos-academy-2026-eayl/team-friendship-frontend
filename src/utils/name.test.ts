import { describe, expect, it } from 'vitest';
import { capitaliseName } from './name';

describe('display name capitalisation', () => {
  it.each([
    ['emma', 'Emma'],
    ['mcDonald', 'McDonald'],
    ["o'Neill", "O'Neill"],
    ['  ada  ', 'Ada'],
    ['', ''],
  ])(
    'formats %j as %j without lowercasing other letters',
    (input, expected) => {
      expect(capitaliseName(input)).toBe(expected);
    },
  );
});
