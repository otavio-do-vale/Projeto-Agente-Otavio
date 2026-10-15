const inputEndpoint = document.getElementById('endpoint');
const inputDeployment = document.getElementById('deployment');
const inputApiKey = document.getElementById('apiKey');

const inputTemperature = document.getElementById('temperature');
const valorTemperature = document.getElementById('valorTemperature');
const inputMaxTokens = document.getElementById('maxTokens');
const valorMaxTokens = document.getElementById('valorMaxTokens');

const btnSalvar = document.getElementById('btnSalvar');
const statusConfig = document.getElementById('statusConfig');

const formChat = document.getElementById('formChat');
const campoMensagem = document.getElementById('campoMensagem');
const listaMensagens = document.getElementById('mensagens');

//Configuracao da API
let config = {
    endpoint: "",
    deployment: "",
    apiKey: "",

    temperature: 0.7,
    maxTokens: 500,
}

inputMaxTokens.addEventListener("input", () => {
    valorMaxTokens.textContent = inputMaxTokens.value;
});
inputTemperature.addEventListener("input", () => {
    valorTemperature.textContent = inputTemperature.value;
});

const instrucoesCineIA =
    'Você é o CineIA, um assistente especializado em recomendar ' +
    'filmes e séries. Seja breve simpático e objetivo. ' +
    'Sempre sugira pelo menos um título de filme e serie concreto.' +
    'Explique em uma frase por que a recomendação combina com o pedido.' +
    'Considere gênero, clima, estilo e referências mencionadas pelo usuário.';

    let historico = [];

    btnSalvar.addEventListener("click", () => {
        config.endpoint = inputEndpoint.value.trim();
        config.deployment = inputDeployment.value.trim();
        config.apiKey = inputApiKey.value.trim();

        config.temperature = Number(inputTemperature.value);
        config.maxTokens = Number(inputMaxTokens.value);

        // Verifica se os três campos foram preenchidos
    if (!config.endpoint || !config.deployment || !config.apiKey) {
        statusConfig.textContent = 'Preencha o Endpoint, o Deployment e a API Key.';
        return; // para a função aqui, não segue adiante
    }

    // Verifica se o endpoint possui o formato esperado
    // (a Responses API do Azure OpenAI espera essa terminação
    // específica na URL)
    if (!config.endpoint.includes('/openai/v1/responses')) {
        statusConfig.textContent = 'O endpoint deve terminar com /openai/v1/responses.';
        return;
    }

    statusConfig.textContent = 'Configuração salva ✅';
});

// --- PASSO 2: Enviar mensagem --------------------------------------
// "submit" dispara quando o formulário é enviado (clicou em "Enviar"
// ou apertou Enter dentro do campo de texto).
formChat.addEventListener('submit', async (evento) => {

    // Impede que a página seja recarregada (comportamento padrão de
    // formulário HTML, que a gente não quer aqui)
    evento.preventDefault();

    // Pega o texto digitado pelo usuário
    const texto = campoMensagem.value.trim();

    // Não envia mensagens vazias
    if (!texto) {
        return;
    }

    // Verifica se a configuração foi realizada antes de tentar conversar
    if (!config.endpoint || !config.deployment || !config.apiKey) {
        adicionarMensagemNaTela(
            'bot',
            'Configure o Endpoint, o Deployment e a API Key antes de conversar.'
        );
        return;
    }

    // Mostra a mensagem do usuário na tela
    adicionarMensagemNaTela('user', texto);

    // Limpa o campo de texto, pronto pra próxima pergunta
    campoMensagem.value = '';

    // Adiciona a mensagem ao histórico (role "user" = foi o usuário
    // quem escreveu isso)
    historico.push({
        role: 'user',
        content: texto
    });

    // Mostra mensagem temporária enquanto aguarda a Azure responder
    const carregando = adicionarMensagemNaTela('bot', 'Pensando...');

    // Desabilita o botão enquanto aguarda a resposta (evita o
    // usuário clicar várias vezes e mandar a pergunta repetida)
    const botaoEnviar = formChat.querySelector('button[type="submit"]');
    if (botaoEnviar) {
        botaoEnviar.disabled = true;
    }

    try {
        // Chama a Azure OpenAI (função definida mais abaixo)
        const resposta = await perguntaParaAzure();

        // Substitui "Pensando..." pela resposta de verdade
        carregando.textContent = resposta;

        // Só adiciona ao histórico se recebemos uma resposta válida
        // (não queremos que uma mensagem de erro vire "memória" do bot)
        if (resposta && !resposta.startsWith('Ocorreu um erro')) {
            historico.push({
                role: 'assistant',
                content: resposta
            });
        }
    } catch (erro) {
        console.error('Erro no chat', erro);
        carregando.textContent = 'Não foi possível obter uma resposta da Azure.';
    } finally {
        // "finally" roda sempre, deu certo ou errado - reativa o botão
        if (botaoEnviar) {
            botaoEnviar.disabled = false;
        }
        // Devolve o foco para o campo de mensagem, pronto pra digitar
        // a próxima pergunta sem precisar clicar de novo
        campoMensagem.focus();
    }
});

