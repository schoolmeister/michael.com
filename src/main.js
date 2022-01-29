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
  // Open the new window
  // with the URL replacing the
  // current page using the
  // _self value
  // eslint-disable-next-line no-restricted-globals
  const newWindow = open(location, '_self');

  // Close this window
  newWindow.close();

  return false;
}

counter();
document.getElementById('close-button').onclick = (() => closeWindow());
document.getElementById('leave-button').onclick = (() => leave());
