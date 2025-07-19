# HTPC Kiosk

HTPC Kiosk is a small Electron based application used to launch media services in a fullscreen kiosk environment.  This document summarises the basic setup steps and a few reminders about how the project works.

## Directory Structure

It is recommended to clone or place the repository in `C:\HTPC\htpc-kiosk`.  Building the project will create a `dist` directory below this location:

```
C:\HTPC\htpc-kiosk\dist\win-unpacked
```

The application stores its user data in `C:\HTPC\htpc-kiosk\user_data`.

A `tools` directory must exist beside the source with `psshutdown.exe` from the Sysinternals suite.  The binary is invoked when the **Sleep** command is selected.

## Installing Dependencies

1. Install a current Node.js release (v20 LTS recommended) from [https://nodejs.org/](https://nodejs.org/).
2. Install package dependencies:

```powershell
npm install
```

## Running in Development

To start the Electron app with console logging enabled:

```powershell
npx electron . --enable-logging
```

Pass the option `--clear-cache` if cached data needs to be removed before the window loads.

`htpc.bat` and `htpc.ps1` are simple helpers which run the same command.

## Building the Distribution

Use `electron-builder` via the defined npm script:

```powershell
npm run dist
```

The output appears under the `dist` folder.  On Windows the unpacked build can be launched directly from `dist\win-unpacked`.

Relevant build configuration is stored in `package.json`:

```json
  "directories": {
    "output": "dist"
  },
  "asarUnpack": [
    "scripts",
    "tools",
    "config",
    "config/icons"
  ],
  "win": {
    "target": "nsis"
  }
```

## Start Page Configuration

The grid of buttons shown on start is defined by `config/matrix.json`.  Each entry contains:

- `icon` – file name from `config/icons`
- `label` – text displayed under the icon
- `type` – `link` (open URL) or `command` (internal action)
- `action` – target URL or command name

Icons referenced here must be present in `config/icons`.

Example fragment:

```json
{ "icon": "netflix2.png", "label": "", "type": "link", "action": "https://www.netflix.com/" }
```

Commands supported include `sleep`, `shutdown`, `reboot`, `setup`, `VPN` and `info`.

## Network Configuration Dialog

Selecting **Config** on the main page opens `startpage/config.html`.  It allows the user to edit IP, gateway and DNS settings using PowerShell scripts from the `scripts` directory.  Administrator rights are requested when applying changes.

## Refresh Logic Reminder

- The start page uses `preload.js` to expose IPC methods.
- `matrix.json` is loaded during startup so edits take effect after the app is restarted.
- Sidebar widgets periodically update system information and geolocation.  Manual refresh can be triggered via IPC from the main process.
- `psshutdown.exe` is required for reliable sleep behaviour; without it the Sleep command will fail.

## Summary

1. Place repository at `C:\HTPC\htpc-kiosk` and create a `tools` folder containing `psshutdown.exe`.
2. Run `npm install` followed by `npx electron . --enable-logging` for development.
3. Build a release with `npm run dist` and use the files under `dist\win-unpacked`.
4. Update `config/matrix.json` and `config/icons` to customise the start page.

