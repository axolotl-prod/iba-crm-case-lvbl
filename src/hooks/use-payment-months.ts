import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { monthStart } from "@/lib/crm";

export function nextMonthStart(period: string) {
  const date = new Date(`${period}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

export function usePaymentMonths() {
  return useQuery({
    queryKey: ["payment-months"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("paid_at, amount")
        .gt("amount", 0)
        .not("paid_at", "is", null)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return [
        ...new Set(
          (data ?? [])
            .filter((payment) => payment.paid_at)
            .map((payment) => `${payment.paid_at!.slice(0, 7)}-01`),
        ),
      ];
    },
    placeholderData: [],
  });
}

export function defaultPaymentMonth(months: string[]) {
  return months[0] ?? monthStart();
}
