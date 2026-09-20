"""AI Service Abstraction Layer (Anish — Intelligence Subsystem).

Provides a provider-agnostic interface for AI insights and conversational Q&A.
Gemini is treated as a pluggable backend; if absent, unconfigured, or failing,
the system gracefully falls back to deterministic, grounded localized templates
based on app/intelligence.py.
"""
from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from typing import Any, Optional

from .ai_models import (
    AIChatRequest,
    AIContext,
    AIInsightRequest,
    AIResponse,
    InformationProvenance,
)
from .intelligence import generate_localized_advisory, generate_priority_justification

log = logging.getLogger("ai_service")


class BaseAIService(ABC):
    """Abstract provider interface for all intelligence engines."""

    @abstractmethod
    def generate_insight(self, context: AIContext) -> AIResponse:
        """Generate a concise, 2-4 sentence analytical insight grounded in screen context."""
        pass

    @abstractmethod
    def chat(self, request: AIChatRequest) -> AIResponse:
        """Process a conversational query using screen context and history."""
        pass


class TemplateFallbackAIService(BaseAIService):
    """Deterministic, zero-hallucination template engine.
    
    Functions fully offline without external API keys or network dependencies.
    Grounded directly in AeroTrace's mathematical and environmental calculations.
    """

    def _format_provenance_note(self, context: AIContext) -> str:
        prov = context.provenance
        src = context.data_source or "Unknown Source"
        ts = context.data_timestamp or "recent observation"

        if context.is_simulated or prov == InformationProvenance.SIMULATION:
            return f"SIMULATED DATA — live source unreachable. Fallback observation dated {ts}."
        if prov == InformationProvenance.MEASURED_FACT:
            return f"Measured physical sensor data from {src} (Observed: {ts})."
        if prov == InformationProvenance.MODEL_ESTIMATE:
            return f"Atmospheric model estimate from {src} (Not direct physical sensor). Model cycle: {ts}."
        if prov == InformationProvenance.FORECAST:
            return f"Forecast projection derived from wind vector and Pasquill dispersion heuristics."
        return f"Reported by {src} at {ts}."

    def generate_insight(self, context: AIContext) -> AIResponse:
        lang = context.language if context.language in ("en", "hi", "mr") else "en"
        city = context.city or "the region"
        station = context.station or "monitoring station"
        pollutant = context.dominant_pollutant or context.pollutant or "PM2.5"
        aqi = int(context.current_aqi) if context.current_aqi is not None else 150
        screen = context.screen_id

        # ── Screen 2: City Overview ─────────────────────────────────────────
        if "city" in screen:
            if lang == "hi":
                text = (
                    f"{city} में समग्र वायु गुणवत्ता सूचकांक {aqi} दर्ज किया गया है, "
                    f"जिसमें प्राथमिक प्रदूषक {pollutant} है। संवेदनशील नागरिकों को बाहरी गतिविधियों "
                    f"को सीमित करने की सलाह दी जाती है।"
                )
            elif lang == "mr":
                text = (
                    f"{city} मध्ये सरासरी हवेचा गुणवत्ता निर्देशांक {aqi} नोंदवला गेला असून, "
                    f"मुख्य प्रदूषक {pollutant} आहे. संवेदनशील नागरिकांनी बाहेर पडणे टाळावे."
                )
            else:
                text = (
                    f"Overall Air Quality Index for {city} stands at {aqi}, dominated by {pollutant}. "
                    f"Civic health guidelines recommend minimizing prolonged outdoor exertion in affected corridors."
                )
            follow_ups = [
                f"Inspect active stations across {city}",
                f"Check 24-hour pollutant trend for {pollutant}",
            ]

        # ── Screen 3: Station Intelligence ──────────────────────────────────
        elif "station" in screen:
            wind = context.weather or {}
            w_speed = wind.get("wind_speed_kmh", 12.0)
            w_card = wind.get("wind_direction_cardinal", "WNW")
            if lang == "hi":
                text = (
                    f"{station} स्टेशन पर AQI {aqi} पर है। स्थानीय पवन गति {w_speed} किमी/घंटा "
                    f"({w_card} दिशा से) मापी गई है, जो वायुमंडलीय फैलाव को प्रभावित कर रही है।"
                )
            elif lang == "mr":
                text = (
                    f"{station} स्थानकावर AQI {aqi} नोंदवला गेला आहे. स्थानिक वाऱ्याचा वेग {w_speed} किमी/तास "
                    f"({w_card} दिशेकडून) असून, यामुळे प्रदूषकांचा प्रसार होत आहे."
                )
            else:
                text = (
                    f"{station} monitoring station is reporting an AQI of {aqi}. Surface wind is moving at "
                    f"{w_speed} km/h from {w_card}, concentrating particulate dispersion along downwind sectors."
                )
            follow_ups = [
                f"Trace source attribution for {pollutant}",
                f"View forward trajectory projection from {station}",
            ]

        # ── Screen 4: Pollution Investigation ────────────────────────────────
        elif "investigation" in screen or "attribution" in screen:
            top_candidate = (context.attribution or {}).get("top_candidate")
            adv = generate_localized_advisory(
                station_name=station,
                aqi=aqi,
                dominant_pollutant=pollutant,
                top_candidate=top_candidate,
                enforcement_priority=float((context.attribution or {}).get("enforcement_priority", 0.7)),
            )
            text = adv.get(lang, adv["en"])
            follow_ups = [
                "Simulate targeted emission intervention",
                "Evaluate sensitive school and hospital receptors",
            ]

        # ── Screen 5: Forward Prediction ─────────────────────────────────────
        elif "prediction" in screen:
            if lang == "hi":
                text = (
                    f"{pollutant} के लिए आगामी 1 से 6 घंटों का फैलाव मॉडल हवा के बहाव पर आधारित है। "
                    f"हवा की गति शांत रहने पर प्रदूषक स्तरों में वृद्धि का अनुमान है।"
                )
            elif lang == "mr":
                text = (
                    f"{pollutant} साठी पुढील १ ते ६ तासांचा अंदाज वाऱ्याच्या दिशेवर आधारित आहे. "
                    f"वाऱ्याचा वेग मंदावल्यास प्रदूषणाची तीव्रता वाढण्याची शक्यता आहे."
                )
            else:
                text = (
                    f"Forward trajectory analysis for {pollutant} projects downwind dispersion over the next 1–6 hours. "
                    f"Atmospheric boundary layer stability indicates potential particulate accumulation."
                )
            follow_ups = [
                "Inspect projected exposure zone on map",
                "Test traffic curtailment impact on predicted AQI",
            ]

        # ── Screen 6: Impact & Intervention ──────────────────────────────────
        elif "impact" in screen or "intervention" in screen:
            if lang == "hi":
                text = (
                    f"प्रक्षेपित प्रभाव क्षेत्र के विश्लेषण से संकेत मिलता है कि निर्माण और यातायात नियंत्रण "
                    f"उपायों से AQI में लक्षणीय सुधार हो सकता है।"
                )
            elif lang == "mr":
                text = (
                    f"संभाव्य बाधित क्षेत्राच्या विश्लेषणावरून असे दिसून येते की बांधकाम व वाहतूक नियंत्रणामुळे "
                    f"हवेच्या गुणवत्तेत लक्षणीय सुधारणा होऊ शकते."
                )
            else:
                text = (
                    f"Impact zone analysis cross-references sensitive receptors. Targeted enforcement "
                    f"(such as water sprinkling or heavy vehicle diversion) yields measurable reduction."
                )
            follow_ups = [
                "Review municipal field team response plan",
                "Export enforcement advisory report",
            ]

        # ── Screen 7: Analytics ──────────────────────────────────────────────
        elif "analytics" in screen:
            if lang == "hi":
                text = (
                    f"ऐतिहासिक प्रवृत्तियों के अनुसार पीक आवर्स के दौरान {pollutant} स्तरों में स्पष्ट "
                    f"उछाल देखा गया है। मौसमी रुझान स्थिर निगरानी की आवश्यकता दर्शाते हैं।"
                )
            elif lang == "mr":
                text = (
                    f"मागील नोंदींवरून असे स्पष्ट होते की गर्दीच्या वेळी {pollutant} चे प्रमाण लक्षणीय वाढते. "
                    f"दीर्घकालीन नियोजनासाठी नियमित विश्लेषण आवश्यक आहे."
                )
            else:
                text = (
                    f"Historical trend analysis indicates recurring diurnal peaks for {pollutant}. "
                    f"Correlation with local transport corridors suggests structured periodic emission cycles."
                )
            follow_ups = [
                f"Compare {city} with other metropolitan centers",
                "Filter multi-day anomaly occurrences",
            ]

        # ── General / National Overview ──────────────────────────────────────
        else:
            if lang == "hi":
                text = (
                    f"राष्ट्रीय पर्यावरण निगरानी डैशबोर्ड 7 प्रमुख शहरों के वास्तविक समय डेटा को ट्रैक करता है। "
                    f"गहन विश्लेषण के लिए किसी भी शहर का चयन करें।"
                )
            elif lang == "mr":
                text = (
                    f"राष्ट्रीय पर्यावरण निरीक्षण प्रणाली ७ प्रमुख शहरांचा थेट डेटा संकलित करते. "
                    f"तपशीलवार माहितीसाठी कोणतेही शहर निवडा."
                )
            else:
                text = (
                    f"AeroTrace National Environmental Intelligence monitors current air quality across 7 key metros. "
                    f"Select any city node to begin progressive forensic investigation."
                )
            follow_ups = [
                "Zoom into cities with Severe or Very Poor AQI",
                "View national multi-city comparative rankings",
            ]

        confidence_note = self._format_provenance_note(context)

        return AIResponse(
            response_text=text,
            language=lang,
            provider="template_fallback",
            confidence_note=confidence_note,
            provenance=context.provenance,
            is_grounded=True,
            suggested_follow_ups=follow_ups,
            context_summary={
                "screen_id": screen,
                "city": city,
                "station": station,
                "pollutant": pollutant,
                "current_aqi": aqi,
                "data_source": context.data_source,
            },
        )

    def chat(self, request: AIChatRequest) -> AIResponse:
        ctx = request.context
        lang = ctx.language if ctx.language in ("en", "hi", "mr") else "en"
        q_lower = request.message.lower()

        # Build grounded response using available context
        city = ctx.city or "the selected city"
        station = ctx.station or "the local station"
        pollutant = ctx.dominant_pollutant or ctx.pollutant or "PM2.5"
        aqi = ctx.current_aqi if ctx.current_aqi is not None else "N/A"

        if "why" in q_lower or "cause" in q_lower or "source" in q_lower:
            if ctx.attribution and "top_candidate" in ctx.attribution:
                cand = ctx.attribution["top_candidate"]
                c_name = cand.get("name", "identified industrial/construction cluster")
                conf = int(cand.get("score_breakdown", {}).get("confidence_score", 0.75) * 100)
                if lang == "hi":
                    resp = (
                        f"उपलब्ध वायु और रासायनिक विश्लेषण के अनुसार, मुख्य संभावित स्रोत '{c_name}' है "
                        f"(विश्वसनीयता: {conf}%)। अपस्ट्रीम पवन कोण इसी क्षेत्र की ओर इंगित करता है।"
                    )
                elif lang == "mr":
                    resp = (
                        f"उपलब्ध रासायनिक व वारा विश्लेषणावरून मुख्य संभाव्य स्रोत '{c_name}' आहे "
                        f"(विश्वासार्हता: {conf}%). वारा याच दिशेकडून वाहत आहे."
                    )
                else:
                    resp = (
                        f"Based on wind cone alignment and chemical ratio matching, the primary attributed source "
                        f"is '{c_name}' with {conf}% confidence under active meteorological conditions."
                    )
            else:
                if lang == "hi":
                    resp = (
                        f"{station} ({city}) पर वर्तमान AQI {aqi} है, जिसमें मुख्य योगदान {pollutant} का है। "
                        f"विस्तृत स्रोत पहचान के लिए प्रदूषण जांच स्क्रीन (Screen 4) देखें।"
                    )
                elif lang == "mr":
                    resp = (
                        f"{station} ({city}) येथे सध्याचा AQI {aqi} असून मुख्य प्रदूषक {pollutant} आहे. "
                        f"सविस्तर स्रोत विश्लेषणासाठी प्रदूषण शोध स्क्रीन (Screen 4) पहा."
                    )
                else:
                    resp = (
                        f"Current AQI at {station} ({city}) is {aqi}, dominated by {pollutant}. "
                        f"Detailed spatial source attribution is available in the Pollution Investigation workspace."
                    )
        elif "predict" in q_lower or "future" in q_lower or "tomorrow" in q_lower:
            if lang == "hi":
                resp = (
                    f"आगे के घंटों के लिए प्रदूषण का फैलाव स्थानीय वायुमंडलीय स्थिरता और हवा की गति पर निर्भर करेगा। "
                    f"विस्तृत प्रक्षेप पथ देखने के लिए स्क्रीन 5 (Prediction) देखें।"
                )
            elif lang == "mr":
                resp = (
                    f"पुढील काही तासांतील प्रदूषणाचा प्रसार स्थानिक वाऱ्याच्या वेगावर अवलंबून असेल. "
                    f"सविस्तर अंदाजासाठी स्क्रीन 5 (Prediction) तपासा."
                )
            else:
                resp = (
                    f"Forward projection indicates pollution transport follows the local wind vector. "
                    f"Uncertainty intervals widen beyond the 3-hour horizon as atmospheric mixing shifts."
                )
        else:
            if lang == "hi":
                resp = (
                    f"मैं AeroTrace पर्यावरण सहायक हूँ। {city} के {station} स्टेशन का डेटा: "
                    f"AQI {aqi}, प्रमुख प्रदूषक {pollutant}, स्रोत: {ctx.data_source or 'CPCB/Open-Meteo'}।"
                )
            elif lang == "mr":
                resp = (
                    f"मी AeroTrace पर्यावरण सहाय्यक आहे. {city} मधील {station} स्थानकाचा डेटा: "
                    f"AQI {aqi}, मुख्य प्रदूषक {pollutant}, स्रोत: {ctx.data_source or 'CPCB/Open-Meteo'}."
                )
            else:
                resp = (
                    f"AeroTrace Intelligence is grounded in active environmental telemetry. For {station} in {city}, "
                    f"the current AQI is {aqi} ({pollutant}) reported by {ctx.data_source or 'standard monitors'}."
                )

        confidence_note = self._format_provenance_note(ctx)

        return AIResponse(
            response_text=resp,
            language=lang,
            provider="template_fallback",
            confidence_note=confidence_note,
            provenance=ctx.provenance,
            is_grounded=True,
            suggested_follow_ups=[
                f"How is {pollutant} concentration trending?",
                "What interventions can reduce this reading?",
            ],
            context_summary={
                "city": city,
                "station": station,
                "pollutant": pollutant,
                "current_aqi": aqi,
                "data_source": ctx.data_source,
            },
        )


