from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from groq import Groq
import json
import os
import firebase_admin
from firebase_admin import credentials, firestore
import datetime
from dotenv import load_dotenv

# Charger les variables d'environnement depuis le fichier .env
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Clé API Groq chargée depuis .env
groq_key = os.environ.get("GROQ_API_KEY")
if not groq_key:
    print("⚠️ Attention : GROQ_API_KEY manquante dans le fichier .env")
client = Groq(api_key=groq_key)

# --- Firebase Initialization ---
FIREBASE_ENABLED = False
db = None
try:
    # Essayez de charger les credentials Firebase (le fichier doit être présent)
    if not firebase_admin._apps:
        if os.path.exists('serviceAccountKey.json'):
            cred = credentials.Certificate('serviceAccountKey.json')
            firebase_admin.initialize_app(cred)
            db = firestore.client()
            FIREBASE_ENABLED = True
            print("✅ Firebase activé avec succès.")
        else:
            print("⚠️ Attention : serviceAccountKey.json manquant. Mode mémoire locale activé.")
except Exception as e:
    print(f"⚠️ Erreur Firebase : {e}. Mode mémoire locale activé.")

# --- Base de données simple des calories (pour 100g) ---
CALORIES_DB = {
    "poulet": 165, "riz": 130, "pâtes": 158, "salade": 15,
    "tomate": 18, "oeuf": 155, "pain": 265, "lait": 42,
    "pomme": 52, "banane": 89, "fromage": 402, "thon": 132,
    "lentilles": 116, "yaourt": 59, "olive": 145, "avocat": 160,
    "steak": 271, "saumon": 208, "carotte": 41, "brocoli": 34
}

# --- Fallback mémoire si Firebase n'est pas configuré ---
local_sessions = {}
local_profiles = {}

def get_today_str():
    return datetime.datetime.now().strftime("%Y-%m-%d")

def get_user_data(user_id: str):
    today = get_today_str()
    
    # Récupérer l'objectif calorique (par défaut 2000 ou celui de l'onboarding)
    objectif = 2000
    if FIREBASE_ENABLED:
        profile_ref = db.collection('users').document(user_id).get()
        if profile_ref.exists:
            objectif = profile_ref.to_dict().get('calories_objectif', 2000)
    else:
        objectif = local_profiles.get(user_id, {}).get('calories_objectif', 2000)

    # Récupérer les données du jour
    if FIREBASE_ENABLED:
        doc_ref = db.collection('users').document(user_id).collection('days').document(today)
        doc = doc_ref.get()
        if doc.exists:
            data = doc.to_dict()
            return {"suivi_journalier": data.get("suivi_journalier", {"total_calories": 0, "repas": []}), "objectif": objectif}
        else:
            return {"suivi_journalier": {"total_calories": 0, "repas": []}, "objectif": objectif}
    else:
        if user_id not in local_sessions:
            local_sessions[user_id] = {}
        if today not in local_sessions[user_id]:
            local_sessions[user_id][today] = {"total_calories": 0, "repas": []}
        return {"suivi_journalier": local_sessions[user_id][today], "objectif": objectif}

def save_user_data(user_id: str, suivi: dict):
    today = get_today_str()
    if FIREBASE_ENABLED:
        doc_ref = db.collection('users').document(user_id).collection('days').document(today)
        doc_ref.set({"suivi_journalier": suivi}, merge=True)
    else:
        local_sessions[user_id][today] = suivi

def get_historique(user_id: str):
    # Historique de chat en mémoire temporaire pour ne pas surcharger la base de données de logs de discussion
    if not hasattr(get_historique, "chat_history"):
        get_historique.chat_history = {}
    
    if user_id not in get_historique.chat_history:
        get_historique.chat_history[user_id] = [
            {
                "role": "system",
                "content": """Tu es NutriBot, un agent nutritionnel intelligent.
Tu peux :
- Calculer les calories d'un repas avec l'outil calculer_calories
- Suivre l'apport calorique journalier avec l'outil suivre_apport

Si l'utilisateur indique ce qu'il a mangé, utilise tes outils pour le calculer et l'enregistrer."""
            }
        ]
    return get_historique.chat_history[user_id]

