import type {Report} from "./reports";
// Built-in PDF fonts avoid dependencies. WinAnsi text stays searchable; unsupported
// scripts fall back to the existing canvas renderer instead of losing characters.
const extra:Record<string,number>={"€":128,"‚":130,"ƒ":131,"„":132,"…":133,"†":134,"‡":135,"ˆ":136,"‰":137,"Š":138,"‹":139,"Œ":140,"Ž":142,"‘":145,"’":146,"“":147,"”":148,"•":149,"–":150,"—":151,"˜":152,"™":153,"š":154,"›":155,"œ":156,"ž":158,"Ÿ":159};
function bytes(text:string):number[]|null{const out:number[]=[];for(const c of text){const n=c.charCodeAt(0);if(extra[c]!==undefined)out.push(extra[c]);else if(n>=32&&n<=126||n>=160&&n<=255)out.push(n);else if(c==="\n"||c==="\r"||c==="\t")out.push(32);else return null;}return out;}
export function textReportPdf(report:Report):Blob|null{
    const lines:{text:string;heading:boolean}[]=[];
    const add=(text:string,heading=false)=>{const limit=heading?67:89;for(const paragraph of text.split(/\r?\n/)){let rest=paragraph;while(rest.length>limit){let cut=rest.lastIndexOf(" ",limit);if(cut<limit/2)cut=limit;lines.push({text:rest.slice(0,cut),heading});rest=rest.slice(cut).trimStart();}lines.push({text:rest,heading});}};
    add(report.title,true);add(`Report ID: ${report.id}`);add(`Generated at: ${report.generatedAt}`);add("SERVER RECORDS — No real financial transactions.");
    for(const section of report.sections){add("");add(section.title,true);if(!section.rows.length)add("No data is available for this section.");for(const row of section.rows){row.forEach((value,i)=>add(`${section.columns[i]}: ${value}`));add("");}}
    if(lines.some(l=>bytes(l.text)===null))return null;
    const pages:string[]=[];let content="",y=776;
    const hex=(text:string)=>bytes(text)!.map(n=>n.toString(16).padStart(2,"0")).join("");
    const line=(text:string,bold=false,size=9)=>{content+=`BT /${bold?"F2":"F1"} ${size} Tf ${bold?"0.23 0.16 0.55":"0.16 0.21 0.3"} rg 1 0 0 1 45 ${y} Tm <${hex(text)}> Tj ET\n`;y-=bold?20:13;};
    const start=()=>{content="";y=792;line("AutoNegotiater | SERVER RECORDS",true,11);y-=10;};
    const save=()=>{content+=`BT /F1 8 Tf 0.4 0.45 0.55 rg 1 0 0 1 45 30 Tm <${hex(`Page ${pages.length+1} — SERVER RECORDS`)}> Tj ET\n`;pages.push(content);};
    start();for(const l of lines){if(y<(l.heading?80:55)){save();start();}line(l.text,l.heading,l.heading?12:9);}save();
    const objects:string[]=["<< /Type /Catalog /Pages 2 0 R >>",`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${5+i*2} 0 R`).join(" ")}] >>`,`<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>`,`<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>`];
    pages.forEach((stream,i)=>{objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6+i*2} 0 R >>`);objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);});
    let result="%PDF-1.4\n",offsets=[0];objects.forEach((body,i)=>{offsets.push(result.length);result+=`${i+1} 0 obj\n${body}\nendobj\n`;});const xref=result.length;result+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,"0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([result],{type:"application/pdf"});
}
