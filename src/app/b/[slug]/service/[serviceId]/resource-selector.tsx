'use client'

import Link from 'next/link'

interface Resource {
    id: string
    name: string
    type: 'PERSON' | 'ASSET' | null
}

interface ResourceSelectorProps {
    resources: Resource[]
    slug: string
    serviceId: string
    resourceLabel: string
}

export function ResourceSelector({ resources, slug, serviceId, resourceLabel }: ResourceSelectorProps) {
    return (
        <div className='space-y-3'>
            {resources.map(resource => (
                <Link
                    key={resource.id}
                    href={`/b/${slug}/service/${serviceId}/resource/${resource.id}/slots`}
                    className='block rounded-lg border border-zinc-200 p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'
                >
                    <div className='flex items-center justify-between'>
                        <div className='flex items-center gap-3'>
                            {/* Icon based on type */}
                            <div className='flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800'>
                                {resource.type === 'PERSON' ? (
                                    <svg
                                        className='h-5 w-5 text-zinc-600 dark:text-zinc-400'
                                        fill='none'
                                        viewBox='0 0 24 24'
                                        stroke='currentColor'
                                    >
                                        <path
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                            strokeWidth={2}
                                            d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
                                        />
                                    </svg>
                                ) : resource.type === 'ASSET' ? (
                                    <svg
                                        className='h-5 w-5 text-zinc-600 dark:text-zinc-400'
                                        fill='none'
                                        viewBox='0 0 24 24'
                                        stroke='currentColor'
                                    >
                                        <path
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                            strokeWidth={2}
                                            d='M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'
                                        />
                                    </svg>
                                ) : (
                                    <svg
                                        className='h-5 w-5 text-zinc-600 dark:text-zinc-400'
                                        fill='none'
                                        viewBox='0 0 24 24'
                                        stroke='currentColor'
                                    >
                                        <path
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                            strokeWidth={2}
                                            d='M4 6h16M4 10h16M4 14h16M4 18h16'
                                        />
                                    </svg>
                                )}
                            </div>
                            <div>
                                <p className='font-medium text-zinc-900 dark:text-zinc-50'>{resource.name}</p>
                                <p className='text-sm text-zinc-500 dark:text-zinc-400'>{resourceLabel}</p>
                            </div>
                        </div>
                        {/* Arrow indicator */}
                        <svg className='h-5 w-5 text-zinc-400' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                        </svg>
                    </div>
                </Link>
            ))}
        </div>
    )
}
