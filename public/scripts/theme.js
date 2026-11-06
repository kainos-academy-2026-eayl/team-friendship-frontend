(() => {
  const root = document.documentElement;
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  const storageKey = 'friendshop-theme';
  let preference = null;
  let storageError = false;

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === 'dark' || saved === 'light') {
      preference = saved;
    }
  } catch (error) {
    storageError = true;
    console.warn('Unable to read the saved theme preference.', error);
  }

  const applyTheme = () => {
    const theme = preference ?? (systemTheme.matches ? 'dark' : 'light');
    root.dataset.theme = theme;
    document
      .getElementById('theme-toggle')
      ?.setAttribute('aria-checked', String(theme === 'dark'));
  };

  applyTheme();
  systemTheme.addEventListener('change', () => {
    if (preference === null) applyTheme();
  });
  addEventListener('storage', (event) => {
    if (event.key !== storageKey && event.key !== null) return;
    preference =
      event.newValue === 'dark' || event.newValue === 'light'
        ? event.newValue
        : null;
    applyTheme();
  });

  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('theme-toggle');
    const status = document.getElementById('theme-status');
    if (!toggle || !status) return;
    const showStorageError = () => {
      status.textContent =
        'Your browser cannot save this preference. The theme will only apply to this page.';
    };
    if (storageError) showStorageError();
    toggle.hidden = false;
    applyTheme();
    toggle.addEventListener('click', () => {
      preference = root.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme();
      try {
        localStorage.setItem(storageKey, preference);
        status.textContent = '';
      } catch (error) {
        console.warn('Unable to save the theme preference.', error);
        showStorageError();
      }
    });
  });
})();
