import type { AddressInfo } from 'node:net';

process.env.DOCENTOS_SKIP_LISTEN = '1';
const { app } = await import('../server.js');
const server = app.listen(0);
try {
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const response = await fetch(`${base}/api/version`);
  const header = process.argv[2] === 'report' ? 'content-security-policy-report-only' : 'content-security-policy';
  process.stdout.write(`CSP_PROBE:${JSON.stringify({ status: response.status, csp: response.headers.get(header), opposite: response.headers.get(header === 'content-security-policy' ? 'content-security-policy-report-only' : 'content-security-policy') })}\n`);
} finally {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
