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
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  email,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="vi" dir="ltr">
    <Head />
    <Preview>Xác nhận thay đổi email cho Aptis Kỳ Tích</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Xác nhận thay đổi email</Heading>
        <Text style={text}>
          Bạn đã yêu cầu thay đổi địa chỉ email từ{' '}
          <Link href={`mailto:${email}`} style={link}>{email}</Link>{' '}
          sang{' '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Text style={text}>Bấm nút bên dưới để xác nhận thay đổi:</Text>
        <Button style={button} href={confirmationUrl}>
          Xác nhận thay đổi email
        </Button>
        <Text style={footer}>
          Nếu bạn không yêu cầu thay đổi này, hãy bảo mật tài khoản ngay.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#121212', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#737373', lineHeight: '1.5', margin: '0 0 25px' }
const link = { color: 'inherit', textDecoration: 'underline' }
const button = { backgroundColor: '#E11D1F', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
