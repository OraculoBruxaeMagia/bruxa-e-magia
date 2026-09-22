// netlify/functions/horoscopo.js
//
// Função serverless (roda no servidor do Netlify, nunca no navegador do visitante).
// A chave da API fica guardada como variável de ambiente no painel do Netlify —
// ela NUNCA aparece no código do site nem no GitHub.
//
// O site chama: /.netlify/functions/horoscopo?sign=Áries
// Esta função busca o horóscopo real na "Best Daily Astrology and Horoscope API" (RapidAPI).
// Essa API não tem opção de idioma, então o texto (que vem em inglês) é traduzido aqui
// no servidor, usando a MyMemory (tradutor gratuito, sem chave), antes de devolver ao site.
//
// Configuração necessária no Netlify (Site settings → Environment variables):
//   RAPIDAPI_KEY -> sua "Chave X-RapidAPI" (obrigatória)

const RAPIDAPI_HOST = 'best-daily-astrology-and-horoscope-api.p.rapidapi.com';

// A API espera o nome do signo em inglês, com inicial maiúscula (Aries, Taurus...).
const ZODIAC_EN = {
  'aries':'Aries', 'touro':'Taurus', 'gemeos':'Gemini', 'cancer':'Cancer',
  'leao':'Leo', 'virgem':'Virgo', 'libra':'Libra', 'escorpiao':'Scorpio',
  'sagitario':'Sagittarius', 'capricornio':'Capricorn', 'aquario':'Aquarius', 'peixes':'Pisces',
};

function normalizeSign(sign) {
  return sign.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Procura o texto da previsão dentro da resposta, testando os nomes de campo mais comuns
// usados por APIs desse tipo, e como último recurso pega o primeiro texto longo que achar.
function extrairTexto(data) {
  const candidatos = ['Horoscope','horoscope','Detailed_Horoscope','description','Description','prediction','Prediction','text','Text','horoscope_data'];
  for (const k of candidatos) {
    if (data && typeof data[k] === 'string' && data[k].trim().length > 10) return data[k].trim();
  }
  if (data && typeof data === 'object') {
    for (const k of Object.keys(data)) {
      if (typeof data[k] === 'string' && data[k].trim().length > 20) return data[k].trim();
    }
  }
  return null;
}

// Tradução gratuita e sem chave (MyMemory). Se falhar por qualquer motivo, devolve o texto original.
async function traduzir(texto) {
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
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Parâmetro "sign" é obrigatório. Ex: /.netlify/functions/horoscopo?sign=Áries' }),
    };
  }

  const zodiac = ZODIAC_EN[normalizeSign(rawSign)];
  if (!zodiac) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: `Signo "${rawSign}" não reconhecido.` }) };
  }

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  if (!RAPIDAPI_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'RAPIDAPI_KEY não configurada nas variáveis de ambiente do Netlify.' }),
    };
  }

  const url = `https://${RAPIDAPI_HOST}/api/Detailed-Horoscope/?zodiacSign=${encodeURIComponent(zodiac)}`;

  try {
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
      return {
        statusCode: 200, // sempre 200 para o navegador conseguir ler o motivo do erro
        headers,
        body: JSON.stringify({
          error: `A API de horóscopo respondeu com status ${response.status}.`,
          statusOriginal: response.status,
          motivoDaApi: detalhe,
          urlChamada: url,
        }),
      };
    }

    const data = await response.json();
    const textoOriginal = extrairTexto(data);
    if (!textoOriginal) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Resposta da API sem texto de previsão reconhecível.', raw: data }) };
    }

    const textoTraduzido = await traduzir(textoOriginal);
    return { statusCode: 200, headers, body: JSON.stringify({ horoscope: textoTraduzido }) };
  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ error: 'Falha ao conectar com a API de horóscopo.', details: String(err) }),
    };
  }
};
