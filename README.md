# HoteluriRo

Aplicație web pentru căutarea hotelurilor și gestionarea rezervărilor hoteliere din România.

## Funcționalități

- Catalog de hoteluri cu filtre după oraș, stele, preț, facilități și perioadă.
- Hartă interactivă cu Leaflet și OpenStreetMap.
- Pagini de hotel cu galerii foto, categorii de camere, disponibilitate și recenzii.
- Conturi de utilizator, autentificare JWT și resetarea parolei.
- Rezervări, integrare Stripe, notificări email și generare de documente PDF.
- Panou de administrare cu acces pe roluri pentru hoteluri, rezervări, utilizatori și oferte.

## Tehnologii

| Componentă | Tehnologii |
| --- | --- |
| Frontend | React 19, Vite 8, React Router, React Leaflet |
| Backend | Node.js, Express 5, mysql2 |
| Bază de date | MySQL, InnoDB |
| Integrări | Stripe, Nodemailer, PDFKit, Multer |

## Rulare locală

Sunt necesare o versiune Node.js compatibilă cu Vite 8, npm și un server MySQL pornit. Repository-ul nu include încă un script complet de inițializare a bazei; baza `licenta_booking`, cu tabelele descrise în [documentația MySQL](docs/BAZA-DE-DATE.md), trebuie pregătită separat. Scripturile istorice din `backend/migratii/` nu sunt suficiente pentru o instalare de la zero.

Instalează dependențele din rădăcina proiectului:

```sh
npm ci --prefix backend
npm ci --prefix frontend
```

La prima configurare, copiază șablonul public, apoi completează valorile în `backend/.env`. Comanda păstrează un fișier `.env` care există deja:

```sh
cp -n backend/.env.example backend/.env
```

Șablonul conține doar exemple. Completează următoarele variabile cu propriile setări:

| Variabile | Utilizare |
| --- | --- |
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexiunea MySQL |
| `JWT_SECRET` | Semnarea și verificarea tokenurilor |
| `STRIPE_SECRET_KEY` | Integrarea Stripe; folosește chei de test pentru dezvoltare |
| `EMAIL_USER`, `EMAIL_PASS` | Autentificarea serviciului email |

Configurația privată nu se publică; doar `.env.example` este inclus în Git. Valorile din șablon nu permit conectarea la servicii fără configurare. Integrarea Stripe este inițializată la pornirea backendului; plățile și emailurile necesită configurarea serviciilor respective.

Pornește backendul și frontendul în terminale separate:

```sh
npm start --prefix backend
```

```sh
npm run dev --prefix frontend
```

Aplicația este disponibilă la **http://localhost:5173**. API-ul rulează pe **http://127.0.0.1:5001**. În dezvoltare, Vite redirecționează cererile `/api` și `/uploads` către backend.

## Administrare locală

Pentru crearea unui administrator, rulează într-un terminal interactiv:

```sh
node backend/creeaza_admin.js
```

Utilitarul cere numele, emailul, unul dintre rolurile `super_admin`, `admin_hotel`, `admin_booking` sau `admin_marketing` și parola, introdusă fără afișare. Nu există conturi sau parole prestabilite. După confirmare, creează un singur cont în baza configurată prin `backend/.env`; conturile existente nu sunt modificate. Parola este stocată ca hash bcrypt.

Scripturile din `backend/migratii/` modifică schema sau datele și nu trebuie rulate automat la pornire. Necesită verificare și backup înainte de utilizare.

## Verificări

```sh
npm test --prefix backend
TEST_MYSQL=1 npm test --prefix backend
npm run build --prefix frontend
npm run lint --prefix frontend
```

Testele backend obișnuite folosesc o conexiune simulată. `TEST_MYSQL=1` activează suplimentar testele SQL cu date sintetice definite în interogări, fără modificarea tabelelor existente. Necesită MySQL local configurat; testele HTTP folosesc porturi locale temporare.

Unele teste documentează explicit defecte existente ale disponibilității și rutării. Trecerea lor confirmă comportamentul actual, nu corectarea acelor defecte. Buildul frontend a fost verificat; lintul are erori existente. Fluxurile complete de plată și email nu sunt acoperite de aceste teste.

## Documentație tehnică

- [Arhitectură, structură și limitări](docs/STRUCTURA.md)
- [Modelul bazei de date](docs/BAZA-DE-DATE.md)
