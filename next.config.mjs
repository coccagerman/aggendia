/** @type {import('next').NextConfig} */
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const nextConfig = {
    turbopack: {
        root: __dirname
    },
    webpack: config => {
        config.resolve.alias = {
            ...(config.resolve.alias || {}),
            tailwindcss: path.join(__dirname, 'node_modules', 'tailwindcss'),
        }
        return config
    },
}

export default nextConfig
