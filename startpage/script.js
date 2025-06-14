const COLS = 6; // Number of columns
const ROWS = 5; // Number of rows

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('matrix');
  container.className = 'table'; // Ensure the container has the correct class

  let idx = 0;
  for (let y = 0; y < ROWS; y++) {
    const row = document.createElement('div');
    row.className = 'table-row';

    for (let x = 0; x < COLS; x++) {
      const cell = document.createElement('div');
      cell.className = 'table-cell';

      if (idx < MATRIX.length) {
        const item = MATRIX[idx];

        // Check if the item is empty
        if (item.icon || item.label || item.action) {
          const el = document.createElement('a');
          el.tabIndex = 0;
          el.dataset.x = x;
          el.dataset.y = y;
          if (x === 0 && y === 0) el.id = 'initial-focus';

          // If item.type is 'link', open it in external Edge kiosk mode
          if (item.type === 'link') {
            el.href = '#';
            el.onclick = (e) => {
              e.preventDefault();
              console.log(`Link item clicked: ${item.label}, action: ${item.action}. Attempting to open in external kiosk mode.`);
              if (window.electronAPI && typeof window.electronAPI.openLinkInKiosk === 'function') {
                window.electronAPI.openLinkInKiosk(item.action);
              } else {
                console.error('electronAPI.openLinkInKiosk is not available. Check preload.js and contextIsolation settings.');
              }
            };
          } else if (item.type === 'command' && window.electronAPI && typeof window.electronAPI.systemCommand === 'function') {
            el.href = '#';
            el.onclick = (e) => {
              e.preventDefault();
              window.electronAPI?.systemCommand?.(item.action);
            };
          }

          const img = document.createElement('img');
          img.className = 'big';
          img.src = item.icon;
          img.alt = item.label;

          const titleDiv = document.createElement('div');
          titleDiv.id = 'title';
          titleDiv.textContent = item.label;

          el.appendChild(img);
          el.appendChild(titleDiv);
          cell.appendChild(el);
        }
      }

      row.appendChild(cell);
      idx++;
    }

    container.appendChild(row);
  }

  // Set initial focus
  const initial = document.getElementById('initial-focus');
  if (initial) initial.focus();
});

// Keyboard navigation
document.addEventListener('keydown', function (e) {
  const focused = document.activeElement;
  if (!focused || !focused.dataset.x) return;
  let x = parseInt(focused.dataset.x);
  let y = parseInt(focused.dataset.y);

  do {
    if (e.key === 'ArrowRight') x = (x + 1) % COLS;
    if (e.key === 'ArrowLeft') x = (x - 1 + COLS) % COLS;
    if (e.key === 'ArrowDown') y = (y + 1) % ROWS;
    if (e.key === 'ArrowUp') y = (y - 1 + ROWS) % ROWS;

    var next = document.querySelector('a[data-x="' + x + '"][data-y="' + y + '"]');
  } while (!next); // Skip empty cells

  if (next) next.focus();
});

function updateFancyClock() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const timeElem = document.getElementById('clock-time');
  const dateElem = document.getElementById('clock-date');
  if (timeElem && dateElem) {
    timeElem.textContent = timeStr;
    dateElem.textContent = dateStr;
  }
}

function fetchGeolocation() {
  const geoDetails = document.getElementById('geo-details');
  if (!geoDetails) return;

  fetch('https://ipwhois.app/json/')
    .then(res => res.json())
    .then(data => {
      // Compose location string with flag
      geoDetails.innerHTML = `
        ${data.country_flag ? `<img style="vertical-align: baseline; width: 18px; height: 12px; margin-right: 8px; background:#F0F0F0; border-radius:2px;" src="${data.country_flag}" alt="${data.country} flag">` : ''}
        ${data.country ? data.country : ''}${data.city ? ' - ' + data.city : ''}
        <br>
        IP: ${data.ip || ''}
      `;
    })
    .catch(() => {
      geoDetails.textContent = 'Unable to fetch location.';
    });
}

window.addEventListener('DOMContentLoaded', () => {
  updateFancyClock();
  setInterval(updateFancyClock, 60000);

  fetchGeolocation();
});
