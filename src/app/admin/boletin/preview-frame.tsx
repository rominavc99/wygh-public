"use client";

import { useState } from "react";

export function PreviewFrame({ html }: { html: string }) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setDevice("desktop")}
          className={device === "desktop" ? "xp-btn" : "xp-btn-secondary"}
        >
          🖥️ Escritorio
        </button>
        <button
          type="button"
          onClick={() => setDevice("mobile")}
          className={device === "mobile" ? "xp-btn" : "xp-btn-secondary"}
        >
          📟 Móvil
        </button>
      </div>
      <p className="text-xs text-ink-faint">
        El correo se fuerza a verse siempre así (modo claro), sin importar el modo
        oscuro del dispositivo o del cliente de correo.
      </p>
      <div className="overflow-auto rounded-xl border border-panel-edge bg-panel-2 p-4">
        <iframe
          title="Vista previa del boletín"
          srcDoc={html}
          className="mx-auto h-[600px] border-0"
          style={{ width: device === "mobile" ? 375 : 640 }}
        />
      </div>
    </div>
  );
}
