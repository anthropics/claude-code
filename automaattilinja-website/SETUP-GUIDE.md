# AutomaattiLinja - Käyttöönotto & Latenssin optimointi

## Latenssin optimointi (KRIITTINEN)

Pitkät vastausajat tappavat demot. Tässä on optimointiopas.

### Jos käytät Vapia (vapi.ai)

#### 1. Turn Detection -asetukset (suurin vaikutus)

```json
{
  "model": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "maxTokens": 150
  },
  "voice": {
    "provider": "11labs",
    "voiceId": "SUOMENKIELINEN_ÄÄNI_ID"
  },
  "silenceTimeoutSeconds": 30,
  "maxDurationSeconds": 600,
  "backgroundSound": "off",
  "startSpeakingPlan": {
    "waitSeconds": 0.4,
    "smartEndpointingEnabled": true,
    "transcriptionEndpointingPlan": {
      "onPunctuationSeconds": 0.1,
      "onNoPunctuationSeconds": 0.8,
      "onNumberSeconds": 0.4
    }
  },
  "stopSpeakingPlan": {
    "numWords": 2,
    "voiceSeconds": 0.2,
    "backoffSeconds": 1
  }
}
```

**Avainkohdat:**
- `waitSeconds: 0.4` - Älä odota liian kauan (oletus on 1.6s!)
- `smartEndpointingEnabled: true` - AI päättää itse milloin käyttäjä on puhunut loppuun
- `onPunctuationSeconds: 0.1` - Reagoi nopeasti lauseen loppuun
- `onNoPunctuationSeconds: 0.8` - Maksimi odotusaika ilman välimerkkiä

#### 2. Nopea LLM-malli

Käytä GPT-4o-mini tai Claude Haiku - EI GPT-4o tai Claude Sonnettia/Opusta. Suuret mallit lisäävät 1-3 sekuntia viivettä.

#### 3. System Prompt -optimointi

```
Pidä vastauksesi lyhyinä (1-2 lausetta). Vastaa suomeksi. Älä käytä listoja tai pitkiä selityksiä puheessa. Ole ystävällinen ja ammattimainen.
```

Lyhyemmät vastaukset = nopeampi TTS = nopeampi kokemus.

#### 4. STT (puheentunnistus) Provider

```json
{
  "transcriber": {
    "provider": "deepgram",
    "model": "nova-2",
    "language": "fi"
  }
}
```

Deepgram Nova-2 on nopein ja tarkin suomen tunnistaja.

#### 5. TTS (puhesynteesi) Provider

```json
{
  "voice": {
    "provider": "11labs",
    "voiceId": "YOUR_FINNISH_VOICE_ID",
    "stability": 0.5,
    "similarityBoost": 0.75,
    "speed": 1.0
  }
}
```

ElevenLabs tuottaa luonnollisinta suomea. Vaihtoehtoisesti Azure TTS tukee suomea natiivisti.

---

### Jos käytät Retell AI:ta (retellai.com)

Retell on oletuksena nopeampi (~600ms). Konfigurointi:

```json
{
  "llm_websocket_url": "YOUR_LLM_URL",
  "voice_id": "FINNISH_VOICE_ID",
  "language": "fi-FI",
  "ambient_sound": null,
  "responsiveness": 0.8,
  "interruption_sensitivity": 0.6,
  "enable_backchannel": true,
  "backchannel_frequency": 0.5,
  "backchannel_words": ["joo", "aivan", "selvä", "niin"]
}
```

**Avainkohdat:**
- `responsiveness: 0.8` - Korkea arvo = nopeampi vastaus (0-1 skaala)
- `interruption_sensitivity: 0.6` - Sallii käyttäjän keskeyttää AI:n
- `enable_backchannel: true` - AI sanoo "joo", "selvä" täytesanoina luonnollisuuden lisäämiseksi

---

## Sivuston julkaisu

### Vaihtoehto 1: Vercel (suositeltu)

```bash
npm install -g vercel
cd automaattilinja-website
vercel
```

### Vaihtoehto 2: Netlify

```bash
npm install -g netlify-cli
cd automaattilinja-website
netlify deploy --prod
```

### Vaihtoehto 3: Perinteinen hosting

Kopioi kaikki tiedostot FTP:llä palvelimelle.

---

## Demo-puhelinnumeroiden konfigurointi

### Vapi

1. Luo tili: https://vapi.ai
2. Luo Assistant joka toimiala-demolle
3. Osta puhelinnumero (Suomi: +358)
4. Yhdistä numero assistanttiin
5. Päivitä `index.html`:n `tel:+358XXXXXXXXX` linkit oikeilla numeroilla

### Retell AI

1. Luo tili: https://www.retellai.com
2. Luo Agent per toimiala
3. Osta tai tuo oma numero
4. Konfiguroi agent
5. Päivitä linkit

---

## Tarkistuslista ennen pilottitarjouksia

- [ ] Demopuhelinnumerot toimivat (soita itse)
- [ ] AI vastaa alle 1 sekunnissa
- [ ] Suomenkielinen puhe kuulostaa luonnolliselta
- [ ] Sivusto latautuu nopeasti (< 3s)
- [ ] Mobiiliversio toimii moitteettomasti
- [ ] SSL-sertifikaatti asennettuna (HTTPS)
- [ ] Yhteystiedot päivitetty (puhelin, sähköposti)
- [ ] GDPR-tietosuojaseloste sivustolla
- [ ] Google Analytics / tilastointi käyttöön
- [ ] Puheluraportointi sähköpostiin testattuna
- [ ] Varajärjestelmä: puhelu siirtyy ihmiselle tarvittaessa

---

## Hinta-arvio pilotille

| Komponentti | Kustannus/kk |
|---|---|
| Voice AI alusta (Vapi/Retell) | ~20-50€ (100 puhelua) |
| Puhelinnumerot (3 kpl) | ~15€ |
| LLM (GPT-4o-mini) | ~5-15€ |
| ElevenLabs TTS | ~5-22€ |
| Hosting (Vercel) | 0€ |
| **Yhteensä** | **~45-100€/kk** |

Pilottihinta asiakkaalle: 0€/kk (ensimmäinen kuukausi ilmainen).
Tuotantohinta: 149€/kk → kate ~50-100€/asiakas/kk.
