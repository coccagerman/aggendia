'use client'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface ServiceCardProps {
    name: string
    description: string | null
    durationMinutes: number
    formattedPrice: string
}

export function ServiceCard({ name, description, durationMinutes, formattedPrice }: ServiceCardProps) {
    return (
        <div
            className='rounded-lg border border-zinc-200 p-4 transition-colors dark:border-zinc-800'
            aria-label={`Servicio: ${name}`}
        >
            <div className='flex items-start justify-between gap-4'>
                <div className='flex-1 min-w-0'>
                    <h3 className='font-medium text-zinc-900 dark:text-zinc-50'>{name}</h3>
                    {description && (
                        <p className='mt-1 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2'>{description}</p>
                    )}
                    <div className='mt-2 flex flex-wrap items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400'>
                        <span>⏱️ {durationMinutes} min</span>
                        <span>💰 {formattedPrice}</span>
                    </div>
                </div>
                <div className='shrink-0'>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span tabIndex={0}>
                                <Button
                                    variant='default'
                                    size='sm'
                                    disabled
                                    aria-label={`Reservar ${name} - Próximamente`}
                                >
                                    Reservar
                                </Button>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Próximamente</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>
        </div>
    )
}
