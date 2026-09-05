export const pageSizes = [25, 50, 100] as const;
export type PageSize = (typeof pageSizes)[number];
