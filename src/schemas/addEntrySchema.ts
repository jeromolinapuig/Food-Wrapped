import { z } from 'zod';
import { MIN_DATE } from '../utils/datetime';

export const addEntrySchema = z
  .object({
    datetime: z.string().min(1, 'Selecciona fecha y hora.'),
    restaurant: z.string().trim().min(1, 'Escribe o selecciona un restaurante.'),
    price: z
      .string()
      .trim()
      .min(1, 'Indica el precio por persona.')
      .refine((val) => {
        const n = Number(val.replace(',', '.'));
        return !Number.isNaN(n) && n >= 0;
      }, 'El precio no es válido.'),
    rating: z
      .string()
      .trim()
      .refine((val) => {
        const n = Number(val);
        return !Number.isNaN(n) && n >= 1 && n <= 5;
      }, 'La puntuación debe estar entre 1 y 5.'),
    isBurger: z.boolean(),
    burger: z.string().trim(),
  })
  .superRefine((val, ctx) => {
    const dt = new Date(val.datetime);
    const now = new Date();

    if (Number.isNaN(dt.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Fecha inválida.' });
    } else {
      if (dt < MIN_DATE) {
        ctx.addIssue({
          code: 'custom',
          message: 'La fecha mínima es el 1 de enero de 2026.',
        });
      }
      if (dt > now) {
        ctx.addIssue({
          code: 'custom',
          message: 'No puedes registrar fechas futuras.',
        });
      }
    }

    if (val.isBurger && !val.burger) {
      ctx.addIssue({
        code: 'custom',
        message: 'Escribe el nombre de la hamburguesa.',
      });
    }
  });

export type AddEntrySchema = z.infer<typeof addEntrySchema>;
