import logging
from typing import Any, Dict

from app.weather_context import get_weather_context

log = logging.getLogger("prediction_intelligence")

def generate_prediction_insight(city_name: str, lang: str = "en") -> Dict[str, Any]:
    weather = get_weather_context(city_name)
    pasquill_class = weather.get("pasquill_class", "D")
    wind_speed = weather.get("wind_speed_kmh", 0)
    
    # Grounded template logic for predictions based on pasquill class
    if pasquill_class in ("E", "F"):
        en_text = f"Highly stable atmospheric boundary layer (Class {pasquill_class}) with low wind ({wind_speed} km/h) suggests severe pollutant accumulation over the next 6 hours."
        hi_text = f"अत्यधिक स्थिर वायुमंडलीय सीमा (श्रेणी {pasquill_class}) और कम हवा ({wind_speed} किमी/घंटा) के कारण अगले 6 घंटों में प्रदूषक स्तर में भारी वृद्धि की संभावना है।"
        mr_text = f"अत्यंत स्थिर वातावरणीय सीमा (वर्ग {pasquill_class}) आणि कमी वाऱ्यामुळे ({wind_speed} किमी/तास) पुढील ६ तासांत प्रदूषणाची पातळी वेगाने वाढण्याची शक्यता आहे."
    elif pasquill_class in ("A", "B", "C"):
        en_text = f"Unstable atmospheric boundary layer (Class {pasquill_class}) indicates active vertical mixing, projecting improved air quality and rapid pollutant dispersion over the next 6 hours."
        hi_text = f"अस्थिर वायुमंडलीय सीमा (श्रेणी {pasquill_class}) सक्रिय ऊर्ध्वाधर मिश्रण का संकेत देती है, जिससे अगले 6 घंटों में वायु गुणवत्ता में सुधार और प्रदूषकों के तेजी से फैलाव का अनुमान है।"
        mr_text = f"अस्थिर वातावरणीय सीमा (वर्ग {pasquill_class}) सक्रिय उभ्या मिश्रणाचे संकेत देते, ज्यामुळे पुढील ६ तासांत हवेची गुणवत्ता सुधारेल आणि प्रदूषकांचा वेगाने प्रसार होईल."
    else:
        en_text = f"Neutral atmospheric conditions (Class {pasquill_class}) project steady pollution transport downwind following current surface wind vectors ({wind_speed} km/h)."
        hi_text = f"तटस्थ वायुमंडलीय स्थितियां (श्रेणी {pasquill_class}) वर्तमान सतही हवा की गति ({wind_speed} किमी/घंटा) के अनुसार प्रदूषण के निरंतर फैलाव का अनुमान लगाती हैं।"
        mr_text = f"तटस्थ वातावरणीय स्थितीमुळे (वर्ग {pasquill_class}) सध्याच्या वाऱ्याच्या वेगाप्रमाणे ({wind_speed} किमी/तास) प्रदूषकांचा प्रसार वेगाने होण्याची शक्यता आहे."

    texts = {"en": en_text, "hi": hi_text, "mr": mr_text}
    
    return {
        "city": city_name,
        "prediction_text": texts.get(lang, en_text),
        "voice_script": en_text, # Usually English for standard TTS testing unless overridden
        "pasquill_class": pasquill_class,
        "wind_speed_kmh": wind_speed,
        "language": lang
    }
