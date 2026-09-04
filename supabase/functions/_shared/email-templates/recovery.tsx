/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="vi" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Đặt lại mật khẩu {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Đặt lại mật khẩu</Heading>
        <Text style={text}>
          Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản {siteName}{' '}
          của bạn. Bấm nút bên dưới để tạo mật khẩu mới.
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Đặt lại mật khẩu
        </Button>
        <Text style={footer}>
          Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#121212',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const button = {
  backgroundColor: '#CC1C01',
  color: '#ffffff',
  fontSize: '14px',
  border: '1px solid #CC1C01',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
  fontWeight: 'bold' as const,
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #CC1C01 !important; color: #ffffff !important; }
  }
  [data-ogsc] .dm-btn { background-color: #CC1C01 !important; color: #ffffff !important; }
  [data-ogsb] .dm-btn { background-color: #CC1C01 !important; color: #ffffff !important; }
`
