import { sendRecoveryEmail } from '../services/forgot-password-service';

const form = document.getElementById('forgot-password-form');
const emailInput = document.getElementById('email');
const submitButton = document.getElementById('send-recovery-email');
const statusMessage = document.getElementById('status');

if (
  form instanceof HTMLFormElement &&
  emailInput instanceof HTMLInputElement &&
  submitButton instanceof HTMLButtonElement &&
  statusMessage instanceof HTMLElement
) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const apiUrl = form.dataset.apiUrl;
    if (!apiUrl) {
      statusMessage.textContent = 'The recovery service is not configured.';
      return;
    }

    submitButton.disabled = true;
    statusMessage.textContent = 'Sending...';

    try {
      const result = await sendRecoveryEmail(apiUrl, {
        email: emailInput.value.trim(),
      });
      statusMessage.textContent = result.message;
    } finally {
      submitButton.disabled = false;
    }
  });
}
