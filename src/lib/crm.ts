export type LeadStatus = "new" | "in_work" | "offer_sent" | "awaiting_payment" | "paid" | "lost";

export const STATUS_COLUMNS: { key: LeadStatus; title: string; hint: string }[] = [
  { key: "new", title: "Новая заявка", hint: "Только что поступила" },
  { key: "in_work", title: "В работе", hint: "Идут переговоры" },
  { key: "offer_sent", title: "КП отправлено", hint: "Ждём решения" },
  { key: "awaiting_payment", title: "Ожидает оплаты", hint: "Счёт выставлен" },
  { key: "paid", title: "Оплата", hint: "Успешная сделка" },
  { key: "lost", title: "Отказ", hint: "Закрыта без оплаты" },
];

export const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Новая заявка",
  in_work: "В работе",
  offer_sent: "КП отправлено",
  awaiting_payment: "Ожидает оплаты",
  paid: "Оплата",
  lost: "Отказ",
};

export function money(value: number | null | undefined) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export function shortMoney(value: number | null | undefined) {
  const v = Number(value ?? 0);
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} млн ₽`;
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)} тыс ₽`;
  return `${Math.round(v)} ₽`;
}

export function monthStart(date = new Date()) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), 1)).toISOString().slice(0, 10);
}

export function monthLabel(period: string) {
  const d = new Date(`${period}T00:00:00Z`);
  return d.toLocaleDateString("ru-RU", { month: "long", year: "numeric", timeZone: "UTC" });
}

export type BonusInput = {
  revenue: number;
  salary: number;
  bonusRate: number;
  coefMin: number;
  coefTarget: number;
  planMin: number;
  planTarget: number;
};

export type BonusResult = {
  coef: number;
  coefLabel: string;
  baseBonus: number;
  bonus: number;
  payout: number;
  toMin: number;
  toTarget: number;
  progress: number;
  nextCoef: number | null;
  toNextCoef: number;
};

export function calcBonus(i: BonusInput): BonusResult {
  const base = (i.revenue * i.bonusRate) / 100;
  let coef = 1;
  let coefLabel = "Базовая ставка";
  if (i.planTarget > 0 && i.revenue >= i.planTarget) {
    coef = i.coefTarget;
    coefLabel = "Целевой план";
  } else if (i.planMin > 0 && i.revenue >= i.planMin) {
    coef = i.coefMin;
    coefLabel = "План-минимум";
  }
  const bonus = base * coef;
  const toMin = Math.max(0, i.planMin - i.revenue);
  const toTarget = Math.max(0, i.planTarget - i.revenue);
  const nextCoef = toMin > 0 ? i.coefMin : toTarget > 0 ? i.coefTarget : null;
  const toNextCoef = toMin > 0 ? toMin : toTarget;
  return {
    coef,
    coefLabel,
    baseBonus: base,
    bonus,
    payout: i.salary + bonus,
    toMin,
    toTarget,
    progress: i.planTarget > 0 ? Math.min(100, (i.revenue / i.planTarget) * 100) : 0,
    nextCoef,
    toNextCoef,
  };
}
