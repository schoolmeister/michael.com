<script>
  import "98.css/dist/98.css";
  import Window from "./Window.svelte";
  import UienRadar from "./UienRadar.svelte";
</script>

<main>
  <!-- <h1>Hello {name}!</h1> -->
  <Window title="Uienradar">
    <UienRadar />
  </Window>
</main>

<style>
  :global(body) {
    margin: 0;
    height: 100vh;
    overflow: hidden;
  }

  main {
    height: 100%;
  }
</style>
