/* eslint-disable strict */

'use strict';

require('98.css');

function counter() {
  let seconds = 0;
  setInterval(() => {
    seconds += 1;
    const element = document.getElementById('counter');
    if (element) element.innerHTML = `<p>You have been here for ${seconds} seconds.</p>`;
  }, 1000);
}

function closeWindow() {
  document.getElementById('main-window').remove();
}

function leave() {
  // eslint-disable-next-line no-restricted-globals
  const newWindow = open(location, '_self');
  // Close this window
  newWindow.close();
  return false;
}

let i = 0;
function maximize(window, button) {
  console.log(window);
  console.log(button);
  window.classList.toggle('maximize');
  console.log(window.classList.contains('maximize'));
  button.setAttribute('aria-label', (window.classList.contains('maximize') ? 'Restore' : 'Maximize'));
  // element.style.width = ((i % 2) === 0 ? '400px': '300px');
  i+= 1;
}


counter();
document.getElementById('close-button').onclick = (() => closeWindow());
document.getElementById('leave-button').onclick = (() => leave());
document.getElementById('maximize-button').onclick = ((e) => maximize(document.getElementById('main-window'), e.target));
