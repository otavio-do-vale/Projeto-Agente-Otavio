/* ==========================================================================
   AGENTE OTÁVIO — CLIENT JAVASCRIPT
   Interações, conexão com Azure AI e interface dinâmica
   ========================================================================== */

(function () {
    'use strict';

    // Determina a URL base da API
    const API_BASE = window.location.origin && window.location.origin.startsWith('http')
        ? window.location.origin
        : 'http://localhost:5000';

    // Estado da Aplicação
    const state = {
        conversationId: null,
        isProcessing: false,
        messages: [],
        speechSynth: window.speechSynthesis || null,
        isListening: false,
        recognition: null,
        soundEnabled: true,
        ttsEnabled: false
    };

    // Elementos do DOM
    const elements = {
        sidebar: document.getElementById('sidebar'),
        toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
        closeSidebarBtn: document.getElementById('closeSidebarBtn'),
        newChatBtn: document.getElementById('newChatBtn'),
        exportChatBtn: document.getElementById('exportChatBtn'),
        headerClearBtn: document.getElementById('headerClearBtn'),
        headerInfoBtn: document.getElementById('headerInfoBtn'),
        infoModal: document.getElementById('infoModal'),
        closeModalBtn: document.getElementById('closeModalBtn'),
        sessionIdDisplay: document.getElementById('sessionIdDisplay'),
        connectionBadge: document.getElementById('connectionBadge'),
        agentNameDisplay: document.getElementById('agentNameDisplay'),
        ttsToggle: document.getElementById('ttsToggle'),
        soundEffectsToggle: document.getElementById('soundEffectsToggle'),

        chatMessages: document.getElementById('chatMessages'),
        welcomeHero: document.getElementById('welcomeHero'),
        typingIndicator: document.getElementById('typingIndicator'),
        chatForm: document.getElementById('chatForm'),
        messageInput: document.getElementById('messageInput'),
        charCounter: document.getElementById('charCounter'),
        sendBtn: document.getElementById('sendBtn'),
        voiceInputBtn: document.getElementById('voiceInputBtn'),
        toastContainer: document.getElementById('toastContainer')
    };

    // ==========================================================================
    // EFEITOS SONOROS (WEB AUDIO API - ZERO ARQUIVOS EXTERNOS)
    // ==========================================================================
    let audioCtx = null;
    function playSound(type) {
        if (!state.soundEnabled) return;
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);

            const now = audioCtx.currentTime;

            if (type === 'send') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
                gain.gain.setValueAtTime(0.06, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
                osc.start(now);
                osc.stop(now + 0.12);
            } else if (type === 'receive') {
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(587.33, now); // D5
                osc.frequency.setValueAtTime(880, now + 0.08);    // A5
                gain.gain.setValueAtTime(0.07, now);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
                osc.start(now);
                osc.stop(now + 0.22);
            }
        } catch (e) {
            console.warn('Áudio não suportado ou bloqueado pelo navegador.');
        }
    }

    // ==========================================================================
    // TOAST NOTIFICATIONS
    // ==========================================================================
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '⚠️';

        toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
        elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 3200);
    }

    // ==========================================================================
    // PARSER MARKDOWN & SANITIZAÇÃO
    // ==========================================================================
    function escapeHtml(str) {
        return (str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function parseMarkdown(text) {
        if (!text) return '';
        let escaped = escapeHtml(text);

        // Blocos de código ```linguagem ... ```
        escaped = escaped.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
            return `<pre><code class="lang-${lang}">${code}</code></pre>`;
        });

        // Código inline `código`
        escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Negrito **texto**
        escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // Itálico *texto*
        escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // Listas não ordenadas (- item ou * item)
        const lines = escaped.split('\n');
        let inList = false;
        let formattedLines = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const listMatch = line.match(/^(\s*)[-*]\s+(.*)/);
            if (listMatch) {
                if (!inList) {
                    formattedLines.push('<ul>');
                    inList = true;
                }
                formattedLines.push(`<li>${listMatch[2]}</li>`);
            } else {
                if (inList) {
                    formattedLines.push('</ul>');
                    inList = false;
                }
                if (line.trim().length > 0) {
                    if (!line.startsWith('<pre>') && !line.startsWith('</pre>') && !line.startsWith('<ul>')) {
                        formattedLines.push(`<p>${line}</p>`);
                    } else {
                        formattedLines.push(line);
                    }
                }
            }
        }
        if (inList) {
            formattedLines.push('</ul>');
        }

        return formattedLines.join('');
    }

    // ==========================================================================
    // FORMATAÇÃO DE HORA
    // ==========================================================================
    function getCurrentTimeFormatted() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    // ==========================================================================
    // RENDERIZAR MENSAGENS NA INTERFACE
    // ==========================================================================
    function appendMessage(role, text, meta = {}, rawText = '') {
        // Remove a tela inicial de boas-vindas se for a primeira mensagem
        if (elements.welcomeHero && elements.welcomeHero.style.display !== 'none') {
            elements.welcomeHero.style.display = 'none';
        }

        const timestamp = getCurrentTimeFormatted();
        const row = document.createElement('div');
        row.className = `message-row ${role === 'user' ? 'user-row' : 'agent-row'}`;

        const isUser = role === 'user';
        const formattedHtml = parseMarkdown(text);

        // Metadados do agente (ex: Idioma, Tom)
        let metaHtml = '';
        if (!isUser && meta && (meta.language || meta.tone)) {
            metaHtml = '<div class="message-meta-chips">';
            if (meta.language) {
                metaHtml += `<span class="meta-chip lang">🌐 ${escapeHtml(meta.language)}</span>`;
            }
            if (meta.tone) {
                metaHtml += `<span class="meta-chip tone">🎭 ${escapeHtml(meta.tone)}</span>`;
            }
            metaHtml += '</div>';
        }

        // Avatar
        const avatarHtml = isUser
            ? `<div class="message-avatar"><div class="user-avatar-icon">VC</div></div>`
            : `<div class="message-avatar"><img src="avatar.jpg" alt="Agente Otávio"></div>`;

        // Botões de ação (Copiar, Ler em voz alta)
        const actionsHtml = `
            <div class="message-actions">
                <span class="msg-timestamp">${timestamp}</span>
                <button class="msg-action-btn copy-msg-btn" title="Copiar mensagem" aria-label="Copiar texto">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
                ${!isUser ? `
                    <button class="msg-action-btn speak-msg-btn" title="Ouvir mensagem" aria-label="Ouvir mensagem">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
                    </button>
                ` : ''}
            </div>
        `;

        row.innerHTML = `
            ${avatarHtml}
            <div class="message-content-wrapper">
                ${metaHtml}
                <div class="message-bubble">${formattedHtml}</div>
                ${actionsHtml}
            </div>
        `;

        // Adiciona listener para copiar mensagem
        const copyBtn = row.querySelector('.copy-msg-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const textToCopy = rawText || text;
                navigator.clipboard.writeText(textToCopy).then(() => {
                    showToast('Mensagem copiada para a área de transferência!', 'success');
                }).catch(() => {
                    showToast('Não foi possível copiar.', 'error');
                });
            });
        }

        // Adiciona listener para síntese de voz (TTS)
        const speakBtn = row.querySelector('.speak-msg-btn');
        if (speakBtn) {
            speakBtn.addEventListener('click', () => {
                speakText(text);
            });
        }

        elements.chatMessages.appendChild(row);
        scrollToBottom();

        // Salva histórico local
        state.messages.push({
            role,
            text,
            meta,
            timestamp
        });

        // Se TTS automático estiver ativo e a mensagem for do agente
        if (!isUser && state.ttsEnabled) {
            speakText(text);
        }
    }

    function scrollToBottom() {
        elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
    }

    // ==========================================================================
    // TEXT-TO-SPEECH (TTS)
    // ==========================================================================
    function speakText(text) {
        if (!state.speechSynth) return;
        state.speechSynth.cancel(); // Para falas anteriores

        // Limpa formatação Markdown para fala mais fluida
        const plainText = text.replace(/[*_#`~\[\]]/g, '').trim();
        const utterance = new SpeechSynthesisUtterance(plainText);

        utterance.lang = 'pt-BR';
        utterance.rate = 1.05;

        // Tenta achar voz brasileira feminina ou natural
        const voices = state.speechSynth.getVoices();
        const ptVoice = voices.find(v => v.lang === 'pt-BR' || v.lang.startsWith('pt'));
        if (ptVoice) {
            utterance.voice = ptVoice;
        }

        state.speechSynth.speak(utterance);
    }

    // ==========================================================================
    // SPEECH-TO-TEXT (MICROFONE)
    // ==========================================================================
    function setupSpeechRecognition() {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            elements.voiceInputBtn.style.display = 'none';
            return;
        }

        const recognition = new SpeechRec();
        recognition.lang = 'pt-BR';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onstart = () => {
            state.isListening = true;
            elements.voiceInputBtn.classList.add('listening');
            showToast('Microfone ativado. Fale sua mensagem...', 'info');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            elements.messageInput.value = (elements.messageInput.value + ' ' + transcript).trim();
            handleTextareaResize();
            updateCharCounter();
        };

        recognition.onerror = (event) => {
            console.error('Erro no reconhecimento de voz:', event.error);
            showToast('Erro ao capturar áudio: ' + event.error, 'error');
            stopListening();
        };

        recognition.onend = () => {
            stopListening();
        };

        state.recognition = recognition;

        elements.voiceInputBtn.addEventListener('click', () => {
            if (state.isListening) {
                recognition.stop();
            } else {
                try {
                    recognition.start();
                } catch (e) {
                    console.warn(e);
                }
            }
        });
    }

    function stopListening() {
        state.isListening = false;
        elements.voiceInputBtn.classList.remove('listening');
    }

    // ==========================================================================
    // ENVIO DE MENSAGENS PARA O BACKEND
    // ==========================================================================
    async function sendMessage(userText) {
        if (!userText || state.isProcessing) return;

        state.isProcessing = true;
        elements.sendBtn.disabled = true;
        elements.messageInput.disabled = true;

        // Renderiza mensagem do usuário
        appendMessage('user', userText);
        playSound('send');

        // Exibe indicador de digitação do agente
        elements.typingIndicator.style.display = 'flex';
        scrollToBottom();

        try {
            const response = await fetch(`${API_BASE}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: userText,
                    conversation_id: state.conversationId
                })
            });

            const data = await response.json();

            // Esconde indicador de digitação
            elements.typingIndicator.style.display = 'none';

            if (!response.ok || data.status === 'error') {
                const errorMsg = data.error || 'Erro ao conectar ao Agente Azure.';
                appendMessage('agent', `⚠️ **Desculpe, ocorreu um erro na comunicação:**\n\n\`${errorMsg}\``);
                showToast('Falha na resposta do agente.', 'error');
                return;
            }

            // Atualiza sessão
            if (data.conversation_id) {
                state.conversationId = data.conversation_id;
                elements.sessionIdDisplay.textContent = data.conversation_id.substring(0, 14) + '...';
                elements.sessionIdDisplay.title = data.conversation_id;
            }

            // Renderiza resposta do agente
            appendMessage('agent', data.response || 'Sem resposta recebida.', data.meta || {}, data.raw_response);
            playSound('receive');

        } catch (err) {
            console.error('Falha na requisição:', err);
            elements.typingIndicator.style.display = 'none';
            appendMessage(
                'agent', 
                `⚠️ **Não foi possível conectar ao servidor local.**\n\nCertifique-se de que o backend está executando com o comando:\n\`python app.py\` no terminal do projeto.`
            );
            showToast('Erro de conexão com o servidor.', 'error');
        } finally {
            state.isProcessing = false;
            elements.sendBtn.disabled = false;
            elements.messageInput.disabled = false;
            elements.messageInput.focus();
        }
    }

    // ==========================================================================
    // NOVA CONVERSA & RESET
    // ==========================================================================
    async function startNewConversation() {
        if (state.isProcessing) return;

        try {
            const res = await fetch(`${API_BASE}/api/reset`, { method: 'POST' });
            const data = await res.json();
            if (data.conversation_id) {
                state.conversationId = data.conversation_id;
                elements.sessionIdDisplay.textContent = data.conversation_id.substring(0, 14) + '...';
                elements.sessionIdDisplay.title = data.conversation_id;
            } else {
                state.conversationId = null;
                elements.sessionIdDisplay.textContent = 'Nova';
            }
        } catch (e) {
            state.conversationId = null;
            elements.sessionIdDisplay.textContent = 'Nova';
        }

        // Limpa lista de mensagens na UI
        state.messages = [];
        elements.chatMessages.innerHTML = '';
        if (elements.welcomeHero) {
            elements.chatMessages.appendChild(elements.welcomeHero);
            elements.welcomeHero.style.display = 'flex';
        }

        showToast('Nova conversa iniciada!', 'success');
    }

    // ==========================================================================
    // EXPORTAR CONVERSA
    // ==========================================================================
    function exportChatHistory() {
        if (state.messages.length === 0) {
            showToast('Nenhuma mensagem para exportar.', 'info');
            return;
        }

        let content = `# Histórico de Atendimento — Agente Otávio\n`;
        content += `Data: ${new Date().toLocaleString()}\n`;
        content += `ID da Sessão: ${state.conversationId || 'N/A'}\n\n`;
        content += `---------------------------------------------------------\n\n`;

        state.messages.forEach(msg => {
            const sender = msg.role === 'user' ? 'VOCÊ' : 'AGENTE OTÁVIO';
            content += `[${msg.timestamp}] ${sender}:\n${msg.text}\n\n`;
        });

        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `historico-conversa-otavio-${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('Histórico exportado com sucesso!', 'success');
    }

    // ==========================================================================
    // AUTO-RESIZE DO TEXTAREA & CONTADOR
    // ==========================================================================
    function handleTextareaResize() {
        const textarea = elements.messageInput;
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
    }

    function updateCharCounter() {
        const len = elements.messageInput.value.length;
        elements.charCounter.textContent = `${len}/2000`;
    }

    // ==========================================================================
    // VERIFICAR STATUS DO SERVIDOR
    // ==========================================================================
    async function checkServerStatus() {
        try {
            const res = await fetch(`${API_BASE}/api/info`);
            if (res.ok) {
                const info = await res.json();
                elements.connectionBadge.innerHTML = '<span class="pulse-dot"></span> Online';
                elements.connectionBadge.className = 'status-badge connected';
                if (info.agent_name) {
                    elements.agentNameDisplay.textContent = info.agent_name;
                }
            } else {
                throw new Error();
            }
        } catch (e) {
            elements.connectionBadge.innerHTML = '⚠️ Servidor offline';
            elements.connectionBadge.className = 'status-badge';
            elements.connectionBadge.style.color = '#f59e0b';
        }
    }

    // ==========================================================================
    // INICIALIZAÇÃO E EVENT LISTENERS
    // ==========================================================================
    function init() {
        // Envio do formulário
        elements.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const text = elements.messageInput.value.trim();
            if (text) {
                sendMessage(text);
                elements.messageInput.value = '';
                handleTextareaResize();
                updateCharCounter();
            }
        });

        // Atalho Enter para enviar, Shift+Enter para nova linha
        elements.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                elements.chatForm.dispatchEvent(new Event('submit'));
            }
        });

        elements.messageInput.addEventListener('input', () => {
            handleTextareaResize();
            updateCharCounter();
        });

        // Sidebar Toggle (Mobile)
        elements.toggleSidebarBtn.addEventListener('click', () => {
            elements.sidebar.classList.add('open');
        });

        elements.closeSidebarBtn.addEventListener('click', () => {
            elements.sidebar.classList.remove('open');
        });

        // Botões de Nova Conversa
        elements.newChatBtn.addEventListener('click', () => {
            startNewConversation();
            elements.sidebar.classList.remove('open');
        });

        elements.headerClearBtn.addEventListener('click', () => {
            if (confirm('Deseja realmente limpar a conversa atual?')) {
                startNewConversation();
            }
        });

        // Exportar Conversa
        elements.exportChatBtn.addEventListener('click', exportChatHistory);

        // Cartões do Hero de boas-vindas
        document.querySelectorAll('.hero-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.getAttribute('data-prompt');
                if (prompt) {
                    elements.messageInput.value = prompt;
                    elements.chatForm.dispatchEvent(new Event('submit'));
                }
            });
        });

        // Sugestões Rápidas na Sidebar
        document.querySelectorAll('.quick-prompt-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.getAttribute('data-prompt');
                if (prompt) {
                    elements.messageInput.value = prompt;
                    elements.sidebar.classList.remove('open');
                    elements.chatForm.dispatchEvent(new Event('submit'));
                }
            });
        });

        // Modais
        elements.headerInfoBtn.addEventListener('click', () => {
            elements.infoModal.classList.add('active');
        });

        elements.closeModalBtn.addEventListener('click', () => {
            elements.infoModal.classList.remove('active');
        });

        elements.infoModal.addEventListener('click', (e) => {
            if (e.target === elements.infoModal) {
                elements.infoModal.classList.remove('active');
            }
        });

        // Toggles
        elements.ttsToggle.addEventListener('change', (e) => {
            state.ttsEnabled = e.target.checked;
            showToast(state.ttsEnabled ? 'Leitura de voz ativada' : 'Leitura de voz desativada', 'info');
        });

        elements.soundEffectsToggle.addEventListener('change', (e) => {
            state.soundEnabled = e.target.checked;
        });

        // Configuração do Microfone
        setupSpeechRecognition();

        // Checagem de status inicial
        checkServerStatus();

        // Foco inicial no campo de texto
        elements.messageInput.focus();
    }

    // Dispara inicialização quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
