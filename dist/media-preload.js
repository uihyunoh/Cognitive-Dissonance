(() => {
  const firstVideo = new URL('./assets/media/film-01.mp4', document.baseURI).href;
  const fallback = async () => {
    try {
      const response = await fetch(firstVideo, { cache: 'force-cache', priority: 'low' });
      if (response.ok) await response.arrayBuffer();
    } catch { /* Native playback remains available if preloading fails. */ }
  };
  if (!('serviceWorker' in navigator)) {
    fallback();
    return;
  }
  navigator.serviceWorker.register('./media-worker.js', { scope: './' })
    .then(() => navigator.serviceWorker.ready)
    .then(registration => {
      if (registration.active) registration.active.postMessage({ type: 'PREFETCH_FIRST_VIDEO' });
      else fallback();
    })
    .catch(fallback);
})();
