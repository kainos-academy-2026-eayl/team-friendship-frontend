const form = document.querySelector('#forgot-password-form');
const emailInput = document.querySelector('#email');
const sendButton = document.querySelector('#send-recovery-email');
const statusMessage = document.querySelector('#status');

if (
  form instanceof HTMLFormElement &&
  emailInput instanceof HTMLInputElement &&
  sendButton instanceof HTMLButtonElement &&
  statusMessage instanceof HTMLElement
) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    sendButton.disabled = true;
    statusMessage.textContent = 'Sending...';

    try {
      const response = await fetch('http://localhost:3000', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.value.trim() }),
      });

      statusMessage.textContent = response.ok
        ? 'Recovery email request sent.'
        : `The request failed (${response.status}).`;
    } catch (error) {
      console.error('Failed to send the recovery email request.', error);
      statusMessage.textContent =
        'Unable to contact the recovery service. Please try again.';
    } finally {
      sendButton.disabled = false;
    }
  });
}
