#!/usr/bin/env tsx
/**
 * Email Sending Diagnostic Script
 *
 * Tests email sending via Resend and logs the full response.
 * Use this to debug deliverability issues.
 *
 * Usage:
 *   yarn tsx scripts/diagnose-email.ts <recipient-email>
 *
 * Example:
 *   yarn tsx scripts/diagnose-email.ts coccagerman@gmail.com
 */

import 'dotenv/config'

async function diagnoseEmail() {
    const recipient = process.argv[2]
    if (!recipient) {
        console.error('Usage: yarn tsx scripts/diagnose-email.ts <recipient-email>')
        process.exit(1)
    }

    console.log('=== Email Sending Diagnostic ===\n')

    // 1. Check environment variables
    const apiKey = process.env.RESEND_API_KEY
    const emailFrom = process.env.EMAIL_FROM

    console.log('1. Environment Variables:')
    console.log(
        `   RESEND_API_KEY: ${apiKey ? `${apiKey.slice(0, 8)}...${apiKey.slice(-4)} (${apiKey.length} chars)` : '❌ NOT SET'}`
    )
    console.log(`   EMAIL_FROM: ${emailFrom ? `"${emailFrom}"` : '❌ NOT SET'}`)

    // Check for hidden characters in EMAIL_FROM (common .env issue)
    if (emailFrom) {
        const trimmed = emailFrom.trim()
        if (trimmed !== emailFrom) {
            console.log(`   ⚠️  EMAIL_FROM has leading/trailing whitespace! Trimmed: "${trimmed}"`)
        }
        const hasNewline = emailFrom.includes('\n') || emailFrom.includes('\r')
        if (hasNewline) {
            console.log(`   ⚠️  EMAIL_FROM contains newline characters!`)
        }
        const encoded = [...emailFrom].map(c => c.charCodeAt(0))
        if (encoded.some(c => c > 127)) {
            console.log(`   ⚠️  EMAIL_FROM contains non-ASCII characters!`)
        }
        console.log(`   EMAIL_FROM char codes: [${encoded.join(', ')}]`)
    }

    if (!apiKey) {
        console.error('\n❌ Cannot proceed without RESEND_API_KEY')
        process.exit(1)
    }

    // 2. Verify domain status via Resend API
    console.log('\n2. Resend Domain Verification:')
    try {
        const domainsRes = await fetch('https://api.resend.com/domains', {
            headers: { Authorization: `Bearer ${apiKey}` }
        })
        const domainsBody = await domainsRes.json()

        if (domainsBody.data && Array.isArray(domainsBody.data)) {
            for (const domain of domainsBody.data) {
                console.log(`   Domain: ${domain.name}`)
                console.log(`     Status: ${domain.status}`)
                console.log(`     Region: ${domain.region}`)
                console.log(`     Created: ${domain.created_at}`)

                // Check if our FROM domain matches any verified domain
                const fromDomain = emailFrom?.split('@')[1]
                if (fromDomain === domain.name) {
                    console.log(`     ✅ Matches EMAIL_FROM domain`)
                } else if (fromDomain?.endsWith(`.${domain.name}`)) {
                    console.log(
                        `     ⚠️  EMAIL_FROM is a subdomain of this domain — Resend may NOT cover subdomains automatically`
                    )
                }
            }
        } else {
            console.log(`   Response: ${JSON.stringify(domainsBody, null, 2)}`)
        }
    } catch (err) {
        console.log(`   ❌ Failed to fetch domains: ${err}`)
    }

    // 3. Send test email
    console.log(`\n3. Sending test email to: ${recipient}`)
    console.log(`   From: ${emailFrom}`)

    try {
        const sendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: emailFrom,
                to: recipient,
                subject: `[Diagnóstico] Test email - ${new Date().toISOString()}`,
                text: 'Este es un email de diagnóstico enviado desde el script diagnose-email.ts. Si lo recibís, el envío funciona correctamente.',
                html: `
          <div style="font-family: sans-serif; padding: 20px;">
            <h2>✅ Email de Diagnóstico</h2>
            <p>Este email fue enviado como prueba desde <code>diagnose-email.ts</code>.</p>
            <p>Timestamp: <strong>${new Date().toISOString()}</strong></p>
            <p>From: <strong>${emailFrom}</strong></p>
            <hr>
            <p style="color: #666; font-size: 12px;">Si estás viendo este email, el envío desde Resend funciona correctamente.</p>
          </div>
        `
            })
        })

        const sendBody = await sendRes.json()

        console.log(`   HTTP Status: ${sendRes.status}`)
        console.log(`   Response: ${JSON.stringify(sendBody, null, 2)}`)

        if (sendRes.ok && sendBody.id) {
            console.log(`\n   ✅ Email accepted by Resend!`)
            console.log(`   Email ID: ${sendBody.id}`)
            console.log(`   Track it at: https://resend.com/emails/${sendBody.id}`)

            // 4. Check email status after brief wait
            console.log(`\n4. Checking email status (waiting 3 seconds)...`)
            await new Promise(resolve => setTimeout(resolve, 3000))

            const statusRes = await fetch(`https://api.resend.com/emails/${sendBody.id}`, {
                headers: { Authorization: `Bearer ${apiKey}` }
            })
            const statusBody = await statusRes.json()

            console.log(`   Email Status: ${JSON.stringify(statusBody, null, 2)}`)
        } else {
            console.log(`\n   ❌ Email rejected by Resend:`)
            console.log(`   Error: ${JSON.stringify(sendBody, null, 2)}`)

            // Common error analysis
            const errorMsg = JSON.stringify(sendBody).toLowerCase()
            if (errorMsg.includes('not verified') || errorMsg.includes('not found')) {
                console.log(`\n   💡 DIAGNOSIS: The "from" domain is not verified in Resend.`)
                console.log(`      Your EMAIL_FROM domain: ${emailFrom?.split('@')[1]}`)
                console.log(
                    `      You need to verify "${emailFrom?.split('@')[1]}" in Resend (not just the parent domain).`
                )
            }
            if (errorMsg.includes('rate limit')) {
                console.log(`\n   💡 DIAGNOSIS: Rate limit hit. Wait and retry.`)
            }
        }
    } catch (err) {
        console.log(`   ❌ Exception during send: ${err}`)
    }

    console.log('\n=== Diagnostic Complete ===')
}

diagnoseEmail().catch(console.error)
