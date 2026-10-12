(() => {
  const track = document.querySelector('.gallery-track');
  if (!track) return;
  const viewport = document.querySelector('.gallery-window');
  const gallery = document.querySelector('.gallery');
  const previous = document.querySelector('.previous');
  const next = document.querySelector('.next');
  const status = document.querySelector('#gallery-status');
  const originals = [...track.children];
  const count = originals.length;
  const copies = () => originals.map(element => {
    const clone = element.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    return clone;
  });
  track.prepend(...copies());
  track.append(...copies());
  let index = count;
  let moving = false;
  let finishTimer;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const loadNearby = () => {
    for (let i = Math.max(0, index - 1); i <= Math.min(track.children.length - 1, index + 3); i += 1) {
      const image = track.children[i].querySelector('img[data-src]');
      if (!image) continue;
      image.srcset = image.dataset.srcset;
      image.src = image.dataset.src;
      delete image.dataset.src;
      delete image.dataset.srcset;
    }
  };
  const place = () => {
    loadNearby();
    track.style.transform = `translateX(${-track.children[index].offsetLeft}px)`;
  };
  const finish = () => {
    clearTimeout(finishTimer);
    track.classList.remove('is-moving');
    if (index < count) index += count;
    if (index >= count * 2) index -= count;
    place();
    moving = false;
  };
  const move = direction => {
    if (moving) return;
    moving = true;
    index += direction;
    track.classList.add('is-moving');
    place();
    status.textContent = `사진 ${((index % count) + count) % count + 1} / ${count}`;
    finishTimer = window.setTimeout(finish, reducedMotion.matches ? 0 : 400);
  };
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  gallery.addEventListener('keydown', event => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  });
  track.addEventListener('transitionend', event => { if (event.propertyName === 'transform') finish(); });
  let touchStart;
  viewport.addEventListener('touchstart', event => { touchStart = {x:event.touches[0].clientX, y:event.touches[0].clientY}; }, {passive:true});
  viewport.addEventListener('touchend', event => {
    if (!touchStart) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) move(dx < 0 ? 1 : -1);
    touchStart = undefined;
  }, {passive:true});
  window.addEventListener('resize', finish);
  place();
})();
