const { app, BrowserWindow, ipcMain, session, dialog } = require('electron');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const sudo = require('sudo-prompt');

let mainWindow;

// Set the userData path to "user_data" folder in the application directory
const appFolderPath = path.join(__dirname, 'user_data');
app.setPath('userData', appFolderPath);

const START_PAGE_URL = 'file://' + path.join(__dirname, 'startpage', 'index.html');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    simpleFullscreen: true,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  
  mainWindow.loadURL(START_PAGE_URL);
  
  mainWindow.once('ready-to-show', () => {
    // The window should already be fullscreen due to constructor options.
    // If maximize() is still needed for some reason, it can stay.
    // mainWindow.maximize(); 

    // Attach input event listener once webContents are available and window is shown
    mainWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'Escape') {
        // Navigate to starting page on Escape key press
        event.preventDefault();
        if (mainWindow.webContents.getURL() !== START_PAGE_URL) {
          mainWindow.loadURL(START_PAGE_URL);
        }
      } else if (input.key === 'ContextMenu') {
        // Emulate Tab key on ContextMenu key press
        event.preventDefault();
        mainWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab' });
        mainWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab' });
      } else if (input.key === 'BrowserBack') {
        // Navigate back in history on BrowserBack key press
        event.preventDefault();
        if (mainWindow.webContents.canGoBack()) {
          mainWindow.webContents.goBack();
        }
      } else if (input.key === 'F4' && input.alt) {
        // Block Alt+F4 to prevent external closure
        event.preventDefault();
      }
    });
  });
}

app.whenReady().then(() => {
  createWindow();
  console.log('Cookies and web data are saved in:', app.getPath('userData'));

  // IPC handler: launch Microsoft Edge in kiosk mode for a given URL
  ipcMain.on('open-link-in-kiosk', (event, url) => {
    console.log(`IPC message received: open-link-in-kiosk for URL: ${url}`);
    const edgePath = '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"';
    const args = `--edge-kiosk-type=fullscreen --new-window --start-fullscreen --app "${url}" --no-first-run`;
    const command = `${edgePath} ${args}`;

    console.log('Executing command:', command);

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error('Error launching Edge:', error);
        console.error('stderr:', stderr);
        return;
      }
      console.log('Edge launched successfully:', stdout);
      // When returning to main window, refresh geolocation
      if (mainWindow) {
        mainWindow.webContents.send('refresh-geolocation');
        mainWindow.webContents.send('refresh-sidebar');
      }
    });
  });

  const defaultSession = session.defaultSession;
  app.on('before-quit', () => {
    defaultSession.cookies.flushStore().catch((error) => {
      console.error('Error flushing cookies:', error);
    });
  });
});

// Helper: Get current gateway using PowerShell (Windows only)
async function getCurrentGateway() {
  try {
    const { execSync } = require('child_process');
    const output = execSync(`powershell -Command "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null }).IPv4DefaultGateway.NextHop"`).toString().trim();
    if (output) return output;
  } catch (e) {
    // ignore
  }
  return null;
}

// Helper: Determine VPN status
async function getVPNStatus() {
  const gw = await getCurrentGateway();
  console.log('Detected gateway:', gw); // <-- Add this line
  if (gw === '192.168.8.1') return 'on';
  if (gw === '192.168.0.1') return 'off';
  return 'unknown';
}

// Helper: Toggle VPN
function toggleVPN(targetMode, callback) {
  const scriptPath = path.join(__dirname, 'scripts', 'vpn.ps1');
  const script = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" ${targetMode}`;
  sudo.exec(script, { name: 'HTPC VPN Switcher' }, (err, stdout, stderr) => {
    if (err) {
      console.error('VPN toggle error:', err);
      callback && callback('error', err);
    } else {
      console.log('VPN script output:', stdout);
      callback && callback('ok', stdout);
    }
  });
}

