import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Gera URL assinada temporária para arquivos em buckets privados. */
export function useSignedUrl(bucket: string, path?: string | null) {
  const { data } = useQuery({
    queryKey: ["signed-url", bucket, path],
    enabled: !!path,
    staleTime: 45 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, 60 * 60);
      if (error) return null;
      return data.signedUrl;
    },
  });
  return data ?? null;
}

/** Faz upload de uma foto e devolve o caminho salvo no bucket. */
export async function uploadPhoto(bucket: string, companyId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${companyId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}
