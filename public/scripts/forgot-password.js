(() => {
  // src/views/services/forgot-password-service.ts
  async function sendRecoveryEmail(apiUrl, request) {
    try {
      const response = await fetch(`${apiUrl}/forgot-password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          success: false,
          message: body.error ?? 'Could not send the recovery email.',
        };
      }
      return {
        success: true,
        message: body.message ?? 'Recovery email request sent.',
      };
    } catch {
      return {
        success: false,
        message: 'Unable to reach the server. Please try again.',
      };
    }
  }

  // src/views/controllers/forgot-password-controller.ts
  var form = document.getElementById('forgot-password-form');
  var emailInput = document.getElementById('email');
  var submitButton = document.getElementById('send-recovery-email');
  var statusMessage = document.getElementById('status');
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
})();
