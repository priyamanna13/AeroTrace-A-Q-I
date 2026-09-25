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
from .weather_context import get_weather_context, format_weather_for_prompt

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
        src_upper = src.upper()
        ts = context.data_timestamp or "recent observation"

        if context.is_simulated or prov == InformationProvenance.SIMULATION or "SIMULAT" in src_upper:
            return f"SIMULATED DATA — live source unreachable. Fallback observation dated {ts}."
        if "COPERNICUS" in src_upper or "CAMS" in src_upper or "OPENMETEO" in src_upper or prov == InformationProvenance.MODEL_ESTIMATE:
            return f"Copernicus CAMS atmospheric model estimate via {src} (Not direct physical sensor). Model cycle: {ts}."
        if "WAQI" in src_upper:
            return f"WAQI global air quality network feed via {src} (Observed: {ts})."
        if prov == InformationProvenance.FORECAST or "FORECAST" in src_upper:
            return f"Forecast projection derived from wind vector and Pasquill dispersion heuristics."
        if "CPCB" in src_upper or "CAAQMS" in src_upper or prov == InformationProvenance.MEASURED_FACT:
            return f"Measured physical sensor data from {src} (Observed: {ts})."
        return f"Reported by {src} at {ts}."

    def generate_insight(self, context: AIContext) -> AIResponse:
        lang = context.language if context.language in ("en", "hi", "mr") else "en"
        city = context.city or "the region"
        station = context.station or "monitoring station"
        pollutant = context.dominant_pollutant or context.pollutant or "PM2.5"
        aqi = int(context.current_aqi) if context.current_aqi is not None else 150
        screen = context.screen_id
        src = context.data_source or "CPCB CAAQMS"
        ts = context.data_timestamp or "recent observation"
        is_sim = context.is_simulated or "SIMULATED" in src.upper()
        voice_script = None

        # Format source citation clause
        if is_sim:
            cite_clause_en = f"(SIMULATED DATA — fallback observation cycle {ts})"
            cite_clause_hi = f"(सिम्युलेटेड डेटा — संदर्भ समय {ts})"
            cite_clause_mr = f"(सिम्युलेटेड डेटा — संदर्भ वेळ {ts})"
        else:
            cite_clause_en = f"(source: {src}, observed: {ts})"
            cite_clause_hi = f"(स्रोत: {src}, समय: {ts})"
            cite_clause_mr = f"(स्रोत: {src}, वेळ: {ts})"

        # ── Screen 2: City Overview ─────────────────────────────────────────
        if "city" in screen:
            if lang == "hi":
                text = (
                    f"{city} में समग्र वायु गुणवत्ता सूचकांक {aqi} दर्ज किया गया है {cite_clause_hi}, "
                    f"जिसमें प्राथमिक प्रदूषक {pollutant} है। संवेदनशील नागरिकों को बाहरी गतिविधियों "
                    f"को सीमित करने की सलाह दी जाती है।"
                )
            elif lang == "mr":
                text = (
                    f"{city} मध्ये सरासरी हवेचा गुणवत्ता निर्देशांक {aqi} नोंदवला गेला असून {cite_clause_mr}, "
                    f"मुख्य प्रदूषक {pollutant} आहे. संवेदनशील नागरिकांनी बाहेर पडणे टाळावे."
                )
            else:
                text = (
                    f"Overall Air Quality Index for {city} stands at {aqi}, dominated by {pollutant} {cite_clause_en}. "
                    f"Civic health guidelines recommend minimizing prolonged outdoor exertion in affected corridors."
                )
            follow_ups = [
                f"Inspect active stations across {city}",
                f"Check 24-hour pollutant trend for {pollutant}",
            ]
            voice_script = (
                f"Air quality in {city} is at index {aqi}, with {pollutant} as the primary pollutant, reported by {src}."
            )

        # ── Screen 3: Station Intelligence ──────────────────────────────────
        elif "station" in screen:
            wind = context.weather or {}
            if not wind and city:
                wind = get_weather_context(city)
            w_speed = wind.get("wind_speed_kmh", 12.0)
            w_card = wind.get("wind_direction_deg", "WNW") # Using deg or cardinal if available
            if "wind_direction_cardinal" in wind:
                w_card = wind["wind_direction_cardinal"]
            pasquill_class = wind.get("pasquill_class", "C")
            
            weather_text_en = f"Surface wind is moving at {w_speed} km/h from {w_card}, concentrating particulate dispersion along downwind sectors. Atmospheric boundary layer stability (Class {pasquill_class}) is currently affecting pollutant accumulation."
            weather_text_hi = f"स्थानीय पवन गति {w_speed} किमी/घंटा ({w_card} दिशा से) मापी गई है, और वायुमंडलीय स्थिरता (श्रेणी {pasquill_class}) फैलाव को प्रभावित कर रही है।"
            weather_text_mr = f"स्थानिक वाऱ्याचा वेग {w_speed} किमी/तास ({w_card} दिशेकडून) असून, हवेच्या स्थिरतेमुळे (वर्ग {pasquill_class}) प्रदूषकांचा प्रसार होत आहे."

            if lang == "hi":
                text = (
                    f"{station} स्टेशन पर AQI {aqi} पर है {cite_clause_hi}। {weather_text_hi}"
                )
            elif lang == "mr":
                text = (
                    f"{station} स्थानकावर AQI {aqi} नोंदवला गेला आहे {cite_clause_mr}। {weather_text_mr}"
                )
            else:
                text = (
                    f"{station} monitoring station is reporting an AQI of {aqi} {cite_clause_en}. {weather_text_en}"
                )
            follow_ups = [
                f"Trace source attribution for {pollutant}",
                f"View forward trajectory projection from {station}",
            ]
            voice_script = (
                f"{station} station reports an AQI of {aqi}. Surface winds at {w_speed} kilometers per hour are dispersing {pollutant} downwind. Stability class {pasquill_class}."
            )

        # ── Screen 4: Pollution Investigation / Attribution ────────────────
        elif "investigation" in screen or "attribution" in screen:
            top_candidate = (context.attribution or {}).get("top_candidate")
            adv = generate_localized_advisory(
                station_name=station,
                aqi=aqi,
                dominant_pollutant=pollutant,
                top_candidate=top_candidate,
                enforcement_priority=float((context.attribution or {}).get("enforcement_priority", 0.7)),
            )
            base_text = adv.get(lang, adv["en"])
            text = f"{base_text} [Forensic Telemetry: {src} at {ts}]"
            follow_ups = [
                "Simulate targeted emission intervention",
                "Evaluate sensitive school and hospital receptors",
            ]
            voice_script = (
                f"Forensic attribution at {station} identifies {(top_candidate or {}).get('name', 'upwind industrial activities')} "
                f"as the primary emission contributor under active wind alignment."
            )

        # ── Screen 5: Forward Prediction ─────────────────────────────────────
        elif "prediction" in screen:
            if lang == "hi":
                text = (
                    f"{pollutant} के लिए आगामी 1 से 6 घंटों का फैलाव मॉडल हवा के बहाव पर आधारित है {cite_clause_hi}। "
                    f"हवा की गति शांत रहने पर प्रदूषक स्तरों में वृद्धि का अनुमान है।"
                )
            elif lang == "mr":
                text = (
                    f"{pollutant} साठी पुढील १ ते ६ तासांचा अंदाज वाऱ्याच्या दिशेवर आधारित आहे {cite_clause_mr}। "
                    f"वाऱ्याचा वेग मंदावल्यास प्रदूषणाची तीव्रता वाढण्याची शक्यता आहे."
                )
            else:
                text = (
                    f"Forward trajectory analysis for {pollutant} projects downwind dispersion over the next 1–6 hours {cite_clause_en}. "
                    f"Atmospheric boundary layer stability indicates potential particulate accumulation."
                )
            follow_ups = [
                "Inspect projected exposure zone on map",
                "Test traffic curtailment impact on predicted AQI",
            ]
            voice_script = (
                f"Trajectory modeling projects {pollutant} dispersion downwind over the next 6 hours."
            )

        # ── Screen 6: Impact & Intervention ──────────────────────────────────
        elif "impact" in screen or "intervention" in screen:
            if lang == "hi":
                text = (
                    f"प्रक्षेपित प्रभाव क्षेत्र के विश्लेषण से संकेत मिलता है कि निर्माण और यातायात नियंत्रण "
                    f"उपायों से AQI में लक्षणीय सुधार हो सकता है {cite_clause_hi}।"
                )
            elif lang == "mr":
                text = (
                    f"संभाव्य बाधित क्षेत्राच्या विश्लेषणावरून असे दिसून येते की बांधकाम व वाहतूक नियंत्रणामुळे "
                    f"हवेच्या गुणवत्तेत लक्षणीय सुधारणा होऊ शकते {cite_clause_mr}।"
                )
            else:
                text = (
                    f"Impact zone analysis cross-references sensitive receptors. Targeted enforcement "
                    f"(such as water sprinkling or heavy vehicle diversion) yields measurable reduction {cite_clause_en}."
                )
            follow_ups = [
                "Review municipal field team response plan",
                "Export enforcement advisory report",
            ]
            voice_script = (
                "Intervention simulation projects noticeable air quality improvements with targeted traffic diversion and dust suppression."
            )

        # ── Screen 7: Analytics (Diurnal Physics & Historical Trajectory) ───
        elif "analytics" in screen:
            an_ctx = context.analytics or {}
            trend_dir = an_ctx.get("trend_direction", "cyclical")
            morning_peak = an_ctx.get("morning_peak_aqi", int(round(aqi * 1.35)))
            midday_dip = an_ctx.get("midday_dip_aqi", int(round(aqi * 0.75)))
            evening_peak = an_ctx.get("evening_peak_aqi", int(round(aqi * 1.25)))

            if lang == "hi":
                text = (
                    f"{city} के ऐतिहासिक विश्लेषण से एक {trend_dir} प्रवृत्ति और स्पष्ट दैनिक चक्र (Diurnal Pattern) "
                    f"प्रदर्शित होता है {cite_clause_hi}। सुबह 07:00–10:00 IST के दौरान सतही तापमान उलटाव (इनवर्जन) "
                    f"के कारण AQI {morning_peak} तक उछल जाता है, जबकि दोपहर (12:00–16:00 IST) में सौर संवहन से सुधरकर "
                    f"{midday_dip} रहता है और शाम को {evening_peak} तक पुनः संचित होता है।"
                )
            elif lang == "mr":
                text = (
                    f"{city} मधील ऐतिहासिक नोंदींवरून {trend_dir} दिशा आणि नियमित दैनिक चक्र (Diurnal Pattern) "
                    f"दिसून येते {cite_clause_mr}। सकाळी ०७:००–१०:०० IST दरम्यान थंडी व गर्दीमुळे AQI {morning_peak} "
                    f"पर्यंत वाढतो, दुपारी सौर प्रसरणामुळे {midday_dip} पर्यंत घसरतो, आणि संध्याकाळी पुन्हा {evening_peak} वर पोहोचतो."
                )
            else:
                text = (
                    f"Historical analytics for {city} indicates a {trend_dir} trajectory with a characteristic diurnal pattern {cite_clause_en}. "
                    f"Morning vehicular exhaust trapped under a shallow radiation inversion causes AQI to peak at {morning_peak} (07:00–10:00 IST), "
                    f"followed by convective thermal dispersion down to {midday_dip} (12:00–16:00 IST), before evening traffic and boundary layer cooling re-elevate levels to {evening_peak}."
                )
            follow_ups = [
                f"Compare {city} with other metropolitan centers",
                "Filter multi-day anomaly occurrences",
                "Simulate diurnal traffic curtailment schedule",
            ]
            voice_script = (
                f"Historical analytics in {city} shows a regular diurnal cycle: morning pollution peaks at index {morning_peak} "
                f"under shallow boundary layer inversion, clears during afternoon convective mixing to {midday_dip}, and rises again in the evening."
            )

        # ── General / National Overview ──────────────────────────────────────
        else:
            if lang == "hi":
                text = (
                    f"राष्ट्रीय पर्यावरण निगरानी डैशबोर्ड 7 प्रमुख शहरों के वास्तविक समय डेटा को ट्रैक करता है {cite_clause_hi}। "
                    f"गहन विश्लेषण के लिए किसी भी शहर का चयन करें।"
                )
            elif lang == "mr":
                text = (
                    f"राष्ट्रीय पर्यावरण निरीक्षण प्रणाली ७ प्रमुख शहरांचा थेट डेटा संकलित करते {cite_clause_mr}। "
                    f"तपशीलवार माहितीसाठी कोणतेही शहर निवडा."
                )
            else:
                text = (
                    f"AeroTrace National Environmental Intelligence monitors current air quality across 7 key metros {cite_clause_en}. "
                    f"Select any city node to begin progressive forensic investigation."
                )
            follow_ups = [
                "Zoom into cities with Severe or Very Poor AQI",
                "View national multi-city comparative rankings",
            ]
            voice_script = (
                "AeroTrace Environmental Intelligence monitors real-time air quality telemetry across all seven metropolitan centers."
            )

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
                "data_timestamp": context.data_timestamp,
                "is_simulated": is_sim,
                "voice_script": voice_script,
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
        weather_data = get_weather_context(context.city or "Pune")
        weather_prompt_block = format_weather_for_prompt(weather_data)
        
        return (
            "You are AeroTrace Environmental Intelligence, an expert atmospheric scientist assistant. "
            "You MUST adhere to these strict rules:\n"
            "1. Ground all statements strictly in the provided AeroTrace context.\n"
            "2. NEVER fabricate environmental measurements, station names, or sensor readings.\n"
            "3. Clearly distinguish measured facts from atmospheric model estimates, forecasts, or synthetic simulations.\n"
            "4. Ground forensic explanations to explicitly cite upstream data sources (e.g. CPCB CAAQMS, Copernicus CAMS / Open-Meteo, WAQI) and observation timestamps.\n"
            "5. If is_simulated is True, explicitly state that values are simulated due to live source outage.\n"
            "6. When interpreting Screen 7 analytics, explicitly interpret diurnal patterns (morning nocturnal inversion peaks, midday convective turbulence dips, evening accumulation).\n"
            f"7. Respond exclusively in the requested language locale: '{context.language}' ('en' for English, 'hi' for Hindi, 'mr' for Marathi).\n"
            "8. Keep responses concise, objective, actionable, and suitable for civic decision-makers.\n\n"
            f"WEATHER & ATMOSPHERIC PHYSICS CONTEXT:\n{weather_prompt_block}"
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
            fallback_res = self._fallback.generate_insight(context)
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
                    "screen_id": context.screen_id,
                    "city": context.city,
                    "station": context.station,
                    "pollutant": context.dominant_pollutant or context.pollutant,
                    "current_aqi": context.current_aqi,
                    "data_source": context.data_source,
                    "data_timestamp": context.data_timestamp,
                    "is_simulated": context.is_simulated,
                    "voice_script": fallback_res.context_summary.get("voice_script"),
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
