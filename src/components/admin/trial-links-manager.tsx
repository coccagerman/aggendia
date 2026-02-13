'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Loader2, Plus, Copy, Check } from 'lucide-react'

interface TrialLink {
    id: string
    code: string
    trialDays: number
    maxUses: number | null
    usedCount: number
    usageCount: number
    expiresAt: string | null
    isActive: boolean
    metadata: unknown
    createdBy: string | null
    createdAt: string
}

const APP_URL = typeof window !== 'undefined' ? window.location.origin : ''

export function TrialLinksManager() {
    const [links, setLinks] = useState<TrialLink[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showCreate, setShowCreate] = useState(false)
    const [copiedId, setCopiedId] = useState<string | null>(null)

    const fetchLinks = useCallback(async () => {
        try {
            const response = await fetch('/api/v1/admin/trial-links')
            const data = await response.json()
            if (!response.ok) {
                setError(data.error?.message || 'Error al cargar trial links.')
                return
            }
            setLinks(data.data)
        } catch {
            setError('No se pudo conectar con el servidor.')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchLinks()
    }, [fetchLinks])

    const handleCopyLink = async (code: string, id: string) => {
        const url = `${APP_URL}/signup?trial=${code}`
        await navigator.clipboard.writeText(url)
        setCopiedId(id)
        setTimeout(() => setCopiedId(null), 2000)
    }

    const handleToggleActive = async (id: string, isActive: boolean) => {
        try {
            const response = await fetch(`/api/v1/admin/trial-links/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !isActive })
            })
            if (response.ok) {
                setLinks(prev => prev.map(l => (l.id === id ? { ...l, isActive: !isActive } : l)))
            }
        } catch {
            // Silent fail — user can retry
        }
    }

    if (loading) {
        return (
            <div className='flex items-center justify-center py-12'>
                <Loader2 className='h-6 w-6 animate-spin text-muted-foreground' />
            </div>
        )
    }

    if (error) {
        return <div className='rounded-md bg-red-50 p-4 text-sm text-red-800'>{error}</div>
    }

    return (
        <div className='space-y-6'>
            {/* Header + create button */}
            <div className='flex items-center justify-between'>
                <div>
                    <h2 className='text-lg font-semibold'>Links de prueba</h2>
                    <p className='text-sm text-muted-foreground'>
                        Creá links especiales con mayor duración de trial para campañas o clientes específicos.
                    </p>
                </div>
                <Button onClick={() => setShowCreate(!showCreate)}>
                    <Plus className='mr-2 h-4 w-4' />
                    Nuevo link
                </Button>
            </div>

            {/* Create form */}
            {showCreate && (
                <CreateTrialLinkForm
                    onCreated={() => {
                        setShowCreate(false)
                        fetchLinks()
                    }}
                    onCancel={() => setShowCreate(false)}
                />
            )}

            {/* List */}
            {links.length === 0 ? (
                <Card>
                    <CardContent className='py-8 text-center text-muted-foreground'>
                        No hay trial links creados todavía.
                    </CardContent>
                </Card>
            ) : (
                <div className='space-y-3'>
                    {links.map(link => (
                        <Card key={link.id}>
                            <CardContent className='py-4'>
                                <div className='flex items-center justify-between'>
                                    <div className='space-y-1'>
                                        <div className='flex items-center gap-2'>
                                            <code className='rounded bg-muted px-2 py-0.5 text-sm font-mono'>
                                                {link.code}
                                            </code>
                                            <Badge variant={link.isActive ? 'default' : 'secondary'}>
                                                {link.isActive ? 'Activo' : 'Inactivo'}
                                            </Badge>
                                            <Badge variant='outline'>{link.trialDays} días</Badge>
                                        </div>
                                        <p className='text-xs text-muted-foreground'>
                                            Usado {link.usedCount} veces
                                            {link.maxUses ? ` de ${link.maxUses}` : ''}
                                            {link.expiresAt
                                                ? ` · Expira ${new Date(link.expiresAt).toLocaleDateString('es-AR')}`
                                                : ''}
                                        </p>
                                    </div>
                                    <div className='flex items-center gap-2'>
                                        <Button
                                            variant='ghost'
                                            size='icon'
                                            onClick={() => handleCopyLink(link.code, link.id)}
                                            title='Copiar link'
                                        >
                                            {copiedId === link.id ? (
                                                <Check className='h-4 w-4 text-green-600' />
                                            ) : (
                                                <Copy className='h-4 w-4' />
                                            )}
                                        </Button>
                                        <Switch
                                            checked={link.isActive}
                                            onCheckedChange={() => handleToggleActive(link.id, link.isActive)}
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── Create form sub-component ─────────────────────────────────────────────

function CreateTrialLinkForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [formData, setFormData] = useState({
        code: '',
        trialDays: 60,
        maxUses: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError(null)

        if (!formData.code.trim()) {
            setError('El código es requerido.')
            return
        }

        setLoading(true)

        try {
            const response = await fetch('/api/v1/admin/trial-links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: formData.code.trim(),
                    trialDays: formData.trialDays,
                    maxUses: formData.maxUses ? parseInt(formData.maxUses, 10) : null
                })
            })

            const data = await response.json()

            if (!response.ok) {
                setError(data.error?.message || 'Error al crear el trial link.')
                setLoading(false)
                return
            }

            onCreated()
        } catch {
            setError('No se pudo conectar con el servidor.')
            setLoading(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className='text-lg'>Nuevo trial link</CardTitle>
                <CardDescription>
                    El link será <code className='text-xs'>{APP_URL}/signup?trial=CODIGO</code>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className='space-y-4'>
                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
                        <div className='space-y-2'>
                            <Label htmlFor='code'>Código</Label>
                            <Input
                                id='code'
                                placeholder='ej: campana-2025'
                                value={formData.code}
                                onChange={e => setFormData({ ...formData, code: e.target.value })}
                                disabled={loading}
                                maxLength={50}
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='trialDays'>Días de prueba</Label>
                            <Input
                                id='trialDays'
                                type='number'
                                min={1}
                                max={365}
                                value={formData.trialDays}
                                onChange={e =>
                                    setFormData({ ...formData, trialDays: parseInt(e.target.value, 10) || 60 })
                                }
                                disabled={loading}
                            />
                        </div>
                        <div className='space-y-2'>
                            <Label htmlFor='maxUses'>Máx. usos (vacío = ilimitado)</Label>
                            <Input
                                id='maxUses'
                                type='number'
                                min={1}
                                placeholder='Ilimitado'
                                value={formData.maxUses}
                                onChange={e => setFormData({ ...formData, maxUses: e.target.value })}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {error && <div className='rounded-md bg-red-50 p-3 text-sm text-red-800'>{error}</div>}

                    <div className='flex gap-3'>
                        <Button type='button' variant='outline' onClick={onCancel} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button type='submit' disabled={loading}>
                            {loading ? <Loader2 className='mr-2 h-4 w-4 animate-spin' /> : null}
                            Crear link
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
