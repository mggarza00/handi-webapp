#!/usr/bin/env node
/*
  HEAD checker for Next CSS assets across UA matrix.
  Usage: node scripts/check-css-headers.mjs https://handi.mx
*/
import https from 'node:https';
import http from 'node:http';
import { URL } from 'node:url';

const BASE = process.argv[2] || process.env.BASE_URL;
if (!BASE) {
  console.error('Usage: node scripts/check-css-headers.mjs https://your-domain');
  process.exit(2);
}

const UAS = {
  chromium: {
    ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    ae: 'gzip, deflate, br',
  },
  ios10: {
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3 like Mac OS X) AppleWebKit/602.1.50 (KHTML, like Gecko) Version/10.0 Mobile/14E5239e Safari/602.1',
    ae: 'gzip, deflate',
  },
  ios12: {
    ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_5_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1 Mobile/15E148 Safari/604.1',
    ae: 'gzip, deflate',
  },
};

function req(method, url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'http:' ? http : https;
    const options = {
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: u.pathname + (u.search || ''),
      headers,
    };
    const r = mod.request(options, (res) => {
      // We only need headers and status
      res.resume();
      resolve({ status: res.statusCode, headers: res.headers });
    });
    r.on('error', reject);
    r.end();
  });
}

async function findCss(base) {
  const { headers, status } = await req('GET', base);
  if ((headers['content-type'] || '').includes('text/html') === false) {
    // Try fetch HTML body anyway
  }
  const body = await new Promise((resolve, reject) => {
    const u = new URL(base);
    const mod = u.protocol === 'http:' ? http : https;
    const r = mod.get(base, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });
    r.on('error', reject);
  });
  const m = body.match(/\/_next\/static\/css\/[^"]+\.css/);
  if (!m) throw new Error('Could not find a _next/static/css/*.css link on homepage');
  return new URL(m[0], base).toString();
}

function assert(cond, msg) {
  if (!cond) {
    console.error('✖', msg);
    process.exitCode = 1;
  } else {
    console.log('✔', msg);
  }
}

function hasToken(h, key, token) {
  const v = (h[key] || h[key.toLowerCase()] || '').toString();
  return v.toLowerCase().includes(token.toLowerCase());
}

(async () => {
  try {
    const cssUrl = await findCss(BASE);
    console.log('Target CSS:', cssUrl);
    const matrix = [
      ['chromium', UAS.chromium],
      ['ios10', UAS.ios10],
      ['ios12', UAS.ios12],
    ];
    for (const [name, cfg] of matrix) {
      const res = await req('HEAD', cssUrl, {
        'User-Agent': cfg.ua,
        'Accept-Encoding': cfg.ae,
      });
      const h = res.headers;
      console.log(`\n[${name}] status=${res.status} ct=${h['content-type']} ce=${h['content-encoding'] || 'none'}`);
      assert(res.status === 200, `[${name}] HTTP 200`);
      assert(hasToken(h, 'content-type', 'text/css'), `[${name}] content-type is text/css`);
      assert(hasToken(h, 'vary', 'accept-encoding'), `[${name}] vary includes Accept-Encoding`);
      if (!cfg.ae.includes('br')) {
        assert(!hasToken(h, 'content-encoding', 'br'), `[${name}] NO br when UA does not advertise it`);
      }
      // For _next/static/css/* ensure immutable cache
      if (new URL(cssUrl).pathname.startsWith('/_next/static/css/')) {
        assert(hasToken(h, 'cache-control', 'immutable'), `[${name}] cache-control immutable present`);
      }
    }
    if (process.exitCode && process.exitCode !== 0) {
      process.exit(process.exitCode);
    } else {
      console.log('\nAll checks passed.');
    }
  } catch (err) {
    console.error(err?.message || err);
    process.exit(1);
  }
})();

