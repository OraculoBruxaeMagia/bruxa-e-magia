const https = require('https');

exports.handler = async (event, context) => {
  const signo = (event.queryStringParameters && event.queryStringParameters.sign) || 'aquarius';
  
  // Endereço correto e isolado para evitar misturas de texto
  const urlCompleta = 'https://rapidapi.com' + signo + '&language=pt&type=daily';

  const options = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
      'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
    }
  };

  return new Promise((resolve) => {
    const req = https.request(urlCompleta, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Content-Type": "application/json"
          },
          body: data
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ error: "Falha ao carregar os dados.", detalhe: error.message })
      });
    });

    req.end();
  });
};
