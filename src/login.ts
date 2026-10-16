const status = document.getElementById('status');
const loginForm = document.getElementById('login-form');
const loginSubmit = document.getElementById('login-submit');
const signUp = document.getElementById('sign-up');
const forgotPassword = document.getElementById('forgot-password');

if (!(status instanceof HTMLElement)
    || !(loginForm instanceof HTMLFormElement)
    || !(loginSubmit instanceof HTMLButtonElement)
    || !(signUp instanceof HTMLButtonElement)
    || !(forgotPassword instanceof HTMLButtonElement)) {
    throw new Error('Required login page elements are missing.');
}

loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    status.textContent = 'Login is not available yet. Authentication has not been connected.';
});

signUp.addEventListener('click', () => {
    status.textContent = 'Sign up is not available yet. Account registration has not been connected.';
});

forgotPassword.addEventListener('click', (event) => {
    event.preventDefault();
    status.textContent = 'Password recovery is not available yet. Password reset has not been connected.';
});

loginSubmit.disabled = false;

export {};
