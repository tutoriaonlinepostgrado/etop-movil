import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from './server.js';

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(createApp());
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

test('serves static app entry points and assets with expected headers', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const rootRes = await fetch(`${baseUrl}/`);
    assert.equal(rootRes.status, 200);
    assert.match(rootRes.headers.get('content-type') || '', /text\/html/);
    const html = await rootRes.text();
    assert.match(html, /ETOP Móvil/);

    const toolsRes = await fetch(`${baseUrl}/herramientas.html`);
    assert.equal(toolsRes.status, 200);
    assert.match(toolsRes.headers.get('content-type') || '', /text\/html/);

    const cssRes = await fetch(`${baseUrl}/styles.css?v=21`);
    assert.equal(cssRes.status, 200);
    assert.match(cssRes.headers.get('content-type') || '', /text\/css/);

    const jsRes = await fetch(`${baseUrl}/app.js?v=22`);
    assert.equal(jsRes.status, 200);
    assert.match(jsRes.headers.get('content-type') || '', /javascript/);

    const coreRes = await fetch(`${baseUrl}/etop-core.js`);
    assert.equal(coreRes.status, 200);
    assert.match(coreRes.headers.get('content-type') || '', /javascript/);

    const shellCssRes = await fetch(`${baseUrl}/herramientas-shell.css?v=22`);
    assert.equal(shellCssRes.status, 200);
    assert.match(shellCssRes.headers.get('content-type') || '', /text\/css/);

    const manifestRes = await fetch(`${baseUrl}/manifest.webmanifest`);
    assert.equal(manifestRes.status, 200);
    assert.match(manifestRes.headers.get('content-type') || '', /application\/manifest\+json/);

    const iconRes = await fetch(`${baseUrl}/icon.svg`);
    assert.equal(iconRes.status, 200);
    assert.match(iconRes.headers.get('content-type') || '', /image\/svg\+xml/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('blocks direct access to server and configuration files', async () => {
  const { server, baseUrl } = await startServer();
  try {
    for (const blocked of ['/server.js', '/etop-core.test.js', '/package.json', '/metadata.json', '/node_modules/express/package.json']) {
      const res = await fetch(`${baseUrl}${blocked}`);
      assert.equal(res.status, 404, `Expected 404 for ${blocked}`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
