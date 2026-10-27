import { login } from '../services/loginService';

const form = document.getElementById('login-form') as HTMLFormElement;
const status = document.getElementById('status') as HTMLElement;
const submit = document.getElementById('login-submit') as HTMLButtonElement;

document.getElementById('sign-up')?.addEventListener('click', () => {
    window.location.assign('/register');
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    submit.disabled = true;
    status.textContent = '';

    const result = await login(
        form.dataset.apiUrl ?? '',
        Object.fromEntries(new FormData(form)),
    );
    status.textContent = result.message;
    submit.disabled = false;

    if (result.ok) {
        window.location.assign('/home');
    }
});
