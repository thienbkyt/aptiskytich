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
      <meta charSet="utf-8" />
    </Head>
    <Preview>Đặt lại mật khẩu Aptis Kỳ Tích</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Đặt lại mật khẩu</Heading>
        <Text style={text}>
          Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản Aptis Kỳ Tích của bạn. Bấm nút bên dưới để chọn mật khẩu mới.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Đặt lại mật khẩu
        </Button>
        <Text style={footer}>
          Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#121212', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#737373', lineHeight: '1.5', margin: '0 0 25px' }
const button = { backgroundColor: '#E11D1F', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
