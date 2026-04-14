# 🚘 FleetManager — Guide de déploiement

## Étape 1 — Installer Node.js
👉 Allez sur https://nodejs.org et cliquez sur le bouton vert **LTS**
Installez-le normalement (suivez l'assistant).

## Étape 2 — Créer un compte Vercel
👉 Allez sur https://vercel.com → Sign Up → avec Google (le plus simple)

## Étape 3 — Déployer l'application

### Option A : Via l'interface Vercel (sans terminal)
1. Allez sur https://vercel.com/new
2. Cliquez sur **"Browse"** ou glissez ce dossier `fleetmanager`
3. Vercel détecte automatiquement que c'est un projet Vite
4. Cliquez **Deploy** → attendez 1 minute
5. Votre URL est prête ! Ex: https://fleetmanager-xxx.vercel.app

### Option B : Via le terminal
Ouvrez un terminal dans ce dossier et tapez :
```
npm install
npm run build
npx vercel --prod
```

## Étape 4 — Raccourci sur le bureau
1. Ouvrez Chrome et allez sur votre URL Vercel
2. Cliquez les 3 points ⋮ → "Enregistrer et partager" → "Créer un raccourci"
3. Cochez **"Ouvrir dans une fenêtre"** → Créer
✅ L'icône FleetManager apparaît sur votre bureau !

## Étape 5 — Sur téléphone/tablette
Ouvrez l'URL dans Safari (iPhone) ou Chrome (Android)
→ "Ajouter à l'écran d'accueil" pour une icône sur votre téléphone
