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

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="vi" dir="ltr">
    <Head>
      <meta charSet="utf-8" />
    </Head>
    <Preview>Link đăng nhập Aptis Kỳ Tích</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Link đăng nhập của bạn</Heading>
        <Text style={text}>
          Bấm nút bên dưới để đăng nhập vào Aptis Kỳ Tích. Link này sẽ hết hạn sau một thời gian ngắn.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Đăng nhập
        </Button>
        <Text style={footer}>
          Nếu bạn không yêu cầu link này, hãy bỏ qua email này.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#121212', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#737373', lineHeight: '1.5', margin: '0 0 25px' }
const button = { backgroundColor: '#E11D1F', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
