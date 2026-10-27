const form = document.getElementById('registration-form');
const status = document.getElementById('registration-status');
const passwordError = document.getElementById('password-error');

document.getElementById('back-to-login')?.addEventListener('click', () => {
  window.location.assign('/login');
});

function showStatus(message) {
  status.textContent = message;
  status.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));

  if (data.password !== data.confirmPassword) {
    passwordError.textContent = 'Passwords do not match.';
    passwordError.hidden = false;
    return;
  }
  passwordError.hidden = true;

  const submit = document.getElementById('register-submit');
  submit.disabled = true;
  status.hidden = true;

  try {
    const response = await fetch(`${form.dataset.apiUrl}/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    const body = await response.json().catch(() => ({}));

    if (response.ok) {
      showStatus(body.message ?? 'Account created successfully.');
      form.reset();
      window.setTimeout(() => window.location.assign('/login'), 1500);
      return;
    }

    showStatus(body.message ?? 'Registration failed.');
  } catch {
    showStatus('Unable to reach the server. Please try again.');
  } finally {
    submit.disabled = false;
  }
});
