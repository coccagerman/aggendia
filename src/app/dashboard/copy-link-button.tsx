'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface CopyLinkButtonProps {
    slug: string
}

export function CopyLinkButton({ slug }: CopyLinkButtonProps) {
    const [copied, setCopied] = useState(false)
    const publicUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/b/${slug}`

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(publicUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        } catch (error) {
            console.error('Error al copiar:', error)
        }
    }

    return (
        <div className='mt-3 flex items-center gap-2'>
            <code className='flex-1 rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'>
                {publicUrl}
            </code>
            <Button size='sm' variant='outline' onClick={handleCopy}>
                {copied ? '✓ Copiado' : '🔗 Copiar'}
            </Button>
        </div>
    )
}
