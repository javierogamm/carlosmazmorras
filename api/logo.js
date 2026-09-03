const fs = require('node:fs/promises');
const path = require('node:path');

let cachedLogo;

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }

  try {
    if (!cachedLogo) {
      const encoded = await fs.readFile(path.join(process.cwd(), 'resources', 'metalwindslogo.base64'), 'utf8');
      cachedLogo = Buffer.from(encoded.replace(/\s/g, ''), 'base64');
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Length', cachedLogo.length);
    return req.method === 'HEAD' ? res.status(200).end() : res.status(200).send(cachedLogo);
  } catch {
    return res.status(500).json({ error: 'No se pudo cargar el logotipo' });
  }
};
