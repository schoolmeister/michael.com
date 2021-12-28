/* eslint-disable strict */

'use strict';

require('98.css');

function counter() {
  let seconds = 0;
  setInterval(() => {
    seconds += 1;
    document.getElementById('counter').innerHTML = `<p>You have been here for ${seconds} seconds.</p>`;
  }, 1000);
}

counter();
