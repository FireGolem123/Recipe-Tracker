import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface Member {
  id: string;
  display_name: string;
  avatar_path: string | null;
  allergies: string[];
  user_id: string | null;
}

export function useMembers() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("members")
      .select("id, display_name, avatar_path, allergies, user_id")
      .order("display_name")
      .then(({ data, error }) => {
        if (error) console.error("useMembers:", error.message);
        setMembers(data ?? []);
        setLoading(false);
      });
  }, []);

  return { members, loading };
}
