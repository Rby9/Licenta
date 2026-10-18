# HoteluriRo

Aplicație de rezervări hoteliere pentru proiectul de licență al lui Robert-Andrei Balaban, Universitatea „Dunărea de Jos” din Galați.

Interfața este construită cu React și Vite, serverul cu Node.js și Express, iar datele sunt păstrate în MySQL.

## Pornire pe Mac

MySQL trebuie să fie pornit, iar baza `licenta_booking` să fie importată. Configurația privată se află în `backend/.env` și nu se urcă pe GitHub.

Din directorul proiectului, deschide două terminale:

**Terminalul 1 — backend:**

```sh
npm start --prefix backend
```

**Terminalul 2 — frontend:**

```sh
npm run dev --prefix frontend
```

Deschide **http://localhost:5173**. Lasă ambele terminale pornite. Pentru oprire folosește `Ctrl+C` în terminalul corespunzător.

Backendul folosește `127.0.0.1:5001`; portul 5000 rămâne disponibil pentru AirPlay. Vite trimite cererile `/api` și imaginile `/uploads` către backend.

Dacă apare „Port 5173 is already in use”, există deja un frontend pornit. Folosește instanța existentă sau oprește-o din terminalul ei înainte să pornești alta.

La o instalare nouă, instalează întâi bibliotecile:

```sh
npm ci --prefix backend
npm ci --prefix frontend
```

Aceste comenzi nu creează baza MySQL și nici fișierul `.env`. Copia bazei și configurația privată se transferă separat, nu prin GitHub.

## Unde găsești lucrurile

| Loc | Ce conține |
| --- | --- |
| `frontend/src/pages/` | Paginile aplicației |
| `frontend/src/components/` | Elemente reutilizabile: navigare, subsol, notificări |
| `frontend/src/assets/` | Imagini incluse în interfață |
| `frontend/src/api.js` | Configurația comună a adresei API |
| `frontend/vite.config.js` | Serverul de dezvoltare și proxy-ul API |
| `backend/server.js` | Rutele API și logica serverului, încă într-un singur fișier |
| `backend/migratii/` | Scripturi istorice pentru modificarea bazei; nu se rulează la pornire |
| `backend/fonts/` | Fișiere de font; vezi observația despre PDF în documentație |
| `backend/uploads/` | Imagini încărcate pentru hoteluri |
| `docs/` | Explicații despre structură, MySQL și Git |

`node_modules/` conține biblioteci instalate de npm. Nu îl edităm și nu îl urcăm pe GitHub. `package.json` descrie bibliotecile și comenzile, iar `package-lock.json` fixează versiunile instalate; ambele se păstrează în Git.

`frontend/dist/` este rezultatul compilării, regenerat cu `npm run build --prefix frontend`. Nu este sursa aplicației și este ignorat de Git.

## Documentație

- [Structura actuală și reorganizarea propusă](docs/STRUCTURA.md)
- [Baza MySQL: tabele, relații și verificări](docs/BAZA-DE-DATE.md)
- [GitHub: istoricul existent și commituri clare](docs/GIT.md)

## Verificări rapide

```sh
curl http://127.0.0.1:5001/api/orase
curl http://localhost:5173/api/orase
npm run build --prefix frontend
npm run lint --prefix frontend
```

Buildul trece. Lintul are probleme existente documentate în `docs/STRUCTURA.md`; acestea nu sunt încă toate rezolvate.