# --- Outils ---
def calculer_calories(ingredients: list) -> dict:
    total = 0
    details = {}
    for item in ingredients:
        if isinstance(item, str):
            nom = item
            grammes = 100
        else:
            nom = item.get("nom", "inconnu")
            grammes = item.get("grammes", 100)
            
        ing_lower = nom.lower()
        cal_100g = CALORIES_DB.get(ing_lower, 0)
        cal_totales = int((cal_100g / 100) * grammes)
        
        details[nom] = f"{cal_totales} kcal ({grammes}g)"
        total += cal_totales
        
    return {"total_estimé": f"{total} kcal", "détails": details}

def suivre_apport(session_id: str, repas: str, calories: int) -> dict:
    user_data = get_user_data(session_id)
    suivi = user_data["suivi_journalier"]
    objectif = user_data["objectif"]
    
    suivi["total_calories"] += calories
    suivi["repas"].append({"repas": repas, "calories": calories})
    
    save_user_data(session_id, suivi)
    
    restant = objectif - suivi["total_calories"]
    return {
        "repas_ajouté": repas,
        "calories_repas": calories,
        "total_journalier": suivi["total_calories"],
        "objectif": objectif,
        "restant": restant,
        "historique": suivi["repas"]
    }

# --- Définition des outils pour Groq ---
tools = [
    {
        "type": "function",
        "function": {
            "name": "calculer_calories",
            "description": "Calcule les calories d'un repas selon la liste d'ingrédients et leur poids en grammes",
            "parameters": {
                "type": "object",
                "properties": {
                    "ingredients": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "nom": {"type": "string", "description": "Nom de l'aliment"},
                                "grammes": {"type": "integer", "description": "Poids consommé en grammes"}
                            },
                            "required": ["nom", "grammes"]
                        }
                    }
                },
                "required": ["ingredients"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "suivre_apport",
            "description": "Ajoute un repas au suivi journalier et retourne le nouveau total",
            "parameters": {
                "type": "object",
                "properties": {
                    "repas": {"type": "string", "description": "Nom descriptif du repas"},
                    "calories": {"type": "integer", "description": "Nombre de calories du repas"}
                },
                "required": ["repas", "calories"]
            }
        }
    }
]

def executer_outil(session_id: str, nom: str, args: dict):
    if nom == "calculer_calories":
        return calculer_calories(args.get("ingredients", []))
    elif nom == "suivre_apport":
        return suivre_apport(session_id, args.get("repas", ""), args.get("calories", 0))
    return {"error": "Outil inconnu"}

# --- Modèles Pydantic pour l'API ---
class ChatRequest(BaseModel):
    message: str
    session_id: str

class ChatResponse(BaseModel):
    response: str
    suivi_journalier: dict

class ImcRequest(BaseModel):
    imc: float
    poids: float
    taille: float
    objectif_poids: Optional[str] = None

class MealItem(BaseModel):
    nom: str
    grammes: int

class LogMealRequest(BaseModel):
    items: List[MealItem]
    session_id: str

class OnboardingRequest(BaseModel):
    session_id: str
    age: int
    sexe: str
    poids: float
    taille: float
    objectif_poids: str # perte, maintien, prise

# --- Endpoints ---

