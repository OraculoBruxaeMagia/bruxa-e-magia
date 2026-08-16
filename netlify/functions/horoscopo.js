exports.handler = async (event, context) => {
  const signo = event.queryStringParameters.sign || 'aquarius';
  
  // Monta a URL com os parâmetros de busca corretos
  const url = `https://rapidapi.com{signo}&language=pt&type=daily`;

  const options = {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
      'X-RapidAPI-Host': process.env.RAPIDAPI_HOST
    }
  };

  try {
    const res = await fetch(url, options);
    
    if (!res.ok) {
      throw new Error(`Erro na API do Horóscopo: Status ${res.status}`);
    }

    const data = await res.json();

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ error: "Falha ao carregar os dados.", detalhe: error.message })
    };
  }
};
