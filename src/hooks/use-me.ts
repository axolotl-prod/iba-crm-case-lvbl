import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Employee = {
  id: string;
  user_id: string | null;
  email: string | null;
  name: string;
  role: "admin" | "manager";
  salary: number;
  bonus_rate: number;
  coef_min: number;
  coef_target: number;
  active: boolean;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    staleTime: 0,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      await supabase.rpc("link_current_user");
      const { data: employee } = await supabase
        .from("employees")
        .select("*")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", auth.user.id);
      const isAdmin = (roles ?? []).some((r) => r.role === "admin");
      return {
        userId: auth.user.id,
        email: auth.user.email ?? "",
        employee: (employee as Employee | null) ?? null,
        isAdmin,
      };
    },
  });
}
