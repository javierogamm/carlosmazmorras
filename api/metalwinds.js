const TABLES = {
  users: 'id,created_at,nombre,role',
  discos: 'id,created_at,nombre,fecha,genero,"país",banda,sello,portada',
  reviews: 'id,created_at,disco,reviewer,fechareview,puntuacion,recomendado,notas'
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('La conexión con la base de datos no está configurada');
  return { url, key };
}

async function getTable(table, columns, url, key) {
  const dateColumn = table === 'reviews' ? 'fechareview' : table === 'discos' ? 'fecha' : 'created_at';
  const endpoint = `${url}/rest/v1/${table}?select=${encodeURIComponent(columns)}&order=${dateColumn}.desc.nullslast`;
  const response = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `No se pudo consultar ${table}`);
  return Array.isArray(data) ? data : [];
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  try {
    const { url, key } = config();
    const entries = await Promise.all(Object.entries(TABLES).map(async ([table, columns]) => [table, await getTable(table, columns, url, key)]));
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(Object.fromEntries(entries));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
