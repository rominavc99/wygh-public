-- 🫪 (Unicode 17) se veía como un cuadrito en la mayoría de los celulares.
-- Las reacciones que ya lo usaban pasan a 🥴, que lo reemplaza en las
-- reacciones rápidas. Si alguien ya había reaccionado con 🥴 a lo mismo,
-- se queda solo esa (la combinación respuesta + persona + emoji es única).
UPDATE OR IGNORE "Reaction" SET "emoji" = '🥴' WHERE "emoji" = '🫪';
DELETE FROM "Reaction" WHERE "emoji" = '🫪';
UPDATE OR IGNORE "CommentReaction" SET "emoji" = '🥴' WHERE "emoji" = '🫪';
DELETE FROM "CommentReaction" WHERE "emoji" = '🫪';
