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
    <Head />
    <Preview>Xác nhận email cho Aptis Kỳ Tích</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Xác nhận email của bạn</Heading>
        <Text style={text}>
          Cảm ơn bạn đã đăng ký tài khoản tại{' '}
          <Link href={siteUrl} style={link}>
            <strong>Aptis Kỳ Tích</strong>
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
        <Button style={button} href={confirmationUrl}>
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
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#121212', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#737373', lineHeight: '1.5', margin: '0 0 25px' }
const link = { color: 'inherit', textDecoration: 'underline' }
const button = { backgroundColor: '#E11D1F', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
