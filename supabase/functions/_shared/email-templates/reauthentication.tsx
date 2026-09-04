/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="vi" dir="ltr">
    <Head>
      <meta charSet="utf-8" />
    </Head>
    <Preview>Mã xác thực của bạn</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Xác thực lại tài khoản</Heading>
        <Text style={text}>Sử dụng mã bên dưới để xác nhận danh tính:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Mã này sẽ hết hạn sau một thời gian ngắn. Nếu bạn không yêu cầu, hãy bỏ qua email này.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#121212', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#737373', lineHeight: '1.5', margin: '0 0 25px' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '22px', fontWeight: 'bold' as const, color: '#E11D1F', margin: '0 0 30px' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
