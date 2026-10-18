
def precargar_biblioteca():
    global BIB_CACHE, BIB_CACHE_TIME
    try:
        print("📚 Precargando biblioteca...")
        BIB_CACHE = generar_biblioteca_viva()
        BIB_CACHE_TIME = time.time()
        print("✅ Biblioteca lista")
    except Exception as e:
        print("⚠️ Error precargando biblioteca:", e)

class LaunchRequestHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_request_type("LaunchRequest")(handler_input)

    def handle(self, handler_input):
        speech_text = "El Kraken ha despertado. ¿Qué deseas reproducir?"
        return handler_input.response_builder.speak(speech_text).set_should_end_session(False).response

# 2. Qué pasa cuando dices "Pon música" (MusicaIntent)
class MusicaIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_intent_name("MusicaIntent")(handler_input)

    def handle(self, handler_input):
        # Llamamos a la nueva variable
        global LAST_ALEXA_COMMAND
        
        print(">>> COMANDO ALEXA: ACTUALIZANDO ORDEN...")
        
        # En lugar de .append, SOBREESCRIBIMOS con la hora actual
        LAST_ALEXA_COMMAND = {
            'action': 'play_mix', 
            'target': 'smart_shuffle',
            'time': time.time() # <--- ESTO ES LA CLAVE (Marca de tiempo)
        }
        
        speech_text = "Entendido, lanzando música aleatoria en Kraken."
        return handler_input.response_builder.speak(speech_text).response

# 3. Configuración del Skill
sb = SkillBuilder()
sb.add_request_handler(LaunchRequestHandler())
sb.add_request_handler(MusicaIntentHandler())

skill_adapter = SkillAdapter(
    skill=sb.create(), 
    skill_id=None, 
    app=app, 
    verifiers=[]
)

if __name__ == '__main__':
    check_ffmpeg()
    init_db()
    precargar_biblioteca()
    print("🐙  KRAKEN V3 - SERVIDOR MULTIMEDIA")
    print("🧹 Iniciando Radar de Usuarios...")
    radar_thread = threading.Thread(target=cleanup_inactive_users, daemon=True)
    radar_thread.start()
    app.run(port=5000, debug=True, use_reloader=True)  # use_reloader=False para evitar doble threading
