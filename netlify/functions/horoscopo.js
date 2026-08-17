const https = require('https');

exports.handler = async (event, context) => {
  const signo = (event.queryStringParameters && event.queryStringParameters.sign) || 'aquarius';
  
  // URL correta fornecida pela RapidAPI
  const host = process.env.RAPIDAPI_HOST || 'astropredict-daily-horoscopes-lucky-insights.p.rapidapi.com';
  const urlCompleta = `https://${host}/horoscope?lang=pt&zodiac=${signo}&type=daily&timezone=UTC`;

  const options = {
    method: 'GET',
    headers: {
      'x-rapidapi-key': process.env.RAPIDAPI_KEY,
      'x-rapidapi-host': host
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
