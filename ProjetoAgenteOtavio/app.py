import os
import re
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from azure.identity import DefaultAzureCredential
from azure.ai.projects import AIProjectClient

app = Flask(__name__, static_folder=".")
CORS(app)

ENDPOINT = "https://aula-agente-otavio-resource.services.ai.azure.com/api/projects/aula-agente-otavio"
AGENT_NAME = "otavio-agente"

# Inicialização do cliente Azure AI
project_client = None
openai_client = None

def get_clients():
    global project_client, openai_client
    if openai_client is None:
        credential = DefaultAzureCredential()
        project_client = AIProjectClient(
            endpoint=ENDPOINT,
            credential=credential,
            allow_preview=True,
        )
        openai_client = project_client.get_openai_client(agent_name=AGENT_NAME)
    return openai_client

def parse_agent_meta(text):
    """
    Detecta metadados no início da mensagem como:
    'Idioma: Português | Tom: Neutro'
    """
    meta = {}
    clean_text = text
    
    # Procura padrão 'Idioma: X | Tom: Y'
    pattern = r"^\s*Idioma:\s*([^|\n]+)\s*\|\s*Tom:\s*([^\n\r]+)\s*"
    match = re.match(pattern, text, re.IGNORECASE)
    if match:
        meta["language"] = match.group(1).strip()
        meta["tone"] = match.group(2).strip()
        clean_text = text[match.end():].strip()
        
    return meta, clean_text

@app.route("/")
def index():
    return send_from_directory(".", "index.html")

@app.route("/<path:path>")
def static_proxy(path):
    return send_from_directory(".", path)

@app.route("/api/info", methods=["GET"])
def agent_info():
    return jsonify({
        "status": "online",
        "agent_name": AGENT_NAME,
        "endpoint": "aula-agente-otavio",
        "service": "Azure AI Foundry"
    })

@app.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json(force=True)
        user_message = data.get("message", "").strip()
        conversation_id = data.get("conversation_id", None)

        if not user_message:
            return jsonify({"error": "Mensagem vazia."}), 400

        client = get_clients()

        # Cria ou reutiliza a conversa
        if not conversation_id:
            conversation = client.conversations.create()
            conv_id = conversation.id
        else:
            conv_id = conversation_id

        # Envia a mensagem do usuário para o agente
        response = client.responses.create(
            conversation=conv_id,
            input=[{"role": "user", "content": user_message}],
        )

        raw_output = response.output_text or ""
        meta, parsed_text = parse_agent_meta(raw_output)

        return jsonify({
            "response": parsed_text,
            "raw_response": raw_output,
            "conversation_id": conv_id,
            "meta": meta,
            "status": "success"
        })

    except Exception as e:
        print(f"Erro no processamento do chat: {e}")
        return jsonify({
            "error": str(e),
            "status": "error"
        }), 500

@app.route("/api/reset", methods=["POST"])
def reset_conversation():
    try:
        client = get_clients()
        conversation = client.conversations.create()
        return jsonify({
            "status": "success",
            "conversation_id": conversation.id,
            "message": "Nova conversa iniciada."
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"\n==================================================")
    print(f"  Agente Otavio - Interface Web Conectada!")
    print(f"  Acesse no seu navegador: http://localhost:{port}")
    print(f"==================================================\n")
    app.run(host="127.0.0.1", port=port, debug=False)
