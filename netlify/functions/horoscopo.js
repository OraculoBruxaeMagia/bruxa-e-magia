const https = require('https');

// Função de tradução gratuita via MyMemory API
function traduzirTexto(texto) {
    return new Promise((resolve) => {
        if (!texto) return resolve('');
        
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
    let signo = (event.queryStringParameters && event.queryStringParameters.signo) || 'aries';
    signo = decodeURIComponent(signo).normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase();

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
                        horoscope: "Sem previsão geral disponível.",
                        love: "Previsão de amor não disponível.",
                        career: "Previsão profissional indisponível.",
                        money: "Previsão financeira indisponível.",
                        health: "Dicas de bem-estar não disponíveis.",
                        lucky_color: "Variada",
                        lucky_number: "7"
                    };

                    // Pega o texto da previsão (seja de "prediction" ou "horoscope")
                    const textoBruto = apiJson.prediction || apiJson.horoscope || "";

                    if (textoBruto) {
                        // 1. Traduz todo o bloco de previsão para Português
                        const textoTraduzido = await traduzirTexto(textoBruto);
                        
                        // 2. Separa por frases
                        const frases = textoTraduzido.split(/(?<=\.)\s+/);
                        let frasesRestantes = [];

                        // 3. Classifica as frases para Amor, Trabalho, Dinheiro e Saúde
  frases.forEach(frase => {
                            const termo = frase.toLowerCase();
                            if (termo.includes('amor') || termo.includes('relacionamento') || termo.includes('parceir') || termo.includes('romance')) {
                                respostaParaOFront.love = frase;
                            } else if (termo.includes('trabalho') || termo.includes('carreira') || termo.includes('profissio') || termo.includes('projeto')) {
                                respostaParaOFront.career = frase;
                            } else if (termo.includes('dinheiro') || termo.includes('financ') || termo.includes('renda') || termo.includes('gastar')) {
                                respostaParaOFront.money = frase;
                            } else if (termo.includes('saúde') || termo.includes('bem-estar') || termo.includes('corpo') || termo.includes('mental')) {
                                respostaParaOFront.health = frase;
                            } else {
                                frasesRestantes.push(frase);
                            }
                        });

                        // Lógica do Conselho Lunar Dinâmico
                        if (frasesRestantes.length > 0) {
                            respostaParaOFront.horoscope = frasesRestantes.join(' ');
                        } else if (frases.length > 0) {
                            respostaParaOFront.horoscope = frases[0]; // Usa a primeira frase se nenhuma sobrou
                        } else {
                            respostaParaOFront.horoscope = "Mantenha a mente aberta e a intuição afiada para as oportunidades de hoje.";
                        }

try { // Se a API trouxer compatibilidade amorosa separada
  if (apiJson.love_compatibility && respostaParaOFront.love.includes("não disponível")) {
      respostaParaOFront.love = await traduzirTexto(apiJson.love_compatibility);
  }

  // Tradução das cores
  const corBruta = apiJson.color || apiJson.lucky_color || "";
  if (corBruta) {
      respostaParaOFront.lucky_color = await traduzirTexto(corBruta);
  }

  // Mapeamento do número da sorte
  const numeroBruto = apiJson.number || apiJson.lucky_number || "";
  if (numeroBruto) {
      respostaParaOFront.lucky_number = String(numeroBruto);
  }

  resolve({
      statusCode: 200,
      headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
      },
      body: JSON.stringify(respostaParaOFront)
  });

} catch (e) {                          // <-- este já fecha o try acima
  resolve({
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Erro ao processar resposta", raw: dados })
  });
}

// este fica fora do try/catch
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
