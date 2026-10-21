function getElement<ElementType extends HTMLElement>(
  selector: string,
): ElementType {
  const element = document.querySelector<ElementType>(selector);
  if (!element) {
    throw new Error(`Missing registration element: ${selector}`);
  }
  return element;
}

const form = getElement<HTMLFormElement>('#registration-form');
const username = getElement<HTMLInputElement>('#username');
const password = getElement<HTMLInputElement>('#password');
const confirmation = getElement<HTMLInputElement>('#confirm-password');
const registrationStatus = getElement<HTMLParagraphElement>(
  '#registration-status',
);

function setError(
  field: HTMLInputElement,
  errorId: string,
  message: string,
): void {
  const error = getElement<HTMLParagraphElement>(`#${errorId}`);
  error.textContent = message;
  error.hidden = !message;
  field.setCustomValidity(message);
  field.setAttribute('aria-invalid', String(Boolean(message)));
}

function validateFields(): void {
  setError(
    username,
    'username-error',
    username.value.trim().length < 3
      ? 'Username must be at least 3 characters.'
      : '',
  );
  setError(
    confirmation,
    'password-error',
    password.value !== confirmation.value ? 'Passwords do not match.' : '',
  );
}

form.noValidate = true;
form.addEventListener('input', () => {
  registrationStatus.hidden = true;
  validateFields();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  validateFields();
  if (!form.reportValidity()) return;

  registrationStatus.textContent =
    'Account registration is currently unavailable.';
  registrationStatus.hidden = false;
});
