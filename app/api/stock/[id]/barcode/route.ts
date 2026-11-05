import { NextRequest } from "next/server";
import bwipjs from "bwip-js/node";
import { requireModuleAccess } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireModuleAccess("stock");
  if (denied) return denied;
  const { id } = await params;
  const item = await prisma.stockItem.findUnique({ where: { id }, include: { variants: true } });
  if (!item) return Response.json({ error: "Stock item not found" }, { status: 404 });
  const variantId = request.nextUrl.searchParams.get("variantId");
  const variant = variantId ? item.variants.find((entry) => entry.id === variantId) : null;
  if (variantId && !variant) return Response.json({ error: "Variant not found" }, { status: 404 });
  const sku = variant?.sku ?? item.sku ?? item.code;
  const svg = bwipjs.toSVG({ bcid: "code128", text: sku, scale: 3, height: 12, includetext: true, textxalign: "center", paddingwidth: 10, paddingheight: 4, backgroundcolor: "FFFFFF" })
    .replace(/(<svg[^>]*>)/, `$1<title>${escapeHtml(sku)}</title>`);
  if (request.nextUrl.searchParams.get("print") !== "1") {
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml", "Cache-Control": "private, no-store" } });
  }
  const name = escapeHtml([item.name, variant?.size, variant?.color].filter(Boolean).join(" / "));
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Garments — Barcode labels</title>
  <style>body{font-family:Arial,sans-serif;color:#0a1628;margin:24px}header{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-bottom:24px}input,button{font:inherit;padding:8px}#labels{display:flex;flex-wrap:wrap;gap:8mm}.label{width:max-content;max-width:100%;text-align:center;break-inside:avoid;padding:3mm;border:1px dashed #999}.label svg{display:block;height:22mm;max-width:100%;width:auto;margin:auto}.name{font-size:11px;margin:4px;max-width:90mm;overflow-wrap:anywhere}@media print{header{display:none}body{margin:0}.label{border:0}#labels{gap:4mm}}</style></head>
  <body><header><strong>Garments · Barcode labels</strong><label>Labels <input id="copies" type="number" min="1" max="500" step="1" value="1"></label><button id="print">Print labels</button></header>
  <template id="label"><div class="label"><div class="name">${name}</div>${svg}</div></template><main id="labels"></main>
  <script>const copies=document.getElementById('copies'),labels=document.getElementById('labels'),template=document.getElementById('label');function render(){labels.replaceChildren();const count=Number(copies.value);if(!Number.isInteger(count)||count<1||count>500)return;for(let i=0;i<count;i++)labels.append(template.content.cloneNode(true));}copies.addEventListener('input',render);document.getElementById('print').addEventListener('click',()=>{if(copies.reportValidity())window.print()});render();</script></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}
