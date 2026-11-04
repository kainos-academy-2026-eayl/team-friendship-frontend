export const TOGGLE_PASSWORD_FIELD = 'togglePassword';
export const VISIBLE_PASSWORDS_FIELD = 'visiblePasswords';

interface FormField {
  name: string;
}

export interface PasswordState {
  visiblePasswords: string[];
  values: Record<string, string>;
}

export const emptyPasswordState: PasswordState = {
  visiblePasswords: [],
  values: {},
};

const toStringList = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).filter(
    (item): item is string => typeof item === 'string',
  );

export function isPasswordVisibilityField(key: string) {
  return key === TOGGLE_PASSWORD_FIELD || key === VISIBLE_PASSWORDS_FIELD;
}

// Works out which password fields should be shown after the eye was clicked,
// and keeps what the user already typed so the re-rendered form is not empty.
export function getPasswordState(
  body: Record<string, unknown>,
  fieldNames: readonly string[],
  passwordFieldNames: readonly string[],
): PasswordState {
  const visible = new Set(
    toStringList(body[VISIBLE_PASSWORDS_FIELD]).filter((name) =>
      passwordFieldNames.includes(name),
    ),
  );

  const toggled = body[TOGGLE_PASSWORD_FIELD];
  if (typeof toggled === 'string' && passwordFieldNames.includes(toggled)) {
    if (visible.has(toggled)) {
      visible.delete(toggled);
    } else {
      visible.add(toggled);
    }
  }

  const values = Object.fromEntries(
    fieldNames.map((name) => {
      const value = body[name];
      return [name, typeof value === 'string' ? value : ''];
    }),
  );

  return { visiblePasswords: [...visible], values };
}

export function applyPasswordState<T extends FormField>(
  fields: readonly T[],
  state: PasswordState = emptyPasswordState,
) {
  return fields.map((field) => ({
    ...field,
    value: state.values[field.name] ?? '',
    visible: state.visiblePasswords.includes(field.name),
  }));
}
