<script>
  export let title;
</script>

<div class="window">
  <div class="title-bar">
    <div class="title-bar-text">{title}</div>
    <div class="title-bar-controls">
      <button aria-label="Minimize" />
      <button aria-label="Maximize" />
      <button aria-label="Close" />
    </div>
  </div>
  <div class="window-body">
    <slot>
      <p>There's so much room for activities!</p>
    </slot>
  </div>
</div>

<style>
</style>
