// Flight Compass by the family (azzbr/flight-compass): the page markup from its index.html.
// The screen (FlightCompass.tsx) puts this inside its own root element before starting the App.
export default `
<div class="app">
    <header class="topbar">
      <button class="brand" id="homeBtn" aria-label="Flight Compass home">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 4l3 8-3 8-3-8z" fill="currentColor"/></svg>
        <span>Flight Compass</span>
      </button>
      <div class="hud" id="hud" hidden></div>
      <div class="top-actions">
        <button class="icon-btn" id="helpBtn" aria-label="How to play">?</button>
        <button class="icon-btn" id="settingsBtn" aria-label="Settings">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z" transform="translate(-1 0)"/></svg>
        </button>
      </div>
    </header>

    <div class="run-header" id="runHeader" hidden></div>

    <main class="stage" id="stage">
      <canvas id="globe" aria-label="Globe" role="img"></canvas>
      <div class="zoom no-dial" role="group" aria-label="Zoom">
        <button class="icon-btn" id="zoomIn" aria-label="Zoom in">+</button>
        <button class="icon-btn" id="zoomOut" aria-label="Zoom out">−</button>
      </div>
      <div class="toast" id="toast" role="status" aria-live="polite"></div>
      <div class="hint-chip no-dial" id="hintChip" role="status" aria-live="polite" hidden>
        <span class="hint-badge">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 5l2.2 7L12 19l-2.2-7z" fill="currentColor"/></svg>
          Hint
        </span>
        <span class="hint-main"><span class="hint-body"></span><span class="hint-cost"></span></span>
        <button class="hint-close" id="hintClose" aria-label="Hide hint">×</button>
      </div>
    </main>

    <section class="panel" id="panel" aria-live="polite"></section>
  </div>

  <dialog id="helpDialog" aria-labelledby="helpTitle">
    <form method="dialog">
      <h2 id="helpTitle">How to play</h2>
      <ol class="rules">
        <li>You start in a city at the centre of the globe. Your target is named on the boarding card underneath.</li>
        <li>Each flight carries on from where you landed. <strong>New flight</strong> starts somewhere new every time; the <strong>Daily route</strong> is the same for everyone that day.</li>
        <li>Turn the compass toward the target and lock your heading. The orange line shows where you're aiming.</li>
        <li>Planes fly <strong>great circles</strong>, the shortest paths over a round planet. So the right heading is often not what a flat map suggests.</li>
        <li>Within 35° scores points; 2° or better is a <strong>Bullseye</strong>. Aiming the long way round the planet counts too.</li>
        <li>Hits in a row build a streak multiplier, up to ×2. Missing by more than 35° costs one of your 3 lives.</li>
        <li>Stuck? <strong>Which way?</strong> names the rough direction (round scores 70%). <strong>Peek</strong> shows the target for 3 seconds (round scores 40%).</li>
      </ol>
      <p class="small">Keyboard: focus the dial, then use the arrow keys (hold Shift for 10°), Enter to lock, H for “Which way?”, P to peek.</p>
      <p class="small">Map and city data: Natural Earth (public domain). Credits are in the Grown-ups corner.</p>
      <div class="dialog-actions"><button class="btn btn-primary" value="close">Got it</button></div>
    </form>
  </dialog>

  <dialog id="settingsDialog" aria-labelledby="settingsTitle">
    <form method="dialog">
      <h2 id="settingsTitle">Settings</h2>
      <label class="switch"><input type="checkbox" name="sound"> <span>Sound effects</span></label>
      <label class="switch"><input type="checkbox" name="vibrate"> <span>Vibration (on phones that support it)</span></label>
      <label class="switch"><input type="checkbox" name="reduceMotion"> <span>Reduce motion (no flying animation)</span></label>
      <p class="small">Settings, best scores and today's result are saved only in this browser.</p>
      <div class="dialog-actions">
        <button class="btn" value="cancel" formnovalidate>Cancel</button>
        <button class="btn btn-primary" value="save">Save</button>
      </div>
    </form>
  </dialog>

  <dialog id="classDialog" aria-labelledby="classTitle">
    <form method="dialog">
      <h2 id="classTitle">Challenge</h2>
      <p class="small">Everyone who enters the same code flies exactly the same cities, so scores can be compared. No accounts and no internet connection needed.</p>
      <label class="field" for="classCode">Enter a code</label>
      <div class="row">
        <input id="classCode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="N10-K7Q2M" maxlength="9">
        <button class="btn btn-primary" id="joinBtn">Start</button>
      </div>
      <p class="error" id="classError" role="alert"></p>
      <hr>
      <p class="field">Teachers: make a new code</p>
      <div class="row">
        <select id="newRounds" aria-label="Number of cities">
          <option value="5">5 cities</option><option value="10" selected>10 cities</option><option value="15">15 cities</option><option value="20">20 cities</option>
        </select>
        <button class="btn" id="makeBtn">Make code</button>
      </div>
      <div class="new-code" id="newCode" hidden>
        <code></code>
        <button class="btn btn-small" id="copyCode">Copy</button>
      </div>
      <div class="dialog-actions"><button class="btn" value="close" autofocus>Close</button></div>
    </form>
  </dialog>

`;