@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    historique = get_historique(req.session_id)
    historique.append({"role": "user", "content": req.message})

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=historique,
            tools=tools,
            tool_choice="auto"
        )
        message = response.choices[0].message

        if message.tool_calls:
            historique.append(message)
            for tool_call in message.tool_calls:
                nom_outil = tool_call.function.name
                args = json.loads(tool_call.function.arguments)
                resultat = executer_outil(req.session_id, nom_outil, args)
                historique.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(resultat, ensure_ascii=False)
                })

            response2 = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=historique
            )
            reply = response2.choices[0].message.content
        else:
            reply = message.content

        historique.append({"role": "assistant", "content": reply})

        user_data = get_user_data(req.session_id)
        return ChatResponse(
            response=reply,
            suivi_journalier={**user_data["suivi_journalier"], "objectif": user_data["objectif"]}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/onboarding")
async def onboarding(req: OnboardingRequest):
    try:
        # L'agent calcule les calories idéales basées sur tout le profil
        prompt = f"""
        Calcule les calories journalières recommandées pour cette personne :
        - Âge : {req.age} ans
        - Sexe : {req.sexe}
        - Poids : {req.poids} kg
        - Taille : {req.taille} cm
        - Objectif : {req.objectif_poids}

        Réponds UNIQUEMENT par le nombre de calories (un nombre entier, ex: 2200). Aucun texte supplémentaire.
        """
        
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}]
        )
        
        calories_str = response.choices[0].message.content.strip().replace(" ", "").replace("kcal", "")
        
        try:
            calories_objectif = int(calories_str)
        except:
            calories_objectif = 2000 # Fallback si l'IA répond mal

        # Calcul automatique de l'IMC
        taille_m = req.taille / 100
        imc = round(req.poids / (taille_m * taille_m), 1)

        # Sauvegarde du profil
        profile_data = {
            "age": req.age,
            "sexe": req.sexe,
            "poids": req.poids,
            "taille": req.taille,
            "objectif_poids": req.objectif_poids,
            "calories_objectif": calories_objectif,
            "imc": imc
        }

        if FIREBASE_ENABLED:
            db.collection('users').document(req.session_id).set(profile_data, merge=True)
        else:
            local_profiles[req.session_id] = profile_data

        return {"calories_objectif": calories_objectif, "message": "Profil enregistré avec succès."}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/profile/{user_id}")
async def get_profile(user_id: str):
    if FIREBASE_ENABLED:
        doc = db.collection('users').document(user_id).get()
        if doc.exists:
            return {"exists": True, "profile": doc.to_dict()}
    else:
        if user_id in local_profiles:
            return {"exists": True, "profile": local_profiles[user_id]}
    return {"exists": False}


@app.post("/api/analyze_imc")
async def analyze_imc(req: ImcRequest):
    try:
        if req.imc >= 25.0 and req.objectif_poids == 'maintien':
            prompt = f"""
            Mon IMC est de {req.imc:.1f} (poids: {req.poids}kg, taille: {req.taille}m).
            J'ai sélectionné un objectif de 'maintien de mon poids actuel'.
            
            En tant que nutritionniste expert et bienveillant, explique-moi gentiment et de manière constructive qu'un objectif de maintien de poids n'est peut-être pas la meilleure option pour ma santé à long terme au vu de mon IMC de surpoids/obésité. Conseille-moi de viser plutôt une perte de poids très douce et progressive (par ex. rééquilibrage ou activité physique) plutôt que de chercher à stabiliser mon poids actuel. Fais une réponse courte de 3 à 4 phrases maximum.
            """
        else:
            prompt = f"Mon IMC est de {req.imc:.1f} (poids: {req.poids}kg, taille: {req.taille}m). Fais une analyse nutritionnelle très courte et bienveillante (3 phrases max) et donne un conseil principal."
        
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "Tu es un nutritionniste expert. Tu réponds de manière concise, bienveillante, sans markdown complexe."},
                {"role": "user", "content": prompt}
            ]
        )
        return {"conseil": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/log_meal")
async def log_meal(req: LogMealRequest):
    aliments_texte = ", ".join([f"{item.grammes}g de {item.nom}" for item in req.items])
    prompt = f"L'utilisateur vient de manger : {aliments_texte}. Calcule les calories exactes avec ton outil 'calculer_calories' puis ajoute ce repas entier au suivi avec l'outil 'suivre_apport'. Fais un petit résumé de validation à la fin."
    
    chat_req = ChatRequest(message=prompt, session_id=req.session_id)
    return await chat(chat_req)

@app.get("/api/suivi/{session_id}")
async def get_suivi(session_id: str):
    user_data = get_user_data(session_id)
    return {**user_data["suivi_journalier"], "objectif": user_data["objectif"]}
