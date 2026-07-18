export const ADD_ENTRY_NOTIFICATION_TARGET = '/?action=add-entry' as const;

export const NOTIFICATION_TARGET_OPTIONS = [
  { value: ADD_ENTRY_NOTIFICATION_TARGET, label: 'Añadir una burger' },
  { value: '/', label: 'Inicio' },
  { value: '/feed', label: 'Feed' },
  { value: '/search', label: 'Buscar usuarios y restaurantes' },
  { value: '/profile', label: 'Perfil' },
  { value: '/groups', label: 'Grupos' },
  { value: '/ranking', label: 'Ranking global' },
  { value: '/saved', label: 'Publicaciones guardadas' },
  { value: '/burger-wishlist', label: 'Burgers pendientes' },
  { value: '/burger-calendar', label: 'Calendario de burgers' },
  { value: '/my-top-burgers', label: 'Mi top de burgers' },
  { value: '/privacy', label: 'Privacidad' },
] as const;

export type NotificationTargetUrl = (typeof NOTIFICATION_TARGET_OPTIONS)[number]['value'];

export const isNotificationTargetUrl = (value: string): value is NotificationTargetUrl =>
  NOTIFICATION_TARGET_OPTIONS.some((option) => option.value === value);
