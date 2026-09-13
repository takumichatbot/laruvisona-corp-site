export const ORDER_STATUSES = ['paid', 'review', 'shipped', 'completed', 'canceled', 'refund_pending', 'refunded', 'refund_review'] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

const NEXT_STATUS: Record<OrderStatus, readonly OrderStatus[]> = {
  paid: ['shipped', 'completed'],
  review: ['shipped', 'completed'],
  shipped: ['completed'],
  completed: [],
  canceled: [],
  refund_pending: [],
  refunded: [],
  refund_review: [],
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validOrderId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && ORDER_STATUSES.includes(value as OrderStatus);
}

export function canMoveOrder(from: OrderStatus, to: OrderStatus) {
  return NEXT_STATUS[from].includes(to);
}

export function nextOrderStatuses(status: OrderStatus) {
  return NEXT_STATUS[status];
}

export function parseOrderUpdate(value: unknown): { id: string; status: OrderStatus } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('注文内容を確認してください');
  const input = value as Record<string, unknown>;
  if (!validOrderId(input.id)) throw new Error('注文を確認してください');
  if (!isOrderStatus(input.status) || !['shipped', 'completed'].includes(input.status)) {
    throw new Error('変更先の状態を確認してください');
  }
  return { id: input.id, status: input.status };
}
