-- Resumen del día (Response.format = DAY y sus campos) y misiones.
-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "requiresPhoto" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MissionAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OFFERED',
    "swaps" INTEGER NOT NULL DEFAULT 0,
    "resolutionText" TEXT,
    "photoFilename" TEXT,
    "responseId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME,
    "closedAt" DATETIME,
    CONSTRAINT "MissionAssignment_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MissionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionAssignment_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionAssignment_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "Response" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Columnas nuevas (ADD COLUMN en vez de reconstruir las tablas).
ALTER TABLE "Response" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'HOME';
ALTER TABLE "Response" ADD COLUMN "didToday" TEXT;
ALTER TABLE "Response" ADD COLUMN "wentWhere" TEXT;
ALTER TABLE "Response" ADD COLUMN "bestPart" TEXT;
ALTER TABLE "Response" ADD COLUMN "worstPart" TEXT;
ALTER TABLE "Response" ADD COLUMN "tomorrowPlan" TEXT;
ALTER TABLE "Response" ADD COLUMN "mood" TEXT;
ALTER TABLE "User" ADD COLUMN "missionStrikes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "missionBanUntil" DATETIME;
ALTER TABLE "User" ADD COLUMN "missionOptOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "MissionAssignment_userId_date_idx" ON "MissionAssignment"("userId", "date");

-- CreateIndex
CREATE INDEX "MissionAssignment_targetId_idx" ON "MissionAssignment"("targetId");

-- CreateIndex
CREATE INDEX "MissionAssignment_status_date_idx" ON "MissionAssignment"("status", "date");

-- CreateIndex
CREATE INDEX "MissionAssignment_responseId_idx" ON "MissionAssignment"("responseId");

-- Reacciones y comentarios sobre misiones cumplidas.
CREATE TABLE "MissionReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "missionId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissionReaction_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "MissionAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionReaction_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissionReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MissionReaction_missionId_groupId_userId_emoji_key" ON "MissionReaction"("missionId", "groupId", "userId", "emoji");
ALTER TABLE "Comment" ADD COLUMN "missionId" TEXT REFERENCES "MissionAssignment" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Comment_missionId_idx" ON "Comment"("missionId");

-- El resumen del día se envía a las 12:00 (el recordatorio sale solo a las
-- 11:00) y el saludo ya no habla de "lo que estarán haciendo hoy". Solo se
-- cambia el saludo de los grupos que seguían con el de fábrica.
UPDATE "Group" SET "sendTime" = '12:00';
UPDATE "Group" SET "greetingTemplate" = 'Hola, {nombre}, esto es lo que hicieron tus amigos ayer:'
  WHERE "greetingTemplate" = 'Hola, {nombre}, esto es lo que estarán haciendo tus amigos el día de hoy:';

