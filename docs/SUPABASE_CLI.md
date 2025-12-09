 Supabase CLI  Usage

 Prereqs
- Windows 11 + Docker Desktop (running)
- Git Bash or WSL2 shell
- Node 18+

 First time
```bash
npm run supa:install

Start local stack
npm run supa:start

Stop / Reset
npm run supa:stop
npm run supa:reset    wipes local DB

Link to remote and align service versions
npm run supa:link

Lint / Push migrations
npm run supa:lint
npm run supa:push

Notes

Siempre ejecuta comandos desde la raíz del repo.

Si Docker Desktop muestra proyectos fantasma, usa:

supabase stop
docker compose down --remove-orphans  true


Puertos por defecto: 54321, 54322, 8000; ajusta en supabase/config.toml.


5) **Stage changes**:
- Ensure all new files are added and executable.
- Do **not** change other files.

6) **Output** a summary of added files and the exact commands the developer should run next:
- `npm run supa:install`
- `npm run supa:start`
- (optional) `npm run supa:link`

**End of instructions.**

---

Con eso, ya puedes usar:
```bash
npm run supa:install    instala/doctor
npm run supa:start      levanta todo
npm run supa:status     URLs & puertos
npm run supa:lint       advisor/linter
npm run supa:push       sube migraciones
```