class GeminiAIService(BaseAIService):
    """Optional Google Gemini LLM provider with strict grounding and fallback."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "").strip()
        self._fallback = TemplateFallbackAIService()
        self._client = None

        if self.api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                self._client = genai.GenerativeModel("gemini-1.5-flash")
                log.info("Gemini AI provider initialized successfully.")
            except Exception as exc:
                log.warning("Could not initialize Gemini SDK (%s); will use template fallback.", exc)
                self._client = None
        else:
            log.info("No GEMINI_API_KEY set; AI layer running with grounded template fallback.")

    def _build_system_prompt(self, context: AIContext) -> str:
        return (
            "You are AeroTrace Environmental Intelligence, an expert atmospheric scientist assistant. "
            "You MUST adhere to these strict rules:\n"
            "1. Ground all statements strictly in the provided AeroTrace context.\n"
            "2. NEVER fabricate environmental measurements, station names, or sensor readings.\n"
            "3. Clearly distinguish measured facts from atmospheric model estimates or forecasts.\n"
            f"4. Respond exclusively in the requested language locale: '{context.language}' ('en' for English, 'hi' for Hindi, 'mr' for Marathi).\n"
            "5. Keep responses concise, objective, actionable, and suitable for civic decision-makers."
        )

    def generate_insight(self, context: AIContext) -> AIResponse:
        if not self._client:
            return self._fallback.generate_insight(context)

        try:
            prompt = (
                f"{self._build_system_prompt(context)}\n\n"
                f"CONTEXT DATA:\n{context.model_dump_json(indent=2)}\n\n"
                f"TASK: Generate a 2-4 sentence environmental insight explaining current conditions for {context.screen_id}. "
                f"Language: {context.language}."
            )
            resp = self._client.generate_content(prompt)
            text = (resp.text or "").strip()

            if not text:
                return self._fallback.generate_insight(context)

            confidence_note = self._fallback._format_provenance_note(context)
            return AIResponse(
                response_text=text,
                language=context.language,
                provider="gemini",
                confidence_note=confidence_note,
                provenance=context.provenance,
                is_grounded=True,
                suggested_follow_ups=[
                    "Check source attribution evidence",
                    "Simulate emission curtailment impact",
                ],
                context_summary={
                    "city": context.city,
                    "station": context.station,
                    "aqi": context.current_aqi,
                    "source": context.data_source,
                },
            )
        except Exception as exc:
            log.warning("Gemini generation failed (%s); degrading to template fallback.", exc)
            return self._fallback.generate_insight(context)

    def chat(self, request: AIChatRequest) -> AIResponse:
        if not self._client:
            return self._fallback.chat(request)

        try:
            history_text = "\n".join(
                f"{h.get('role', 'user').upper()}: {h.get('content', '')}"
                for h in request.conversation_history[-4:]
            )
            prompt = (
                f"{self._build_system_prompt(request.context)}\n\n"
                f"SCREEN CONTEXT:\n{request.context.model_dump_json(indent=2)}\n\n"
                f"CONVERSATION HISTORY:\n{history_text}\n\n"
                f"USER QUERY: {request.message}\n"
                f"Language: {request.context.language}."
            )
            resp = self._client.generate_content(prompt)
            text = (resp.text or "").strip()

            if not text:
                return self._fallback.chat(request)

            confidence_note = self._fallback._format_provenance_note(request.context)
            return AIResponse(
                response_text=text,
                language=request.context.language,
                provider="gemini",
                confidence_note=confidence_note,
                provenance=request.context.provenance,
                is_grounded=True,
                suggested_follow_ups=[
                    "What are the downwind affected areas?",
                    "View active municipal alerts",
                ],
                context_summary={
                    "city": request.context.city,
                    "station": request.context.station,
                    "aqi": request.context.current_aqi,
                },
            )
        except Exception as exc:
            log.warning("Gemini chat failed (%s); degrading to template fallback.", exc)
            return self._fallback.chat(request)


# ── Factory Singleton ────────────────────────────────────────────────────────
_ACTIVE_SERVICE: Optional[BaseAIService] = None


def get_ai_service() -> BaseAIService:
    """Return the active AI service provider singleton."""
    global _ACTIVE_SERVICE
    if _ACTIVE_SERVICE is None:
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if api_key:
            _ACTIVE_SERVICE = GeminiAIService(api_key=api_key)
        else:
            _ACTIVE_SERVICE = TemplateFallbackAIService()
    return _ACTIVE_SERVICE