// --- Função principal: chamar a Azure OpenAI (Responses API) ----------
async function perguntaParaAzure() {
    // Verifica a configuração de novo (segurança extra, caso essa
    // função seja chamada de outro lugar no futuro)
    if (!config.endpoint || !config.deployment || !config.apiKey) {
        return 'Configure o Endpoint, o Deployment e a API Key antes de conversar.';
    }

    // Remove uma possível barra "/" sobrando no final do endpoint
    const url = config.endpoint.replace(/\/+$/, '');

    // Corpo da requisição - é isso que vai "dentro" do envelope que
    // mandamos pro Azure. "model" é o nome do deployment; "instructions"
    // é a regra de comportamento (definida lá em cima); "input" é todo
    // o histórico da conversa até agora.
    const corpo = {
        model: config.deployment,
        instructions: instrucoesCineIA,
        input: historico,
        // Os dois parâmetros que vêm dos sliders da tela:
        temperature: config.temperature,
        max_output_tokens: config.maxTokens
    };

    try {
        // Faz a requisição HTTP para a Azure
        const resposta = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Chave de acesso da Azure - é assim que o serviço
                // sabe que somos nós (e que temos permissão de usar)
                'api-key': config.apiKey
            },
            body: JSON.stringify(corpo)
        });

        // Tratamento de erro: se a resposta HTTP não for "ok"
        // (código 200), algo deu errado do lado da Azure
        if (!resposta.ok) {
            const erroTexto = await resposta.text();
            console.error('Erro da Azure: ', erroTexto);

            // Tenta transformar o erro em JSON, pra pegar só a
            // mensagem (em vez de mostrar o JSON inteiro cru)
            let mensagemErro = erroTexto;

            try {
                const erroJson = JSON.parse(erroTexto);
                // CORREÇÃO: aqui checamos o objeto já convertido
                // (erroJson), não o texto cru (erroTexto) - o texto
                // cru é uma string e nunca vai ter a propriedade
                // ".error.message", então a condição original nunca
                // era verdadeira de fato.
                if (erroJson.error?.message) {
                    mensagemErro = erroJson.error.message;
                }
            } catch {
                // Caso o retorno não seja JSON, mantém o texto original
            }

            return `Ocorreu um erro (${resposta.status}): ${mensagemErro}`;
        }

        // Converte a resposta (que vem em JSON) pra um objeto JS
        const dados = await resposta.json();
        console.log('Resposta completa da Azure:', dados);

        // Extrai o texto gerado.
        // A Responses API normalmente disponibiliza o texto pronto em:
        //   dados.output_text
        if (dados.output_text) {
            return dados.output_text;
        }

        // Fallback: caso output_text não esteja disponível (depende
        // da versão da API), tentamos localizar o texto "na unha",
        // vasculhando a estrutura de dados.output
        if (Array.isArray(dados.output)) {
            for (const item of dados.output) {
                if (Array.isArray(item.content)) {
                    for (const conteudo of item.content) {
                        if (conteudo.text) {
                            return conteudo.text;
                        }
                    }
                }
            }
        }

        console.error('Não foi possível localizar o texto da resposta:', dados);
        return 'A Azure respondeu, mas não foi possível encontrar o texto da resposta.';

    } catch (erro) {
        // Erro de conexão (sem internet, CORS bloqueado, endpoint
        // errado, etc. - não chegou nem a ter uma resposta HTTP)
        console.error('Erro de conexão com a Azure', erro);
        return (
            'Não foi possível conectar à Azure. ' +
            'Verifique o endpoint, a API Key, o CORS e a sua conexão.'
        );
    }
}

// --- Função auxiliar: adicionar mensagem na tela -----------------------
// Cria uma "bolha" de mensagem (uma <div>) e coloca dentro da lista
// de mensagens na tela. Retorna a div criada, pra podermos editá-la
// depois (é assim que trocamos "Pensando..." pela resposta real).
function adicionarMensagemNaTela(remetente, texto) {
    const div = document.createElement('div');

    // Define a classe CSS da mensagem (muda a cor/alinhamento
    // dependendo se foi o usuário ou o bot que "falou")
    div.classList.add(
        'msg',
        remetente === 'user' ? 'user' : 'bot'
    );

    // Insere o texto dentro da bolha
    div.textContent = texto;

    // Adiciona a mensagem ao final da lista de mensagens na tela
    listaMensagens.appendChild(div);

    // Rola automaticamente para a última mensagem (senão, em
    // conversas longas, o usuário precisaria descer manualmente)
    listaMensagens.scrollTop = listaMensagens.scrollHeight;

    return div;
}

    