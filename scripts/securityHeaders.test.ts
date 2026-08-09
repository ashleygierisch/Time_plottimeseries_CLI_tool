import { test } from 'node:test';
import assert from 'node:assert';
import { contentSecurityPolicy, cspHash, headersFile } from './securityHeaders.ts';

const SOURCES = { scripts: ['window.x = 1;', 'console.log(1)'], styles: ['body{color:red}'] };

test('cspHash matches the base64 sha256 the browser computes', () => {
  // Known-answer test: sha256("") in base64.
  assert.strictEqual(cspHash(''), `'sha256-47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='`);
});

test('the policy denies everything by default and allows only the built sources', () => {
  const csp = contentSecurityPolicy(SOURCES);

  assert.ok(csp.includes(`default-src 'none'`));
  for (const source of [...SOURCES.scripts, ...SOURCES.styles]) {
    assert.ok(csp.includes(cspHash(source)), `no hash for: ${source}`);
  }
  assert.ok(csp.includes(`base-uri 'none'`));
  assert.ok(csp.includes(`form-action 'none'`));
});

test('the policy never relaxes script execution', () => {
  const csp = contentSecurityPolicy(SOURCES);

  // 'unsafe-eval' would let anything that reaches eval/new Function run, and
  // 'strict-dynamic' would let an allowed script vouch for scripts it loads.
  // Either one gives away what the hashes are here to buy.
  assert.ok(!csp.includes('unsafe-eval'));
  assert.ok(!csp.includes('strict-dynamic'));
  assert.ok(!csp.includes(`script-src-elem`));
  // 'unsafe-inline' is only ever acceptable for the style *attribute*.
  assert.strictEqual(csp.match(/unsafe-inline/g)?.length, 1);
  assert.ok(csp.includes(`style-src-attr 'unsafe-inline'`));
});

test('the policy has no double quotes, which would break out of the meta tag', () => {
  assert.ok(!contentSecurityPolicy(SOURCES).includes('"'));
});

test('frame-ancestors is header-only, since <meta> ignores it', () => {
  assert.ok(!contentSecurityPolicy(SOURCES).includes('frame-ancestors'));
  assert.ok(headersFile(SOURCES).includes(`frame-ancestors 'none'`));
});

test('the headers file carries the header-only protections', () => {
  const headers = headersFile(SOURCES);

  assert.ok(headers.includes('X-Frame-Options: DENY'));
  assert.ok(headers.includes('X-Content-Type-Options: nosniff'));
  assert.ok(headers.includes('Referrer-Policy: no-referrer'));
  // Applies to every path.
  assert.ok(headers.includes('\n/*\n'));
});
