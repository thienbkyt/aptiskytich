/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="vi" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Xác nhận email của bạn tại {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Xác nhận email của bạn</Heading>
        <Text style={text}>
          Cảm ơn bạn đã đăng ký{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          !
        </Text>
        <Text style={text}>
          Vui lòng xác nhận địa chỉ email (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) bằng cách bấm nút bên dưới:
        </Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Xác nhận email
        </Button>
        <Text style={footer}>
          Nếu bạn không tạo tài khoản này, hãy bỏ qua email này.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
const link = { color: 'inherit', textDecoration: 'underline' }
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
