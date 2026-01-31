/**
 * Diagnostic script for WhatsApp notifications
 * Usage: yarn dotenv -e .env.local -- npx tsx scripts/diagnose-whatsapp.ts
 */

import { prisma } from '@/data/prisma/prisma'

async function main() {
    console.log('\n📊 WhatsApp Notification Diagnostic\n')
    console.log('='.repeat(50))

    // 1. Check env vars
    console.log('\n1️⃣ Environment Variables:')
    console.log('   WHATSAPP_ACCESS_TOKEN:', process.env.WHATSAPP_ACCESS_TOKEN ? '✅ Set' : '❌ Missing')
    console.log('   WHATSAPP_PHONE_NUMBER_ID:', process.env.WHATSAPP_PHONE_NUMBER_ID ? '✅ Set' : '❌ Missing')

    // 2. Check business config
    console.log('\n2️⃣ Business Configuration:')
    const businesses = await prisma.business.findMany({
        select: { id: true, name: true, whatsappNotificationsEnabled: true }
    })
    businesses.forEach(b => {
        console.log(
            `   ${b.name}: whatsappNotificationsEnabled = ${b.whatsappNotificationsEnabled ? '✅ true' : '❌ false'}`
        )
    })

    // 3. Check recent customers
    console.log('\n3️⃣ Recent Customers (last 5):')
    const customers = await prisma.customer.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, fullName: true, phone: true, phoneE164: true, createdAt: true }
    })
    customers.forEach(c => {
        const phoneStatus = c.phoneE164 ? '✅' : c.phone ? '⚠️ (no E164)' : '❌'
        console.log(`   ${c.fullName}: phone=${c.phone || 'null'}, phoneE164=${c.phoneE164 || 'null'} ${phoneStatus}`)
    })

    // 4. Check recent notifications
    console.log('\n4️⃣ Recent Notifications (last 10):')
    const notifications = await prisma.notification.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: { id: true, channel: true, type: true, status: true, error: true, createdAt: true }
    })
    notifications.forEach(n => {
        const statusIcon = n.status === 'SENT' ? '✅' : n.status === 'FAILED' ? '❌' : '⏳'
        console.log(`   ${n.channel} ${n.type}: ${n.status} ${statusIcon} ${n.error ? `(${n.error})` : ''}`)
    })

    // 5. Summary
    console.log('\n5️⃣ Summary:')
    const whatsappNotifs = notifications.filter(n => n.channel === 'WHATSAPP')
    const emailNotifs = notifications.filter(n => n.channel === 'EMAIL')
    console.log(`   Email notifications: ${emailNotifs.length}`)
    console.log(`   WhatsApp notifications: ${whatsappNotifs.length}`)

    if (whatsappNotifs.length === 0) {
        console.log('\n⚠️ No WhatsApp notifications found. Possible causes:')
        const anyBusinessEnabled = businesses.some(b => b.whatsappNotificationsEnabled)
        if (!anyBusinessEnabled) {
            console.log('   → No business has whatsappNotificationsEnabled = true')
            console.log('   → Go to Settings and enable "Notificaciones por WhatsApp"')
        }
        const anyCustomerWithE164 = customers.some(c => c.phoneE164)
        if (!anyCustomerWithE164) {
            console.log('   → No customers have phoneE164 set')
            console.log('   → Make sure phone numbers include country code (e.g., +54 9 11 1234-5678)')
        }
    }

    console.log('\n' + '='.repeat(50))
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect())
