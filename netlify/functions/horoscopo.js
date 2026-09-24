// netlify/functions/horoscopo.js
//
// Função serverless (roda no servidor do Netlify, nunca no navegador do visitante).
// A chave da API fica guardada como variável de ambiente no painel do Netlify —
// ela NUNCA aparece no código do site nem no GitHub.
//
// O site chama: /.netlify/functions/horoscopo?sign=Áries
//
// Esta função busca a previsão do dia na "Daily Rashifal API" (RapidAPI), que devolve
// os 12 signos em UMA ÚNICA chamada. Para economizar a cota gratuita da API (que costuma
// ser baixa), o resultado do dia é traduzido para português e guardado no Supabase (o mesmo
// banco de dados que o site já usa) — assim, a API externa só é chamada 1 vez por dia, não
// uma vez a cada clique em um signo, não importa quantos visitantes o site tenha.
//
// Configuração necessária no Netlify (Site settings → Environment variables):
//   RAPIDAPI_KEY -> sua "Chave X-RapidAPI" (obrigatória)

const RAPIDAPI_HOST = 'daily-rashifal-api.p.rapidapi.com';

// Mesmas credenciais públicas do Supabase já usadas no index.html (a anon key é feita
// para ser pública — protege o acesso pelas regras do banco, não por ficar em segredo).
const SUPABASE_URL = 'https://kvcvjvarllwlrtjjdwsy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2Y3ZqdmFybGx3bHJ0ampkd3N5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MjE3ODgsImV4cCI6MjEwMTk5Nzc4OH0.x8m-Ve3OsOEDaMqNZyJJXQhFhIm7tNECWPfWSfcBlfU';

// A "rashi" (signo) da API já vem em inglês minúsculo (aries, taurus...), então só
// precisamos remover acentos e comparar.
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

/* ---------- Supabase: ler/gravar o cache do dia ---------- */

async function lerCacheDoDia() {
  const id = 'rashifal:' + todayKey();
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/kv_store?id=eq.${encodeURIComponent(id)}&select=value`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows || !rows[0]) return null;
    return JSON.parse(rows[0].value); // { aries: "texto pt", touro: "texto pt", ... }
  } catch (e) {
    return null;
  }
}

async function salvarCacheDoDia(mapa) {
  const dia = todayKey();
  const id = 'rashifal:' + dia;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/kv_store`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ id, key: id, value: JSON.stringify(mapa), shared: true, updated_at: new Date().toISOString() }),
    });
  } catch (e) {
    // Se não conseguir salvar o cache, sem problema — a função ainda funciona,
    // só vai chamar a API de novo na próxima vez.
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

/* ---------- Busca os 12 signos na API e traduz todos ---------- */

async function buscarEDoTraduzirTodos() {
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  if (!RAPIDAPI_KEY) throw new Error('RAPIDAPI_KEY não configurada nas variáveis de ambiente do Netlify.');

  const url = `https://${RAPIDAPI_HOST}/all`;
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
  const lista = (data && data.result) || [];
  if (!lista.length) throw new Error('Resposta da API sem a lista "result" esperada.');

  const mapa = {};
  for (const item of lista) {
    const rashi = (item.rashi || '').toLowerCase().trim();
    const textoOriginal = item.rashifal || '';
    if (!rashi || !textoOriginal) continue;
    mapa[rashi] = await traduzir(textoOriginal);
  }
  return mapa;
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
    // 1) Tenta usar o cache de hoje (evita gastar a cota da API a cada clique).
    let mapa = await lerCacheDoDia();

    // 2) Se não tem cache de hoje ainda, busca na API real, traduz, e salva pros próximos.
    if (!mapa) {
      mapa = await buscarEDoTraduzirTodos();
      await salvarCacheDoDia(mapa);
    }

    const texto = mapa[zodiac];
    if (!texto) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: `Sem previsão para "${zodiac}" na resposta de hoje.` }) };
    }

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
