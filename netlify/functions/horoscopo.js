const https = require('https');

exports.handler = async (event, context) => {
    const signo = event.queryStringParameters.signo || 'aries';
    
    const host = process.env.RAPIDAPI_HOST || 'astropredict-data.p.rapidapi.com';
    const urlCompleta = `https://${host}/horoscope?zodiac=${signo}&type=daily`;

    const options = {
        method: 'GET',
        headers: {
            'x-rapidapi-key': process.env.RAPIDAPI_KEY,
            'x-rapidapi-host': host
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(urlCompleta, options, (res) => {
            let dados = '';
            res.on('data', (chunk) => dados += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "Content-Type": "application/json"
                    },
                    body: dados
                });
            });
        });

        req.on('error', (erro) => {
            reject({
                statusCode: 500,
                body: JSON.stringify({ error: erro.message })
            });
        });

        req.end();
    });
};
