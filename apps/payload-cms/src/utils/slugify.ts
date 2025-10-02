// /apps/payload-cms/src/utils/slugify.ts

export const slugify = (text: string): string => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .normalize('NFD') // Normaliza para separar acentos de las letras
        .replace(/[\u0300-\u036f]/g, '') // Elimina los diacríticos (acentos)
        .replace(/\s+/g, '-') // Reemplaza espacios con guiones
        .replace(/[^\w\-]+/g, '') // Elimina todos los caracteres no alfanuméricos excepto guiones
        .replace(/\-\-+/g, '-'); // Reemplaza múltiples guiones con uno solo
};