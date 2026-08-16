// netlify/functions/horoscopo.js
//
// Função serverless (roda no servidor do Netlify, nunca no navegador do visitante).
// A chave da API fica guardada como variável de ambiente no painel do Netlify —
// ela NUNCA aparece no código do site nem no GitHub.
//
// O site chama: /.netlify/functions/horoscopo?sign=Áries
// Esta função busca o horóscopo real na RapidAPI (horoscope-api.p.rapidapi.com) e devolve o resultado.
//
// Configuração necessária no Netlify (Site settings → Environment variables):
//   RAPIDAPI_KEY -> sua "Chave X-RapidAPI" (obrigatória)

const RAPIDAPI_HOST = 'horoscope-api.p.rapidapi.com';

// Remove acentos e deixa minúsculo, para bater com o formato esperado pela API (ex: "Áries" -> "aries").
function normalizeSign(sign) {
  return sign
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json; charset=utf-8',
  };

  // Requisição de "preflight" do navegador (CORS) — só confirma que pode prosseguir.
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
  const sign = normalizeSign(rawSign);

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  if (!RAPIDAPI_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'RAPIDAPI_KEY não configurada nas variáveis de ambiente do Netlify.' }),
    };
  }

  const url = `https://${RAPIDAPI_HOST}/pt/${encodeURIComponent(sign)}`;

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
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: `A API de horóscopo respondeu com status ${response.status}.` }),
      };
    }

    const data = await response.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };
  } catch (err) {
    return {
      statusCode: 502,
      headers,
      body: JSON.stringify({ error: 'Falha ao conectar com a API de horóscopo.', details: String(err) }),
    };
  }
};
