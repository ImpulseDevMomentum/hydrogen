const { app, BrowserWindow, shell, Menu, session, Tray, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let tray = null;

function loadWindowState() {
  const statePath = path.join(app.getPath('userData'), 'window-state.json');
  try {
    if (fs.existsSync(statePath)) {
      const data = fs.readFileSync(statePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading window state:', error);
  }
  return null;
}

function saveWindowState() {
  if (!mainWindow) return;
  
  const state = {
    width: mainWindow.getBounds().width,
    height: mainWindow.getBounds().height,
    x: mainWindow.getBounds().x,
    y: mainWindow.getBounds().y,
    isMaximized: mainWindow.isMaximized()
  };
  
  const statePath = path.join(app.getPath('userData'), 'window-state.json');
  try {
    fs.writeFileSync(statePath, JSON.stringify(state), 'utf8');
  } catch (error) {
    console.error('Error saving window state:', error);
  }
}

function createWindow() {
  const ses = session.defaultSession;
  
  const savedState = loadWindowState();
  const windowOptions = {
    width: savedState?.width || 1200,
    height: savedState?.height || 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#000000',
    title: 'Hydrogen',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    titleBarStyle: 'default',
    titleBarOverlay: {
      color: '#000000',
      symbolColor: '#ffffff',
      height: 40
    },
    show: false
  };
  
  if (savedState && savedState.x !== undefined && savedState.y !== undefined) {
    windowOptions.x = savedState.x;
    windowOptions.y = savedState.y;
  }

  mainWindow = new BrowserWindow(windowOptions);
  
  if (savedState?.isMaximized) {
    mainWindow.maximize();
  }

    const checkLoginStatus = async () => {
        try {
        const cookies = await ses.cookies.get({ domain: '.facebook.com' });
        const hasSessionCookie = cookies.some(cookie => 
            cookie.name === 'c_user' || cookie.name === 'xs' || cookie.name === 'datr'
        );
        
        if (hasSessionCookie) {
            mainWindow.loadURL('https://www.messenger.com', {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });
        } else {
            mainWindow.loadURL('https://www.facebook.com/login.php?next=https://www.messenger.com', {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });
        }
        } catch (error) {
        mainWindow.loadURL('https://www.messenger.com', {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
    }
};

  checkLoginStatus();

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (process.platform === 'darwin') {
      app.dock.show();
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    const cssPath = path.join(__dirname, 'styles', 'dark-theme.css');
    try {
      const css = fs.readFileSync(cssPath, 'utf8');
      mainWindow.webContents.insertCSS(css);
    } catch (error) {
    }
  });

  mainWindow.on('moved', saveWindowState);
  mainWindow.on('resized', saveWindowState);
  mainWindow.on('maximize', saveWindowState);
  mainWindow.on('unmaximize', saveWindowState);

  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      if (process.platform === 'win32') {
        if (!tray) {
          createTray();
        }
      }
    }
  });

    mainWindow.webContents.on('did-navigate', (event, url) => {
        const parsedUrl = new URL(url);
        if (parsedUrl.hostname === 'www.facebook.com' && parsedUrl.pathname === '/') {
        setTimeout(() => {
            mainWindow.loadURL('https://www.messenger.com');
        }, 1000);
    }
});

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
    return { action: 'deny' };
});

    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    
        const parsedUrl = new URL(navigationUrl);
    
        if (parsedUrl.hostname !== 'www.messenger.com' && 
            parsedUrl.hostname !== 'messenger.com' &&
            parsedUrl.hostname !== 'facebook.com' &&
            parsedUrl.hostname !== 'www.facebook.com') {
        event.preventDefault();
        shell.openExternal(navigationUrl);
    }
});

  mainWindow.on('page-title-updated', (event, title) => {
    event.preventDefault();
    mainWindow.setTitle('Hydrogen');
    
    const match = title.match(/\((\d+)\)/);
    if (match && Notification.isSupported()) {
      const count = parseInt(match[1]);
      if (count > 0) {
        new Notification({
          title: 'Hydrogen',
          body: `You have ${count} unread message${count > 1 ? 's' : ''}`,
          icon: path.join(__dirname, 'assets', 'icon.ico'),
          silent: false
        }).show();
      }
    }
  });

  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.control || input.meta) && input.key.toLowerCase() === 'k') {
      event.preventDefault();
      mainWindow.webContents.executeJavaScript(`
        const searchInput = document.querySelector('input[placeholder*="Search"], input[aria-label*="Search"]');
        if (searchInput) {
          searchInput.focus();
          searchInput.click();
        }
      `);
    }
    
    if ((input.control || input.meta) && input.key === ',') {
    }
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  let icon = nativeImage.createFromPath(iconPath);
  
  if (icon.isEmpty()) {
    icon = nativeImage.createEmpty();
  }
  
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Focus',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Hydrogen');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      }
    }
  });
}

app.setName('Hydrogen');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.hydrogen.messenger');
  
  try {
    process.title = 'Hydrogen';
  } catch (e) {
  }
}

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  
  if (process.platform === 'win32') {
    createTray();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (!tray) {
      app.quit();
    }
  } else {
    app.quit();
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
  saveWindowState();
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    if (url.includes('messenger.com') || url.includes('facebook.com')) {
        event.preventDefault();
        callback(true);
    } else {
        callback(false);
    }
});