import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export function useHousehold() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("households")
      .select("name")
      .single()
      .then(({ data, error }) => {
        if (error) console.error("useHousehold:", error.message);
        setName(data?.name ?? null);
      });
  }, []);

  return { name };
}
