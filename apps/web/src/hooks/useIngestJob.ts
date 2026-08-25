import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface IngestJob {
  id: string;
  status: "queued" | "processing" | "done" | "error";
  status_detail: string | null;
  error: string | null;
  recipe_id: string | null;
}

export function useIngestJob(jobId: string | undefined) {
  const [job, setJob] = useState<IngestJob | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let cancelled = false;
    supabase
      .from("ingest_jobs")
      .select("id, status, status_detail, error, recipe_id")
      .eq("id", jobId)
      .single()
      .then(({ data }) => {
        if (!cancelled) setJob(data);
      });

    const channel = supabase
      .channel(`ingest_job:${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "ingest_jobs", filter: `id=eq.${jobId}` },
        (payload) => setJob(payload.new as IngestJob)
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [jobId]);

  return job;
}
