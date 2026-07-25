const scenes = {
  'bang-bang': (
    <>
      <div className="preview-hud preview-hud--sky">
        <span>48°</span>
        <strong>WIND 12 →</strong>
        <span>72%</span>
      </div>
      <span className="bang-cloud bang-cloud--one" />
      <span className="bang-cloud bang-cloud--two" />
      <span className="bang-terrain" />
      <span className="bang-cannon bang-cannon--left" />
      <span className="bang-cannon bang-cannon--right" />
      <span className="bang-projectile" />
    </>
  ),
  asteroids: (
    <>
      <div className="preview-hud">
        <span>1UP 02450</span>
        <strong>WAVE 3</strong>
      </div>
      <span className="asteroid asteroid--large" />
      <span className="asteroid asteroid--small" />
      <span className="asteroid-ship" />
      <span className="asteroid-laser" />
      <span className="asteroid-ufo" />
    </>
  ),
  'star-catcher': (
    <>
      <div className="preview-hud">
        <span>SCORE 18</span>
        <strong>TIME 42</strong>
      </div>
      <span className="catcher-star catcher-star--one">★</span>
      <span className="catcher-star catcher-star--two">★</span>
      <span className="catcher-star catcher-star--three">★</span>
      <span className="catcher-comet" />
      <span className="catcher-ship" />
    </>
  ),
  'sticker-book': (
    <>
      <img
        className="sticker-scene"
        src="/games/sticker-book/assets/generated/picnic/backgrounds/picnic.png"
        alt=""
        draggable="false"
      />
      <div className="preview-hud preview-hud--paper">
        <span>PICNIC</span>
        <strong>3 / 10</strong>
      </div>
      <img
        className="sticker-piece sticker-piece--basket"
        src="/games/sticker-book/assets/generated/picnic/items/basket.png"
        alt=""
        draggable="false"
      />
      <img
        className="sticker-piece sticker-piece--apple"
        src="/games/sticker-book/assets/generated/picnic/items/apple.png"
        alt=""
        draggable="false"
      />
      <span className="sticker-cursor">✦</span>
    </>
  ),
  'lizard-lunch': (
    <>
      <div className="preview-hud">
        <span>BUGS 7</span>
        <strong>98%</strong>
      </div>
      <span className="lizard-target">frog</span>
      <span className="lizard-bug">
        <i />
      </span>
      <span className="lizard-tongue" />
      <span className="lizard-face">
        <i className="lizard-eye lizard-eye--left" />
        <i className="lizard-eye lizard-eye--right" />
      </span>
      <div className="lizard-keys">
        <span>F</span>
        <span>R</span>
        <span>O</span>
        <span>G</span>
      </div>
    </>
  ),
  immune: (
    <>
      <div className="preview-hud">
        <span>BREACH 04</span>
        <strong>WAVE 2</strong>
      </div>
      <span className="immune-cell immune-cell--sentinel">
        <i />
      </span>
      <span className="immune-cell immune-cell--helper">
        <i />
      </span>
      <span className="immune-bacterium immune-bacterium--one" />
      <span className="immune-bacterium immune-bacterium--two" />
      <span className="immune-signal" />
    </>
  ),
};

export function GamePreview({ type }) {
  return (
    <div className={`game-preview game-preview--${type}`} aria-hidden="true">
      <div className="preview-screen">{scenes[type]}</div>
      <div className="preview-bezel">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}
