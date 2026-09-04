import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

type Outcome = {
  logStatus: 'bounced' | 'complained' | 'suppressed'
  suppressionReason: 'bounce' | 'complaint' | 'unsubscribe'
  message: string
}

async function record(
  eventId: string,
  recipient: string | undefined,
  outcome: Outcome
): Promise<void> {
  const email = String(recipient ?? '').toLowerCase()
  if (!email) {
    console.error('Email event without recipient', { event_id: eventId })
    return
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    template_name: 'system',
    recipient_email: email,
    status: outcome.logStatus,
    error_message: outcome.message,
  })
  if (logError) {
    console.error('Failed to record email event in send log', {
      event_id: eventId,
      code: logError.code,
      message: logError.message,
    })
    throw new Error('email_send_log insert failed')
  }

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert(
      {
        email,
        reason: outcome.suppressionReason,
        metadata: null,
      },
      { onConflict: 'email' }
    )
  if (suppressError) {
    console.error('Failed to record email suppression', {
      event_id: eventId,
      code: suppressError.code,
      message: suppressError.message,
    })
    throw new Error('suppressed_emails upsert failed')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await record(event.event_id, event.data?.recipient, {
        logStatus: 'bounced',
        suppressionReason: 'bounce',
        message: 'Email bị trả lại (bounce)',
      })
    },
    'email.complaint': async (event) => {
      await record(event.event_id, event.data?.recipient, {
        logStatus: 'complained',
        suppressionReason: 'complaint',
        message: 'Người nhận báo cáo spam (complaint)',
      })
    },
    'email.unsubscribed': async (event) => {
      await record(event.event_id, event.data?.recipient, {
        logStatus: 'suppressed',
        suppressionReason: 'unsubscribe',
        message: 'Người nhận đã hủy đăng ký nhận email',
      })
    },
  },
})

Deno.serve((req) => handler(req))
