import time
from ask_sdk_core.skill_builder import SkillBuilder
from ask_sdk_core.dispatch_components import AbstractRequestHandler
from ask_sdk_core.utils import is_request_type, is_intent_name
from flask_ask_sdk.skill_adapter import SkillAdapter
import state

class LaunchRequestHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_request_type("LaunchRequest")(handler_input)

    def handle(self, handler_input):
        speech_text = "El Kraken ha despertado. ¿Qué deseas reproducir?"
        return handler_input.response_builder.speak(speech_text).set_should_end_session(False).response

class MusicaIntentHandler(AbstractRequestHandler):
    def can_handle(self, handler_input):
        return is_intent_name("MusicaIntent")(handler_input)

    def handle(self, handler_input):
        print(">>> COMANDO ALEXA: ACTUALIZANDO ORDEN...")
        
        state.LAST_ALEXA_COMMAND.update({
            'action': 'play_mix', 
            'target': 'smart_shuffle',
            'time': time.time()
        })
        
        speech_text = "Entendido, lanzando música aleatoria en Kraken."
        return handler_input.response_builder.speak(speech_text).response

def setup_alexa(app):
    sb = SkillBuilder()
    sb.add_request_handler(LaunchRequestHandler())
    sb.add_request_handler(MusicaIntentHandler())

    skill_adapter = SkillAdapter(
        skill=sb.create(), 
        skill_id=None, 
        app=app, 
        verifiers=[]
    )
    
    # We register the Alexa webhook to Flask 
    # Usually skill_adapter is called directly if we setup route manually:
    app.add_url_rule('/alexa', view_func=skill_adapter.dispatch_request, methods=['POST'])
    return skill_adapter
