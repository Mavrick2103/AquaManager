const http = require('node:http');

function check(path) {
  return new Promise((resolve, reject) => {
    const request = http.get({
      hostname: '127.0.0.1', port: Number(process.env.PORT || 4000), path,
      headers: { host: 'aquamanager.fr' }, timeout: 10000,
    }, response => {
      let html = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { html += chunk; });
      response.on('error', reject);
      response.on('end', () => {
        if (response.statusCode !== 200 || !/<h1[\s>]/.test(html) || !/name="robots"/.test(html)) {
          reject(new Error(`SSR check failed for ${path} (HTTP ${response.statusCode})`));
        } else resolve();
      });
    });
    request.on('timeout', () => request.destroy(new Error('SSR timeout')));
    request.on('error', reject);
  });
}

(async () => {
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      for (const path of ['/', '/species', '/articles']) await check(path);
      console.log('SSR renders public pages with content and metadata');
      return;
    } catch (error) {
      if (attempt === 11) throw error;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
