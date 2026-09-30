// Verify the HTML Google receives; temporary loopback listener is always closed.
import assert from 'node:assert/strict';
import { createServer, get } from 'node:http';
import { readFileSync } from 'node:fs';
import { reqHandler } from '../dist/web/server/server.mjs';
function localGet(url) {
  return new Promise((resolve, reject) => {
    get(url, {headers:{host:'aquamanager.fr'}}, response => {
      let html='';response.setEncoding('utf8');response.on('data', chunk=>html+=chunk);
      response.on('error',reject);response.on('end',()=>resolve({status:response.statusCode,text:async()=>html}));
    }).on('error',reject);
  });
}
const server = createServer(reqHandler);
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const [path, title, description] of [
    ['/login', 'Connexion', 'Connectez-vous'],
    ['/register', 'Inscription', 'Créez votre compte'],
    ['/contact', 'Contact', 'Contactez'],
    ['/privacy', 'Politique de confidentialité', 'Découvrez'],
  ]) {
    const response = await localGet(origin + path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert(html.includes(`<title>${title} – AquaManager</title>`), path + ' title');
    assert.match(html, /<meta name="robots" content="index,follow"/);
    assert(html.includes(`<meta name="description" content="${description}`), path + ' description');
    assert(html.includes(`href="https://aquamanager.fr${path}"`), path + ' canonical');
    assert.match(html, /<h[12][\s>]/);
    assert(!html.includes('Internal Server Error'));
  }
  const home = await (await localGet(origin + '/')).text();
  const match = home.match(/<script[^>]*id="aqm-structured-data"[^>]*>([\s\S]*?)<\/script>/);
  assert(match, 'homepage structured data');
  const websites = JSON.parse(match[1])['@graph'].filter(item => item['@type'] === 'WebSite');
  assert.equal(websites.length, 1);
  assert.equal(websites[0].name, 'AquaManager');
  assert.equal(websites[0].url, 'https://aquamanager.fr/');
  assert(home.includes('property="og:site_name" content="AquaManager"'));
  const robots = readFileSync(new URL('../public/robots.txt', import.meta.url), 'utf8');
  assert(!/^Disallow: \/(login|register)/m.test(robots));
  assert(robots.includes('Disallow: /admin'));
  const nginx = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf8');
  assert(nginx.includes('|login|register|contact|privacy|'));
  console.log('SEO OK: rendered HTML for four public pages, unique site name, canonical URLs, robots and Nginx routing.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  server.closeAllConnections();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}
