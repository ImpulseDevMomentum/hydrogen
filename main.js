const { app, BrowserWindow, shell, Menu, session, Tray, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let tray = null;
let unreadCount = 0;

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
    const cssPath = path.join(__dirname, 'styles', 'dark.css');
    try {
      const css = fs.readFileSync(cssPath, 'utf8');
      mainWindow.webContents.insertCSS(css);
    } catch (error) {
    }
    
    if (tray) {
      setTimeout(() => {
        updateTrayMenu();
      }, 3000);
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
    const count = match ? parseInt(match[1]) : 0;
    unreadCount = count;

    updateAppIcon(count > 0);
    updateTrayMenu();
    
    if (count > 0 && Notification.isSupported()) {
      new Notification({
        title: 'Hydrogen',
        body: `You have ${count} unread message${count > 1 ? 's' : ''}`,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        silent: false
      }).show();
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

function updateAppIcon(hasUnread) {
  const iconPath = path.join(__dirname, 'assets', hasUnread ? 'iconalert.ico' : 'icon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  
  if (!icon.isEmpty() && mainWindow) {
    mainWindow.setIcon(icon);
  }
  
  if (tray) {
    tray.setImage(icon);
  }
}

function updateTrayMenu() {
  if (!tray) return;
  
  const recentContacts = [];
  
  if (mainWindow && mainWindow.webContents) {
    setTimeout(() => {
      if (!mainWindow || !mainWindow.webContents) {
        buildTrayMenu([]);
        return;
      }
      mainWindow.webContents.executeJavaScript(`
      (function() {
        const contacts = [];
        const selectors = [
          '[role="row"]',
          'div[aria-label*="Chat"] > div > div',
          'div[data-pagelet="LeftRail"] [role="row"]',
          'div[aria-label*="Chaty"] [role="row"]',
          'div[role="listbox"] > div',
          'ul[role="list"] > li',
          'div[role="list"] > div',
          'a[role="row"]'
        ];
        
        let chatItems = [];
        for (const selector of selectors) {
          const items = document.querySelectorAll(selector);
          if (items.length > 0) {
            chatItems = Array.from(items).filter(item => {
              const text = item.textContent.trim();
              return text.length > 0 && text.length < 200;
            });
            if (chatItems.length > 0) break;
          }
        }
        
        chatItems.forEach((item, index) => {
          if (index < 5 && contacts.length < 5) {
            let name = null;
            const nameSelectors = [
              'span[dir="auto"]',
              'div[dir="auto"]',
              'span[class*="name"]',
              'div[class*="name"]',
              'strong',
              'span strong',
              'a span',
              'div span',
              '[data-testid*="name"]',
              'h1',
              'h2',
              'h3'
            ];
            
            for (const nameSel of nameSelectors) {
              const nameEl = item.querySelector(nameSel);
              if (nameEl && nameEl.textContent.trim()) {
                const candidate = nameEl.textContent.trim();
                if (candidate.length > 0 && candidate.length < 50 && !candidate.match(/^\\d+[:\\s]/)) {
                  name = candidate;
                  break;
                }
              }
            }
            
            if (!name) {
              const text = item.textContent.trim();
              const lines = text.split(/[\\n\\r]+/).filter(l => {
                const trimmed = l.trim();
                return trimmed.length > 0 && trimmed.length < 50 && !trimmed.match(/^\\d+[:\\s]/);
              });
              if (lines.length > 0) {
                name = lines[0].trim();
              }
            }
            
            if (name && name.length > 0 && name.length < 50 && !name.match(/^\\d+$/)) {
              contacts.push({
                name: name,
                index: index
              });
            }
          }
        });
        
        return contacts;
      })();
    `).then(contacts => {
      if (contacts && contacts.length > 0) {
        buildTrayMenu(contacts);
      } else {
        buildTrayMenu([]);
      }
    }).catch((err) => {
      buildTrayMenu([]);
    });
    }, 2000);
  } else {
    buildTrayMenu([]);
  }
}

function buildTrayMenu(recentContacts) {
  const menuItems = [
    {
      label: 'Hydrogen',
      enabled: false
    },
    { type: 'separator' }
  ];
  
  if (unreadCount > 0) {
    menuItems.push({
      label: `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}`,
      enabled: false
    });
    menuItems.push({ type: 'separator' });
  }
  
  if (recentContacts.length > 0) {
    menuItems.push({
      label: 'Recent Contacts',
      enabled: false
    });
    recentContacts.forEach((contact, idx) => {
      menuItems.push({
        label: contact.name.length > 30 ? contact.name.substring(0, 30) + '...' : contact.name,
        click: () => {
          if (mainWindow && mainWindow.webContents) {
            mainWindow.webContents.executeJavaScript(`
              (function() {
                const selectors = [
                  '[role="row"]',
                  'div[aria-label*="Chat"] > div > div',
                  'div[data-pagelet="LeftRail"] [role="row"]'
                ];
                
                let chatItems = [];
                for (const selector of selectors) {
                  chatItems = document.querySelectorAll(selector);
                  if (chatItems.length > 0) break;
                }
                
                const targetName = '${contact.name.replace(/'/g, "\\'").replace(/"/g, '\\"')}';
                chatItems.forEach((item, index) => {
                  if (index === ${contact.index || idx}) {
                    item.click();
                    return;
                  }
                  const text = item.textContent.trim();
                  if (text.includes(targetName)) {
                    item.click();
                  }
                });
              })();
            `);
          }
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      });
    });
    menuItems.push({ type: 'separator' });
  }
  
  menuItems.push({
    label: 'Focus',
    click: () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
  
  menuItems.push({ type: 'separator' });
  
  menuItems.push({
    label: 'Quit',
    click: () => {
      app.isQuitting = true;
      app.quit();
    }
  });
  
  const contextMenu = Menu.buildFromTemplate(menuItems);
  tray.setContextMenu(contextMenu);
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', unreadCount > 0 ? 'iconalert.ico' : 'icon.ico');
  let icon = nativeImage.createFromPath(iconPath);
  
  if (icon.isEmpty()) {
    icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.ico'));
  }
  
  tray = new Tray(icon);
  tray.setToolTip(unreadCount > 0 ? `Hydrogen - ${unreadCount} unread` : 'Hydrogen');
  
  updateTrayMenu();
  
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