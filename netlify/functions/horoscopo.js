const https = require('https');

// Função de tradução gratuita
function traduzirTexto(texto) {
    return new Promise((resolve) => {
        if (!texto) return resolve('');
        
        // URL corrigida do MyMemory
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=en|pt`;
        
        https.get(url, (res) => {
            let dados = '';
            res.on('data', (chunk) => dados += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(dados);
                    if (json && json.responseData && json.responseData.translatedText) {
                        resolve(json.responseData.translatedText);
                    } else {
                        resolve(texto);
                    }
                } catch (e) {
                    resolve(texto);
                }
            });
        }).on('error', () => {
            resolve(texto);
        });
    });
}

exports.handler = async (event, context) => {
    // Trata e limpa o parâmetro de signo recebido
    let signo = (event.queryStringParameters && event.queryStringParameters.signo) || 'aries';
    signo = decodeURIComponent(signo).normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // Hosts e endpoints ajustados
    const host = process.env.RAPIDAPI_HOST || 'same-horoscope-api.p.rapidapi.com';
    const urlCompleta = `https://${host}/horoscope?zodiac=${signo}&type=daily`;

    const options = {
        method: 'GET',
        headers: {
            'x-rapidapi-key': process.env.RAPIDAPI_KEY || '',
            'x-rapidapi-host': host
        }
    };

    return new Promise((resolve) => {
        const req = https.request(urlCompleta, options, (res) => {
            let dados = '';
            res.on('data', (chunk) => dados += chunk);
            res.on('end', async () => {
                try {
                    const apiJson = JSON.parse(dados);
                    
                    let respostaParaOFront = {
                        horoscope: "Sem previsão disponível.",
                        love: "Previsão de amor não disponível no momento.",
                        career: "Previsão profissional indisponível.",
                        money: "Previsão financeira indisponível.",
                        health: "Dicas de bem-estar não disponíveis.",
                        lucky_color: "Variada",
                        lucky_number: "7"
                    };

                    if (apiJson && apiJson.horoscope) {
                        const textoTraduzido = await traduzirTexto(apiJson.horoscope);
                        const frases = textoTraduzido.split(/(?<=\.)\s+/);
                        let frasesRestantes = [];

                        frases.forEach(frase => {
                            const termo = frase.toLowerCase();
                            if (termo.includes('amor') || termo.includes('romance') || termo.includes('parceir') || termo.includes('sorte no amor')) {
                                respostaParaOFront.love = frase;
                            } else if (termo.includes('trabalho') || termo.includes('projeto') || termo.includes('profiss') || termo.includes('carreira') || termo.includes('trabalhar')) {
                                respostaParaOFront.career = frase;
                            } else if (termo.includes('dinheiro') || termo.includes('financ') || termo.includes('gastar') || termo.includes('lucro') || termo.includes('economiz')) {
                                respostaParaOFront.money = frase;
                            } else if (termo.includes('saúde') || termo.includes('bem-estar') || termo.includes('energia') || termo.includes('corpo')) {
                                respostaParaOFront.health = frase;
                            } else {
                                frasesRestantes.push(frase);
                            }
                        });

                        if (frasesRestantes.length > 0) {
                            respostaParaOFront.horoscope = frasesRestantes.join(' ');
                        }
                    }

                    if (apiJson && apiJson.lucky_color) {
                        respostaParaOFront.lucky_color = await traduzirTexto(apiJson.lucky_color);
                    }

                    if (apiJson && apiJson.lucky_number) {
                        respostaParaOFront.lucky_number = String(apiJson.lucky_number);
                    }

                    resolve({
                        statusCode: 200,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(respostaParaOFront)
                    });

                } catch (e) {
                    resolve({
                        statusCode: 500,
                        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
                        body: JSON.stringify({ error: "Erro ao processar resposta da API", raw: dados })
                    });
                }
            });
        });

        req.on('error', (erro) => {
            resolve({ 
                statusCode: 500, 
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ error: erro.message }) 
            });
        });

        req.end();
    });
};
