const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');
const { exec } = require('child_process');

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
    
    // Use Edge with kiosk flags (adjust path if necessary)
    const edgePath = '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"';
    // Launch Edge in fullscreen with the given URL
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
    });
  });

  const defaultSession = session.defaultSession;
  app.on('before-quit', () => {
    defaultSession.cookies.flushStore().catch((error) => {
      console.error('Error flushing cookies:', error);
    });
  });
});

// Add handler for system commands (sleep, shutdown, kodi, etc.)
ipcMain.on('system-command', (event, cmd) => {
  console.log(`IPC message received: system-command, cmd: ${cmd}`);
  if (cmd === 'sleep') {
    exec('"C:\\PsTools\\psshutdown.exe" -d -t 0', (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing sleep command:', error);
        return;
      }
      console.log('Sleep command executed successfully.', stdout);
    });
  } else if (cmd === 'shutdown') {
    exec('shutdown /s /t 0', (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing shutdown command:', error);
        return;
      }
      console.log('Shutdown command executed successfully.', stdout);
    });
  } else if (cmd === 'kodi') {
    exec('"C:\\Program Files\\Kodi\\kodi.exe"', (error, stdout, stderr) => {
      if (error) {
        console.error('Error executing kodi command:', error);
        return;
      }
      console.log('Kodi launched successfully.', stdout);
    });
  } else {
    console.error('Unknown system command:', cmd);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
