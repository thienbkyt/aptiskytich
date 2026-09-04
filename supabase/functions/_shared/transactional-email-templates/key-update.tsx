import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_URL = 'https://aptiskytich.vn'

interface Props {
  name?: string
  keyDate?: string
}

const Email = ({ name, keyDate }: Props) => {
  const safeName = name || 'bạn'
  const safeDate = keyDate || ''
  return (
    <Html lang="vi" dir="ltr">
      <Head />
      <Preview>{`Key dự đoán Aptis ngày ${safeDate} đã có`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            🔑 Key dự đoán ngày {safeDate} đã cập nhật
          </Heading>
          <Text style={text}>Chào {safeName},</Text>
          <Text style={text}>
            Đội ngũ <strong>Aptis Kỳ Tích</strong> vừa cập nhật bộ đề trọng tâm
            theo key dự đoán mới nhất. Hãy vào ôn ngay để bám sát đề thi sắp
            tới!
          </Text>
          <Button style={button} href={`${SITE_URL}/key-du-doan`}>
            Vào ôn theo key
          </Button>
          <Hr style={hr} />
          <Text style={footer}>— Đội ngũ Aptis Kỳ Tích</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Key dự đoán Aptis ngày ${data?.keyDate ?? ''} đã có — vào ôn ngay`,
  displayName: 'Key dự đoán mới',
  previewData: { name: 'Minh', keyDate: '10/09/2026' },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Plus Jakarta Sans', Arial, sans-serif",
}
const container = { padding: '20px 25px', maxWidth: '560px' }
const h1 = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  color: '#CC1C01',
  margin: '0 0 12px',
}
const text = {
  fontSize: '15px',
  color: '#0F0F10',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const button = {
  backgroundColor: '#CC1C01',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '12px 22px',
  textDecoration: 'none',
}
const hr = { border: 'none', borderTop: '1px solid #eeeeee', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#6b7280', margin: '0' }
