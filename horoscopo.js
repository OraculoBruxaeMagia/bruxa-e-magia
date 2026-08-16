// netlify/functions/horoscopo.js
//
// Função serverless (roda no servidor do Netlify, nunca no navegador do visitante).
// A chave da API fica guardada como variável de ambiente no painel do Netlify —
// ela NUNCA aparece no código do site nem no GitHub.
//
// O site chama: /.netlify/functions/horoscopo?sign=ÁRIES
// Esta função busca o horóscopo real na RapidAPI e devolve o resultado.
//
// Configuração necessária no Netlify (Site settings → Environment variables):
//   RAPIDAPI_KEY        -> sua "X-RapidAPI Key" (obrigatória)
//   HOROSCOPE_API_KEY   -> o campo "apiKey" que aparece no playground da API (se a API pedir; opcional)

const RAPIDAPI_HOST = 'horoscopo-brasil.p.rapidapi.com';

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

  const sign = (event.queryStringParameters && event.queryStringParameters.sign || '').trim();
  if (!sign) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Parâmetro "sign" é obrigatório. Ex: /.netlify/functions/horoscopo?sign=ÁRIES' }),
    };
  }

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  const HOROSCOPE_API_KEY = process.env.HOROSCOPE_API_KEY; // opcional, depende da API

  if (!RAPIDAPI_KEY) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'RAPIDAPI_KEY não configurada nas variáveis de ambiente do Netlify.' }),
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const url = `https://${RAPIDAPI_HOST}/rest/v1/horoscopes?date=${today}&sign=${encodeURIComponent(sign)}`;

  const reqHeaders = {
    'Content-Type': 'application/json',
    'x-rapidapi-host': RAPIDAPI_HOST,
    'x-rapidapi-key': RAPIDAPI_KEY,
  };
  if (HOROSCOPE_API_KEY) reqHeaders['apiKey'] = HOROSCOPE_API_KEY;

  try {
    const response = await fetch(url, { method: 'GET', headers: reqHeaders });

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
