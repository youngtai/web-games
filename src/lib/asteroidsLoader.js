const ASTEROIDS_SCRIPT_VERSION = '20260808-spawn-invincibility';

const ASTEROIDS_SCRIPT_PATHS = [
  'constants.js',
  'state.js',
  'utils.js',
  'sound.js',
  'particles.js',
  'blackholes.js',
  'asteroids.js',
  'powerups.js',
  'ufo.js',
  'ship.js',
  'bullets.js',
  'update.js',
  'collision.js',
  'render.js',
  'gamepad.js',
  'game.js',
].map((name) => `/games/asteroids/js/${name}?v=${ASTEROIDS_SCRIPT_VERSION}`);

let asteroidsScriptsPromise = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-asteroids-src="${src}"]`);
    if (existing?.dataset.loaded === 'true') {
      resolve();
      return;
    }

    const script = existing || document.createElement('script');
    script.src = src;
    script.dataset.asteroidsSrc = src;
    script.async = false;

    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        resolve();
      },
      { once: true }
    );

    script.addEventListener(
      'error',
      () => {
        reject(new Error(`Unable to load ${src}`));
      },
      { once: true }
    );

    if (!existing) {
      document.body.appendChild(script);
    }
  });
}

export async function loadAsteroidsGame() {
  if (window.mountAsteroidsGame) {
    return window.mountAsteroidsGame;
  }

  if (!asteroidsScriptsPromise) {
    asteroidsScriptsPromise = ASTEROIDS_SCRIPT_PATHS.reduce(
      (promise, src) => promise.then(() => loadScript(src)),
      Promise.resolve()
    ).then(() => {
      if (!window.mountAsteroidsGame) {
        throw new Error('Asteroids loaded without exposing mountAsteroidsGame.');
      }
      return window.mountAsteroidsGame;
    });
  }

  return asteroidsScriptsPromise;
}