// Add handler for system commands (sleep, shutdown, kodi, etc.)
ipcMain.on('system-command', async (event, cmd) => {
  console.log(`IPC message received: system-command, cmd: ${cmd}`);
  if (cmd === 'sleep') {
    const result = await showCustomDialog({
      title: 'Sleep',
      message: 'Are you sure you want to put the system to sleep?',
      okText: 'OK',
      cancelText: 'Cancel'
    });
    if (result === 'ok') {
      exec('"C:\\PsTools\\psshutdown.exe" -d -t 0', (error, stdout, stderr) => {
        if (error) {
          console.error('Error executing sleep command:', error);
          return;
        }
        console.log('Sleep command executed successfully.', stdout);
      });
    } else {
      console.log('Sleep action cancelled by user.');
    }
  } else if (cmd === 'shutdown') {
    const result = await showCustomDialog({
      title: 'Shutdown',
      message: 'Are you sure you want to shutdown the system?',
      okText: 'OK',
      cancelText: 'Cancel'
    });
    if (result === 'ok') {
      exec('shutdown /s /t 0', (error, stdout, stderr) => {
        if (error) {
          console.error('Error executing shutdown command:', error);
          return;
        }
        console.log('Shutdown command executed successfully.', stdout);
      });
    } else {
      console.log('Shutdown action cancelled by user.');
    }
  } else if (cmd === 'reboot') {
    const result = await showCustomDialog({
      title: 'Reboot',
      message: 'Are you sure you want to close the application (reboot action)?',
      okText: 'OK',
      cancelText: 'Cancel'
    });
    if (result === 'ok') {
      console.log('Gracefully closing the application due to reboot command.');
      app.quit();
    } else {
      console.log('Reboot action cancelled by user.');
    }
  } else if (cmd === 'kodi') {
    exec('"C:\\Program Files\\Kodi\\kodi.exe"', (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing kodi command:', error);
        return;
      }
      console.log('Kodi launched successfully.', stdout);
    });
  } else if (cmd === 'VPN') {
    // Show indicator while checking status
    mainWindow.webContents.send('set-activity-indicator', { visible: true, text: 'Checking VPN...' });

    // Detect current status
    const status = await getVPNStatus();

    // Hide indicator before  showing the confirmation dialog
    mainWindow.webContents.send('set-activity-indicator', { visible: false });

    let nextMode, msg;
    if (status === 'on') {
      nextMode = 'off';
      msg = 'VPN is currently ON. Do you want to turn it OFF?';
    } else if (status === 'off') {
      nextMode = 'on';
      msg = 'VPN is currently OFF. Do you want to turn it ON?';
    } else {
      nextMode = null;
      msg = 'Unable to detect VPN status. Try to toggle anyway?';
    }

    const result = await showCustomDialog({
      title: 'VPN Toggle',
      message: msg,
      okText: 'OK',
      cancelText: 'Cancel'
    });

    if (result === 'ok' && nextMode) {
      // Show indicator again for the toggle operation
      mainWindow.webContents.send('set-activity-indicator', { visible: true, text: `Switching VPN ${nextMode. toUpperCase()}...` });

      toggleVPN(nextMode, (status, output) => {
        // Hide indicator when toggle operation is complete
        mainWindow.webContents.send('set-activity-indicator', { visible: false });

        if (status === 'ok') {
          mainWindow.webContents.send('refresh-geolocation');
          mainWindow.webContents.send('refresh-sidebar');
          showCustomDialog({
            title: 'VPN',
            message: `VPN switched ${nextMode.toUpperCase()} successfully.`,
            okText: 'OK'
          });
        } else {
          showCustomDialog({
            title: 'VPN Error',
            message: `Failed to switch VPN: ${output}`,
            okText: 'OK'
          });
        }
      });
    } else if (result === 'ok' && !nextMode) {
      showCustomDialog({
        title: 'VPN',
        message: 'Could not detect VPN status. Please check your network.',
        okText: 'OK'
      });
    } else {
      console.log('VPN toggle cancelled by user.');
    }
    return;
  } else if (cmd === 'info') {
    showInfoDialog();
  } else {
    console.error('Unknown system command:', cmd);
  }
});

