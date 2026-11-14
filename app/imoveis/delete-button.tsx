"use client";
import { useState } from "react";
import { deleteProperty } from "@/lib/properties";
export function DeletePropertyButton({id,title}:{id:string;title:string}) {
  const [busy,setBusy]=useState(false);
  async function remove() {
    if(!window.confirm(`Excluir o imóvel “${title}”? Esta ação não pode ser desfeita.`)) return;
    setBusy(true);
    const result=await deleteProperty(id);
    if(!result.ok) { window.alert(result.error); setBusy(false); return; }
    window.location.reload();
  }
  return <button type="button" disabled={busy} onClick={()=>void remove()} className="text-sm text-red-700 hover:underline disabled:opacity-50">{busy?"Excluindo...":"Excluir"}</button>;
}

