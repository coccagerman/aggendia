const ALLOWED_DISABLED_PAGES = new Set(['/', '/privacy', '/terms', '/maintenance'])

const ALLOWED_SYSTEM_PATHS = new Set(['/favicon.ico', '/robots.txt', '/sitemap.xml'])

function isStaticAsset(pathname: string): boolean {
    return /\.[a-zA-Z0-9]+$/.test(pathname)
}

function isDisableEnvEnabled(): boolean {
    const value = process.env.DISABLE_ENV?.trim()
        .replace(/^['\"]|['\"]$/g, '')
        .toLowerCase()
    return value === 'true' || value === '1' || value === 'yes' || value === 'on'
}

export function isAppDisabledInProd(): boolean {
    return isDisableEnvEnabled()
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