// Handler to relay activity indicator changes from any window to the main window
ipcMain.on('set-activity-indicator', (event, options) => {
  if (mainWindow) {
    mainWindow.webContents.send('set-activity-indicator', options);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

async function showCustomDialog(options) {
  return new Promise((resolve) => {
    const modal = new BrowserWindow({
      parent: mainWindow,
      modal: true,
      width: 600,
      height: 200,
      minWidth: 400,
      minHeight: 150,
      maxWidth: 900,
      maxHeight: 600,
      frame: false,
      alwaysOnTop: true,
      resizable: true,
      transparent: true, // <-- add this
      backgroundColor: '#00000000', // <-- add this
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      }
    });
    modal.loadFile(path.join(__dirname, 'startpage', 'dialog.html'));
    modal.webContents.once('did-finish-load', () => {
      modal.webContents.send('dialog-options', options);
    });
    ipcMain.once('dialog-response', (event, response) => {
      resolve(response);
      modal.close();
    });
  });
}

// System information handler (async, non-blocking)
ipcMain.handle('get-system-info', async () => {
  
  // Uptime
  const uptimeSec = process.uptime();
  const uptimeH = Math.floor(uptimeSec / 3600);
  const uptimeM = Math.floor((uptimeSec % 3600) / 60);

  // Memory
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  // Network (async)
  const interfaces = os.networkInterfaces();
  const ip = Object.values(interfaces).flat().find(i => i.family === 'IPv4' && !i.internal)?.address || 'N/A';

  // Gateway (async PowerShell)
  const gateway = await new Promise(resolve => {
    exec(`powershell -Command "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null }).IPv4DefaultGateway.NextHop"`, (err, stdout) => {
      resolve(err ? 'N/A' : stdout.trim() || 'N/A');
    });
  });

  // Disk (async WMIC)
  const diskInfo = await new Promise(resolve => {
    exec(`wmic logicaldisk where "DeviceID='C:'" get FreeSpace,Size /format:csv`, (err, stdout) => {
      if (err) return resolve({ diskTotal: 0, diskFree: 0 });
      const lines = stdout.trim().split('\n');
      const dataLine = lines.find(line => /\d+,\d+/.test(line));
      if (dataLine) {
        const [, free, total] = dataLine.trim().split(',');
        resolve({ diskTotal: parseInt(total, 10), diskFree: parseInt(free, 10) });
      } else {
        resolve({ diskTotal: 0, diskFree: 0 });
      }
    });
  });

  return {
    ip,
    gateway,
    uptime: `${uptimeH}h ${uptimeM}m`,
    mem: `${Math.round((totalMem - freeMem) / 1024 / 1024)} / ${Math.round(totalMem / 1024 / 1024)} MB`,
    disk: diskInfo.diskTotal && diskInfo.diskFree
      ? `${Math.round((diskInfo.diskTotal - diskInfo.diskFree) / 1024 / 1024 / 1024)} / ${Math.round(diskInfo.diskTotal / 1024 / 1024 / 1024)} GB`
      : 'N/A'
  };
});

// Extended system information handler (async, non-blocking)
ipcMain.handle('get-full-info', async () => {
  // Network info
  const interfaces = os.networkInterfaces();
  let ip = Object.values(interfaces).flat().find(i => i.family === 'IPv4' && !i.internal)?.address || 'N/A';

  // Gateway (async)
  const gw = await new Promise(resolve => {
    exec(`powershell -Command "(Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null }).IPv4DefaultGateway.NextHop"`, (err, stdout) => {
      resolve(err ? 'N/A' : stdout.trim() || 'N/A');
    });
  });

  // DNS (async)
  const dns = await new Promise(resolve => {
    exec(`powershell -Command "(Get-DnsClientServerAddress -AddressFamily IPv4 | Select-Object -ExpandProperty ServerAddresses)"`, (err, stdout) => {
      resolve(err ? 'N/A' : stdout.trim() || 'N/A');
    });
  });

  // Geolocation (async)
  let geo = '';
  try {
    const res = await fetch('https://ipwhois.app/json/');
    const data = await res.json();
    geo = `${data.country || ''} ${data.city || ''} (IP: ${data.ip || ''})`;
  } catch (e) { geo = 'N/A'; }

  // System info
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  // Disk (async WMIC)
  const diskInfo = await new Promise(resolve => {
    exec(`wmic logicaldisk where "DeviceID='C:'" get FreeSpace,Size /format:csv`, (err, stdout) => {
      if (err) return resolve({ diskTotal: 0, diskFree: 0 });
      const lines = stdout.trim().split('\n');
      const dataLine = lines.find(line => /\d+,\d+/.test(line));
      if (dataLine) {
        const [, free, total] = dataLine.trim().split(',');
        resolve({ diskTotal: parseInt(total, 10), diskFree: parseInt(free, 10) });
      } else {
        resolve({ diskTotal: 0, diskFree: 0 });
      }
    });
  });

  return [
    `IP Address:      ${ip}`,
    `Gateway:         ${gw}`,
    `DNS:             ${dns}`,
    `Geolocation:     ${geo}`,
    `Memory (used):   ${Math.round((totalMem - freeMem) / 1024 / 1024)} MB`,
    `Memory (total):  ${Math.round(totalMem / 1024 / 1024)} MB`,
    `Disk (used):     ${diskInfo.diskTotal && diskInfo.diskFree ? Math.round((diskInfo.diskTotal - diskInfo.diskFree) / 1024 / 1024 / 1024) : 'N/A'} GB`,
    `Disk (total):    ${diskInfo.diskTotal ? Math.round(diskInfo.diskTotal / 1024 / 1024 / 1024) : 'N/A'} GB`
  ].join('\n');
});

// Show information dialog
function showInfoDialog() {
  mainWindow.webContents.send('set-activity-indicator', { visible: true, text: 'Fetching system info...' });
  const infoWin = new BrowserWindow({
    parent: mainWindow,
    width: 700,
    height: 500,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    transparent: false,
    backgroundColor: '#111',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });
  infoWin.loadFile(path.join(__dirname, 'startpage', 'info.html'));

  ipcMain.once('info-close', () => {
    mainWindow.webContents.send('set-activity-indicator', { visible: false });  
    infoWin.close();
    // Trigger geolocation refresh on main window
    if (mainWindow) mainWindow.webContents.send('refresh-geolocation');
  });
}
