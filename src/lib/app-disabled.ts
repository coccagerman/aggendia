const ALLOWED_DISABLED_PAGES = new Set(['/', '/privacy', '/terms', '/maintenance'])

const ALLOWED_SYSTEM_PATHS = new Set(['/favicon.ico', '/robots.txt', '/sitemap.xml'])

function isStaticAsset(pathname: string): boolean {
    return /\.[a-zA-Z0-9]+$/.test(pathname)
}

export function isAppDisabledInProd(): boolean {
    return process.env.APP_ENV === 'prod' && process.env.DISABLE_ENV === 'true'
}

export function isAllowedPathWhenAppDisabled(pathname: string): boolean {
    if (ALLOWED_DISABLED_PAGES.has(pathname) || ALLOWED_SYSTEM_PATHS.has(pathname)) {
        return true
    }

    if (pathname.startsWith('/_next/')) {
        return true
    }

    return isStaticAsset(pathname)
}
