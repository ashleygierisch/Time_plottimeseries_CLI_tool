/**
 * Clickjacking defense for a page that has no way to send response headers.
 *
 * The usual answers -- `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`
 * -- are both headers, and GitHub Pages serves static files with a fixed set of
 * headers that we cannot add to. CSP delivered in a `<meta>` tag is honoured for
 * everything else, but `frame-ancestors` is explicitly ignored there. A report
 * opened straight off disk has no headers at all.
 *
 * So the only defense that travels with the file is refusing to render. See
 * scripts/securityHeaders.ts for the header-based version, which does apply if
 * the site is ever served by a host that reads `_headers`.
 */
/** Just the parts of `window` this needs, so tests can hand it a stand-in. */
export interface FrameContext {
  readonly top: unknown;
  readonly self: unknown;
}

export function isFramed(win: FrameContext): boolean {
  try {
    return win.top !== win.self;
  } catch {
    // Reading `top` across origins can throw. If we can't tell, assume framed.
    return true;
  }
}

export const FRAMED_MESSAGE = 'This page cannot be displayed inside a frame.';
