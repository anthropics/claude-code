# KuntotarkastusAI 🏗️

> Tekoälypohjainen kuntotarkastusjärjestelmä ammattilaisille

Täysin toimiva web-sovellus rakennusten kuntotarkastusraporttien laadintaan tekoälyavusteisesti. Suunniteltu suomalaisille rakennustarkastajille.

---

## Ominaisuudet

### Tekoälyominaisuudet (Claude Opus 4.6)
- **Automaattinen puhtaaksikirjoitus** — Muuttaa puhutut tai lyhyet muistiinpanot ammattimaiseksi suomen kieleksi
- **Teoriatiedon lisäys** — Lisää automaattisesti havaintoon rakennusteknisen taustan ja rakennusmääräysviittaukset (RT-kortit, RakMK)
- **Automaattiset kuvatekstit** — Claude Vision tunnistaa kuvasta vaurion/rakenteen ja kirjoittaa kuvatekstin
- **Havaintoyhteenveto** — Tekoäly luo taulukon havainnoista kiireellisyyden mukaan järjestettynä
- **Loppuyhteenveto** — Ammattimainen kuntoluokituksen sisältävä loppuyhteenveto

### Tiedonkeruu kentällä
- **Sanelu** — Web Speech API, suomen kielen tuki (fi-FI)
- **Kameraintegraatio** — Kuvien ottaminen suoraan sovelluksella kategorian kohdalla
- **Automaattinen sijoittelu** — Kuvat sijoittuvat oikean kategorian alle automaattisesti

### Raportointi
- **14 tarkastuskategoriaa** — Kattaa kaikki rakenneosat perustuksista piha-alueeseen
- **Kiireellisyysluokitus** — Välitön / 1–2v / 3–5v / Seurattava / Ei toimenpiteitä
- **PDF-vienti** — Ammattimainen PDF-raportti kuvilla ja teoriaosuuksilla
- **Automaattinen tallennus** — Kaikki muutokset tallentuvat selaimen localStorageen

---

## Arkkitehtuuri

```
building-inspection-app/
├── backend/          # Express.js + TypeScript API
│   └── src/
│       ├── server.ts
│       ├── routes/ai.ts
│       └── services/claudeService.ts
└── frontend/         # React + TypeScript + Tailwind CSS
    └── src/
        ├── components/
        │   ├── Dashboard/     # Raporttilistaus
        │   ├── Inspection/    # Sanelu, kamera, havaintokortit
        │   ├── Report/        # Lomakkeet, yhteenvedot
        │   ├── Layout/        # Navigaatio
        │   └── UI/            # Yhteiset komponentit
        ├── pages/             # Sivukomponentit
        ├── hooks/             # useVoiceRecorder, useReport
        ├── services/          # API-kutsut, localStorage
        ├── types/             # TypeScript-tyypit
        └── utils/             # PDF-generaattori
```

**Tech stack:**
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Express.js + TypeScript
- **AI:** Claude Opus 4.6 (Anthropic SDK) — adaptive thinking + streaming
- **Speech:** Web Speech API (browser-native, fi-FI)
- **PDF:** jsPDF
- **Storage:** localStorage (no database needed)

---

## Asennus ja käynnistys

### Esiehdot
- Node.js 18+
- Anthropic API-avain ([console.anthropic.com](https://console.anthropic.com/))

### 1. Kloonaa ja asenna

```bash
cd building-inspection-app

# Asenna riippuvuudet
npm run install:all
```

### 2. Konfiguroi ympäristö

```bash
# Kopioi esimerkki
cp .env.example backend/.env

# Muokkaa API-avain
nano backend/.env
# Aseta: ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Käynnistä kehityspalvelin

```bash
# Käynnistää sekä backendin (portti 3001) että frontendin (portti 5173)
npm run dev
```

Avaa selain osoitteeseen [http://localhost:5173](http://localhost:5173)

---

## API-endpointit

| Method | Endpoint | Kuvaus |
|--------|----------|--------|
| POST | `/api/ai/transcribe` | Puhtaaksikirjoitus (raakahavainto → ammattimainen teksti) |
| POST | `/api/ai/add-theory` | Lisää tekninen teoria havaintoon |
| POST | `/api/ai/photo-caption` | Generoi kuvateksti (Claude Vision) |
| POST | `/api/ai/findings-summary` | Luo havaintotaulukko |
| POST | `/api/ai/final-summary` | Luo loppuyhteenveto |
| POST | `/api/ai/process-observation-stream` | Streamattu havaintojen käsittely (SSE) |

---

## Käyttöohjeet

1. **Luo uusi tarkastus** kojelaudalta
2. **Täytä kohdetiedot** — osoite, tarkastuspäivä, tilaajan tiedot
3. **Kirjaa havainnot** — kirjoita tai diktoi jokaisen kategorian kohdalla
4. **Lisää valokuvia** — kamera tai tiedostosta, AI generoi kuvatekstin
5. **Käsittele tekoälyllä** — "Käsittele tekoälyllä" -nappi professionalisation + teoriaviittaukset
6. **Luo yhteenvedot** — Yhteenveto & AI -välilehdessä
7. **Vie PDF** — ammattimainen raportti yhdellä klikkauksella

---

## Tuetut tarkastuskategoriat

1. Perustukset ja maanvastainen rakenne
2. Alapohja
3. Ulkoseinät ja julkisivu
4. Ikkunat ja ulko-ovet
5. Vesikatto ja yläpohja
6. Märkätilat
7. Keittiö
8. Muut sisätilat
9. Lämmitysjärjestelmä
10. Vesi- ja viemärijärjestelmä
11. Sähköjärjestelmä
12. Ilmanvaihto
13. Piha ja ympäristö

---

## Tuotantokäyttöönotto

```bash
# Build
npm run build

# Backend (esim. Railway, Render, Fly.io)
# Aseta ympäristömuuttuja: ANTHROPIC_API_KEY

# Frontend (esim. Vercel, Netlify)
# Rakennekansio: frontend/dist
# Aseta API-proxy tai erillinen backend URL
```

---

## Lisenssi

MIT — Vapaa käyttää ja muokata
