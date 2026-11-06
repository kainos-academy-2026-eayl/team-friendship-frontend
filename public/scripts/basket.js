(() => {
  let pending = false;

  document.addEventListener('submit', async (event) => {
    const form = event.target;
    if (
      !(form instanceof HTMLFormElement) ||
      !form.matches('.basket-quantity-controls')
    )
      return;
    event.preventDefault();
    if (pending) return;

    const button = event.submitter;
    if (!(button instanceof HTMLButtonElement)) return;
    const content = document.querySelector('[data-basket-content]');
    const status = content?.querySelector('#status');
    if (!content || !status) return;
    const data = new FormData(form);
    if (button.name) data.set(button.name, button.value);
    const body = new URLSearchParams();
    for (const [name, value] of data) {
      if (typeof value === 'string') body.append(name, value);
    }

    pending = true;
    content.setAttribute('aria-busy', 'true');
    status.textContent = 'Updating basket…';
    const controls = [...content.querySelectorAll('button')];
    const disabledStates = controls.map((control) => control.disabled);
    for (const control of controls) control.disabled = true;

    try {
      const response = await fetch(
        button.getAttribute('formaction') || form.action,
        {
          method: 'POST',
          credentials: 'same-origin',
          body,
        },
      );
      if (
        new URL(response.url).pathname !== '/basket' &&
        !new URL(response.url).pathname.startsWith('/basket/')
      ) {
        throw new Error(
          'Your session may have expired. Log in again before updating your basket.',
        );
      }
      const page = new DOMParser().parseFromString(
        await response.text(),
        'text/html',
      );
      const updated = page.querySelector('[data-basket-content]');
      if (!updated)
        throw new Error(
          'Unable to confirm the update. Reload your basket before trying again.',
        );

      content.replaceChildren(...updated.childNodes);
      const basketLink = document.querySelector('.header-basket');
      const updatedLink = page.querySelector('.header-basket');
      if (basketLink && updatedLink) basketLink.replaceWith(updatedLink);

      const updatedStatus = content.querySelector('#status');
      if (updatedStatus) {
        updatedStatus.textContent = response.ok
          ? 'Basket updated.'
          : 'Basket update failed. See the error above.';
      }
      const updatedForm = [...content.querySelectorAll('form')].find(
        (candidate) => candidate.action === form.action,
      );
      const focusButton =
        updatedForm &&
        [...updatedForm.querySelectorAll('button')].find(
          (candidate) =>
            candidate.name === button.name &&
            candidate.value === button.value &&
            !candidate.disabled,
        );
      if (focusButton) focusButton.focus({ preventScroll: true });
    } catch (error) {
      console.error('Basket update failed', error);
      status.textContent =
        'Unable to confirm the update. Reload your basket before trying again. If your session has expired, log in again.';
    } finally {
      controls.forEach((control, index) => {
        control.disabled = disabledStates[index];
      });
      content.removeAttribute('aria-busy');
      pending = false;
    }
  });
})();
