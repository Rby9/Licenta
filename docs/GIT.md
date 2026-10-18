# Git și GitHub

Continuăm repository-ul existent: https://github.com/Rby9/Licenta. Nu este necesar un proiect nou și nu rescriem istoricul vechi.

## Istoricul găsit

| Commit | Data în Git | Ce reprezintă |
| --- | --- | --- |
| `0af7f9f` | 2026-06-18 | `initial commit licenta`: prima versiune încărcată |
| `ac95eb7` | 2026-06-18 | Eliminarea setărilor locale Claude din tracking și actualizarea `.gitignore` |
| `0d266f5` | 2026-08-01 | Actualizarea README-ului proiectului |
| `f5a0653` | 2026-10-19 | `chore: backup checkpoint - functional local Mac setup` |

Commitul checkpoint este primul din această etapă de lucru, nu primul din istoria proiectului. Include reparațiile locale pentru porturi, API și hartă. Nu este un backup al bazei MySQL sau al fișierului `.env`.

Copia locală nu avea `.git`. Metadatele au fost recuperate din repository-ul existent, păstrând fișierele locale și toate commiturile vechi.

## Cum lucrăm de acum

Un commit reprezintă o schimbare coerentă și verificată. De exemplu:

- `docs: explain project structure and database`
- `refactor: extract hotel routes without changing behavior`
- `fix: count occupied rooms once per interval`
- `style: align hotel card spacing`
- `feat: add availability assistant`

Nu amestecăm într-un singur commit schimbări de DB, design și logică de rezervare. Facem push după o etapă verificată, nu după fiecare salvare de fișier.

Pentru o funcționalitate nouă, o ramură separată păstrează versiunea stabilă mai ușor de urmărit:

```sh
git switch -c refactor/hoteluri
```

Înainte de commit:

```sh
git status
git diff
```

Adăugăm explicit fișierele schimbate cu `git add`, inspectăm `git diff --cached`, apoi `git commit -m "mesaj clar"`. Un commit este local până la `git push`.

Pentru a vedea istoricul:

```sh
git log --oneline --graph --decorate -12
```

Nu folosi `push --force` sau resetări pentru a face istoricul „mai frumos”. Commiturile inițiale sunt utile chiar dacă proiectul a fost încărcat târziu.

## Ce nu urcăm

`.env`, `node_modules`, `dist` și logurile sunt ignorate. Dumpurile MySQL cu utilizatori, parole hash, tokenuri sau rezervări reale nu se publică. Scripturile auxiliare existente conțin configurație hardcodată și trebuie curățate într-o etapă separată; verificarea acestei sesiuni nu este un audit complet de secrete al întregului istoric.

Vizibilitatea repository-ului nu a fost modificată. Accesul pentru verificare a funcționat fără această schimbare.
