const axios = require('axios');

exports.handler = async (event, context) => {
  const signo = event.queryStringParameters.sign || 'aquarius';
   const options = {
    method: 'GET',
    url: 'https://rapidapi.com',
    params: {
      zodiac: signo,
      language: 'pt',
      type: 'daily'
    },
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
      'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
    }
  };

  try {
    const response = await axios.request(options);
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(response.data)
    };
  } catch (error) {
    return {
      statusCode: error.response ? error.response.status : 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "A API de horóscopo respondeu com erro.", detalhe: error.message })
    };
  }
};
