const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { exec, execSync } = require('child_process');
const os = require('os');
const sudo = require('sudo-prompt');

let mainWindow;
let configWindow = null; // To hold the reference to the config window

// Define path for psshutdown for easier management
const psshutdownPath = path.join(__dirname, 'tools', 'psshutdown.exe');

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
      exec(`"${psshutdownPath}" -d -t 0`, (error, stdout, stderr) => {
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
  } else if (cmd === 'setup') {
    mainWindow.webContents.send('set-activity-indicator', { visible: true, text: 'Loading Config...' });
    showConfigDialog();
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
        preload: path.join(__dirname, 'dialog-preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
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
      preload: path.join(__dirname, 'info-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
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

/**
 * Unified handler to get all system details efficiently.
 * This replaces get-system-info and get-full-info.
 */
ipcMain.handle('get-system-details', async () => {
  // 1. Get Uptime and Memory from Node.js os module (fast)
  const uptimeSec = process.uptime();
  const uptimeH = Math.floor(uptimeSec / 3600);
  const uptimeM = Math.floor((uptimeSec % 3600) / 60);
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  // 2. Get all network info with one efficient PowerShell script
  const networkInfo = await new Promise(resolve => {
    const scriptPath = path.join(__dirname, 'scripts', 'get-network-config.ps1');
    exec(`powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`, (error, stdout) => {
      if (error) return resolve({ ipAddress: 'N/A', gateway: 'N/A', dns: 'N/A' });
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve({ ipAddress: 'N/A', gateway: 'N/A', dns: 'N/A' });
      }
    });
  });

  // 3. Get Geolocation from external API
  const geoInfo = await fetch('https://ipwhois.app/json/')
    .then(res => res.json())
    .catch(() => ({ country: 'N/A', city: '', ip: 'N/A' }));

  // 4. Get Disk info with one WMIC call
  const diskInfo = await new Promise(resolve => {
    exec(`wmic logicaldisk where "DeviceID='C:'" get FreeSpace,Size /format:csv`, (err, stdout) => {
      if (err) return resolve({ total: 0, free: 0 });
      const lines = stdout.trim().split('\n');
      const dataLine = lines.find(line => /\d+,\d+/.test(line));
      if (dataLine) {
        const [, free, total] = dataLine.trim().split(',');
        resolve({ total: parseInt(total, 10), free: parseInt(free, 10) });
      } else {
        resolve({ total: 0, free: 0 });
      }
    });
  });

  // 5. Construct and return the final JSON object
  return {
    ip: networkInfo.ipAddress || 'N/A',
    gateway: networkInfo.gateway || 'N/A',
    dns: networkInfo.dns || 'N/A',
    uptime: `${uptimeH}h ${uptimeM}m`,
    memUsed: Math.round((totalMem - freeMem) / 1024 / 1024),
    memTotal: Math.round(totalMem / 1024 / 1024),
    diskUsed: diskInfo.total ? Math.round((diskInfo.total - diskInfo.free) / 1024 / 1024 / 1024) : 'N/A',
    diskTotal: diskInfo.total ? Math.round(diskInfo.total / 1024 / 1024 / 1024) : 'N/A',
    geo: {
      country: geoInfo.country || 'N/A',
      city: geoInfo.city || '',
      ip: geoInfo.ip || 'N/A',
    }
  };
});

function showConfigDialog() {
  if (configWindow) {
    configWindow.focus();
    return;
  }

  configWindow = new BrowserWindow({
    width: 850,
    height: 600,
    modal: true,
    parent: mainWindow,
    frame: false,
    transparent: true,
    show: false,
    webPreferences: {
      // Use the dedicated, secure preload script for this window
      preload: path.join(__dirname, 'config-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  configWindow.loadFile(path.join(__dirname, 'startpage/config.html'));

  configWindow.once('ready-to-show', () => {
    configWindow.show();
  });

  configWindow.on('closed', () => {
    configWindow = null;
    // Refresh sidebar in case network settings changed
    mainWindow.webContents.send('refresh-sidebar');
  });
}

// IPC handler to get current network configuration
ipcMain.handle('get-network-config', async () => {
  const scriptPath = path.join(__dirname, 'scripts', 'get-network-config.ps1');
  return new Promise((resolve, reject) => {
    exec(`powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`get-network-config exec error: ${error}`);
        return reject({ error: `Script execution failed: ${error.message}` });
      }
      try {
        const data = JSON.parse(stdout);
        if (data.error) {
          console.error('Error from get-network-config.ps1:', data.error);
          return reject({ error: data.error });
        }
        resolve(data);
      } catch (e) {
        console.error('Failed to parse JSON from get-network-config.ps1:', e, 'Raw stdout:', stdout);
        reject({ error: 'Failed to parse network configuration.' });
      }
    });
  });
});

// IPC handler to set network configuration with admin rights
ipcMain.handle('set-network-config', async (event, config) => {
  const scriptPath = path.join(__dirname, 'scripts', 'set-network-config.ps1');
  const command = `powershell.exe -ExecutionPolicy Bypass -File "${scriptPath}" -InterfaceAlias "${config.interfaceAlias}" -IPAddress "${config.ipAddress}" -PrefixLength ${config.prefixLength} -Gateway "${config.gateway}" -DNS "${config.dns}"`;

  const sudoOptions = {
    name: 'HTPC Kiosk Network Setup',
  };

  return new Promise((resolve, reject) => {
    sudo.exec(command, sudoOptions, (error, stdout, stderr) => {
      if (error || stderr) {
        const errorMessage = (error ? error.message : stderr).trim();
        console.error(`sudo-prompt error: ${errorMessage}`);
        return reject({ error: `Failed to apply settings: ${errorMessage}` });
      }
      resolve({ success: true, message: 'Network settings applied successfully.' });
    });
  });
});

// IPC handler to close the config window from the renderer
ipcMain.on('config-close', () => {
  if (configWindow) configWindow.close();
});
