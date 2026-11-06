(() => {
  let pending = false;

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (
      !(form instanceof HTMLFormElement) ||
      !form.matches('[data-product-quantity-form]')
    )
      return;
    const button = event.submitter;
    if (!(button instanceof HTMLButtonElement)) return;
    // Adding to the basket keeps its normal submit and browse redirect.
    if (button.name !== 'direction') return;

    const content = document.querySelector('[data-product-content]');
    const status = content?.querySelector('#status');
    if (!content || !status) return;
    event.preventDefault();
    if (pending) return;

    const data = new FormData(form);
    data.set(button.name, button.value);
    const body = new URLSearchParams();
    for (const [name, value] of data) {
      if (typeof value === 'string') body.append(name, value);
    }
    const action = button.getAttribute('formaction');
    if (!action) return;

    pending = true;
    content.setAttribute('aria-busy', 'true');
    status.textContent = 'Updating quantity...';
    const controls = [...form.querySelectorAll('button')];
    const disabledStates = controls.map((control) => control.disabled);
    for (const control of controls) control.disabled = true;

    try {
      const response = await fetch(action, {
        method: 'POST',
        credentials: 'same-origin',
        body,
      });
      if (new URL(response.url).pathname !== action) {
        throw new Error(
          'Unexpected quantity response. Your session may have expired.',
        );
      }
      const page = new DOMParser().parseFromString(
        await response.text(),
        'text/html',
      );
      const updated = page.querySelector('[data-product-content]');
      if (!updated) throw new Error('Missing product in quantity response.');
      content.replaceChildren(...updated.childNodes);
      const updatedStatus = content.querySelector('#status');
      if (updatedStatus) {
        updatedStatus.textContent = response.ok
          ? 'Quantity updated.'
          : 'Unable to update quantity. See the error above.';
      }
      const buttons = [...content.querySelectorAll('button')];
      const focusButton =
        buttons.find(
          (candidate) =>
            candidate.name === button.name &&
            candidate.value === button.value &&
            !candidate.disabled,
        ) ?? buttons.find((candidate) => !candidate.disabled);
      focusButton?.focus({ preventScroll: true });
    } catch (error) {
      console.error('Product quantity update failed', error);
      const currentStatus = content.querySelector('#status');
      if (currentStatus)
        currentStatus.textContent =
          'Unable to update quantity. Reload the product before trying again.';
    } finally {
      controls.forEach((control, index) => {
        control.disabled = disabledStates[index];
      });
      content.removeAttribute('aria-busy');
      pending = false;
    }
  });
})();
