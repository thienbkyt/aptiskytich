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

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="vi" dir="ltr">
    <Head>
      <style>{darkModeCss}</style>
    </Head>
    <Preview>Xác nhận đổi email tại {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Xác nhận đổi địa chỉ email</Heading>
        <Text style={text}>
          Bạn đã yêu cầu đổi địa chỉ email của tài khoản {siteName} từ{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>
            {oldEmail}
          </Link>{' '}
          sang{' '}
          <Link href={`mailto:${newEmail}`} style={link}>
            {newEmail}
          </Link>
          .
        </Text>
        <Text style={text}>Bấm nút bên dưới để xác nhận thay đổi này:</Text>
        <Button className="dm-btn" style={button} href={confirmationUrl}>
          Xác nhận đổi email
        </Button>
        <Text style={footer}>
          Nếu bạn không yêu cầu thay đổi này, hãy bảo vệ tài khoản của bạn ngay.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

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
