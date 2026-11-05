for (const button of document.querySelectorAll('[data-password-toggle]')) {
  const input = document.getElementById(button.getAttribute('aria-controls'));
  if (!(input instanceof HTMLInputElement) || input.type !== 'password') {
    console.error(
      'Password visibility control has no matching password input.',
    );
    continue;
  }

  button.hidden = false;
  button.addEventListener('click', () => {
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute(
      'aria-label',
      `${visible ? 'Hide' : 'Show'} ${button.dataset.passwordLabel}`,
    );
  });
}
