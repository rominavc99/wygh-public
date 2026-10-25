-- Correo a quien no mandó su resumen: poemas, registro de envíos y ajustes.
CREATE TABLE "Poem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "fragment" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "MissedResponseEmail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "poemId" TEXT,
    "variant" INTEGER NOT NULL,
    "sent" BOOLEAN NOT NULL DEFAULT true,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MissedResponseEmail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MissedResponseEmail_poemId_fkey" FOREIGN KEY ("poemId") REFERENCES "Poem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MissedResponseEmail_userId_date_key" ON "MissedResponseEmail"("userId", "date");
CREATE INDEX "MissedResponseEmail_userId_sentAt_idx" ON "MissedResponseEmail"("userId", "sentAt");

ALTER TABLE "Settings" ADD COLUMN "missedEmailEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Settings" ADD COLUMN "missedEmailDelayMinutes" INTEGER NOT NULL DEFAULT 5;

-- 50 poemas tristes de autores en dominio público (murieron antes de 1926),
-- tomados de es.wikisource.org con la ortografía modernizada.
INSERT INTO "Poem" ("id", "title", "author", "text", "fragment") VALUES
  ('poema-01', 'Rima XXX', 'Gustavo Adolfo Bécquer', 'Asomaba a sus ojos una lágrima
y a mi labio una frase de perdón;
Habló el orgullo y se enjugó su llanto,
Y la frase en mis labios espiró.

Yo voy por un camino, ella por otro;
Pero al pensar en nuestro mutuo amor,
Yo digo aún: ¿por qué callé aquel día?
Y ella dirá: ¿por qué no lloré yo?', false),
  ('poema-02', 'Rima XXXVIII', 'Gustavo Adolfo Bécquer', 'Los suspiros son aire, y van al aire.
Las lágrimas son agua, y van al mar.
Dime, mujer: cuando el amor se olvida,
¿Sabes tú adónde va?', false),
  ('poema-03', 'Rima XXXIX', 'Gustavo Adolfo Bécquer', '¿A qué me lo decís? lo sé: es mudable,
Es altanera y vana y caprichosa;
Antes que el sentimiento de su alma,
Brotará el agua de la estéril roca.

Sé que en su corazón, nido de sierpes,
No hay una fibra que al amor responda;
Que es una estatua inanimada... pero...
Es tan hermosa!', false),
  ('poema-04', 'Rima XLI', 'Gustavo Adolfo Bécquer', 'Tú eras el huracán, y yo la alta
Torre que desafía su poder;
¡Tenías que estrellarte o abatirme!...
¡No pudo ser!

Tú eras el Océano, y yo la enhiesta
Roca que firme aguarda su vaivén:
¡Tenías que romperte o que arrancarme!...
¡No pudo ser!

Hermosa tú, yo altivo; acostumbrados
Uno a arrollar, el otro a no ceder;
La senda estrecha, inevitable el choque...
¡No pudo ser!', false),
  ('poema-05', 'Rima XLII', 'Gustavo Adolfo Bécquer', 'Cuando me lo contaron sentí el frío
De una hoja de acero en las entrañas.
Me apoyé contra el muro, y un instante
La conciencia perdí de donde estaba.

Cayó sobre mi espíritu la noche;
En ira y en piedad se anegó el alma...
¡Y entonces comprendí por qué se llora,
Y entonces comprendí por qué se mata!

Pasó la nube de dolor... con pena
Logré balbucear breves palabras...
¿Quién me dio la noticia?... Un fiel amigo...
¡Me hacía un gran favor!... Le di las gracias.', false),
  ('poema-06', 'Rima XLVIII', 'Gustavo Adolfo Bécquer', 'Como se arranca el hierro de una herida
Su amor de las entrañas me arranqué,
Aunque sentí, al hacerlo, que la vida
Me arrancaba con él.

Del altar que la alcé en el alma mía
La voluntad su imagen arrojó,
Y la luz de la fe que en ella ardía
Ante el ara desierta se apagó.

Aun para combatir mi firme empeño
Viene a mi mente su visión tenaz...
¡Cuando podré dormir con ese sueño
En que acaba el soñar!', false),
  ('poema-07', 'Rima XLIX', 'Gustavo Adolfo Bécquer', 'Alguna vez la encuentro por el mundo
Y pasa junto a mí:
Y pasa sonriéndose, y yo digo:
¿Cómo puede reír?

Luego asoma a mi labio otra sonrisa,
Máscara del dolor,
Y entonces pienso:—¡Acaso ella se ríe
Como me río yo!', false),
  ('poema-08', 'Rima LII', 'Gustavo Adolfo Bécquer', 'Olas gigantes que os rompéis bramando
En las playas desiertas y remotas,
Envuelto entre la sábana de espumas,
Llevadme con vosotras!

Ráfagas de huracán, que arrebatáis
Del alto bosque las marchitas hojas,
Arrastrado en el ciego torbellino,
Llevadme con vosotras!

Nubes de tempestad, que rompe el rayo
Y en fuego ornáis las desprendidas orlas,
Arrebatado entre la niebla oscura,
Llevadme con vosotras!

Llevadme, por piedad, adonde el vértigo
Con la razón me arranque la memoria...
¡Por piedad!... ¡Tengo miedo de quedarme
Con mi dolor a solas!', false),
  ('poema-09', 'Rima LIII', 'Gustavo Adolfo Bécquer', 'Volverán las oscuras golondrinas
En tu balcón sus nidos a colgar,
Y, otra vez, con el ala a sus cristales
Jugando llamarán.

Pero aquellas que el vuelo refrenaban
Tu hermosura y mi dicha a contemplar,
Aquellas que aprendieron nuestros nombres...
Esas... ¡no volverán!', true),
  ('poema-10', 'Rima LX', 'Gustavo Adolfo Bécquer', 'Mi vida es un erial;
Flor que toco se deshoja;
Que en mi camino fatal,
Alguien va sembrando el mal
Para que yo lo recoja.', false),
  ('poema-11', 'Rima LXIV', 'Gustavo Adolfo Bécquer', 'Como guarda el avaro su tesoro,
Guardaba mi dolor;
Yo quería probar que hay algo eterno
A la que eterno me juró su amor.

Mas hoy le llamo en vano, y oigo al tiempo
Que le agotó, decir:
¡Ah, barro miserable, eternamente
No podrás ni aun sufrir!', false),
  ('poema-12', 'Rima LXVI', 'Gustavo Adolfo Bécquer', '¿De dónde vengo?... El más horrible y áspero
De los senderos busca;
Las huellas de unos pies ensangrentados
Sobre la roca dura;
Los despojos de un alma hecha jirones
En las zarzas agudas;
Te dirán el camino
que conduce a mi cuna.

¿Adónde voy? El más sombrío y triste
De los páramos cruza;
Valle de eternas nieves y de eternas
Melancólicas brumas.
En donde esté una piedra solitaria
Sin inscripción alguna,
Donde habite el olvido,
Allí estará mi tumba.', false),
  ('poema-13', 'Rima LXIX', 'Gustavo Adolfo Bécquer', 'Al brillar un relámpago nacemos,
Y aún dura su fulgor cuando morimos:
¡Tan corto es el vivir!

La gloria y el amor tras que corremos,
Sombras de un sueño son que perseguimos:
¡Despertar es morir!', false),
  ('poema-14', 'Rima LVI', 'Gustavo Adolfo Bécquer', 'Hoy como ayer, mañana como hoy,
Y siempre igual!
Un cielo gris, un horizonte eterno,
Y andar... andar!

Moviéndose a compás, como una estúpida
Máquina, el corazón:
La torpe inteligencia del cerebro,
Dormida en un rincón.', true),
  ('poema-15', 'Lo fatal', 'Rubén Darío', 'Dichoso el árbol, que es apenas sensitivo,
y más la piedra dura porque esa ya no siente,
pues no hay dolor más grande que el dolor de ser vivo,
ni mayor pesadumbre que la vida consciente.

Ser y no saber nada, y ser sin rumbo cierto,
y el temor de haber sido y un futuro terror...
Y el espanto seguro de estar mañana muerto,
y sufrir por la vida y por la sombra y por

lo que no conocemos y apenas sospechamos,
y la carne que tienta con sus frescos racimos,
y la tumba que aguarda con sus fúnebres ramos,
¡y no saber a dónde vamos,
ni de dónde venimos!...', false),
  ('poema-16', 'Canción de otoño en primavera', 'Rubén Darío', 'Juventud, divino tesoro,
ya te vas para no volver!
Cuando quiero llorar, no lloro...
Y a veces lloro sin querer...

Plural ha sido la celeste
historia de mi corazón.
Era una dulce niña, en este
mundo de duelo y aflicción.', true),
  ('poema-17', 'Nocturno', 'Rubén Darío', 'Quiero expresar mi angustia en versos que abolida
dirán mi juventud de rosas y de ensueños,
y la desfloración amarga de mi vida
por un vasto dolor y cuidados pequeños.

Y el viaje de un vago Oriente por entrevistos barcos,
y el grano de oraciones que floreció en blasfemia,
y los azoramientos del cisne entre los charcos
y el falso azul nocturno de inquerida bohemia.', true),
  ('poema-18', 'Melancolía', 'Rubén Darío', 'Hermano, tú que tienes la luz, dime la mía.
Soy como un ciego. Voy sin rumbo y ando a tientas.
Voy bajo tempestades y tormentas
ciego de ensueño y loco de armonía.

Ese es mi mal. Soñar. La poesía
es la camisa férrea de mil puntas cruentas
que llevo sobre el alma. Las espinas sangrientas
dejan caer las gotas de mi melancolía.

Y así voy, ciego y loco, por este mundo amargo;
a veces me parece que el camino es muy largo,
y a veces que es muy corto...

Y en este titubeo de aliento y agonía,
cargo lleno de penas lo que apenas soporto.
¿No oyes caer las gotas de mi melancolía?', false),
  ('poema-19', 'Flores negras', 'Julio Flórez', 'Oye: bajo las ruinas de mis pasiones,
y en el fondo de esta alma que ya no alegras,
entre polvos de ensueños y de ilusiones
yacen entumecidas mis flores negras.

Ellas son el recuerdo de aquellas horas
en que presa en mis brazos te adormecías,
mientras yo suspiraba por las auroras
de tus ojos, auroras que no eran mías.

Ellas son mis dolores, capullos hechos;
los intensos dolores que en mis entrañas
sepultan sus raíces, cual los helechos
en las húmedas grietas de las montañas.

Ellas son tus desdenes y tus reproches
ocultos en esta alma que ya no alegras;
son, por eso, tan negras como las noches
de los gélidos polos, mis flores negras.

Guarda, pues, este triste, débil manojo,
que te ofrezco de aquellas flores sombrías;
guárdalo, nada temas, es un despojo
del jardín de mis hondas melancolías.', false),
  ('poema-20', 'Todo nos llega tarde', 'Julio Flórez', 'Todo nos llega tarde... ¡hasta la muerte!
Nunca se satisface ni alcanza
la dulce posesión de una esperanza
cuando el deseo acósanos más fuerte.

Todo puede llegar: pero se advierte
que todo llega tarde: la bonanza,
después de la tragedia: la alabanza
cuando ya está la inspiración inerte.

La justicia nos muestra su balanza
cuando sus siglos en la Historia vierte
el Tiempo mudo que en el orbe avanza;

Y la gloria, esa ninfa de la suerte,
solo en las sepulturas danza.
Todo nos llega tarde... ¡hasta la muerte!', false),
  ('poema-21', 'Para entonces', 'Manuel Gutiérrez Nájera', 'Quiero morir cuando decline el día,
en alta mar y con la cara al cielo,
donde parezca sueño la agonía,
y el alma, un ave que remonta el vuelo.

No escuchar en los últimos instantes,
ya con el cielo y con el mar a solas,
más voces ni plegarias sollozantes
que el majestuoso tumbo de las olas.

Morir cuando la luz, triste, retira
sus áureas redes de la onda verde,
y ser como ese sol que lento expira:
algo muy luminoso que se pierde.

Morir, y joven: antes que destruya
el tiempo aleve la gentil corona;
cuando la vida dice aún: soy tuya,
aunque sepamos bien que nos traiciona.', false),
  ('poema-22', 'Mis enlutadas', 'Manuel Gutiérrez Nájera', 'Descienden taciturnas las tristezas
al fondo de mi alma,
y entumecidas, haraposas, brujas,
con uñas negras
mi vida escarban.

De sangre es el color de sus pupilas,
de nieve son sus lágrimas,
hondo pavor infunden... Yo las amo
por ser las solas
que me acompañan.

Aguárdolas ansioso, si el trabajo
de ellas me separa,
y búscolas en medio del bullicio,
y son constantes,
y nunca tardan.

En las fiestas, a ratos se me pierden
o se ponen la máscara,
pero luego las hallo, y así dicen:
-¡Ven con nosotras!
vamos a casa.', true),
  ('poema-23', 'Al que ingrato me deja, busco amante', 'Sor Juana Inés de la Cruz', 'Al que ingrato me deja busco amante;
y al que amante me sigue dejo ingrata;
constante adoro a quien mi amor maltrata;
maltrato a quien mi amor busca constante.

Al que trato de amor hallo diamante;
y soy diamante al que de amor me trata;
triunfante quiero ver al que me mata;
y mato al que me quiere ver triunfante.

Si a éste pago, padece mi deseo;
si ruego a aquél, mi pundonor enojo;
de entre ambos modos infeliz me veo.

Pero yo por mejor partido escojo;
de quien no quiero ser violento empleo;
que de quien no me quiere, vil despojo.', false),
  ('poema-24', 'Detente, sombra de mi bien esquivo', 'Sor Juana Inés de la Cruz', 'Detente, sombra de mi bien esquivo,
imagen del hechizo que más quiero,
bella ilusión por quien alegre muero,
dulce ficción por quien penosa vivo.

Si al imán de tus gracias, atractivo,
sirve mi pecho de obediente acero,
¿para qué me enamoras lisonjero
si has de burlarme luego fugitivo?

Mas blasonar no puedes, satisfecho,
de que triunfa de mí tu tiranía:
que aunque dejas burlado el lazo estrecho

que tu forma fantástica ceñía,
poco importa burlar brazos y pecho
si te labra prisión mi fantasía.', false),
  ('poema-25', 'Miré los muros de la patria mía', 'Francisco de Quevedo', 'Miré los muros de la patria mía,
si un tiempo fuertes, ya desmoronados,
de la carrera de la edad cansados,
por quien caduca ya su valentía.

Salime al campo, vi que el sol bebía
los arroyos del hielo desatados,
y del monte quejosos los ganados,
que con sombras hurtó su luz al día.

Entré en mi casa, vi que amancillada
de anciana habitación era despojos;
mi báculo más corvo y menos fuerte.

Vencida de la edad sentí mi espada,
y no hallé cosa en que poner los ojos
que no fuese recuerdo de la muerte.', false),
  ('poema-26', '¡Ah de la vida!', 'Francisco de Quevedo', '"¡Ah de la vida..!" ¿Nadie me responde?
¡Aquí de los antaños que he vivido!
La Fortuna mis tiempos ha mordido,
las Horas mi locura las esconde.

¡Que sin poder saber cómo ni adónde
la salud y la edad se hayan huido!
Falta la vida, asiste lo vivido,
y no hay calamidad que no me ronde.

Ayer se fue, mañana no ha llegado;
hoy se está yendo sin parar un punto:
soy un fue, y un será, y un es cansado.

En el hoy y mañana y ayer, junto
pañales y mortaja, y he quedado
presentes sucesiones de difunto.', false),
  ('poema-27', 'Soneto I', 'Garcilaso de la Vega', 'Cuando me paro a contemplar mi estado
y a ver los pasos por do me ha traído,
hallo, según por do anduve perdido,
que a mayor mal pudiera haber llegado.

Mas cuando del camino estó olvidado,
a tanto mal no sé por do he venido;
sé que me acabo, y más he yo sentido
ver acabar comigo mi cuidado.

Yo acabaré, que me entregué sin arte
a quien sabrá perderme y acabarme,
si ella quisiere, y aun sabrá querello;

que pues mi voluntad puede matarme,
la suya, que no es tanto de mi parte,
pudiendo, ¿qué hará sino hacello?', false),
  ('poema-28', 'Llorar cuando nací, señal fue cierta', 'Lope de Vega', 'Llorar cuando nací señal fue cierta
de la miseria del vivir futuro,
¿pues qué será de la vida que procuro,
si lágrimas le aguardan a la puerta?

Incierto el cuando, aunque la muerte cierta,
¿cómo a tantos peligros me aventuro?
¿Qué tiene el alma por defensa y muro,
aunque de terrapleno está cubierta?

Oh, pues, vida, llorad; llorar conviene,
que no reír, pues si reír pretendo,
no es el efeto que esta causa tiene.

Proporcionad el medio, porque entiendo
que, si reís, impropiamente viene
nacer llorando con vivir riendo.', false),
  ('poema-29', 'Cobardía', 'Amado Nervo', 'Pasó con su madre, qué rara belleza,
qué rubios cabellos de trigo garzul,
qué ritmo en el paso, qué innata realeza
de porte, qué formas bajo el fino tul.
Pasó con su madre, volvió la cabeza,
me clavó muy hondo su mirada azul.

Quedé como en éxtasis; con febril premura
¡Síguela! gritaron cuerpo y alma al par.
Pero tuve miedo de amar con locura,
de abrir mis heridas, que suelen sangrar,
y no obstante toda mi sed de ternura,
cerrando los ojos, la dejé pasar.', false),
  ('poema-30', '¿Llorar? ¿Por qué?', 'Amado Nervo', 'Este es el libro de mi dolor:
lágrima a lágrima lo formé;
una vez hecho, te juro, por
Cristo, que nunca más lloraré.
¿Llorar? ¿Por qué?

Serán mis rimas como el rielar
de una luz íntima, que dejaré
en cada verso; pero llorar,
¡eso ya nunca! ¿Por quién? ¿Por qué?

Serán un plácido florilegio
un haz de notas que regaré
y habrá una risa por cada arpegio,
¿Pero una lágrima? ¡Qué sacrilegio!
Eso ya nunca. ¿Por quién? ¿Por qué?', false),
  ('poema-31', 'Gratia plena', 'Amado Nervo', 'Todo en ella encantaba, todo en ella atraía:
su mirada, su gesto, su sonrisa, su andar...
El ingenio de Francia de su boca fluía.
Era llena de gracia, como el Avemaría;
¡quien la vio no la pudo ya jamás olvidar!

Ingenua como el agua, diáfana como el día,
rubia y nevada como margarita sin par,
al influjo de su alma celeste amanecía...
Era llena de gracia, como el Avemaría;
¡quien la vio no la pudo ya jamás olvidar!

Cierta dulce y amable dignidad la investía
de no sé qué prestigio lejano y singular.
Más que muchas princesas, princesa parecía:
era llena de gracia, como el Avemaría;
¡quien la vio no la pudo ya jamás olvidar!

Yo gocé el privilegio de encontrarla en mi vía
dolorosa; por ella tuvo fin mi anhelar,
y cadencias arcanas halló mi poesía.
Era llena de gracia, como el Avemaría;
¡quien la vio no la pudo ya jamás olvidar!

¡Cuánto, cuánto la quise! ¡Por diez años fue mía;
pero flores tan bellas nunca pueden durar!
¡Era llena de gracia, como el Avemaría;
y a la Fuente de gracia, de donde procedía,
se volvió... como gota que se vuelve a la mar!', false),
  ('poema-32', 'La niña de Guatemala', 'José Martí', 'Quiero, a la sombra de un ala,
contar este cuento en flor:
la niña de Guatemala,
la que se murió de amor.

Eran de lirios los ramos;
y las orlas de reseda
y de jazmín; la enterramos
en una caja de seda...

Ella dio al desmemoriado
una almohadilla de olor;
él volvió, volvió casado;
ella se murió de amor.

Iban cargándola en andas
obispos y embajadores;
detrás iba el pueblo en tandas,
todo cargado de flores...', true),
  ('poema-33', 'Ya no mana la fuente', 'Rosalía de Castro', 'Ya no mana la fuente, se agotó el manantial;
Ya el viajero allí nunca va su sed a apagar.

Ya no brota la hierba, ni florece el narciso,
Ni en los aires esparcen su fragancia los lirios.

Sólo el cauce arenoso de la seca corriente
Le recuerda al sediento el horror de la muerte.

¡Mas no importa!; a lo lejos otro arroyo murmura
Donde humildes violetas el espacio perfuman.

Y de un sauce el ramaje, al mirarse en las ondas,
Tiende en torno del agua su fresquísima sombra.

El sediento viajero que el camino atraviesa,
Humedece los labios en la linfa serena
Del arroyo que el árbol con sus ramas sombrea,
Y dichoso se olvida de la fuente ya seca.', false),
  ('poema-34', 'Alma que vas huyendo de ti misma', 'Rosalía de Castro', 'Alma que vas huyendo de ti misma,
¿Qué buscas, insensata, en las demás?
Si en ti secó la fuente del consuelo,
Secas todas las fuentes has de hallar.

¡Que hay en el cielo estrellas todavía,
Y hay en la tierra flores perfumadas!
¡Sí!... Mas no son ya aquellas
Que tú amaste y te amaron, desdichada.', false),
  ('poema-35', 'Cuando recuerdo del ancho bosque', 'Rosalía de Castro', 'Cuando recuerdo del ancho bosque
El mar dorado
De hojas marchitas que en el otoño
Agita el viento con soplo blando,

Tan honda angustia nubla mi alma,
Turba mi pecho,
Que me pregunto:
— ¿Por qué tan terca,
Tan fiel memoria, me ha dado el cielo?', false),
  ('poema-36', 'Cenicientas las aguas', 'Rosalía de Castro', 'Cenicientas las aguas, los desnudos
Árboles y los montes cenicientos;
Parda la bruma que los vela y pardas
Las nubes que atraviesan por el cielo,
Triste, en la tierra, el color gris domina,
¡El color de los viejos!

De cuando en cuando de la lluvia el sordo
Rumor suena, y el viento
Al pasar por el bosque
Silba o finge lamentos', true),
  ('poema-37', 'Sedientas las arenas', 'Rosalía de Castro', 'Sedientas las arenas, en la playa
Sienten del sol los besos abrasados,
Y no lejos, las ondas siempre frescas,
Ruedan pausadamente murmurando.

Pobres arenas, de mi suerte imagen;
No sé lo que me pasa al contemplaros,
Pues como yo sufrís, secas y mudas,
El suplicio sin término de Tántalo.', true),
  ('poema-38', 'Dicen que no hablan las plantas', 'Rosalía de Castro', 'Dicen que no hablan las plantas, ni las fuentes, ni los pájaros,
Ni el onda con sus rumores, ni con su brillo los astros;
Lo dicen, pero no es cierto, pues siempre cuando yo paso
De mí murmuran y exclaman:

— Ahí va la loca, soñando
Con la eterna primavera de la vida y de los campos,
Y ya bien pronto, bien pronto, tendrá los cabellos canos,
Y ve temblando, aterida, que cubre la escarcha el prado.', true),
  ('poema-39', 'La vida humana', 'Ramón de Campoamor', 'Velas de amor en golfos de ternura
vuela mi pobre corazón al viento
y encuentra, en lo que alcanza, su tormento,
y espera, en lo que no halla, su ventura,

viviendo en esta humana sepultura
engañar el pesar es mi contento,
y este cilicio atroz del pensamiento
no halla un linde entre el genio y la locura.

¡Ay! en la vida ruin que al loco embarga,
y que al cuerdo infeliz de horror consterna,
dulce en el nombre, en realidad amarga,

sólo el dolor con el dolor alterna,
y si al contarla a días es muy larga,
midiéndola por horas es eterna.', false),
  ('poema-40', 'Flor de un día', 'Antonio Plaza', 'Yo di un eterno adiós a los placeres
cuando la pena doblegó mi frente,
y me soñé, mujer indiferente
al estúpido amor de las mujeres.

En mi orgullo insensato yo creía
que estaba el mundo para mi desierto,
y que en lugar de corazón tenía
una insensible lápida de muerto.

Mas despertaste tú mis ilusiones
con embusteras frases de cariño,
y dejaron su tumba las pasiones
y te entregué mi corazón de niño.

No extraño que quisieras provocarme,
ni extraño que lograras encenderme;
porque fuiste capaz de sospecharme,
pero no eres capaz de comprenderme.', true),
  ('poema-41', 'Desde lejos', 'Delmira Agustini', 'En el silencio siento pasar hora tras hora,
como un cortejo lento, acompasado y frío...
¡Ah! Cuando tú estás lejos, mi vida toda llora,
y al rumor de tus pasos hasta en sueños sonrío.

Yo sé que volverás, que brillará otra aurora
en mi horizonte, grave como un ceño sombrío;
revivirá en mis bosques tu gran risa sonora
que los cruzaba alegre como el cristal de un río.

Un día, al encontrarnos tristes en el camino,
yo puse entre tus manos pálidas mi destino
¡y nada de más grande jamás han de ofrecerte!

Mi alma es frente a tu alma como el mar frente al cielo:
pasarán entre ellas, tal la sombra de un vuelo,
¡la Tormenta y el Tiempo y la Vida y la Muerte!', false),
  ('poema-42', 'Nocturno a Rosario', 'Manuel Acuña', '¡Pues bien!, yo necesito
decirte que te adoro,
decirte que te quiero
con todo el corazón;
que es mucho lo que sufro,
que es mucho lo que lloro,
que ya no puedo tanto,
y al grito que te imploro
te imploro y te hablo en nombre
de mi última ilusión.

Yo quiero que tú sepas
que ya hace muchos días
estoy enfermo y pálido
de tanto no dormir;
que ya se han muerto todas
las esperanzas mías,
que están mis noches negras,
tan negras y sombrías,
que ya no sé ni dónde
se alzaba el porvenir.', true),
  ('poema-43', 'Nocturno', 'José Asunción Silva', 'Una noche,
una noche toda llena de perfumes, de murmullos y de música de alas,
una noche,
en que ardían en la sombra nupcial y húmeda, las luciérnagas fantásticas,
a mi lado, lentamente, contra mí ceñida, toda, muda y pálida
como si un presentimiento de amarguras infinitas
hasta el fondo más secreto de tus fibras te agitara,
por la senda que atraviesa la llanura florecida
caminabas,
y la luna llena
por los cielos azulosos, infinitos y profundos esparcía su luz blanca,
y tu sombra,
fina y lánguida,
y mi sombra
por los rayos de la luna proyectadas,
sobre las arenas tristes
de la senda se juntaban
y eran una
y eran una
¡Y eran una sola sombra larga!
¡Y eran una sola sombra larga!
¡Y eran una sola sombra larga!', true),
  ('poema-44', 'A Jarifa en una orgía', 'José de Espronceda', 'Trae, Jarifa, trae tu mano,
Ven y pósala en mi frente,
Que en un mar de lava hirviente
Mi cabeza siento arder.

Ven y junta con mis labios
Esos labios que me irritan,
Donde aún los besos palpitan
De tus amantes de ayer.

¿Qué la virtud, la pureza?
¿Qué la verdad y el cariño?
Mentida ilusión de niño
Que halagó mi juventud.

Dadme vino: en él se ahoguen
Mis recuerdos; aturdida,
Sin sentir, huya la vida;
Paz me traiga el ataúd.', true),
  ('poema-45', 'El retorno maléfico', 'Ramón López Velarde', 'Mejor será no regresar al pueblo,
al edén subvertido que se calla
en la mutilación de la metralla.

Hasta los fresnos mancos,
los dignatarios de cúpula oronda,
han de rodar las quejas de la torre
acribillada en los vientos de fronda.

Y la fusilería grabó en la cal
de todas las paredes
de la aldea espectral,
negros y aciagos mapas,
porque en ellos leyese el hijo pródigo
al volver a su umbral
en un anochecer de maleficio,
a la luz del petróleo de una mecha
su esperanza deshecha.', true),
  ('poema-46', 'Vivo sin vivir en mí', 'Santa Teresa de Jesús', 'Vivo sin vivir en mí,
y de tal manera espero,
que muero porque no muero.

Vivo ya fuera de mí
después que muero de amor;
porque vivo en el Señor,
que me quiso para sí;
cuando el corazón le di
puse en él este letrero:
que muero porque no muero.', true),
  ('poema-47', 'Yo en mi lecho de abrojos', 'Rosalía de Castro', 'Yo en mi lecho de abrojos,
Tú en tu lecho de rosas y de plumas,
Verdad dijo el que dijo que un abismo
Media entre mi miseria y tu fortuna.

Mas yo no cambiaría
Por tu lecho mi lecho,
Pues rosas hay que manchan y emponzoñan,
Y abrojos que a través de su aspereza
Nos conducen al cielo.', false),
  ('poema-48', 'Non omnis moriar', 'Manuel Gutiérrez Nájera', '¡No moriré del todo, amiga mía!
De mi ondulante espíritu disperso,
algo en la urna diáfana del verso,
piadosa guardará la poesía.

¡No moriré del todo! Cuando herido
caiga a los golpes del dolor humano,
ligera tú, del campo entenebrido
levantarás al moribundo hermano.

Tal vez para entonces por la boca inerme
que muda aspira la infinita calma,
oigas la voz de todo lo que duerme
con los ojos abiertos de mi alma.', true),
  ('poema-49', 'Rima LXXIII', 'Gustavo Adolfo Bécquer', 'Cerraron sus ojos
Que aún tenía abiertos;
Taparon su cara
Con un blanco lienzo;
Y unos sollozando,
Otros en silencio,
De la triste alcoba
Todos se salieron.

La luz, que en un vaso
Ardía en el suelo,
Al muro arrojaba
La sombra del lecho;
Y entre aquella sombra
Veíase a intervalos,
Dibujarse rígida
La forma del cuerpo.', true),
  ('poema-50', 'Yo', 'Antonio Plaza', 'Me hizo nacer la suerte maldecida,
de sombra y luz conjunto inexplicable;
que oculta en mi corteza despreciable
arde un alma grandiosa y descreída.

Llevo en mi frente, do la audacia anida
un mundo de ilusiones impalpable;
soy, en fin, un misterio impenetrable,
que me agito en el sueño de la vida.

Por el cielo a sufrir predestinado,
me llena el mundo de ponzoña y duelo;
mas yo siempre orgulloso y resignado

contra mi propia pena me rebelo,
y, en cada golpe, al mundo malhadado
doy mi desprecio, y mi perdón al cielo.', false);
