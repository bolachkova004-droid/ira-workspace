export const getTelegramApp = () => window.Telegram?.WebApp;
export const getTelegramUser = () => getTelegramApp()?.initDataUnsafe?.user;
/** Telegram clients differ by version. One unsupported SDK method must never
 * prevent the React application from mounting. */
export function safeTelegramCall(action) {
    try {
        action();
    }
    catch (error) {
        console.warn('[Ira Workspace] Telegram SDK call was skipped:', error);
    }
}
export function applyTelegramChrome(dark) {
    const app = getTelegramApp();
    if (!app)
        return;
    const background = dark ? '#171318' : '#fff8fb';
    const bottom = dark ? '#211b22' : '#ffffff';
    safeTelegramCall(() => app.setHeaderColor?.(background));
    safeTelegramCall(() => app.setBackgroundColor?.(background));
    safeTelegramCall(() => app.setBottomBarColor?.(bottom));
}
export function haptic(type = 'tap') {
    const feedback = getTelegramApp()?.HapticFeedback;
    if (!feedback)
        return;
    safeTelegramCall(() => {
        if (type === 'success')
            feedback.notificationOccurred?.('success');
        else if (type === 'warning')
            feedback.notificationOccurred?.('warning');
        else
            feedback.impactOccurred?.('light');
    });
}
export function initTelegram() {
    const app = getTelegramApp();
    if (!app)
        return;
    document.documentElement.classList.add('is-telegram');
    safeTelegramCall(() => app.ready());
    safeTelegramCall(() => app.expand());
    const syncTheme = () => {
        let dark = app.colorScheme === 'dark';
        try {
            const saved = localStorage.getItem('ira.v4.dark');
            if (saved !== null)
                dark = JSON.parse(saved);
        }
        catch {
            // Telegram theme remains the fallback.
        }
        document.documentElement.dataset.theme = dark ? 'dark' : 'light';
        applyTelegramChrome(dark);
    };
    syncTheme();
    safeTelegramCall(() => app.onEvent?.('themeChanged', syncTheme));
}
