const statusMessage = document.querySelector<HTMLParagraphElement>('#status');
const signupForm = document.querySelector<HTMLFormElement>('#signup-form');

if (signupForm) {
    const password = document.querySelector<HTMLInputElement>('#password');
    const confirmPassword = document.querySelector<HTMLInputElement>('#confirm-password');

    if (!password || !confirmPassword || !statusMessage) {
        throw new Error('Signup page is missing required form elements.');
    }

    const passwordInput = password;
    const confirmationInput = confirmPassword;
    const signupStatus = statusMessage;

    function validatePasswords(): void {
        confirmationInput.setCustomValidity(
            confirmationInput.value && passwordInput.value !== confirmationInput.value
                ? 'Passwords must match.'
                : ''
        );
        signupStatus.textContent = '';
    }

    passwordInput.addEventListener('input', validatePasswords);
    confirmationInput.addEventListener('input', validatePasswords);

    signupForm.addEventListener('submit', (event) => {
        event.preventDefault();
        signupStatus.textContent = 'Sign up is not available yet. Account registration has not been connected.';
    });
}

const loginForm = document.querySelector<HTMLFormElement>('#login-form');
const forgotPasswordLink = document.querySelector<HTMLAnchorElement>('#forgot-password');

if (loginForm) {
    if (!statusMessage || !forgotPasswordLink) {
        throw new Error('Login page is missing required form elements.');
    }

    const loginStatus = statusMessage;

    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        loginStatus.textContent = 'Login is not available yet. Authentication has not been connected.';
    });

    forgotPasswordLink.addEventListener('click', (event) => {
        event.preventDefault();
        loginStatus.textContent = 'Password recovery is not available yet. Password reset has not been connected.';
    });
}
