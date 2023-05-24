<script>
  import "98.css/dist/98.css";
  import Window from "./Window.svelte";
  import UienRadar from "./UienRadar.svelte";
  import Icon from "./Icon.svelte";

  let windows = [];
  function openWindow(title) {
    windows = [...windows, {
      title: title,
      component: Window,
      slots: {
        content: UienRadar,
      },
    }];
    // const window = new Window({
    //   target: document.querySelector('#window-space'),
    //   props: {
    //     title: title,
    //   },
    //   slots: {
    //     default: UienRadar,
    //   },
    // });
  }
</script>

<main>
  <div class="desktop" style="background: url(assets/windows-xp.jpg) no-repeat center center fixed; background-size: cover">
    <div class="icon-space">
      <Icon image="assets/uienradar.png" name="Uienradar" on:open={e => openWindow(e.detail.name)}></Icon>
      <Icon image="assets/tree-icon.png" name="Raytracer"></Icon>
      <Icon image="assets/notepad.png" name="Blog"></Icon>
    </div>
    <div id="window-space">
      {#each windows as window}
        <svelte:component this={window.component} {...window}> 
          {#each Object.keys(window.slots) as slot}
            <svelte:component this={window.slots[slot]} slot={slot}></svelte:component>
          {/each}
        </svelte:component>
      {/each}
    </div>
  </div>
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

  .desktop {
    height: 100vh;
    width: 100vw;
    position: fixed;
  }

  .icon-space {
    margin: 10px;
    display: flex;
    gap: 20px;
  }
</style>
