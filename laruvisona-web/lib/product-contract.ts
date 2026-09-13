import { randomUUID } from 'node:crypto';

export const PRODUCT_CATEGORIES = ['その他', 'サービス', '商品', 'デジタルコンテンツ', 'コース・講座', 'チケット'] as const;

export interface ProductVariant {
  id: string;
  name: string;
  priceDelta: number;
  stock: number | null;
}

export interface StoredProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  stock: number | null;
  active: boolean;
  category: string;
  createdAt: string;
  variantLabel?: string;
  variants?: ProductVariant[];
}

const ID = /^[a-zA-Z0-9_-]{1,80}$/;

function text(value: unknown, max: number, required = false) {
  if (typeof value !== 'string') {
    if (!required && value == null) return '';
    throw new Error('入力内容を確認してください');
  }
  const result = value.trim();
  if ((required && !result) || result.length > max) throw new Error('入力内容を確認してください');
  return result;
}

function integer(value: unknown, min: number, max: number) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < min || result > max) throw new Error('数値を確認してください');
  return result;
}

function stock(value: unknown) {
  return value === null || value === undefined || value === '' ? null : integer(value, 0, 1_000_000);
}

export function validProductId(value: unknown): value is string {
  return typeof value === 'string' && ID.test(value);
}

export function parseNewProduct(value: unknown): Omit<StoredProduct, 'id' | 'createdAt'> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('商品を確認してください');
  const input = value as Record<string, unknown>;
  const price = integer(input.price, 50, 99_999_999);
  const rawVariants = input.variants == null ? [] : input.variants;
  if (!Array.isArray(rawVariants) || rawVariants.length > 50) throw new Error('選択肢を確認してください');
  const variants = rawVariants.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('選択肢を確認してください');
    const item = raw as Record<string, unknown>;
    const priceDelta = integer(item.priceDelta ?? 0, -99_999_998, 99_999_999);
    if (price + priceDelta < 50) throw new Error('選択肢の価格を確認してください');
    return {
      id: validProductId(item.id) ? item.id : randomUUID(),
      name: text(item.name, 80, true),
      priceDelta,
      stock: stock(item.stock),
    };
  });
  const category = PRODUCT_CATEGORIES.includes(input.category as typeof PRODUCT_CATEGORIES[number])
    ? input.category as string
    : 'その他';
  const variantLabel = text(input.variantLabel, 40);
  return {
    name: text(input.name, 120, true),
    description: text(input.description, 5_000),
    price,
    images: [],
    stock: stock(input.stock),
    active: true,
    category,
    ...(variantLabel && variants.length ? { variantLabel, variants } : {}),
  };
}

export function readStoredProducts(value: unknown): StoredProduct[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('商品データを確認できません');
  return value as StoredProduct[];
}
