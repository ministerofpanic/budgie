import { buildExportCsv } from "@/lib/dal/export";

const todayIso = (): string => new Date().toISOString().slice(0, 10);

export async function GET() {
  const csv = await buildExportCsv();
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="budgie-export-${todayIso()}.csv"`,
    },
  });
}
