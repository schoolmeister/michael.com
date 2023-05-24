<script>
  export let title;

  let window;
  let minimized = false;

  function minimize(element) {
    minimized = !minimized;
  }
</script>

<div class="window" class:minimized bind:this={window}>
  <div class="title-bar">
    <div class="title-bar-text">{title}</div>
    <div class="title-bar-controls">
      <button aria-label="Minimize" on:click={(e) => (minimized = true)} />
      <button aria-label="Maximize" on:click={(e) => (minimized = false)} />
      <button
        aria-label="Close"
        on:click={(e) => window.parentNode.removeChild(window)}
      />
    </div>
  </div>
  <div class="window-body" class:minimized>
    <slot>
      <p>There's so much room for activities!</p>
    </slot>
  </div>
</div>

<style>
  .window {
    display: flex;
    flex-direction: column;
    width: 50vw;
    height: 70vh;
    position: fixed;
    left: 25vw;
  }

  .window-body {
    flex-grow: 1;
  }

  .minimized {
    height: auto;
  }

  .minimized.window-body {
    display: none;
  }
</style>
