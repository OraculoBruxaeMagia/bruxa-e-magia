const https = require('https');

exports.handler = async (event, context) => {
  const urlCompleta = 'https://rws-cards-api.herokuapp.com/api/v1/cards/random?n=1';

  return new Promise((resolve) => {
    https.get(urlCompleta, (res) => {
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
    }).on('error', (error) => {
      resolve({
        statusCode: 500,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Erro ao buscar carta", detalhe: error.message })
      });
    });
  });
};
