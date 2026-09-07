# KuntotarkastusAI - Expo React Native

Expo Go -yhteensopiva mobiilisovellus kuntotarkastajille.

## Pikaohje

```bash
cd mobile
npm install
npx expo start
```

Skannaa QR-koodi **Expo Go** -sovelluksella (Android / iOS).

## Backend-yhteys

Backend pitää olla käynnissä portissa 3001:

```bash
cd ../backend
npm run dev
```

### API-osoitteen konfigurointi

Muokkaa `src/services/api.ts` tiedostoa:

- **Android-emulaattori**: `http://10.0.2.2:3001/api/ai`
- **iOS-simulaattori**: `http://localhost:3001/api/ai`
- **Fyysinen laite (sama verkko)**: `http://<tietokoneen-IP>:3001/api/ai`

## Testitunnukset

- Tarkastaja: `tarkastaja@kuntotarkastus.fi` / `tarkastaja123`
- Admin: `admin@kuntotarkastus.fi` / `admin123`

## Ominaisuudet

- Kirjautuminen
- Raporttien luonti, muokkaus, poisto, kopiointi
- Kohdetiedot (30+ kenttää)
- 13 tarkastuskategoriaa
- AI-pohjainen havaintojen muotoilu
- Kamerakuvaus + AI-kuvatekstit
- Yhteenveto + kattavuustarkistus
