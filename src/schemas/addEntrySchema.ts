import { z } from 'zod';
import { MIN_DATE } from '../utils/datetime';

export const addEntrySchema = z
  .object({
    datetime: z.string().min(1, 'Selecciona fecha y hora.'),
    restaurant: z.string().trim(),
    price: z
      .string()
      .trim()
      .min(1, 'Indica el precio por persona.')
      .refine((val) => {
        const n = Number(val.replace(',', '.'));
        return !Number.isNaN(n) && n >= 0;
      }, 'El precio no es valido.'),
    rating: z
      .string()
      .trim()
      .min(1, 'Selecciona una puntuacion.')
      .refine((val) => {
        const n = Number(val);
        return !Number.isNaN(n) && n >= 0.5 && n <= 5;
      }, 'La puntuacion debe estar entre 0.5 y 5.'),
    currency: z
      .string()
      .trim()
      .min(1, 'Selecciona moneda.')
      .max(5, 'Selecciona moneda.'),
    isBurger: z.boolean(),
    burger: z.string().trim(),
    burgerOrigin: z.string().trim().optional().or(z.literal('')),
    ingredients: z
      .string()
      .trim()
      .max(200, 'Maximo 200 caracteres.')
      .optional()
      .or(z.literal('')),
    additionalNotes: z
      .string()
      .trim()
      .max(250, 'Maximo 250 caracteres.')
      .optional()
      .or(z.literal('')),
  })
  .superRefine((val, ctx) => {
    const dt = new Date(val.datetime);
    const now = new Date();

    if (Number.isNaN(dt.getTime())) {
      ctx.addIssue({ code: 'custom', message: 'Fecha invalida.', path: ['datetime'] });
    } else {
      if (dt < MIN_DATE) {
        ctx.addIssue({
          code: 'custom',
          message: 'La fecha minima es el 1 de enero de 2026.',
          path: ['datetime'],
        });
      }
      if (dt > now) {
        ctx.addIssue({
          code: 'custom',
          message: 'No puedes registrar fechas futuras.',
          path: ['datetime'],
        });
      }
    }

    if ((!val.isBurger || val.burgerOrigin === 'restaurant') && !val.restaurant) {
      ctx.addIssue({
        code: 'custom',
        message: 'Escribe o selecciona un restaurante.',
        path: ['restaurant'],
      });
    }

    if (val.isBurger && val.burgerOrigin === 'restaurant' && !val.burger) {
      ctx.addIssue({
        code: 'custom',
        message: 'Escribe el nombre de la hamburguesa.',
        path: ['burger'],
      });
    }

    if (val.isBurger && !val.burgerOrigin) {
      ctx.addIssue({
        code: 'custom',
        message: 'Selecciona si es casera o de restaurante.',
        path: ['burgerOrigin'],
      });
    }

    if (val.isBurger && val.burgerOrigin === 'homemade' && !val.ingredients) {
      ctx.addIssue({
        code: 'custom',
        message: 'Escribe los ingredientes.',
        path: ['ingredients'],
      });
    }
  });

export type AddEntrySchema = z.infer<typeof addEntrySchema>;
