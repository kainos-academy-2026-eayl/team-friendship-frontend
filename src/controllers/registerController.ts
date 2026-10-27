import { passwordsMatch, register } from '../services/registerService';

const form = document.getElementById('registration-form') as HTMLFormElement;
const status = document.getElementById('registration-status') as HTMLElement;
const passwordError = document.getElementById('password-error') as HTMLElement;
const submit = document.getElementById('register-submit') as HTMLButtonElement;

document.getElementById('back-to-login')?.addEventListener('click', () => {
  window.location.assign('/login');
});

function showStatus(message: string): void {
  status.textContent = message;
  status.hidden = false;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form));

  if (!passwordsMatch(data)) {
    passwordError.textContent = 'Passwords do not match.';
    passwordError.hidden = false;
    return;
  }
  passwordError.hidden = true;

  submit.disabled = true;
  status.hidden = true;

  const result = await register(form.dataset.apiUrl ?? '', data);
  showStatus(result.message);
  submit.disabled = false;

  if (result.ok) {
    form.reset();
    window.setTimeout(() => window.location.assign('/login'), 1500);
  }
});
