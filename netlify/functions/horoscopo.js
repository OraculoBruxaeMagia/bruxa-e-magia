const axios = require('axios'); // ou use fetch se preferir

exports.handler = async (event, context) => {
  // Pega o signo enviado pelo front-end (ex: ?signo=aquarius)
  const signo = event.queryStringParameters.sign), || 'aquarius';

  const options = {
    method: 'GET',
    url: 'https://rapidapi.com',
    params: {
      zodiac: signo,
      language: 'pt', // Força o idioma para português
      type: 'daily'
    },
    headers: {
      // Puxa AUTOMATICAMENTE os valores que você salvou no painel do Netlify
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
      'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
    }
  };

  try {
    const response = await axios.request(options);
    return {
      statusCode: 200,
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    return {
      statusCode: error.response ? error.response.status : 500,
      body: JSON.stringify({ error: "Erro na API do Horóscopo", detalhe: error.message })
    };
  }
};
