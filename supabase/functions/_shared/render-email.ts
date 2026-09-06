// Synchronous email rendering.
//
// @react-email/render's streaming renderer decodes its output stream chunk by
// chunk without a streaming decoder, which splits multi-byte Vietnamese
// characters at chunk boundaries and produces "nh<?><?>n" style garbage. It
// also pulls in react-dom 19 on the edge runtime, which cannot render our
// react 18 elements. Rendering synchronously with react-dom 18 avoids both.
import * as React from 'npm:react@18.3.1'
import { renderToStaticMarkup } from 'npm:react-dom@18.3.1/server'
import { convert } from 'npm:html-to-text@9.0.5'

const DOCTYPE =
  '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">'

export function renderEmailHtml(element: React.ReactElement): string {
  return DOCTYPE + renderToStaticMarkup(element)
}

export function renderEmailText(element: React.ReactElement): string {
  return convert(renderToStaticMarkup(element), {
    selectors: [{ selector: 'img', format: 'skip' }],
  })
}
