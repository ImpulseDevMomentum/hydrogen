const { app, BrowserWindow, shell, Menu, session } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  
    const ses = session.defaultSession;

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
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
});

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

    mainWindow.on('page-title-updated', (event) => {
        event.preventDefault();
        mainWindow.setTitle('Hydrogen');
});

    Menu.setApplicationMenu(null);

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    if (url.includes('messenger.com') || url.includes('facebook.com')) {
        event.preventDefault();
        callback(true);
    } else {
        callback(false);
    }
});