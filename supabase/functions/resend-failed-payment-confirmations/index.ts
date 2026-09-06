import { createClient } from 'npm:@supabase/supabase-js@2'
import { EmailAPIError, sendLovableEmail } from 'npm:@lovable.dev/email-js@0.1.0'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const SITE_URL = 'https://aptiskytich.vn'
const FROM = 'Aptis Kỳ Tích <noreply@mail.aptiskytich.vn>'
const SENDER_DOMAIN = 'notify.mail.aptiskytich.vn'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

Deno.serve(async (req) => {
  const bridgeToken = req.headers.get('x-internal-token') ?? ''
  const { data: storedToken } = await admin
    .from('internal_service_tokens')
    .select('token')
    .eq('name', 'email_bridge')
    .maybeSingle()

  if (!storedToken?.token || bridgeToken !== storedToken.token) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) return Response.json({ error: 'email_not_configured' }, { status: 500 })

  const { data: failed, error: failedError } = await admin
    .from('email_send_log')
    .select('message_id, recipient_email, created_at')
    .eq('template_name', 'payment_success')
    .eq('status', 'failed')
    .not('message_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(30)

  if (failedError) return Response.json({ error: failedError.message }, { status: 500 })

  let sent = 0
  let skipped = 0
  let failedCount = 0

  for (const row of failed ?? []) {
    const originalId = String(row.message_id ?? '')
    const paymentId = originalId.replace('payment-paid-', '')
    const retryId = `resend-v3-${originalId}`

    const { data: existing } = await admin
      .from('email_send_log')
      .select('id')
      .eq('message_id', retryId)
      .eq('status', 'sent')
      .limit(1)
    if (existing?.length) {
      skipped++
      continue
    }

    const { data: payment } = await admin
      .from('payments')
      .select('user_id, plan_key, tier, amount_vnd')
      .eq('id', paymentId)
      .eq('status', 'paid')
      .maybeSingle()
    if (!payment) {
      skipped++
      continue
    }

    const [{ data: profile }, { data: plan }, { data: subscription }] = await Promise.all([
      admin.from('profiles').select('display_name').eq('user_id', payment.user_id).maybeSingle(),
      admin.from('pricing_plans').select('label').eq('key', payment.plan_key).maybeSingle(),
      admin.from('user_subscriptions').select('tier, pro_until').eq('user_id', payment.user_id).maybeSingle(),
    ])

    const name = profile?.display_name?.trim() || 'bạn'
    const planLabel = plan?.label || payment.tier || 'Pro'
    const expiry = subscription?.tier === 'premium' || !subscription?.pro_until
      ? 'Trọn đời'
      : new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(subscription.pro_until))
    const amount = new Intl.NumberFormat('vi-VN').format(payment.amount_vnd ?? 0) + 'đ'
    const subject = `Xác nhận kích hoạt gói ${planLabel} — Aptis Kỳ Tích`
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px;color:#0F0F10;line-height:1.6"><h2 style="color:#CC1C01">Gói học đã được kích hoạt</h2><p>Chào ${name}, tài khoản của bạn đã được kích hoạt thành công.</p><p><b>Gói:</b> ${planLabel}<br><b>Hạn dùng:</b> ${expiry}<br><b>Số tiền:</b> ${amount}</p><p><a href="${SITE_URL}/dashboard">Bắt đầu học ngay</a></p><p>— Đội ngũ Aptis Kỳ Tích</p></div>`

    try {
      await sendLovableEmail({
        to: row.recipient_email,
        from: FROM,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text: `Gói ${planLabel} đã kích hoạt. Hạn dùng: ${expiry}. ${SITE_URL}/dashboard`,
        purpose: 'transactional',
        label: 'payment_success_resend',
        idempotency_key: retryId,
      }, { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') })

      await admin.from('email_send_log').insert({
        template_name: 'payment_success_resend',
        recipient_email: row.recipient_email,
        status: 'sent',
        message_id: retryId,
        metadata: { original_message_id: originalId },
      })
      sent++
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const suppressed = error instanceof EmailAPIError && error.code === 'recipient_suppressed'
      await admin.from('email_send_log').insert({
        template_name: 'payment_success_resend',
        recipient_email: row.recipient_email,
        status: suppressed ? 'suppressed' : 'failed',
        message_id: retryId,
        error_message: message.slice(0, 1000),
        metadata: { original_message_id: originalId },
      })
      failedCount++
    }

    await sleep(3000)
  }

  return Response.json({ sent, skipped, failed: failedCount })
})