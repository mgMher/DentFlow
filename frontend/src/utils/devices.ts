/** "Chrome on macOS" from a browser's user agent (F9 device list). Good enough to recognise your own devices. */
export const deviceName = (userAgent?: string): string => {
    if (!userAgent) return '';
    const ua = userAgent;
    const browser = /Edg\//.test(ua)
        ? 'Edge'
        : /OPR\/|Opera/.test(ua)
          ? 'Opera'
          : /Firefox\//.test(ua)
            ? 'Firefox'
            : /Chrome\/|CriOS/.test(ua)
              ? 'Chrome'
              : /Safari\//.test(ua)
                ? 'Safari'
                : '';
    const os = /iPhone|iPad|iPod/.test(ua)
        ? 'iOS'
        : /Android/.test(ua)
          ? 'Android'
          : /Mac OS X|Macintosh/.test(ua)
            ? 'macOS'
            : /Windows/.test(ua)
              ? 'Windows'
              : /Linux/.test(ua)
                ? 'Linux'
                : '';
    if (browser && os) return `${browser} · ${os}`;
    return browser || os || ua.slice(0, 40);
};
