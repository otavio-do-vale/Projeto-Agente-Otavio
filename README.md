# 🤖 Agente Otávio — Interface Web Interativa (Azure AI Foundry)

Interface web moderna, responsiva e com estética *glassmorphic dark* integrada diretamente com o **Agente Otávio** hospedado no **Microsoft Azure AI Foundry**.

---

## 🚀 Como Executar

### Opção 1: Execução com 1 Clique (Windows)
Dê um duplo clique no arquivo [`iniciar_servidor.bat`](file:///c:/Users/fic/Desktop/ProjetoAgenteOtavio/iniciar_servidor.bat).

### Opção 2: Pelo Terminal
No PowerShell ou CMD, dentro da pasta do projeto:
```bash
# Ativar o ambiente virtual
.venv\Scripts\activate

# Iniciar o servidor Flask
python app.py
```

Após iniciar, abra no seu navegador:
👉 **[http://localhost:5000](http://localhost:5000)**

---

## 🌟 Funcionalidades do Front-End

- **Conexão Real-Time com Azure AI**: Utiliza o `AIProjectClient` e `Responses API` com persistência de conversas entre mensagens.
- **Detecção de Metadados**: Identifica tags de `Idioma: ...` e `Tom: ...` geradas pelo agente e as exibe em badges elegantes.
- **Micro-interações e Sons**: Efeitos sonoros ao enviar e receber mensagens (via Web Audio API nativa).
- **Leitura em Voz Alta (TTS)**: Botão de síntese de fala no cabeçalho ou por mensagem para ouvir as respostas do agente.
- **Entrada por Voz (Ditado)**: Permite enviar mensagens falando através do microfone.
- **Histórico e Exportação**: Permite baixar todo o diálogo em Markdown (`.md`).
- **Cards e Atalhos Rápidos**: Perguntas frequentes para reembolso, dúvidas e consultas em 1 clique.
- **Design Glassmorphic Premium**: Paleta escura com luzes dinâmicas, tipografia moderna (*Outfit* e *Plus Jakarta Sans*) e responsividade para celular e desktop.

---

## 📁 Estrutura do Projeto

- [`app.py`](file:///c:/Users/fic/Desktop/ProjetoAgenteOtavio/app.py): Backend em Flask que atua como ponte com a API do Azure AI.
- [`index.html`](file:///c:/Users/fic/Desktop/ProjetoAgenteOtavio/index.html): Estrutura semântica da aplicação web.
- [`style.css`](file:///c:/Users/fic/Desktop/ProjetoAgenteOtavio/style.css): Estilos CSS modernos (Dark Glassmorphism).
- [`script.js`](file:///c:/Users/fic/Desktop/ProjetoAgenteOtavio/script.js): Lógica cliente, controle de estado e áudio.
- [`avatar.jpg`](file:///c:/Users/fic/Desktop/ProjetoAgenteOtavio/avatar.jpg): Avatar visual do Agente Otávio.
- [`agente.py`](file:///c:/Users/fic/Desktop/ProjetoAgenteOtavio/agente.py): Script original de teste via CLI.