-- Catálogo inicial de misiones (se edita desde /admin/misiones).
INSERT INTO "Mission" ("id", "text", "requiresPhoto", "updatedAt") VALUES
  ('mision-inicial-01', 'Consigue una foto de una comida que le guste mucho a {usuario}.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-02', 'Pregúntale a {usuario} cuál fue el último sueño raro que tuvo y cuéntalo.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-03', 'Mándale a {usuario} una canción que te recuerde a esa persona y cuenta por qué la elegiste.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-04', 'Escribe un haiku (5-7-5) sobre la semana de {usuario}.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-05', 'Dibuja el animal favorito de {usuario} y comparte la foto del dibujo.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-06', 'Recomiéndale a {usuario} una película o serie corta y cuéntanos por qué esa.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-07', 'Averigua cuál es el primer recuerdo de infancia de {usuario}.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-08', 'Descubre qué superpoder elegiría {usuario} y para qué lo usaría.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-09', 'Pregúntale a {usuario} cuál es su comida para los días malos.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-10', 'Toma una foto de algo que te recuerde a {usuario}.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-11', 'Cuéntanos un recuerdo bonito que tengas con {usuario}.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-12', 'Pregúntale a {usuario} qué canción sonaría en los créditos de la película de su vida.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-13', 'Averigua a qué lugar del mundo le gustaría ir a {usuario} y por qué.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-14', 'Mándale a {usuario} un mensaje de ánimo de verdad y cuéntanos qué te contestó.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-15', 'Descubre el talento escondido de {usuario}.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-16', 'Pregúntale a {usuario} cuál era su apodo de la infancia y de dónde salió.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-17', 'Averigua qué haría {usuario} con un día libre sin ninguna obligación.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-18', 'Pregúntale a {usuario} cuál es el emoji que más usa y por qué.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-19', 'Hazle un meme a {usuario} (con cariño) y compártelo.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-20', 'Descubre cuál es el libro, serie o videojuego favorito de {usuario} de todos los tiempos.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-21', 'Pregúntale a {usuario} qué es lo más raro que ha comido.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-22', 'Averigua cuál es el peor regalo que ha recibido {usuario}.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-23', 'Pregúntale a {usuario} qué le diría a su yo de hace diez años.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-24', 'Toma una foto del cielo de hoy y dedícasela a {usuario}.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-25', 'Investiga qué canción canta {usuario} cuando nadie le escucha.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-26', 'Pregúntale a {usuario} qué es lo que más le ha hecho reír últimamente.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-27', 'Descubre la manía más rara de {usuario}.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-28', 'Prepara o compra algo de comer que le encante a {usuario} y muéstranos la foto.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-29', 'Pregúntale a {usuario} cuál ha sido la mejor decisión que ha tomado este año.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-30', 'Dile a {usuario} tres cosas que admiras de esa persona y cuéntanos qué te respondió.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-31', 'Encuentra una piedra que te recuerde a {usuario} y cuéntanos por qué.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-32', 'Encuentra un objeto que te recuerde a {usuario} y cuéntanos por qué.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-33', 'Pídele a {usuario} que te recomiende un video de YouTube, míralo y cuéntanos qué te pareció.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-34', 'Pídele a {usuario} una canción que no conozcas, escúchala completa y danos tu reseña.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-35', 'Encuentra una hoja de árbol que se parezca a {usuario} y explica el parecido.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-36', 'Toma una foto de un perro o un gato que tenga la vibra de {usuario}.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-37', 'Encuentra algo de color favorito de {usuario} en la calle y tómale foto.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-38', 'Pregúntale a {usuario} qué vería en YouTube a las 3 de la mañana y cuéntanos.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-39', 'Busca en el súper un producto que sería {usuario} si fuera producto y explica por qué.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-40', 'Elige una nube que se parezca a {usuario} y tómale foto.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-41', 'Pídele a {usuario} una palabra al azar y escribe un poema de 4 líneas con ella.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-42', 'Pregúntale a {usuario} cuál es su meme favorito y explícanos por qué nos debería dar risa.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-43', 'Encuentra un letrero o anuncio en la calle que podría haber escrito {usuario}.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-44', 'Pídele a {usuario} que te recomiende un lugar para comer, ve (o búscalo) y cuéntanos qué tal.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-45', 'Dibuja a {usuario} en 30 segundos sin ver el papel y comparte el resultado.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-46', 'Averigua cuál es la app que más usa {usuario} (según su tiempo de pantalla) y cuéntanos.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-47', 'Encuentra una taza que sea totalmente de {usuario} y tómale foto.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-48', 'Pregúntale a {usuario} cuál es la última foto de su galería y descríbela sin mostrarla.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-49', 'Inventa un nombre de banda de rock para {usuario} y diseña su portada (dibujo o como puedas).', true, CURRENT_TIMESTAMP),
  ('mision-inicial-50', 'Pregúntale a {usuario} qué compraría con 500 pesos para gastar hoy mismo.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-51', 'Encuentra en tu casa algo que {usuario} odiaría y explica por qué.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-52', 'Pídele a {usuario} un reto pequeño para ti, cúmplelo y cuéntanos cómo te fue.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-53', 'Averigua qué plática de YouTube, TikTok o pódcast le cambió la forma de pensar a {usuario}.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-54', 'Encuentra un charco, ventana o espejo y toma una foto artística dedicada a {usuario}.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-55', 'Pregúntale a {usuario} cuál sería su última cena y arma el menú.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-56', 'Haz una figura de plastilina, papel o lo que tengas que represente a {usuario}.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-57', 'Pregúntale a {usuario} qué olor le trae un recuerdo bonito y cuál es ese recuerdo.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-58', 'Pregúntale a {usuario} cómo sería su día ideal y elige una canción que lo describa. Cuéntanos por qué esa.', false, CURRENT_TIMESTAMP),
  ('mision-inicial-59', 'Toma una foto de tu comida de hoy y escribe la reseña que le haría {usuario} si fuera crítico de comida.', true, CURRENT_TIMESTAMP),
  ('mision-inicial-60', 'Pregúntale a {usuario} qué animal sería y qué animal cree que eres tú.', false, CURRENT_TIMESTAMP);
