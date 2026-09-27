// netlify/functions/horoscopo.js
//
// Função serverless (roda no servidor do Netlify, nunca no navegador do visitante).
// A chave da API fica guardada como variável de ambiente no painel do Netlify —
// ela NUNCA aparece no código do site nem no GitHub.
//
// O site chama: /.netlify/functions/horoscopo?sign=Áries
//
// Esta função busca a previsão do dia na AstroPredict (RapidAPI), que já devolve o texto
// em português (via ?lang=pt) — sem precisar de tradutor. O plano gratuito permite 20
// chamadas por dia, então cada previsão é guardada no Supabase por 1 dia: se duas pessoas
// diferentes clicarem no mesmo signo no mesmo dia, a segunda usa o cache, sem gastar cota.
// Com 12 signos e 20 chamadas/dia, dá pra atualizar todos os signos uma vez por dia com folga.
//
// Configuração necessária no Netlify (Site settings → Environment variables):
//   RAPIDAPI_KEY -> sua "Chave X-RapidAPI" (obrigatória)

const RAPIDAPI_HOST = 'astropredict-daily-horoscopes-lucky-insights.p.rapidapi.com';

// Mesmas credenciais públicas do Supabase já usadas no index.html (a anon key é feita
// para ser pública — protege o acesso pelas regras do banco, não por ficar em segredo).
const SUPABASE_URL = 'https://kvcvjvarllwlrtjjdwsy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2Y3ZqdmFybGx3bHJ0ampkd3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MjE3ODgsImV4cCI6MjEwMTk5Nzc4OH0.x8m-Ve3OsOEDaMqNZyJJXQhFhIm7tNECWPfWSfcBlfU';

// A API espera o nome do signo em inglês, minúsculo (aries, taurus...).
const ZODIAC_EN = {
  'aries':'aries', 'touro':'taurus', 'gemeos':'gemini', 'cancer':'cancer',
  'leao':'leo', 'virgem':'virgo', 'libra':'libra', 'escorpiao':'scorpio',
  'sagitario':'sagittarius', 'capricornio':'capricorn', 'aquario':'aquarius', 'peixes':'pisces',
};

function normalizeSign(sign) {
  return sign.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // AAAA-MM-DD
}

/* ---------- Supabase: ler/gravar o cache do dia, por signo ---------- */

async function lerCache(zodiac) {
  const id = `astropredict:${todayKey()}:${zodiac}`;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?id=eq.${encodeURIComponent(id)}&select=value`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows || !rows[0]) return null;
    return JSON.parse(rows[0].value); // { texto: "..." }
  } catch (e) {
    return null;
  }
}

async function salvarCache(zodiac, texto) {
  const id = `astropredict:${todayKey()}:${zodiac}`;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ id, key: id, value: JSON.stringify({ texto }), shared: true, updated_at: new Date().toISOString() }),
    });
  } catch (e) {
    // Sem problema se não conseguir salvar — a função ainda funciona, só busca de novo depois.
  }
}

/* ---------- Busca 1 signo na AstroPredict (já em português) ---------- */

async function buscarNaApi(zodiac) {
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  if (!RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY não configurada nas variáveis de ambiente do Netlify.');

  const url = `https://${RAPIDAPI_HOST}/horoscope?lang=pt&zodiac=${zodiac}&type=daily&timezone=UTC`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': RAPIDAPI_HOST,
      'x-rapidapi-key': RAPIDAPI_KEY,
    },
  });

  if (!response.ok) {
    let detalhe = '';
    try { detalhe = await response.text(); } catch (e) { /* ignora */ }
    const erro = new Error(`A API de horóscopo respondeu com status ${response.status}.`);
    erro.detalhe = detalhe;
    erro.statusOriginal = response.status;
    throw erro;
  }

  const data = await response.json();
  const texto = data && data.horoscope;
  if (!texto || typeof texto !== 'string' || texto.trim().length < 10) {
    const erro = new Error('Resposta da API sem texto de previsão reconhecível.');
    erro.detalhe = JSON.stringify(data);
    throw erro;
  }
  return texto.trim();
}

/* ---------- Handler principal ---------- */

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  const rawSign = (event.queryStringParameters && event.queryStringParameters.sign || '').trim();
  if (!rawSign) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ error: 'Parâmetro "sign" é obrigatório. Ex: /.netlify/functions/horoscopo?sign=Áries' }),
    };
  }

  const zodiac = ZODIAC_EN[normalizeSign(rawSign)];
  if (!zodiac) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: `Signo "${rawSign}" não reconhecido.` }) };
  }

  try {
    // 1) Tenta usar o cache de hoje pra esse signo (evita gastar a cota a cada clique repetido).
    const cache = await lerCache(zodiac);
    if (cache && cache.texto) {
      return { statusCode: 200, headers, body: JSON.stringify({ horoscope: cache.texto }) };
    }

    // 2) Sem cache ainda hoje: busca na API real (já em português) e salva pros próximos.
    const texto = await buscarNaApi(zodiac);
    await salvarCache(zodiac, texto);

    return { statusCode: 200, headers, body: JSON.stringify({ horoscope: texto }) };
  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        error: err.message || 'Falha ao buscar o horóscopo.',
        statusOriginal: err.statusOriginal,
        motivoDaApi: err.detalhe,
      }),
    };
  }
};
