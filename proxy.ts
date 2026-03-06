import type { NextRequest } from 'next/server'
import { middleware, config } from './middleware'

export function proxy(request: NextRequest) {
    return middleware(request)
}

export { config }
