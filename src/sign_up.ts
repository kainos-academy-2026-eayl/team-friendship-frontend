export { };

function requiredElement<T extends Element>(selector: string): T {
    const element = document.querySelector<T>(selector);
    if (!element) {
        throw new Error(`Signup page is missing required element: ${selector}`);
    }
    return element;
}

const password = requiredElement<HTMLInputElement>('#password');
const confirmPassword = requiredElement<HTMLInputElement>('#confirm-password');
const statusMessage = requiredElement<HTMLParagraphElement>('#status');
const signupForm = requiredElement<HTMLFormElement>('#signup-form');

function validatePasswords(): void {
    confirmPassword.setCustomValidity(
        confirmPassword.value && password.value !== confirmPassword.value
            ? 'Passwords must match.'
            : ''
    );
    statusMessage.textContent = '';
}

password.addEventListener('input', validatePasswords);
confirmPassword.addEventListener('input', validatePasswords);

signupForm.addEventListener('submit', (event) => {
    event.preventDefault();
    statusMessage.textContent = 'Sign up is not available yet. Account registration has not been connected.';
});
