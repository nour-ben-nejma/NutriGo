# 🥗 NutriGo

NutriGo is an AI-powered nutritional assistant agent that helps users track their daily caloric intake and get personalized nutrition advice.

##  Features

- **AI Nutritional Agent** — Powered by Groq (LLaMA 3.3 70B), specialized exclusively in nutrition, recipes, and food
- **Calorie Calculator** — Estimates calories based on a list of ingredients
- **Daily Intake Tracker** — Tracks meals and monitors daily caloric goals
- **Recipe Advice** — Suggests recipes and nutritional tips

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI |
| AI / LLM | Groq API (LLaMA 3.3 70B) |
| Frontend | Next |

##  Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- A [Groq API key](https://console.groq.com)

### Backend Setup

```bash
cd backend
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` folder:
```env
GROQ_API_KEY=your_groq_api_key_here
```

Run the backend:
```bash
uvicorn main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## 🧠 How the Agent Works

NutriGo is not a simple chatbot — it's an **AI agent** with tools:

1. **`calculer_calories`** — Called automatically when the user mentions ingredients or asks about calories
2. **`suivre_apport`** — Called when the user logs a meal, updating the daily tracker

The agent decides on its own which tool to use based on the conversation context.

## 📊 Example Usage

```
Toi: calcule les calories de poulet, riz et tomate
 Utilisation de l'outil : calculer_calories
 Résultat : {"total_estimé": "313 kcal", ...}
 NutriBot: Votre repas contient environ 313 kcal...

Toi: j'ai mangé une salade césar, 350 calories
 Utilisation de l'outil : suivre_apport
 Résultat : {"total_journalier": 350, "restant": 1650, ...}
 NutriBot: Repas enregistré ! Il vous reste 1650 kcal pour aujourd'hui.
```

## 🔒 Environment Variables

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Your Groq API key |

## 📄 License

MIT License
