import {
  applyPasswordState,
  emptyPasswordState,
  type PasswordState,
} from './passwordVisibilityService';

const resetPasswordPage = {
  title: 'Reset Password',
  eyebrow: 'Account Recovery',
  fields: [
    {
      id: 'new-password',
      name: 'newPassword',
      label: 'New password',
      placeholder: 'Enter your new password',
    },
    {
      id: 'confirm-password',
      name: 'confirmPassword',
      label: 'Confirm password',
      placeholder: 'Re-enter your new password',
    },
  ],
};

export type ResetPasswordErrors = {
  newPassword?: string[];
  confirmPassword?: string[];
};

export function validateResetPassword(
  newPassword: string,
  confirmPassword: string,
): ResetPasswordErrors {
  const errors: ResetPasswordErrors = {};
  const passwordErrors: string[] = [];

  if (newPassword.length < 8) {
    passwordErrors.push('Password must be at least 8 characters long.');
  }
  if (!/\d/.test(newPassword)) {
    passwordErrors.push('Password must contain at least one number.');
  }
  if (!/[^A-Za-z0-9]/.test(newPassword)) {
    passwordErrors.push(
      'Password must contain at least one special character.',
    );
  }
  if (passwordErrors.length > 0) {
    errors.newPassword = passwordErrors;
  }

  if (confirmPassword !== newPassword) {
    errors.confirmPassword = ['Passwords do not match.'];
  }

  return errors;
}

export function hasResetPasswordErrors(errors: ResetPasswordErrors) {
  return Boolean(errors.newPassword || errors.confirmPassword);
}

export const resetPasswordFieldNames = resetPasswordPage.fields.map(
  (field) => field.name,
);

export function getResetPasswordPage(
  email: string,
  token = '',
  errors: ResetPasswordErrors = {},
  passwordState: PasswordState = emptyPasswordState,
) {
  return {
    page: {
      ...resetPasswordPage,
      fields: applyPasswordState(resetPasswordPage.fields, passwordState),
    },
    email,
    token,
    errors,
  };
}
