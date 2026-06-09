import { create } from "zustand";

export interface PortfolioParams {
  risk: string;
  ccy: string;
  base_currency: string;
  start_date: string;
  end_date: string;
  amount: number;
  amount_ccy: string;
  manual: boolean;
  manual_funds: Record<string, number>;
  deposit_term_months: number;
}

interface PortfolioStore extends PortfolioParams {
  set: (patch: Partial<PortfolioParams>) => void;
  resetManual: () => void;
}

const DEFAULT_MANUAL_FUNDS: Record<string, number> = {
  Liq: 10, M3: 10, Aplus: 10, A12080: 10, R1: 10,
  R5: 10,  VO: 10, D5: 10,    Yu5: 10,    D1: 10,
};

export const usePortfolioStore = create<PortfolioStore>((set) => ({
  risk: "cons",
  ccy: "equal",
  base_currency: "RUB",
  start_date: "",
  end_date: "",
  amount: 10_000_000,
  amount_ccy: "RUB",
  manual: false,
  manual_funds: { ...DEFAULT_MANUAL_FUNDS },
  deposit_term_months: 6,

  set: (patch) => set((s) => ({ ...s, ...patch })),
  resetManual: () => set((s) => ({ ...s, manual_funds: { ...DEFAULT_MANUAL_FUNDS } })),
}));
