for (const button of document.querySelectorAll('[data-password-toggle]')) {
  const input = document.getElementById(button.dataset.passwordToggle);
  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Password visibility control has no matching input.');
  }

  const label = button.getAttribute('aria-label').replace(/^Show /, '');
  button.hidden = false;
  button.addEventListener('click', () => {
    const showPassword = input.type === 'password';
    input.type = showPassword ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(showPassword));
    button.setAttribute(
      'aria-label',
      `${showPassword ? 'Hide' : 'Show'} ${label}`,
    );
  });
}
