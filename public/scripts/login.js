const form = document.getElementById('login-form');
const status = document.getElementById('status');

document.getElementById('sign-up')?.addEventListener('click', () => {
  window.location.assign('/register');
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = document.getElementById('login-submit');
  submit.disabled = true;
  status.textContent = '';

  try {
    const response = await fetch(`${form.dataset.apiUrl}/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form))),
    });
    const body = await response.json().catch(() => ({}));

    if (response.ok) {
      status.textContent = body.message ?? 'Login successful';
      window.location.assign('/home');
      return;
    }

    const fieldErrors = Object.values(body.details ?? {}).flat();
    status.textContent = fieldErrors[0] ?? body.error ?? 'Login failed.';
  } catch {
    status.textContent = 'Unable to reach the server. Please try again.';
  } finally {
    submit.disabled = false;
  }
});
