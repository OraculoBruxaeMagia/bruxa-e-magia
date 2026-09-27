// netlify/functions/horoscopo.js
//
// Função serverless (roda no servidor do Netlify, nunca no navegador do visitante).
// A chave da API fica guardada como variável de ambiente no painel do Netlify —
// ela NUNCA aparece no código do site nem no GitHub.
//
// O site chama: /.netlify/functions/horoscopo?sign=Áries
//
// Esta função busca a previsão do dia na "Daily Rashifal API" (RapidAPI), 1 signo por vez
// (o endpoint que traz os 12 de uma vez só existe no plano pago "MEGA", então usamos o
// endpoint de signo único: GET /{Rashi}). Para economizar a cota gratuita, cada previsão
// (já traduzida para português) é guardada no Supabase por 1 dia — assim, se duas pessoas
// diferentes clicarem no mesmo signo no mesmo dia, a segunda usa o cache, sem gastar cota.
//
// Configuração necessária no Netlify (Site settings → Environment variables):
//   RAPIDAPI_KEY -> sua "Chave X-RapidAPI" (obrigatória)

const RAPIDAPI_HOST = 'daily-rashifal-api.p.rapidapi.com';

// Mesmas credenciais públicas do Supabase já usadas no index.html (a anon key é feita
// para ser pública — protege o acesso pelas regras do banco, não por ficar em segredo).
const SUPABASE_URL = 'https://kvcvjvarllwlrtjjdwsy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2Y3ZqdmFybGx3bHJ0ampkd3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MjE3ODgsImV4cCI6MjEwMTk5Nzc4OH0.x8m-Ve3OsOEDaMqNZyJJXQhFhIm7tNECWPfWSfcBlfU';

// A API espera o nome do signo em inglês, com inicial maiúscula (Aries, Taurus, ...),
// exatamente como aparece nos exemplos da documentação (GET /Leo, GET /Aries).
const ZODIAC_EN = {
  'aries':'Aries', 'touro':'Taurus', 'gemeos':'Gemini', 'cancer':'Cancer',
  'leao':'Leo', 'virgem':'Virgo', 'libra':'Libra', 'escorpiao':'Scorpio',
  'sagitario':'Sagittarius', 'capricornio':'Capricorn', 'aquario':'Aquarius', 'peixes':'Pisces',
};

function normalizeSign(sign) {
  return sign.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // AAAA-MM-DD
}

/* ---------- Supabase: ler/gravar o cache do dia, por signo ---------- */

async function lerCache(zodiac) {
  const id = `rashifal:${todayKey()}:${zodiac.toLowerCase()}`;
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
  const id = `rashifal:${todayKey()}:${zodiac.toLowerCase()}`;
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

/* ---------- Tradução (MyMemory, gratuita, sem chave) ---------- */

async function traduzirPedaco(texto) {
  if (!texto) return texto;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=en|pt-BR`;
    const res = await fetch(url);
    if (!res.ok) return texto;
    const json = await res.json();
    return (json && json.responseData && json.responseData.translatedText) || texto;
  } catch (e) {
    return texto;
  }
}

// Quebra textos longos em blocos de até ~450 caracteres (limite seguro do plano gratuito
// da MyMemory, que é de ~500), traduz cada bloco, e junta tudo de volta.
async function traduzir(texto) {
  if (!texto) return texto;
  if (texto.length <= 450) return traduzirPedaco(texto);

  const frases = texto.split(/(?<=[.!?])\s+/);
  const blocos = [];
  let atual = '';
  for (const frase of frases) {
    if ((atual + ' ' + frase).trim().length > 450 && atual) {
      blocos.push(atual.trim());
      atual = frase;
    } else {
      atual = (atual + ' ' + frase).trim();
    }
  }
  if (atual) blocos.push(atual);

  const traduzidos = [];
  for (const bloco of blocos) {
    traduzidos.push(await traduzirPedaco(bloco));
  }
  return traduzidos.join(' ');
}

/* ---------- Extrai o texto da previsão, testando formatos comuns ---------- */

function extrairTexto(data) {
  if (!data) return null;
  // Formato comum 1: { rashifal: "..." } direto na raiz
  if (typeof data.rashifal === 'string' && data.rashifal.trim().length > 10) return data.rashifal.trim();
  // Formato comum 2: { result: { rashifal: "..." } }
  if (data.result && typeof data.result.rashifal === 'string') return data.result.rashifal.trim();
  // Formato comum 3: { result: [ { rashifal: "..." } ] }
  if (Array.isArray(data.result) && data.result[0] && typeof data.result[0].rashifal === 'string') return data.result[0].rashifal.trim();
  // Último recurso: primeiro texto longo encontrado em qualquer campo do objeto.
  for (const k of Object.keys(data)) {
    if (typeof data[k] === 'string' && data[k].trim().length > 20) return data[k].trim();
  }
  return null;
}

/* ---------- Busca 1 signo na API e traduz ---------- */

async function buscarEDoTraduzir(zodiac) {
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  if (!RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY não configurada nas variáveis de ambiente do Netlify.');

  const url = `https://${RAPIDAPI_HOST}/${encodeURIComponent(zodiac)}`;
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
  const textoOriginal = extrairTexto(data);
  if (!textoOriginal) {
    const erro = new Error('Resposta da API sem texto de previsão reconhecível.');
    erro.detalhe = JSON.stringify(data);
    throw erro;
  }

  return traduzir(textoOriginal);
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

    // 2) Sem cache ainda hoje: busca na API real, traduz, e salva pros próximos.
    const texto = await buscarEDoTraduzir(zodiac);
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
