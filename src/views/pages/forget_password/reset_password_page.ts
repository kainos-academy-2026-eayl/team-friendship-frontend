const resetPasswordPage = {
  title: 'Reset Password',
  eyebrow: 'Account Recovery',
  intro: 'Enter your new password, then enter it again to confirm.',
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

export default resetPasswordPage;
