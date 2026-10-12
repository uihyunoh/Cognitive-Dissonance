(() => {
  const gallery = document.querySelector('.film-gallery');
  const video = document.querySelector('#artwork-video');
  const films = JSON.parse(document.querySelector('#film-list').textContent);
  const status = document.querySelector('#film-status');
  const error = document.querySelector('.video-error');
  let index = 0;

  const move = direction => {
    const wasPlaying = !video.paused && !video.ended;
    video.pause();
    index = (index + direction + films.length) % films.length;
    const film = films[index];
    error.hidden = true;
    error.querySelector('a').href = film.src;
    video.poster = film.poster;
    video.preload = index === 0 ? 'auto' : 'none';
    video.src = film.src;
    video.width = film.width;
    video.height = film.height;
    video.setAttribute('aria-label', film.title);
    video.querySelector('a').href = film.src;
    status.textContent = `영상 ${index + 1} / ${films.length}: ${film.title}`;
    video.load();
    if (wasPlaying) video.play().catch(() => {});
  };

  gallery.querySelector('.previous').addEventListener('click', () => move(-1));
  gallery.querySelector('.next').addEventListener('click', () => move(1));
  gallery.addEventListener('keydown', event => {
    if (event.target === video || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    move(event.key === 'ArrowLeft' ? -1 : 1);
  });
  video.addEventListener('error', () => { error.hidden = false; });
})();
