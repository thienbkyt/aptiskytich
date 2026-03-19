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

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
}: InviteEmailProps) => (
  <Html lang="vi" dir="ltr">
    <Head />
    <Preview>Bạn được mời tham gia Aptis Kỳ Tích</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Bạn được mời tham gia</Heading>
        <Text style={text}>
          Bạn được mời tham gia{' '}
          <Link href={siteUrl} style={link}>
            <strong>Aptis Kỳ Tích</strong>
          </Link>
          . Bấm nút bên dưới để chấp nhận lời mời và tạo tài khoản.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Chấp nhận lời mời
        </Button>
        <Text style={footer}>
          Nếu bạn không mong đợi lời mời này, hãy bỏ qua email này.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#121212', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#737373', lineHeight: '1.5', margin: '0 0 25px' }
const link = { color: 'inherit', textDecoration: 'underline' }
const button = { backgroundColor: '#E11D1F', color: '#ffffff', fontSize: '14px', borderRadius: '8px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
