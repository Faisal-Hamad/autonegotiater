import type { Report } from "./reports";

export function downloadFile(data: Blob, name: string) {
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
}
// Native canvas renders English text before embedding each page as a JPEG.
// Image PDF deliberately avoids font packages; CSV is the searchable text alternative.
export async function reportPdf(report: Report): Promise<Blob> {
    await document.fonts.ready;
    const canvas = document.createElement("canvas"); canvas.width = 1240; canvas.height = 1754;
    const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Unable to create a PDF in this browser.");
    const pages: Uint8Array[] = []; let y = 0;
    function start() {
        ctx!.fillStyle = "white"; ctx!.fillRect(0, 0, 1240, 1754);
        ctx!.fillStyle = "#334155"; ctx!.direction = "ltr"; ctx!.textAlign = "left";
        ctx!.font = "24px Arial"; ctx!.fillText("AutoNegotiater | DEMO / SAMPLE DATA", 70, 65);
        ctx!.font = "18px Arial"; ctx!.fillText(`${report.id} | ${report.generatedAt}`, 70, 103); y = 155;
    }
    function save() {
        ctx!.font = "20px Arial"; ctx!.fillText(`Page ${pages.length + 1} — DEMO / SAMPLE DATA`, 70, 1700);
        const raw = atob(canvas.toDataURL("image/jpeg", .94).split(",")[1]); pages.push(Uint8Array.from(raw, c => c.charCodeAt(0)));
    }
    function line(text: string, heading = false) {
        ctx!.font = `${heading ? "bold 30" : "24"}px Arial`;
        // Character fallback also wraps very long IDs/URLs without clipping.
        const tokens = text.split(/(\s+)/); let current = "";
        const emit = () => { if (y > 1620) { save(); start(); ctx!.font = `${heading ? "bold 30" : "24"}px Arial`; } ctx!.fillText(current, 70, y); y += 38; current = ""; };
        for (const token of tokens) {
            if (ctx!.measureText(current + token).width > 1100 && current) emit();
            if (ctx!.measureText(token).width > 1100) { for (const char of token) { if (ctx!.measureText(current + char).width > 1100) emit(); current += char; } }
            else current += token;
        }
        if (current) emit();
    }
    start(); line(report.title, true);
    for (const section of report.sections) {
        if (y > 1480) { save(); start(); }
        y += 20; line(section.title, true);
        if (!section.rows.length) line("No data is available for this section.");
        for (const row of section.rows) {
            ctx.font = "24px Arial";
            const estimatedHeight = row.reduce((n, value, i) => n + 38 * Math.max(1, Math.ceil(ctx.measureText(`${section.columns[i]}: ${value}`).width / 1000)), 16);
            if (estimatedHeight < 1400 && y + estimatedHeight > 1620) { save(); start(); line(`${section.title} — continued`, true); }
            // English labels and values follow the same left-to-right layout.
            row.forEach((value, i) => line(`${section.columns[i]}: ${value}`)); y += 16;
        }
    }
    save(); return jpegPagesPdf(pages);
}
export function jpegPagesPdf(pages: Uint8Array[]): Blob {
    const encoder = new TextEncoder(); const chunks: Uint8Array[] = []; const offsets = [0]; let length = 0;
    const append = (s: string | Uint8Array) => { const b = typeof s === "string" ? encoder.encode(s) : s; chunks.push(b); length += b.length; };
    const object = (id: number, body: string) => { offsets[id] = length; append(`${id} 0 obj\n${body}\nendobj\n`); };
    append("%PDF-1.4\n"); object(1, "<< /Type /Catalog /Pages 2 0 R >>");
    object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>`);
    pages.forEach((jpeg, i) => {
        const id = 3 + i * 3;
        object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Image ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`);
        offsets[id + 1] = length; append(`${id + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`); append(jpeg); append("\nendstream\nendobj\n");
        const content = "q 595 0 0 842 0 0 cm /Image Do Q";
        object(id + 2, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });
    const xref = length; append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
    offsets.slice(1).forEach(n => append(`${String(n).padStart(10, "0")} 00000 n \n`));
    append(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}
