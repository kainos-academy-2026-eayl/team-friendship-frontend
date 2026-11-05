const carousel = document.getElementById('home-products');
const previous = document.getElementById('previous-product');
const next = document.getElementById('next-product');
const navigation = document.querySelector('.home-product-navigation');

if (carousel && previous && next && navigation) {
  const cards = [...carousel.querySelectorAll('.product-card')];
  const lastIndex = Math.max(0, cards.length - 3);
  let index = 0;

  const step = () =>
    cards.length > 1 ? cards[1].offsetLeft - cards[0].offsetLeft : 0;

  const updateButtons = () => {
    previous.disabled = index === 0;
    next.disabled = index === lastIndex;
  };

  const move = (direction) => {
    index = Math.max(0, Math.min(lastIndex, index + direction));
    carousel.scrollTo({
      left: index * step(),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
    updateButtons();
  };

  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  carousel.addEventListener('scrollend', () => {
    const width = step();
    index =
      width > 0
        ? Math.max(
            0,
            Math.min(lastIndex, Math.round(carousel.scrollLeft / width)),
          )
        : 0;
    updateButtons();
  });
  carousel.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      move(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  new ResizeObserver(() => {
    carousel.scrollTo({ left: index * step(), behavior: 'instant' });
  }).observe(carousel);
  navigation.hidden = false;
  updateButtons();
}
