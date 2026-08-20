const https = require('https');

// Função auxiliar para traduzir textos sem precisar de bibliotecas externas
function traduzirTexto(texto, de = 'en', para = 'pt') {
    return new Promise((resolve) => {
        if (!texto) return resolve('');
        
        const url = `https://googleapis.com{de}&tl=${para}&dt=t&q=${encodeURIComponent(texto)}`;
        
        https.get(url, (res) => {
            let dados = '';
            res.on('data', (chunk) => dados += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(dados);
                    // O Google Translate retorna uma estrutura de arrays aninhados
                    const resultado = json[0].map(item => item[0]).join('');
                    resolve(resultado);
                } catch (e) {
                    resolve(texto); // Retorna o original em inglês caso falhe
                }
            });
        }).on('error', () => {
            resolve(texto);
        });
    });
}

exports.handler = async (event, context) => {
    const signo = event.queryStringParameters.signo || 'aries';
    const host = process.env.RAPIDAPI_HOST || '://rapidapi.com';
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
                        // Traduz o parágrafo inteiro usando nossa função nativa
                        const textoTraduzido = await traduzirTexto(apiJson.horoscope, 'en', 'pt');
                        
                        // Divide o texto em frases individuais usando o ponto final
                        const frases = textoTraduzido.split(/(?<=\.)\s+/);
                        let frasesRestantes = [];

                        // Distribui as frases dinamicamente nas seções do seu front-end
                        frases.forEach(frase => {
                            const termo = frase.toLowerCase();
                            
                            if (termo.includes('amor') || termo.includes('romance') || termo.includes('parceir')) {
                                respostaParaOFront.love = frase;
                            } else if (termo.includes('trabalho') || termo.includes('projeto') || termo.includes('profiss') || termo.includes('carreira')) {
                                respostaParaOFront.career = frase;
                            } else if (termo.includes('dinheiro') || termo.includes('financ') || termo.includes('gastar') || termo.includes('lucro')) {
                                respostaParaOFront.money = frase;
                            } else if (termo.includes('saúde') || termo.includes('bem-estar') || termo.includes('energia') || termo.includes('corpo')) {
                                respostaParaOFront.health = frase;
                            } else {
                                frasesRestantes.push(frase);
                            }
                        });

                        if(frasesRestantes.length > 0) {
                            respostaParaOFront.horoscope = frasesRestantes.join(' ');
                        }
                    }

                    // Traduz a cor da sorte
                    if (apiJson && apiJson.lucky_color) {
                        respostaParaOFront.lucky_color = await traduzirTexto(apiJson.lucky_color, 'en', 'pt');
                    }

                    // Mapeia o número da sorte
                    if (apiJson && apiJson.lucky_number) {
                        respostaParaOFront.lucky_number = String(apiJson.lucky_number);
                    }

                    resolve({
                        statusCode: res.statusCode,
                        headers: {
                            "Access-Control-Allow-Origin": "*",
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(respostaParaOFront)
                    });

                } catch (e) {
                    resolve({
                        statusCode: res.statusCode,
                        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
                        body: dados
                    });
                }
            });
        });

        req.on('error', (erro) => {
            reject({ statusCode: 500, body: JSON.stringify({ error: erro.message }) });
        });

        req.end();
    });
};
